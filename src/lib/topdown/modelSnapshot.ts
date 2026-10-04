/** Orthographic plan photographs of the exact same measured preview bodies as
 * the 3D editor. This module is loaded only when a supported item is placed. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Product } from '../../data/products.schema';
import { canRenderPlanModel, planModelKey, planModelRasterSize, planModelSolid, planPhotoLightBalance, planModelShadowFrame, planModelShadowKey, type PlanShadowDirection, type PlanShadowFrame } from '../../designer/planModel';
import { furniturePreview, disposeFurnitureTextures } from '../../components/three/furniturePreview';
import { solarPanelPreview } from '../../components/three/solarPanelPreview';
import { waterTankPreview } from '../../components/three/waterTankPreview';
import { applyProductSurfaceLighting } from '../../components/three/productSurfaceLighting';
import { presentationProfile } from '../../components/three/renderPresentation';

const cache = new Map<string, Promise<HTMLCanvasElement | null>>();
export interface PlanModelShadow extends PlanShadowFrame { image: HTMLCanvasElement }
const shadowCache = new Map<string, Promise<PlanModelShadow | null>>();
let renderer: THREE.WebGLRenderer | null = null;
let environment: THREE.WebGLRenderTarget | null = null;
let disposeTimer: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<unknown> = Promise.resolve();

function studio(): THREE.WebGLRenderer {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  try { environment = generator.fromScene(room, 0.04); } finally { generator.dispose(); room.dispose(); }
  return renderer;
}

function releaseStudio(): void {
  environment?.dispose(); environment = null;
  renderer?.dispose(); renderer?.forceContextLoss(); renderer = null;
}

function disposeBody(root: THREE.Object3D): void {
  disposeFurnitureTextures(root);
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  materials.forEach(material => material.dispose());
}

function photograph(product: Product): HTMLCanvasElement | null {
  const item = planModelSolid(product);
  const body = solarPanelPreview(item) ?? waterTankPreview(item) ?? furniturePreview(item);
  if (!body) return null;
  let sun: THREE.DirectionalLight | null = null;
  try {
    const render = studio();
    const size = planModelRasterSize(item.lengthM, item.widthM);
    // Render above final resolution: thin chair frames, cloth seams and PV
    // cells remain crisp when the final bitmap is rotated on the plan.
    render.setSize(size.width * 2, size.height * 2, false);
    const scene = new THREE.Scene();
    scene.add(body);
    // Plan y grows south. Setting camera up to north (-z) prevents the
    // front edge flipping when a user changes from Plan to 3D.
    const camera = new THREE.OrthographicCamera(-item.lengthM / 2, item.lengthM / 2, item.widthM / 2, -item.widthM / 2, 0.01, Math.max(100, item.heightM * 5));
    const centre = new THREE.Vector3(item.lengthM / 2, 0, item.widthM / 2);
    camera.position.set(centre.x, Math.max(12, item.heightM * 3), centre.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(centre);
    const profile = presentationProfile('architectural');
    const light = planPhotoLightBalance(profile.day, profile.sunDirection);
    scene.add(new THREE.HemisphereLight(profile.sky, profile.bounce, Math.PI * light.hemi));
    sun = new THREE.DirectionalLight(profile.sun, Math.PI * light.sun);
    const sunHeight = item.heightM + 7;
    sun.position.set(centre.x + profile.sunDirection[0] * sunHeight, sunHeight, centre.z + profile.sunDirection[2] * sunHeight);
    sun.target.position.copy(centre);
    sun.castShadow = true;
    const extent = Math.hypot(item.lengthM, item.widthM, item.heightM) * 0.5 + 0.12;
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: 50 });
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.0015;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(profile.fill, Math.PI * profile.day.fill);
    fill.position.set(centre.x + 5, item.heightM + 8, centre.z + 3);
    fill.target.position.copy(centre);
    scene.add(fill, fill.target);
    applyProductSurfaceLighting(body, environment?.texture ?? null, render.capabilities.getMaxAnisotropy());
    render.render(scene, camera);
    const result = document.createElement('canvas');
    result.width = size.width; result.height = size.height;
    const context = result.getContext('2d');
    if (!context) return null;
    context.drawImage(render.domElement, 0, 0, size.width, size.height);
    return result;
  } finally {
    sun?.shadow.map?.dispose();
    disposeBody(body);
  }
}

/** Photograph the actual model's cast shadow on a transparent receiver. The
 * receiver is display-only, never returned as an item, and is clipped to the
 * owning room by Konva. Rotating a product rotates its body but not the sun. */
