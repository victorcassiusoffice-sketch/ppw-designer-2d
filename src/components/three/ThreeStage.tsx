/**
 * ThreeStage — the WebGL renderer behind the 3D MODE (2026-09-17).
 *
 * Draws `SceneSolids` (designer/roomSolids.ts) with three.js: wall slabs
 * with real thickness and their doors and windows cut through, floor slabs,
 * furniture bodies, a sun with soft shadows and a sky/ground fill. The Sims
 * cutaway is a per-camera VISIBILITY toggle between a wall's full and stub
 * meshes — orbiting never rebuilds geometry.
 *
 * This module is loaded LAZILY (its own `vendor-three` chunk) the first time
 * a 3D view opens, so the 2D designer's first paint does not carry three.
 * Its parent (`RoomView3D`) owns the camera state, the gestures and the
 * store reads; this file owns nothing but the GL scene and answers three
 * questions for the parent: what wall is under a point, where a wall is on
 * screen (the e2e bridge), and what is drawn.
 *
 * Frame mapping: the plan is x east, y south, z up. three is y-up, so
 * plan (x, y, z) → three (x, z, y). Right-handed either way (verified: the
 * camera south of a room looking north has east on its right).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { cameraPosition, GLASS_HEX, GROUND_HEX, HOVER_HEX, type OrbitCamera, type WallHit } from '../../designer/roomView3d';
import { cutawayState, wallAnchor, type ItemSolid, type SceneSolids, type WallShow, type WallSolid } from '../../designer/roomSolids';
import { fitToSize, itemPose } from '../../designer/fitToSize';

// ---------------------------------------------------------------------------
// Product bodies (2026-09-17): a textured glTF per product, fetched once and
// cloned per placed item, fitted EXACTLY to the catalog's dimensions by
// `fitToSize`. Until it arrives (or if it cannot), the shaded box stands in.
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
gltfLoader.setDRACOLoader(dracoLoader);

interface BodyTemplate {
  scene: THREE.Group;
  bbox: THREE.Box3;
}
const bodyCache = new Map<string, Promise<BodyTemplate>>();

function loadBody(url: string): Promise<BodyTemplate> {
  let p = bodyCache.get(url);
  if (!p) {
    p = gltfLoader.loadAsync(url).then((gltf) => {
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return { scene, bbox: new THREE.Box3().setFromObject(scene) };
    });
    p.catch(() => bodyCache.delete(url));
    bodyCache.set(url, p);
  }
  return p;
}

/** The body for one placed item: fitted to its catalog box, posed on the plan. */
function bodyObject(it: ItemSolid, tpl: BodyTemplate): THREE.Group {
  const fit = fitToSize({
    bbox: tpl.bbox,
    lengthCm: it.lengthM * 100,
    widthCm: it.widthM * 100,
    heightCm: it.heightM * 100,
    frontEdge: it.frontEdge,
    modelFront: it.modelFront,
    lengthAxis: it.lengthAxis,
  });
  const inner = tpl.scene.clone(true);
  // Own materials per placed item: a shared material would tint every copy
  // of the product when one is selected or hovered.
  inner.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : (m.material as THREE.Material).clone();
  });
  inner.scale.set(fit.scale.x, fit.scale.y, fit.scale.z);
  inner.rotation.set(0, fit.yawRad, 0);
  inner.position.set(fit.offset.x, fit.offset.y, fit.offset.z);
  const pose = itemPose({ x: it.x0, y: it.y0, footprintW: it.x1 - it.x0, footprintH: it.y1 - it.y0, rotationDeg: it.rotationDeg, z0: it.z0 });
  const holder = new THREE.Group();
  holder.position.set(pose.centre.x, pose.centre.z, pose.centre.y);
  holder.rotation.set(0, pose.yawRad, 0);
  holder.add(inner);
  holder.userData = { key: it.key, instanceId: it.instanceId, body: true };
  return holder;
}

