/**
 * The engine's browser side. Served by the Vite dev server (any file under the project root is),
 * so it imports the SAME modules the app runs: `bodyObject` + `fitToSize` for the fit, the
 * architectural light rig for the plan photograph. What this measures is what a customer gets.
 * Node drives it through `page.evaluate` (scripts/product-engine/lib/browser.mjs). Nothing here
 * is bundled into the app.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bodyObject, bodyTemplate } from '../../../src/components/three/productBody';
import { presentationProfile } from '../../../src/components/three/renderPresentation';
import { applyProductSurfaceLighting } from '../../../src/components/three/productSurfaceLighting';
import { planPhotoLightBalance } from '../../../src/designer/planModel';

const draco = new DRACOLoader().setDecoderPath('/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

let renderer = null;
let environment = null;
function studio() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      environment = pmrem.fromScene(room, 0.04);
    } finally {
      pmrem.dispose();
      room.dispose();
    }
  }
  return renderer;
}

async function loadGlb(url) {
  const bust = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
  return loader.loadAsync(bust);
}

function itemFor(product, model) {
  const L = product.dimensions_cm.length / 100;
  const W = product.dimensions_cm.width / 100;
  const H = product.dimensions_cm.height / 100;
  return {
    key: product.id, instanceId: product.id, productId: product.id,
    x0: 0, y0: 0, x1: L, y1: W, z0: 0, z1: H, rotationDeg: 0,
    lengthM: L, widthM: W, heightM: H,
    frontEdge: product.front_edge, modelFront: model.modelFront, modelUp: model.modelUp, lengthAxis: model.lengthAxis,
    hex: '#ffffff',
  };
}

function triangleCount(geometry) {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  if (!position) return 0;
  return Math.round((index ? index.count : position.count) / 3);
}

/** Triangles, materials and whether every texture actually decoded. */
function stats(root) {
  let triangles = 0;
  const materials = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    triangles += triangleCount(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  let texturesTotal = 0;
  let texturesLoaded = 0;
  let baseColorMaps = 0;
  for (const m of materials) {
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
      const t = m[key];
      if (!t) continue;
      texturesTotal++;
      const img = t.image;
      const w = img?.width ?? img?.videoWidth ?? 0;
      if (w > 0) texturesLoaded++;
      if (key === 'map') baseColorMaps++;
    }
  }
  return { triangles, materials: materials.size, texturesTotal, texturesLoaded, baseColorMaps };
}

function disposeTree(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose?.();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) m[key]?.dispose?.();
      m.dispose?.();
    }
  });
}

function withLights(scene, lights, fn) {
  for (const l of lights) scene.add(l);
  try {
    return fn();
  } finally {
    for (const l of lights) {
      scene.remove(l);
      l.shadow?.map?.dispose?.();
      l.dispose?.();
    }
  }
}

/** Render at 2× and draw down to the final size: thin frames and cells stay crisp. */
function snapshot(r, scene, camera, width, height, { supersample = 2 } = {}) {
  r.setSize(width * supersample, height * supersample, false);
  r.render(scene, camera);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(r.domElement, 0, 0, width, height);
  return canvas;
}

function alphaCoverage(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, opaqueFraction: 0 };
  return { x: (maxX - minX + 1) / width, y: (maxY - minY + 1) / height, opaqueFraction: opaque / (width * height) };
}

/** The plan photograph: straight down, the exact L × W frame, the plan's own architectural rig (as modelSnapshot does it). */
function renderPlan(r, scene, body, item, longPx) {
  const largest = Math.max(item.lengthM, item.widthM);
  const width = Math.max(8, Math.round((longPx * item.lengthM) / largest));
  const height = Math.max(8, Math.round((longPx * item.widthM) / largest));
  const centre = new THREE.Vector3(item.lengthM / 2, 0, item.widthM / 2);
  const camera = new THREE.OrthographicCamera(-item.lengthM / 2, item.lengthM / 2, item.widthM / 2, -item.widthM / 2, 0.01, Math.max(100, item.heightM * 5));
  camera.position.set(centre.x, Math.max(12, item.heightM * 3), centre.z);
  camera.up.set(0, 0, -1);
  camera.lookAt(centre);
  const profile = presentationProfile('architectural');
  const light = planPhotoLightBalance(profile.day, profile.sunDirection);
  const hemi = new THREE.HemisphereLight(profile.sky, profile.bounce, Math.PI * light.hemi);
  const sun = new THREE.DirectionalLight(profile.sun, Math.PI * light.sun);
  const sunHeight = item.heightM + 7;
  sun.position.set(centre.x + profile.sunDirection[0] * sunHeight, sunHeight, centre.z + profile.sunDirection[2] * sunHeight);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  const extent = Math.hypot(item.lengthM, item.widthM, item.heightM) * 0.5 + 0.12;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: 50 });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0001;
  sun.shadow.normalBias = 0.0015;
  const fill = new THREE.DirectionalLight(profile.fill, Math.PI * profile.day.fill);
  fill.position.set(centre.x + 5, item.heightM + 8, centre.z + 3);
  fill.target.position.copy(centre);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NoToneMapping;
  r.toneMappingExposure = 1;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.setClearColor(0xffffff, 0);
  scene.environment = null;
  applyProductSurfaceLighting(body, environment?.texture ?? null, r.capabilities.getMaxAnisotropy());
  return withLights(scene, [hemi, sun, sun.target, fill, fill.target], () => {
    const canvas = snapshot(r, scene, camera, width, height);
    return { png: canvas.toDataURL('image/png'), width, height, coverage: alphaCoverage(canvas) };
  });
}