function photographShadow(product: Product, rotationDeg: number, direction: PlanShadowDirection): PlanModelShadow | null {
  const item = planModelSolid(product);
  const body = solarPanelPreview(item) ?? waterTankPreview(item) ?? furniturePreview(item);
  if (!body) return null;
  const frame = planModelShadowFrame(product, rotationDeg, direction);
  const scene = new THREE.Scene();
  const oriented = new THREE.Group();
  oriented.position.set(frame.itemWidthM / 2, 0, frame.itemDepthM / 2);
  oriented.rotation.y = -rotationDeg * Math.PI / 180;
  body.position.x -= item.lengthM / 2; body.position.z -= item.widthM / 2;
  oriented.add(body); scene.add(oriented);
  body.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.colorWrite = false;
  });
  const receiver = new THREE.Mesh(new THREE.PlaneGeometry(frame.widthM, frame.depthM), new THREE.ShadowMaterial({ opacity: 0.38, color: '#273028' }));
  receiver.rotation.x = -Math.PI / 2;
  receiver.position.set(frame.xM + frame.widthM / 2, -0.002, frame.yM + frame.depthM / 2);
  receiver.receiveShadow = true; scene.add(receiver);
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  const centre = new THREE.Vector3(frame.itemWidthM / 2, item.heightM / 2, frame.itemDepthM / 2);
  const radius = Math.hypot(frame.widthM, frame.depthM, item.heightM) / 2 + 0.2;
  sun.position.copy(centre).addScaledVector(new THREE.Vector3(-direction.x, 1, -direction.y).normalize(), radius * 3 + 10);
  sun.target.position.copy(centre); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 0.1, far: radius * 7 + 30 });
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0001; sun.shadow.normalBias = 0.001;
  sun.shadow.radius = 2.5; scene.add(sun, sun.target);
  try {
    const render = studio();
    const size = planModelRasterSize(frame.widthM, frame.depthM);
    render.setSize(size.width, size.height, false);
    const camera = new THREE.OrthographicCamera(-frame.widthM / 2, frame.widthM / 2, frame.depthM / 2, -frame.depthM / 2, 0.01, item.heightM * 4 + 100);
    camera.position.set(receiver.position.x, Math.max(12, item.heightM * 3), receiver.position.z);
    camera.up.set(0, 0, -1); camera.lookAt(receiver.position.x, 0, receiver.position.z);
    render.render(scene, camera);
    const image = document.createElement('canvas'); image.width = size.width; image.height = size.height;
    const context = image.getContext('2d');
    if (!context) return null;
    context.drawImage(render.domElement, 0, 0, size.width, size.height);
    return { ...frame, image };
  } finally {
    receiver.geometry.dispose(); receiver.material.dispose(); sun.shadow.map?.dispose(); disposeBody(body);
  }
}

function enqueuePhotograph<T>(render: () => T): Promise<T | null> {
  clearTimeout(disposeTimer);
  const pending = queue.then(() => new Promise<void>(resolve => setTimeout(resolve, 0))).then(() => {
    try { return render(); } catch { return null; }
    finally { clearTimeout(disposeTimer); disposeTimer = setTimeout(releaseStudio, 5000); }
  });
  queue = pending;
  return pending;
}

export function planModelSnapshot(product: Product): Promise<HTMLCanvasElement | null> {
  if (!canRenderPlanModel(product)) return Promise.resolve(null);
  const key = planModelKey(product);
  const cached = cache.get(key);
  if (cached) return cached;
  // Yield between models so a furnished home does not block a phone's input.
  const pending = enqueuePhotograph(() => photograph(product));
  cache.set(key, pending);
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return pending;
}

export function planModelShadowSnapshot(product: Product, rotationDeg: number, direction: PlanShadowDirection): Promise<PlanModelShadow | null> {
  if (!canRenderPlanModel(product) || ![rotationDeg, direction.x, direction.y].every(Number.isFinite)) return Promise.resolve(null);
  const key = planModelShadowKey(product, rotationDeg, direction);
  const cached = shadowCache.get(key);
  if (cached) return cached;
  const pending = enqueuePhotograph(() => photographShadow(product, rotationDeg, direction));
  shadowCache.set(key, pending);
  if (shadowCache.size > 64) shadowCache.delete(shadowCache.keys().next().value!);
  return pending;
}