export interface ThreeStageHandle {
  /** Wall under a canvas-local point, or null. */
  hitTest(x: number, y: number): WallHit | null;
  /** Canvas-local point at the middle of a wall's shown face — the e2e bridge aims here. */
  screenPoint(hit: WallHit): { x: number; y: number } | null;
  faceCount(): number;
  faces(): Array<{ key: string; holes: number }>;
  /** DEV bridge: what the stage has done so far. */
  debug(): { frames: number; children: number; camera: number[]; target: number[]; renderer: string };
  /** The placed item under a canvas-local point (its body or its box), or null. */
  hitItem(x: number, y: number): { instanceId: string } | null;
  /** Where a canvas-local point meets the floor plane, in PLAN metres, or null when it looks at the sky. */
  floorPoint(x: number, y: number): { x: number; y: number } | null;
  /** A PLAN point (x, y on the plan, z up) on the canvas, or null when it is behind the camera. */
  projectPoint(x: number, y: number, z: number): { x: number; y: number } | null;
  /** Slide an item's body by a plan-metre delta while a drag is in progress (no store write). */
  moveItemPreview(instanceId: string, dxM: number, dyM: number): void;
  /** Put a previewed body back where the plan has it. */
  resetItemPreview(instanceId: string): void;
}

export interface ThreeStageProps {
  solids: SceneSolids;
  camera: OrbitCamera;
  width: number;
  height: number;
  hover: WallHit | null;
  /** The plan's selection — tinted so 2D and 3D agree on what is picked. */
  selectedInstanceId?: string | null;
  /** WebGL could not start (headless without GL, an old device) — the parent falls back to the painter. */
  onFailed?: () => void;
}

const SKY_HEX = '#EEEAE2';
/** Wall tops, ends and the reveals of openings — a shade under plaster so edges read. */
const REVEAL_HEX = '#D7D1C4';
const ITEM_ROUGHNESS = 0.72;

const toThree = (p: { x: number; y: number; z: number }): THREE.Vector3 => new THREE.Vector3(p.x, p.z, p.y);

interface WallEntry {
  solid: WallSolid;
  group: THREE.Group;
  full: THREE.Object3D;
  stub: THREE.Object3D;
  paint: THREE.MeshStandardMaterial;
  show: WallShow;
}

function sameHit(a: WallHit | null | undefined, b: WallHit): boolean {
  if (!a) return false;
  if (a.kind !== b.kind) return false;
  return a.kind === 'edge' ? a.roomId === b.roomId && a.edgeIndex === b.edgeIndex : a.wallId === b.wallId;
}