/** Studio light, transparent background, three-quarter view: the catalogue picture (the rig of bake-catalog-thumbnails-2026-10-22). */
const CATALOGUE_RIG = { version: 2, camera: [1.25, 0.9, 1.6], exposure: 1, key: 2.7, fill: 1.5, hemi: 1.1, environment: 0.65, margin: 1.16 };
function studioLights(centre) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#c7c0ad', CATALOGUE_RIG.hemi);
  const key = new THREE.DirectionalLight('#fff4e8', CATALOGUE_RIG.key);
  key.position.copy(centre).add(new THREE.Vector3(-4, 7, 5));
  key.target.position.copy(centre);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const fill = new THREE.DirectionalLight('#eaf2ff', CATALOGUE_RIG.fill);
  fill.position.copy(centre).add(new THREE.Vector3(5, 3, -3));
  fill.target.position.copy(centre);
  return [hemi, key, key.target, fill, fill.target];
}
function studioSetup(r, scene) {
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = CATALOGUE_RIG.exposure;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.setClearColor(0xffffff, 0);
  scene.environment = environment?.texture ?? null;
  scene.environmentIntensity = CATALOGUE_RIG.environment;
}

function renderCatalogue(r, scene, body, size) {
  const bounds = new THREE.Box3().setFromObject(body, true);
  const centre = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length();
  const camera = new THREE.OrthographicCamera(-radius / 2, radius / 2, radius / 2, -radius / 2, 0.01, radius * 10 + 50);
  camera.position.copy(centre).addScaledVector(new THREE.Vector3(...CATALOGUE_RIG.camera).normalize(), radius * 3 + 10);
  camera.lookAt(centre);
  camera.updateMatrixWorld(true);
  const points = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  const extent = Math.max(...points.map((p) => Math.abs(p.x)), ...points.map((p) => Math.abs(p.y))) * CATALOGUE_RIG.margin;
  Object.assign(camera, { left: -extent, right: extent, top: extent, bottom: -extent });
  camera.updateProjectionMatrix();
  studioSetup(r, scene);
  return withLights(scene, studioLights(centre), () => snapshot(r, scene, camera, size, size).toDataURL('image/png'));
}

/** Straight at the catalogue front (plan +y = three +z after the fit). */
function renderFront(r, scene, body, item, size) {
  const bounds = new THREE.Box3().setFromObject(body, true);
  const centre = bounds.getCenter(new THREE.Vector3());
  const fov = 35;
  const span = Math.max(item.lengthM, item.heightM) * 1.25;
  const dist = span / (2 * Math.tan((fov * Math.PI) / 360)) + item.widthM / 2;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 200);
  camera.position.set(centre.x, Math.max(0.3, item.heightM * 0.55), centre.z + dist);
  camera.lookAt(centre.x, item.heightM * 0.45, centre.z);
  studioSetup(r, scene);
  return withLights(scene, studioLights(centre), () => snapshot(r, scene, camera, size, size).toDataURL('image/png'));
}

/** How a walker sees it: a 60° camera at 1.65 m, 2.2 m in front, on a plain floor. An engine render, not Walk mode itself. */
function renderEye(r, scene, body, item, width, height) {
  const bounds = new THREE.Box3().setFromObject(body, true);
  const centre = bounds.getCenter(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.05, 200);
  camera.position.set(centre.x, 1.65, bounds.max.z + 2.2);
  camera.lookAt(centre.x, Math.min(1.2, Math.max(0.4, item.heightM * 0.6)), centre.z);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centre.x, -0.001, centre.z);
  floor.receiveShadow = true;
  studioSetup(r, scene);
  r.setClearColor(0xeef1f4, 1);
  try {
    return withLights(scene, [...studioLights(centre), floor], () => snapshot(r, scene, camera, width, height).toDataURL('image/png'));
  } finally {
    floor.geometry.dispose();
    floor.material.dispose();
    r.setClearColor(0xffffff, 0);
  }
}

/**
 * One product, one body: load it as the stage would, fit it as the stage does, measure the
 * fitted envelope, floor and pivot, check the textures, load the phone copy, and photograph it
 * for the plan, the catalogue, the front view and an eye-level view.
 */
