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
import { cameraPosition, GLASS_HEX, GROUND_HEX, HOVER_HEX, type OrbitCamera, type WallHit } from '../../designer/roomView3d';
import { cutawayState, wallAnchor, type SceneSolids, type WallShow, type WallSolid } from '../../designer/roomSolids';

export interface ThreeStageHandle {
  /** Wall under a canvas-local point, or null. */
  hitTest(x: number, y: number): WallHit | null;
  /** Canvas-local point at the middle of a wall's shown face — the e2e bridge aims here. */
  screenPoint(hit: WallHit): { x: number; y: number } | null;
  faceCount(): number;
  faces(): Array<{ key: string; holes: number }>;
  /** DEV bridge: what the stage has done so far. */
  debug(): { frames: number; children: number; camera: number[]; target: number[]; renderer: string };
}

export interface ThreeStageProps {
  solids: SceneSolids;
  camera: OrbitCamera;
  width: number;
  height: number;
  hover: WallHit | null;
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

export const ThreeStage = forwardRef<ThreeStageHandle, ThreeStageProps>(function ThreeStage(
  { solids, camera, width, height, hover, onFailed },
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
  const itemsRef = useRef<THREE.Mesh[]>([]);
  const rafRef = useRef<number | null>(null);
  const failedRef = useRef(false);
  const hoveredRef = useRef<WallEntry | null>(null);
  const framesRef = useRef(0);
  const targetRef = useRef<number[]>([0, 0, 0]);

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

    for (const it of solids.items) {
      const sx = Math.max(0.01, it.x1 - it.x0);
      const sy = Math.max(0.01, it.z1 - it.z0);
      const sz = Math.max(0.01, it.y1 - it.y0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color: it.hex, roughness: ITEM_ROUGHNESS, metalness: 0.02 }));
      mesh.position.set((it.x0 + it.x1) / 2, (it.z0 + it.z1) / 2, (it.y0 + it.y1) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { key: it.key };
      content.add(mesh);
      itemsRef.current.push(mesh);
      bounds.expandByObject(mesh);
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