/** A wall slab as an extruded shape with its openings as holes, in the wall's local frame (u along, v up, w outward-in). */
function slabObject(w: WallSolid, heightM: number, paint: THREE.Material, reveal: THREE.Material): THREE.Object3D {
  const node = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w.lengthM, 0);
  shape.lineTo(w.lengthM, heightM);
  shape.lineTo(0, heightM);
  shape.closePath();
  const openings = w.openings.filter((o) => o.bottomM < heightM);
  for (const o of openings) {
    const top = Math.min(o.topM, heightM);
    const hole = new THREE.Path();
    hole.moveTo(o.t0M, o.bottomM);
    hole.lineTo(o.t1M, o.bottomM);
    hole.lineTo(o.t1M, top);
    hole.lineTo(o.t0M, top);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w.thicknessM, bevelEnabled: false });
  const slab = new THREE.Mesh(geo, [paint, reveal]);
  slab.castShadow = true;
  slab.receiveShadow = true;
  slab.userData = { hit: w.hit, key: w.key, holes: openings.length, wall: true };
  node.add(slab);
  // Window glass: a pane in the middle of the slab's thickness.
  for (const o of openings) {
    if (o.kind !== 'window') continue;
    const top = Math.min(o.topM, heightM);
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(o.t1M - o.t0M, top - o.bottomM),
      new THREE.MeshPhysicalMaterial({ color: GLASS_HEX, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    pane.position.set((o.t0M + o.t1M) / 2, (o.bottomM + top) / 2, w.thicknessM / 2);
    node.add(pane);
  }
  return node;
}

/** World placement of a wall's local frame: u = along the wall, v = up, extrusion from the outer face to the wall line. */
function placeWall(w: WallSolid, node: THREE.Object3D): void {
  const dx = (w.b.x - w.a.x) / w.lengthM;
  const dy = (w.b.y - w.a.y) / w.lengthM;
  const X = new THREE.Vector3(dx, 0, dy);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3().crossVectors(X, Y); // = plan (-dy, dx) = the inward normal
  const origin = new THREE.Vector3(w.a.x, 0, w.a.y);
  // Room-edge slabs sit OUTSIDE their line (the inner face is the line);
  // free walls straddle it.
  origin.addScaledVector(Z, w.centred ? -w.thicknessM / 2 : -w.thicknessM);
  node.matrixAutoUpdate = false;
  node.matrix.makeBasis(X, Y, Z).setPosition(origin);
  node.matrixWorldNeedsUpdate = true;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** The placed-item root (the box mesh or the body holder) an object belongs to. */
function itemRootOf(o: THREE.Object3D | null): THREE.Object3D | null {
  let n: THREE.Object3D | null = o;
  while (n && n.userData?.instanceId === undefined) n = n.parent;
  return n;
}

/** Tint every mesh of an item root (selection / preview), remembering the untinted state. */
function tintItem(root: THREE.Object3D, hex: string | null, intensity: number): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (!std.emissive) continue;
      if (hex) {
        std.emissive.set(hex);
        std.emissiveIntensity = intensity;
      } else {
        std.emissive.set(0x000000);
        std.emissiveIntensity = 0;
      }
    }
  });
}