export async function measureProduct({ product, model, servedUrl, phoneUrl, planLongPx = 1024, catalogueSize = 512, viewSize = 512 }) {
  const r = studio();
  const out = { id: product.id, servedUrl, phoneUrl, errors: [] };
  let gltf;
  try {
    gltf = await loadGlb(servedUrl);
  } catch (e) {
    out.errors.push(`served copy failed to load: ${String(e)}`);
    return out;
  }
  const item = itemFor(product, model);
  let template;
  let body;
  try {
    template = bodyTemplate(gltf.scene);
    body = bodyObject(item, template);
  } catch (e) {
    out.errors.push(`fit failed: ${String(e)}`);
    disposeTree(gltf.scene);
    return out;
  }
  body.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(body, true);
  const size = box.getSize(new THREE.Vector3());
  out.envelope = {
    lengthCm: size.x * 100, widthCm: size.z * 100, heightCm: size.y * 100,
    errCm: {
      length: Math.abs(size.x * 100 - product.dimensions_cm.length),
      width: Math.abs(size.z * 100 - product.dimensions_cm.width),
      height: Math.abs(size.y * 100 - product.dimensions_cm.height),
    },
  };
  out.floorM = box.min.y;
  out.pivotOffsetM = { x: (box.min.x + box.max.x) / 2 - item.lengthM / 2, z: (box.min.z + box.max.z) / 2 - item.widthM / 2 };
  out.served = stats(template.scene);
  if (phoneUrl) {
    try {
      const phone = await loadGlb(phoneUrl);
      out.phone = { ok: true, ...stats(phone.scene) };
      disposeTree(phone.scene);
    } catch (e) {
      out.phone = { ok: false, error: String(e) };
    }
  }
  const scene = new THREE.Scene();
  scene.add(body);
  try {
    out.plan = renderPlan(r, scene, body, item, planLongPx);
    out.catalogue = renderCatalogue(r, scene, body, catalogueSize);
    out.front = renderFront(r, scene, body, item, viewSize);
    out.eye = renderEye(r, scene, body, item, 640, 400);
  } catch (e) {
    out.errors.push(`render failed: ${String(e)}`);
  } finally {
    scene.remove(body);
    disposeTree(body);
    disposeTree(template.scene);
  }
  return out;
}

/**
 * A walk character: bind-pose height, triangles, textures, clips, and pictures: the 64 px chooser
 * thumbnail (head and shoulders), a full-body front view, and one frame of each clip.
 */
export async function measureCharacter({ url, clips, heightM = 1.7, thumbSize = 64 }) {
  const r = studio();
  const out = { url, errors: [] };
  let gltf;
  try {
    gltf = await loadGlb(url);
  } catch (e) {
    out.errors.push(`failed to load: ${String(e)}`);
    return out;
  }
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const bindHeight = box.max.y - box.min.y;
  const scale = heightM / Math.max(0.1, bindHeight);
  gltf.scene.scale.setScalar(scale);
  gltf.scene.position.y = -box.min.y * scale;
  out.bindHeightM = bindHeight;
  out.footprint = { x: (box.max.x - box.min.x) * scale, z: (box.max.z - box.min.z) * scale };
  out.stats = stats(gltf.scene);
  out.clips = gltf.animations.map((a) => ({ name: a.name, duration: a.duration, tracks: a.tracks.length }));
  const scene = new THREE.Scene();
  scene.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const centre = new THREE.Vector3(0, heightM / 2, 0);
  const shoot = (fov, aspect, pos, look, width, height) => {
    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.01, 50);
    camera.position.copy(pos);
    camera.lookAt(look);
    studioSetup(r, scene);
    return withLights(scene, studioLights(centre), () => snapshot(r, scene, camera, width, height).toDataURL('image/png'));
  };
  try {
    out.frames = {};
    for (const [key, clipName] of Object.entries(clips ?? {})) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
      if (!clip) {
        out.frames[key] = null;
        out.errors.push(`missing clip ${key} (${clipName})`);
        continue;
      }
      mixer.stopAllAction();
      mixer.clipAction(clip).reset().play();
      mixer.setTime(Math.min(0.3, clip.duration * 0.4));
      gltf.scene.updateMatrixWorld(true);
      out.frames[key] = shoot(40, 0.5, new THREE.Vector3(0.9, heightM * 0.55, 3.0), new THREE.Vector3(0, heightM * 0.5, 0), 256, 512);
    }
    mixer.stopAllAction();
    const idle = THREE.AnimationClip.findByName(gltf.animations, clips?.idle ?? 'idle');
    if (idle) {
      mixer.clipAction(idle).reset().play();
      mixer.setTime(0.2);
      gltf.scene.updateMatrixWorld(true);
    }
    out.full = shoot(40, 0.5, new THREE.Vector3(0, heightM * 0.55, 3.2), new THREE.Vector3(0, heightM * 0.5, 0), 256, 512);
    // Head and shoulders for the chooser: the top 30 % of the body, seen from the front.
    out.thumbnail = shoot(30, 1, new THREE.Vector3(0, heightM * 0.86, 1.05), new THREE.Vector3(0, heightM * 0.84, 0), thumbSize, thumbSize);
    out.thumbnailLarge = shoot(30, 1, new THREE.Vector3(0, heightM * 0.86, 1.05), new THREE.Vector3(0, heightM * 0.84, 0), 256, 256);
  } catch (e) {
    out.errors.push(`render failed: ${String(e)}`);
  } finally {
    mixer.stopAllAction();
    scene.remove(gltf.scene);
    disposeTree(gltf.scene);
  }
  return out;
}
