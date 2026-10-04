/** Orthographic plan photographs of the exact same measured preview bodies as
 * the 3D editor. This module is loaded only when a supported item is placed. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Product } from '../../data/products.schema';
import { canRenderPlanModel, planModelKey, planModelRasterSize, planModelSolid, planPhotoLightBalance } from '../../designer/planModel';
import { furniturePreview, disposeFurnitureTextures } from '../../components/three/furniturePreview';
import { solarPanelPreview } from '../../components/three/solarPanelPreview';
import { waterTankPreview } from '../../components/three/waterTankPreview';
import { applyProductSurfaceLighting } from '../../components/three/productSurfaceLighting';
import { presentationProfile } from '../../components/three/renderPresentation';

const cache = new Map<string, Promise<HTMLCanvasElement | null>>();
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

export function planModelSnapshot(product: Product): Promise<HTMLCanvasElement | null> {
  if (!canRenderPlanModel(product)) return Promise.resolve(null);
  const key = planModelKey(product);
  const cached = cache.get(key);
  if (cached) return cached;
  clearTimeout(disposeTimer);
  // Yield between models so a furnished home does not block a phone's input.
  const pending = queue.then(() => new Promise<void>(resolve => setTimeout(resolve, 0))).then(() => {
    try { return photograph(product); } catch { return null; }
    finally {
      clearTimeout(disposeTimer);
      // Bitmaps remain cached; the temporary WebGL context is released once
      // the initial photographs finish, well before another editing session.
      disposeTimer = setTimeout(releaseStudio, 5000);
    }
  });
  queue = pending;
  cache.set(key, pending);
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return pending;
}