const SELECT_HEX = '#79C7AD';
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export const ThreeStage = forwardRef<ThreeStageHandle, ThreeStageProps>(function ThreeStage(
  { solids, camera, width, height, hover, selectedInstanceId, onFailed },
  ref,
): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const wallsRef = useRef<WallEntry[]>([]);
  const floorsRef = useRef<THREE.Mesh[]>([]);
  const itemsRef = useRef<THREE.Object3D[]>([]);
  const buildRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const failedRef = useRef(false);
  const hoveredRef = useRef<WallEntry | null>(null);
  const framesRef = useRef(0);
  const targetRef = useRef<number[]>([0, 0, 0]);
  /** Bodies slid by a drag preview, with where the plan has them. */
  const previewRef = useRef(new Map<string, THREE.Vector3>());
  const selectedRootRef = useRef<THREE.Object3D | null>(null);
  const padRef = useRef<THREE.Mesh | null>(null);

  const requestRender = () => {
    if (rafRef.current !== null || failedRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const r = rendererRef.current;
      const s = sceneRef.current;
      const c = cameraRef.current;
      if (r && s && c) {
        r.render(s, c);
        framesRef.current += 1;
      }
    });
  };

  // ---- renderer + lights, once ------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      failedRef.current = true;
      onFailed?.();
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_HEX);
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(50, 1.4, 0.05, 250);
    cameraRef.current = cam;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc7b8, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2de, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    sunRef.current = sun;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: GROUND_HEX, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.002;
    ground.receiveShadow = true;
    scene.add(ground);

    const content = new THREE.Group();
    scene.add(content);
    contentRef.current = content;

    const onLost = (e: Event) => {
      e.preventDefault();
      failedRef.current = true;
      onFailed?.();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      // Clear the handle too: a cancelled frame left in the ref would make
      // every later requestRender() think a frame is already pending — zero
      // renders after StrictMode's dev remount (the "blank 3D" bug).
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      failedRef.current = false;
      if (contentRef.current) disposeObject(contentRef.current);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      // dispose() only — forceContextLoss() would leave the canvas's context
      // LOST for the next mount (StrictMode remounts in dev; a view that
      // closes and reopens on the same element), and three then reads a null
      // precision format and refuses to start.
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      contentRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- geometry, on plan change ---------------------------------------------
  useEffect(() => {
    const content = contentRef.current;
    const sun = sunRef.current;
    if (!content || !sun) return;
    disposeObject(content);
    content.clear();
    wallsRef.current = [];
    floorsRef.current = [];
    itemsRef.current = [];
    hoveredRef.current = null;
    previewRef.current.clear();
    selectedRootRef.current = null;
    padRef.current = null;

    const bounds = new THREE.Box3();

    for (const f of solids.floors) {
      const shape = new THREE.Shape(f.polygon.map((v) => new THREE.Vector2(v.x, v.y)));
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(Math.PI / 2); // plan (x, y) → three (x, 0, y)
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: f.hex, roughness: 0.86, metalness: 0, side: THREE.DoubleSide }));
      mesh.position.y = 0.001;
      mesh.receiveShadow = true;
      mesh.userData = { key: f.key };
      content.add(mesh);
      floorsRef.current.push(mesh);
      bounds.expandByObject(mesh);
    }

    const reveal = new THREE.MeshStandardMaterial({ color: REVEAL_HEX, roughness: 0.95, metalness: 0 });
    for (const w of solids.walls) {
      const paint = new THREE.MeshStandardMaterial({ color: w.hex, roughness: 0.93, metalness: 0 });
      const group = new THREE.Group();
      const full = slabObject(w, w.heightM, paint, reveal);
      const stub = slabObject(w, w.stubHeightM, paint, reveal);
      stub.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData.wall) o.userData = { ...o.userData, key: w.key.replace(/^wall-/, 'stub-'), stub: true };
      });
      group.add(full, stub);
      placeWall(w, group);
      content.add(group);
      group.updateMatrixWorld(true);
      wallsRef.current.push({ solid: w, group, full, stub, paint, show: 'full' });
      bounds.expandByObject(full);
    }

    const buildId = ++buildRef.current;
    for (const it of solids.items) {
      const sx = Math.max(0.01, it.x1 - it.x0);
      const sy = Math.max(0.01, it.z1 - it.z0);
      const sz = Math.max(0.01, it.y1 - it.y0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color: it.hex, roughness: ITEM_ROUGHNESS, metalness: 0.02 }));
      mesh.position.set((it.x0 + it.x1) / 2, (it.z0 + it.z1) / 2, (it.y0 + it.y1) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { key: it.key, instanceId: it.instanceId };
      content.add(mesh);
      itemsRef.current.push(mesh);
      bounds.expandByObject(mesh);
      // Swap the box for the product's body once it has loaded — unless the
      // plan has been rebuilt since (a stale load must not resurrect).
      if (it.meshUrl) {
        loadBody(it.meshUrl)
          .then((tpl) => {
            if (buildRef.current !== buildId || !contentRef.current) return;
            const body = bodyObject(it, tpl);
            contentRef.current.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            contentRef.current.add(body);
            const i = itemsRef.current.indexOf(mesh);
            if (i >= 0) itemsRef.current[i] = body;
            if (selectedRootRef.current === mesh) {
              selectedRootRef.current = body;
              tintItem(body, SELECT_HEX, 0.35);
            }
            requestRender();
          })
          .catch(() => {
            /* the box stays */
          });
      }
    }

    // Sun from the north-west, high: shadows fall to the south-east across
    // the plan; the shadow camera hugs whatever is drawn.
    const centre = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const radius = bounds.isEmpty() ? 6 : Math.max(4, bounds.getSize(new THREE.Vector3()).length() / 2);
    const dir = new THREE.Vector3(-0.45, 1, -0.55).normalize();
    sun.position.copy(centre).addScaledVector(dir, radius * 3 + 10);
    sun.target.position.copy(centre);
    sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera;
    sc.left = -radius - 2;
    sc.right = radius + 2;
    sc.top = radius + 2;
    sc.bottom = -radius - 2;
    sc.near = 0.5;
    sc.far = radius * 6 + 40;
    sc.updateProjectionMatrix();

    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solids]);

  // ---- camera + cutaway, on orbit / resize -------------------------------------
  useEffect(() => {
    const r = rendererRef.current;
    const c = cameraRef.current;
    if (!r || !c || width < 8 || height < 8) return;
    r.setSize(width, height, false);
    c.aspect = width / height;
    c.fov = (camera.fovRad * 180) / Math.PI;
    const pos = cameraPosition(camera);
    c.position.copy(toThree(pos));
    targetRef.current = toThree(camera.target).toArray();
    c.up.set(0, 1, 0);
    c.lookAt(toThree(camera.target));
    c.updateProjectionMatrix();
    // Raycasts and screen projections read the camera's WORLD matrices,
    // which the renderer would only refresh on its next frame — a click or
    // a bridge call between an orbit and that frame would otherwise aim
    // with the previous camera (the e2e's first click landed on nothing).
    c.updateMatrixWorld(true);

    const state = cutawayState(solids, pos, camera.target);
    for (const e of wallsRef.current) {
      const show = state.get(e.solid.key) ?? 'full';
      e.show = show;
      e.full.visible = show === 'full';
      e.stub.visible = show === 'stub';
    }
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, width, height, solids]);

  // ---- selection (the plan's selection, mirrored) -----------------------------------
  // A mint pad on the floor under the picked body — the Sims' footprint
  // highlight — plus a tint on the body itself. The pad lives in the content
  // group, which a plan change rebuilds, so it is re-laid on every rebuild.
  useEffect(() => {
    const prev = selectedRootRef.current;
    if (prev) tintItem(prev, null, 0);
    const oldPad = padRef.current;
    if (oldPad) {
      oldPad.parent?.remove(oldPad);
      oldPad.geometry.dispose();
      (oldPad.material as THREE.Material).dispose();
      padRef.current = null;
    }
    const next = selectedInstanceId ? itemsRef.current.find((o) => o.userData.instanceId === selectedInstanceId) ?? null : null;
    if (next) tintItem(next, SELECT_HEX, 0.5);
    selectedRootRef.current = next;
    const s = selectedInstanceId ? solids.items.find((i) => i.instanceId === selectedInstanceId) : undefined;
    if (s && contentRef.current) {
      const m = 0.06;
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(s.x1 - s.x0 + 2 * m, s.y1 - s.y0 + 2 * m),
        new THREE.MeshBasicMaterial({ color: SELECT_HEX, transparent: true, opacity: 0.55, depthWrite: false }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set((s.x0 + s.x1) / 2, 0.012, (s.y0 + s.y1) / 2);
      pad.userData = { key: `pad-${s.instanceId}` };
      contentRef.current.add(pad);
      padRef.current = pad;
    }
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstanceId, solids]);

  // ---- hover tint ----------------------------------------------------------------
  useEffect(() => {
    const prev = hoveredRef.current;
    if (prev) {
      prev.paint.emissive.set(0x000000);
      prev.paint.emissiveIntensity = 0;
    }
    const next = hover ? wallsRef.current.find((e) => sameHit(hover, e.solid.hit)) ?? null : null;
    if (next) {
      next.paint.emissive.set(HOVER_HEX);
      next.paint.emissiveIntensity = 0.42;
    }
    hoveredRef.current = next;
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, solids]);

  useImperativeHandle(
    ref,
    () => ({
      hitTest(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        const targets: THREE.Object3D[] = [];
        for (const e of wallsRef.current) {
          const node = e.show === 'full' ? e.full : e.show === 'stub' ? e.stub : null;
          if (!node) continue;
          node.traverse((o) => {
            if ((o as THREE.Mesh).isMesh && o.userData.wall) targets.push(o);
          });
        }
        const hits = ray.intersectObjects(targets, false);
        return (hits[0]?.object.userData.hit as WallHit | undefined) ?? null;
      },
      screenPoint(hit) {
        const c = cameraRef.current;
        if (!c) return null;
        const e = wallsRef.current.find((x) => sameHit(hit, x.solid.hit));
        if (!e || e.show === 'hidden') return null;
        const p = toThree(wallAnchor(e.solid, e.show)).project(c);
        if (p.z > 1) return null;
        return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
      },
      faceCount() {
        return wallsRef.current.filter((e) => e.show !== 'hidden').length + floorsRef.current.length + itemsRef.current.length;
      },
      faces() {
        const out: Array<{ key: string; holes: number }> = [];
        for (const e of wallsRef.current) {
          if (e.show === 'hidden') continue;
          const node = e.show === 'full' ? e.full : e.stub;
          node.traverse((o) => {
            if ((o as THREE.Mesh).isMesh && o.userData.wall) out.push({ key: o.userData.key as string, holes: o.userData.holes as number });
          });
        }
        for (const f of floorsRef.current) out.push({ key: f.userData.key as string, holes: 0 });
        for (const it of itemsRef.current) out.push({ key: it.userData.key as string, holes: 0 });
        return out;
      },
      hitItem(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        const hits = ray.intersectObjects(itemsRef.current, true);
        const root = hits.length ? itemRootOf(hits[0].object) : null;
        return root ? { instanceId: root.userData.instanceId as string } : null;
      },
      floorPoint(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        const p = new THREE.Vector3();
        return ray.ray.intersectPlane(FLOOR_PLANE, p) ? { x: p.x, y: p.z } : null;
      },
      projectPoint(x, y, z) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        // Plan (x, y, z-up) → three (x, z, y): the same map the solids use.
        const v = new THREE.Vector3(x, z, y).project(c);
        if (v.z > 1) return null;
        return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
      },
      moveItemPreview(instanceId, dxM, dyM) {
        const root = itemsRef.current.find((o) => o.userData.instanceId === instanceId);
        if (!root) return;
        let home = previewRef.current.get(instanceId);
        if (!home) {
          home = root.position.clone();
          previewRef.current.set(instanceId, home);
        }
        root.position.set(home.x + dxM, home.y, home.z + dyM);
        // The pad rides with the body it marks.
        const pad = padRef.current;
        if (pad && selectedRootRef.current === root) {
          let padHome = previewRef.current.get(`pad:${instanceId}`);
          if (!padHome) {
            padHome = pad.position.clone();
            previewRef.current.set(`pad:${instanceId}`, padHome);
          }
          pad.position.set(padHome.x + dxM, padHome.y, padHome.z + dyM);
        }
        requestRender();
      },
      resetItemPreview(instanceId) {
        const root = itemsRef.current.find((o) => o.userData.instanceId === instanceId);
        const home = previewRef.current.get(instanceId);
        if (root && home) root.position.copy(home);
        const pad = padRef.current;
        const padHome = previewRef.current.get(`pad:${instanceId}`);
        if (pad && padHome) pad.position.copy(padHome);
        previewRef.current.delete(instanceId);
        previewRef.current.delete(`pad:${instanceId}`);
        requestRender();
      },
      debug() {
        const r = rendererRef.current;
        return {
          frames: framesRef.current,
          children: contentRef.current?.children.length ?? 0,
          camera: cameraRef.current?.position.toArray() ?? [],
          target: targetRef.current,
          renderer: r ? `${r.domElement.width}x${r.domElement.height} calls=${r.info.render.calls} tris=${r.info.render.triangles}` : 'none',
        };
      },
    }),
    [width, height],
  );

  return <canvas ref={canvasRef} data-testid="wallpaint-3d-gl" style={{ display: 'block', width: '100%', height: '100%' }} />;
});

export default ThreeStage;
