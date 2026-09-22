/**
 * ThreeStage — the WebGL renderer behind the 3D MODE (2026-09-17; P3
 * realism 2026-09-19).
 *
 * Draws `SceneSolids` (designer/roomSolids.ts) with three.js: wall slabs
 * with real thickness and their doors and windows cut through — dressed
 * with skirting, architraves, panelled door leaves, window frames and
 * sills (three/joinery.ts) — floor slabs in the laid product's real
 * surface (three/surfaces.ts), furniture bodies on soft contact shadows,
 * corner shading where walls meet the floor (the phone-safe stand-in for
 * ambient occlusion), a sun with soft shadows that can follow the real
 * Mauritian sky by the hour (designer/sunPosition.ts), lamps that come on
 * after dark, and a sky dome that goes from noon to night. The Sims
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
 *
 * COLOUR TRUTH (measured, pinned by paint-sims-3d.spec.ts): with no hour
 * set the rig is the STUDIO rig — hemisphere 0.8 π + camera fill 0.25 π +
 * a fixed high sun 0.15 π, NoToneMapping — under which a painted wall
 * renders its hex (a #808080 room reads 119–127 on every wall). The
 * time-of-day rig only replaces it while the customer drags the sun.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cameraPosition, GLASS_HEX, type OrbitCamera, type WallHit } from '../../designer/roomView3d';
import { cutawayState, wallAnchor, type ItemSolid, type SceneSolids, type WallShow, type WallSolid } from '../../designer/roomSolids';
import { fitToSize, itemPose, pitchedBox, upPitchRad } from '../../designer/fitToSize';
import { dayOfYear, sunAt, sunColourHex } from '../../designer/sunPosition';
import { BARE_PLASTER_HEX } from '../../data/wallPaints';
import type { WallView } from '../../store/designerUIStore';
import type { FloorKind } from './surfaces';
import { applyWallLook, wallTextures } from './wallSurfaces';
import { wallJoinery } from './joinery';
import { contactShadow, cornerShades, floorMesh, groundPlane, lampsOnFactor, nightLight, skyDome, updateSkyDome, type NightLight } from './dressing';

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
  // A flat product generated from a photo arrives as an upright slab: the
  // `modelUp` pitch lays it down first, and the fit sees the pitched box.
  const fit = fitToSize({
    bbox: pitchedBox(tpl.bbox, it.modelUp),
    lengthCm: it.lengthM * 100,
    widthCm: it.widthM * 100,
    heightCm: it.heightM * 100,
    frontEdge: it.frontEdge,
    modelFront: it.modelFront,
    lengthAxis: it.lengthAxis,
  });
  const model = tpl.scene.clone(true);
  // Own materials per placed item: a shared material would tint every copy
  // of the product when one is selected or hovered.
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : (m.material as THREE.Material).clone();
  });
  const upright = new THREE.Group();
  upright.rotation.set(upPitchRad(it.modelUp), 0, 0);
  upright.add(model);
  const inner = new THREE.Group();
  inner.add(upright);
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

// ---------------------------------------------------------------------------
// A product with NO body (Vic 2026-09-20: "there's a random table there and
// there's no 3D product of a table … it's a design software operating like
// The Sims"): no stand-in model, ever. The box wears the product's OWN art —
// the plan's top-down image on its top (what the 2D shows), the photo on its
// sides — so what you placed is what you see, at its exact catalog size.
// ---------------------------------------------------------------------------
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const artCache = new Map<string, Promise<THREE.Texture>>();
function loadArt(url: string): Promise<THREE.Texture> {
  let p = artCache.get(url);
  if (!p) {
    p = textureLoader.loadAsync(url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    p.catch(() => artCache.delete(url));
    artCache.set(url, p);
  }
  return p;
}

/** A clone of `tex` cropped to COVER a face of aspect `faceW / faceH` (centre crop, no stretch). */
function coverTexture(tex: THREE.Texture, faceW: number, faceH: number): THREE.Texture {
  const img = tex.image as { width?: number; height?: number } | undefined;
  const t = tex.clone();
  const iw = img?.width ?? 1;
  const ih = img?.height ?? 1;
  const imgAspect = iw / ih;
  const faceAspect = faceW / faceH;
  if (imgAspect > faceAspect) {
    const r = faceAspect / imgAspect;
    t.repeat.set(r, 1);
    t.offset.set((1 - r) / 2, 0);
  } else {
    const r = imgAspect / faceAspect;
    t.repeat.set(1, r);
    t.offset.set(0, (1 - r) / 2);
  }
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/**
 * The art box for one placed item: a shaded box at the catalog size, then —
 * as the images arrive — the top-down art laid on top at the item's
 * rotation and the photo on the four sides. Returns the item's root (a
 * Group carrying `userData.instanceId`).
 */
function artBox(it: ItemSolid, requestRender: () => void): THREE.Group {
  const sx = Math.max(0.01, it.x1 - it.x0);
  const sy = Math.max(0.01, it.z1 - it.z0);
  const sz = Math.max(0.01, it.y1 - it.y0);
  const root = new THREE.Group();
  root.position.set((it.x0 + it.x1) / 2, (it.z0 + it.z1) / 2, (it.y0 + it.y1) / 2);
  root.userData = { key: it.key, instanceId: it.instanceId, art: !!(it.artTopUrl || it.artSideUrl) };
  const base = new THREE.MeshStandardMaterial({ color: it.hex, roughness: ITEM_ROUGHNESS, metalness: 0.02 });
  const box: THREE.Mesh<THREE.BoxGeometry, THREE.Material | THREE.Material[]> = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), base);
  box.castShadow = true;
  box.receiveShadow = true;
  root.add(box);
  if (it.artSideUrl) {
    const sideUrl = it.artSideUrl;
    loadArt(sideUrl)
      .then((tex) => {
        if (!root.parent) return;
        const side = (w: number, h: number) => new THREE.MeshStandardMaterial({ color: 0xffffff, map: coverTexture(tex, w, h), roughness: 0.8, metalness: 0 });
        // Box material order: +x, −x, +y (top), −y (bottom), +z, −z.
        box.material = [side(sz, sy), side(sz, sy), base, base, side(sx, sy), side(sx, sy)];
        requestRender();
      })
      .catch(() => {
        /* the shaded box stays */
      });
  }
  if (it.artTopUrl) {
    const topUrl = it.artTopUrl;
    loadArt(topUrl)
      .then((tex) => {
        if (!root.parent) return;
        // The plan's icon, at the plan's rotation, on the box's lid.
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.max(0.01, it.lengthM), Math.max(0.01, it.widthM)),
          new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, transparent: true, alphaTest: 0.35, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        );
        plane.rotation.x = -Math.PI / 2; // image top → plan north (−z)
        const turn = new THREE.Group();
        turn.rotation.y = (-it.rotationDeg * Math.PI) / 180;
        turn.position.y = sy / 2 + 0.003;
        turn.add(plane);
        root.add(turn);
        requestRender();
      })
      .catch(() => {
        /* the shaded box stays */
      });
  }
  return root;
}

export interface ThreeStageHandle {
  /** Wall under a canvas-local point, or null. */
  hitTest(x: number, y: number): WallHit | null;
  /** Canvas-local point at the middle of a wall's shown face — the e2e bridge aims here. */
  screenPoint(hit: WallHit): { x: number; y: number } | null;
  faceCount(): number;
  faces(): Array<{ key: string; holes: number }>;
  /** DEV bridge: what the stage has done so far. */
  debug(): { frames: number; children: number; camera: number[]; target: number[]; renderer: string; hour: number | null; sun: { elevationDeg: number; azimuthDeg: number } | null };
  /** The placed item under a canvas-local point (its body or its box), or null. */
  hitItem(x: number, y: number): { instanceId: string } | null;
  /** DEV bridge: what a wall's material shows right now (the preview or its own paint). */
  wallMaterial(hit: WallHit): { hex: string; baseHex: string; finish: string | null; roughness: number; sheen: number; hasMap: boolean; show: WallShow } | null;
  /** DEV bridge: the rendered colour at a canvas-local point (renders, then reads the pixel back). */
  samplePixel(x: number, y: number): { r: number; g: number; b: number } | null;
  /** DEV bridge: bisect the light rig / materials live. */
  tune(opts: { hemi?: number; sun?: number; fill?: number; env?: boolean; normals?: number; maps?: boolean }): void;
  /** Where a canvas-local point meets the floor plane, in PLAN metres, or null when it looks at the sky. */
  floorPoint(x: number, y: number): { x: number; y: number } | null;
  /** A PLAN point (x, y on the plan, z up) on the canvas, or null when it is behind the camera. */
  projectPoint(x: number, y: number, z: number): { x: number; y: number } | null;
  /** Slide an item's body by a plan-metre delta while a drag is in progress (no store write). */
  moveItemPreview(instanceId: string, dxM: number, dyM: number): void;
  /** Put a previewed body back where the plan has it. */
  resetItemPreview(instanceId: string): void;
  /** DEV bridge: what is dressed — joinery, shades, lamps, bodies, art boxes — for a spec to count. */
  dressing(): { joinery: number; shades: number; lamps: number; contactShadows: number; floors: Array<{ key: string; kind: string }>; bodies: number; artBoxes: number };
}

export interface ThreeStageProps {
  solids: SceneSolids;
  camera: OrbitCamera;
  width: number;
  height: number;
  hover: WallHit | null;
  /** The plan's selection — tinted so 2D and 3D agree on what is picked. */
  selectedInstanceId?: string | null;
  /**
   * The paint on the brush, shown ON the hovered wall before the click (The
   * Sims' wallpaper preview); null = the tool is armed with no preview
   * colour (Erase shows bare plaster); undefined = no paint tool.
   */
  brushHex?: string | null;
  /** Product finish on the brush; null previews bare plaster. */
  brushFinish?: string | null;
  /** Walls Up / Cutaway / Down (default 'cutaway'). */
  wallView?: WallView;
  /**
   * Local clock hour (0–24) to light the room by the real Mauritian sun;
   * null / undefined = the studio rig the colour truth is measured under.
   */
  hour?: number | null;
  /** Day of the year for the sun's path (default: today). */
  dayOfYear?: number;
  /** WebGL could not start (headless without GL, an old device) — the parent falls back to the painter. */
  onFailed?: () => void;
}

/** Wall tops, ends and the reveals of openings — a shade under plaster so edges read. */
const REVEAL_HEX = '#C9C3B6';
/** The cap strip along the top of every wall, full or cut — the Sims' cut-wall cap. */
const CAP_HEX = '#B5AFA2';
/** The OUTSIDE of a room wall: render, never the room's paint (the quote prices one face; the picture painted two). */
const EXTERIOR_HEX = '#E4E0D6';
const ITEM_ROUGHNESS = 0.72;
/** The target outline on the hovered wall (mint, the plan's selection colour). */
const TARGET_HEX = '#79C7AD';
const OUTLINE_WIDTH_M = 0.028;

/**
 * The studio rig (measured): the sun direction, three frame, and the three
 * intensities in π multiples. P3 raised the sun (0.15 → 0.25) for readable
 * shadows and lowered the hemisphere to keep a camera-facing, sun-shaded
 * wall at the same ≈0.95 of its hex the colour-truth probe pins.
 */
const STUDIO_SUN_DIR = new THREE.Vector3(-0.45, 1, -0.55).normalize();
const STUDIO = { hemi: 0.72, sun: 0.25, fill: 0.25 };
/**
 * Floors face the sky, so the hemisphere, the fill from above and the sun
 * all land on them at once: a floor rendered ×1.14 of its swatch and a
 * light one clipped to white (the 3D audit). This gain, measured on
 * #3A3A3A / #1F2A44 / #F1EBDD floor centres against the swatch, brings the
 * rendered floor back to its hex; the walls are untouched.
 */
const FLOOR_GAIN = 0.9;
/** Night rig: a cool, dim sky and the lamps. */
const NIGHT = { hemi: 0.14, sun: 0, fill: 0.07 };
const HEMI_DAY_SKY = new THREE.Color(0xffffff);
const HEMI_DAY_GROUND = new THREE.Color(0xf2ede4);
const HEMI_NIGHT_SKY = new THREE.Color(0x9db0d6);
const HEMI_NIGHT_GROUND = new THREE.Color(0x3b3f4a);
const LAMP_INTENSITY = 26;

const toThree = (p: { x: number; y: number; z: number }): THREE.Vector3 => new THREE.Vector3(p.x, p.z, p.y);
const SELECT_HEX = '#79C7AD';

interface WallEntry {
  solid: WallSolid;
  group: THREE.Group;
  full: THREE.Object3D;
  stub: THREE.Object3D;
  paint: THREE.MeshPhysicalMaterial;
  /** The wall's own colour (the preview swaps the material colour and restores this). */
  baseHex: string;
  /** Outline of the wall face, shown only while it is the paint target. */
  outlineFull: THREE.Object3D;
  outlineStub: THREE.Object3D;
  show: WallShow;
  /** A cut wall raised as a ghost while the brush hovers it (the preview shows the whole face). */
  ghost: boolean;
}

/**
 * Raise a cutaway stub as a translucent ghost of its full wall while the
 * brush hovers it, so the preview shows the whole face and not a skirting-
 * height strip (the 3D audit); the joinery and shading of the ghost stay
 * hidden so only the painted face floats up.
 */
function setGhost(e: WallEntry, on: boolean): void {
  if (e.ghost === on) return;
  e.ghost = on;
  e.paint.transparent = on;
  e.paint.opacity = on ? 0.55 : 1;
  e.paint.depthWrite = !on;
  e.paint.needsUpdate = true;
  e.full.traverse((o) => {
    if (o === e.full) return;
    if (o.userData?.joinery || o.userData?.cap || o.name === 'corner-shades') o.visible = !on;
  });
  e.full.visible = on ? true : e.show === 'full';
}

/** A mint inverted hull around a body — the Sims' selection glow, one draw call, phone-safe. */
let hullMaterialCache: THREE.MeshBasicMaterial | null = null;
function makeHull(root: THREE.Object3D): THREE.Object3D {
  if (!hullMaterialCache) {
    hullMaterialCache = new THREE.MeshBasicMaterial({ color: SELECT_HEX, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false });
    hullMaterialCache.userData.shared = true;
  }
  const hull = root.clone(true);
  hull.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = hullMaterialCache as THREE.Material;
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = -1;
    }
  });
  hull.userData = { hull: true };
  // A little bigger about the body's own centre, so the rim shows all round.
  const box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  const k = 1.028;
  hull.scale.multiplyScalar(k);
  hull.position.copy(root.position).sub(centre).multiplyScalar(k).add(centre);
  return hull;
}

/**
 * What a rebuild is FOR: the geometry. A paint click changes a wall's hex
 * and finish only — the same walls, floors and items with new colours —
 * and repaints in place instead of disposing and re-extruding the room
 * (Sims-instant, and the phone never stalls on a click).
 */
function structureSignature(s: SceneSolids): string {
  return JSON.stringify({
    h: s.wallHeightM,
    f: s.floors.map((f) => [f.key, f.hex, f.kind, f.tileM, f.polygon]),
    w: s.walls.map((w) => [w.key, w.a, w.b, w.thicknessM, w.heightM, w.stubHeightM, w.centred, w.openings, w.shared, w.free]),
    i: s.items.map((it) => [it.key, it.instanceId, it.x0, it.y0, it.z0, it.x1, it.y1, it.z1, it.rotationDeg, it.hex, it.meshUrl, it.modelFront, it.lengthAxis, it.modelUp, it.emitsLight, it.lightMountM, it.artTopUrl, it.artSideUrl]),
  });
}

let outlineMaterialCache: THREE.MeshBasicMaterial | null = null;
function outlineMaterial(): THREE.MeshBasicMaterial {
  if (!outlineMaterialCache) {
    outlineMaterialCache = new THREE.MeshBasicMaterial({ color: TARGET_HEX, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
    outlineMaterialCache.userData.shared = true;
  }
  return outlineMaterialCache;
}

/**
 * The outline of a slab's inner face, drawn only while it is the target:
 * four 28 mm strips just in front of the face (a WebGL line is always one
 * pixel, which read as a hairline on the phone — the 3D audit).
 */
function faceOutline(w: WallSolid, heightM: number): THREE.Group {
  const g = new THREE.Group();
  const z = w.thicknessM + 0.006;
  const t = OUTLINE_WIDTH_M;
  const mat = outlineMaterial();
  const strip = (sw: number, sh: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
    m.position.set(x, y, z);
    m.renderOrder = 5;
    g.add(m);
  };
  strip(w.lengthM, t, w.lengthM / 2, t / 2);
  strip(w.lengthM, t, w.lengthM / 2, heightM - t / 2);
  strip(t, heightM, t / 2, heightM / 2);
  strip(t, heightM, w.lengthM - t / 2, heightM / 2);
  g.visible = false;
  return g;
}

/**
 * Re-group an extruded slab's faces so the OUTSIDE cap of a room wall gets
 * the exterior render instead of the room's paint. ExtrudeGeometry gives
 * both caps material 0 and the sides material 1; the cap at z = 0 is the
 * outer face (placeWall puts the inner face on the wall line at z =
 * thickness). Free walls straddle their line and are painted on both faces.
 */
function splitCaps(geo: THREE.ExtrudeGeometry, depth: number, centred: boolean): void {
  const pos = geo.getAttribute('position');
  const groups = geo.groups.map((g) => ({ ...g }));
  geo.clearGroups();
  for (const g of groups) {
    if (g.materialIndex !== 0) {
      geo.addGroup(g.start, g.count, g.materialIndex ?? 1);
      continue;
    }
    let runStart = g.start;
    let runMat = -1;
    for (let i = g.start; i < g.start + g.count; i += 3) {
      const mat = pos.getZ(i) < depth / 2 && !centred ? 2 : 0;
      if (mat !== runMat) {
        if (runMat >= 0) geo.addGroup(runStart, i - runStart, runMat);
        runStart = i;
        runMat = mat;
      }
    }
    if (runMat >= 0) geo.addGroup(runStart, g.start + g.count - runStart, runMat);
  }
}

function sameHit(a: WallHit | null | undefined, b: WallHit): boolean {
  if (!a) return false;
  if (a.kind !== b.kind) return false;
  return a.kind === 'edge' ? a.roomId === b.roomId && a.edgeIndex === b.edgeIndex : a.wallId === b.wallId;
}

/**
 * A wall slab as an extruded shape with its openings as holes, in the
 * wall's local frame (u along, v up, w outward-in), dressed: skirting,
 * architraves and door leaves, window frames and sills, corner shading.
 */
function slabObject(w: WallSolid, heightM: number, paint: THREE.Material, reveal: THREE.Material, exterior: THREE.Material, cap: THREE.Material): THREE.Object3D {
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
  splitCaps(geo, w.thicknessM, w.centred);
  const slab = new THREE.Mesh(geo, [paint, reveal, exterior]);
  slab.castShadow = true;
  slab.receiveShadow = true;
  slab.userData = { hit: w.hit, key: w.key, holes: openings.length, wall: true };
  node.add(slab);
  // The cap strip along the top — every wall, full or cut, wears one.
  const capStrip = new THREE.Mesh(new THREE.BoxGeometry(w.lengthM + 0.004, 0.012, w.thicknessM + 0.006), cap);
  capStrip.position.set(w.lengthM / 2, heightM + 0.006, w.thicknessM / 2);
  capStrip.receiveShadow = true;
  capStrip.userData = { cap: true };
  node.add(capStrip);
  // Window glass: a pane in the middle of the slab's thickness.
  for (const o of openings) {
    if (o.kind !== 'window') continue;
    const top = Math.min(o.topM, heightM);
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(o.t1M - o.t0M, top - o.bottomM),
      new THREE.MeshPhysicalMaterial({ color: GLASS_HEX, transparent: true, opacity: 0.28, roughness: 0.06, metalness: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    pane.position.set((o.t0M + o.t1M) / 2, (o.bottomM + top) / 2, w.thicknessM / 2);
    node.add(pane);
  }
  // Dressing (P3): joinery on every wall, corner shading on the room side.
  node.add(wallJoinery(w.lengthM, w.thicknessM, heightM, openings));
  node.add(cornerShades(w, heightM, openings));
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
    // Shared joinery materials are singletons — never disposed here.
    if (Array.isArray(mat)) mat.forEach((x) => !x.userData?.shared && x.dispose());
    else if (mat && !mat.userData?.shared) mat.dispose();
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

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export const ThreeStage = forwardRef<ThreeStageHandle, ThreeStageProps>(function ThreeStage(
  { solids, camera, width, height, hover, selectedInstanceId, brushHex, brushFinish, wallView = 'cutaway', hour = null, dayOfYear: doy, onFailed },
  ref,
): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const hemiRef = useRef<THREE.HemisphereLight | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  /** A soft light that rides with the camera so no wall face is ever unlit. */
  const fillRef = useRef<THREE.DirectionalLight | null>(null);
  /** The room environment, for materials with a sheen. */
  const envRef = useRef<THREE.Texture | null>(null);
  const skyRef = useRef<THREE.Mesh | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const signatureRef = useRef<string>('');
  const wallsRef = useRef<WallEntry[]>([]);
  const floorsRef = useRef<THREE.Mesh[]>([]);
  const itemsRef = useRef<THREE.Object3D[]>([]);
  const lampsRef = useRef<NightLight[]>([]);
  const shadowsRef = useRef<THREE.Mesh[]>([]);
  /** Where the plan is and how big, for the sun's shadow frustum. */
  const boundsRef = useRef<{ centre: THREE.Vector3; radius: number }>({ centre: new THREE.Vector3(), radius: 6 });
  const sunStateRef = useRef<{ elevationDeg: number; azimuthDeg: number } | null>(null);
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
  const hullRef = useRef<THREE.Object3D | null>(null);

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

  /** Aim the sun and size its shadow camera to the plan. `dir` is the direction TOWARDS the sun, three frame. */
  const aimSun = (dir: THREE.Vector3) => {
    const sun = sunRef.current;
    if (!sun) return;
    const { centre, radius } = boundsRef.current;
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
  };

  /**
   * The rig for an hour: the studio rig (null) that the colour truth is
   * measured under, or the real sun for that clock hour with the sky and
   * the lamps following it.
   */
  const applyHour = (h: number | null) => {
    const hemi = hemiRef.current;
    const sun = sunRef.current;
    const fill = fillRef.current;
    if (!hemi || !sun || !fill) return;
    if (h === null || !Number.isFinite(h)) {
      hemi.intensity = Math.PI * STUDIO.hemi;
      hemi.color.copy(HEMI_DAY_SKY);
      hemi.groundColor.copy(HEMI_DAY_GROUND);
      sun.intensity = Math.PI * STUDIO.sun;
      sun.color.set(0xfff6ea);
      fill.intensity = Math.PI * STUDIO.fill;
      aimSun(STUDIO_SUN_DIR);
      sunStateRef.current = null;
      if (skyRef.current && skyRef.current.userData.day !== 1) updateSkyDome(skyRef.current, 1);
      for (const l of lampsRef.current) {
        l.light.intensity = 0;
        (l.glow.material as THREE.MeshBasicMaterial).color.set(0xe9e2d3);
      }
      return;
    }
    const s = sunAt(h, doy ?? dayOfYear(new Date().getMonth() + 1, new Date().getDate()));
    const day = s.daylight;
    hemi.intensity = Math.PI * (STUDIO.hemi * day + NIGHT.hemi * (1 - day));
    hemi.color.copy(HEMI_NIGHT_SKY).lerp(HEMI_DAY_SKY, day);
    hemi.groundColor.copy(HEMI_NIGHT_GROUND).lerp(HEMI_DAY_GROUND, day);
    // The sun's share grows as it climbs; it never adds more than the studio sun did at its brightest.
    const up = Math.max(0, Math.sin((s.elevationDeg * Math.PI) / 180));
    sun.intensity = Math.PI * STUDIO.sun * Math.min(1, up * 1.4) * day;
    sun.color.set(sunColourHex(s.elevationDeg));
    fill.intensity = Math.PI * (STUDIO.fill * day + NIGHT.fill * (1 - day));
    aimSun(new THREE.Vector3(s.direction.x, Math.max(0.05, s.direction.z), s.direction.y));
    sunStateRef.current = { elevationDeg: s.elevationDeg, azimuthDeg: s.azimuthDeg };
    if (skyRef.current) {
      const quant = Math.round(day * 20) / 20;
      if (skyRef.current.userData.day !== quant) updateSkyDome(skyRef.current, quant);
    }
    const lamps = lampsOnFactor(s.elevationDeg);
    for (const l of lampsRef.current) {
      l.light.intensity = LAMP_INTENSITY * lamps;
      (l.glow.material as THREE.MeshBasicMaterial).color.set(lamps > 0.5 ? 0xffe9c4 : 0xe9e2d3);
    }
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
    // Colour truth (Vic 2026-09-17): the wall must be the SAME hex as the
    // 2D chip and the merchant's colour card. Filmic tone mapping remaps
    // every pixel (ACES washed tints toward grey), so none — a lit face
    // renders its albedo. The rig sums to ≈1.0 on a camera-facing wall:
    // hemisphere 0.8 (flat, everywhere) + fill 0.2 · cos (from the camera)
    // + sun 0.2 · cos (for the shadows). Measured, not assumed: a wall
    // painted #4C493F reads back within a few points of #4C493F on the far
    // walls (the pixel probe in paint-sims-3d.spec.ts pins it).
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const sky = skyDome(1);
    scene.add(sky);
    skyRef.current = sky;

    const cam = new THREE.PerspectiveCamera(50, 1.4, 0.05, 250);
    cameraRef.current = cam;

    // Physical light units (r155+): a lit Lambert face renders albedo ×
    // intensity × cos / π, so the rig is stated in multiples of π. Measured
    // on a #808080 room with the DEV `tune()` knob: hemisphere alone at
    // 0.8 π → 0.76 of the hex on a wall; sun / fill add their cos share.
    const hemi = new THREE.HemisphereLight(HEMI_DAY_SKY, HEMI_DAY_GROUND, Math.PI * STUDIO.hemi);
    scene.add(hemi);
    hemiRef.current = hemi;
    const sun = new THREE.DirectionalLight(0xfff6ea, Math.PI * STUDIO.sun);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    sunRef.current = sun;
    const fill = new THREE.DirectionalLight(0xffffff, Math.PI * STUDIO.fill);
    scene.add(fill);
    scene.add(fill.target);
    fillRef.current = fill;

    // Something for a sheen to reflect: a neutral room environment, handed
    // to the materials that have a sheen (silk / satin / gloss, the product
    // bodies) — never set on the scene, see applyWallLook.
    const pmrem = new THREE.PMREMGenerator(renderer);
    try {
      envRef.current = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch {
      envRef.current = null; /* no environment: finishes read flat, colours unaffected */
    }
    pmrem.dispose();

    const ground = groundPlane();
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
      disposeObject(ground);
      disposeObject(sky);
      envRef.current?.dispose();
      envRef.current = null;
      signatureRef.current = '';
      // dispose() only — forceContextLoss() would leave the canvas's context
      // LOST for the next mount (StrictMode remounts in dev; a view that
      // closes and reopens on the same element), and three then reads a null
      // precision format and refuses to start.
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      contentRef.current = null;
      skyRef.current = null;
      hemiRef.current = null;
      sunRef.current = null;
      fillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- geometry, on plan change ---------------------------------------------
  useEffect(() => {
    const content = contentRef.current;
    const sun = sunRef.current;
    if (!content || !sun) return;

    // Same room, new paint: repaint in place (see structureSignature).
    const signature = structureSignature(solids);
    if (signature === signatureRef.current && wallsRef.current.length === solids.walls.length) {
      const byKey = new Map(solids.walls.map((w) => [w.key, w]));
      for (const e of wallsRef.current) {
        const w = byKey.get(e.solid.key);
        if (!w) continue;
        e.solid = w;
        e.baseHex = w.hex;
        applyWallLook(e.paint, w, envRef.current);
      }
      requestRender();
      return;
    }
    signatureRef.current = signature;

    disposeObject(content);
    content.clear();
    wallsRef.current = [];
    floorsRef.current = [];
    itemsRef.current = [];
    lampsRef.current = [];
    shadowsRef.current = [];
    hoveredRef.current = null;
    previewRef.current.clear();
    selectedRootRef.current = null;
    padRef.current = null;
    hullRef.current = null;

    const bounds = new THREE.Box3();

    for (const f of solids.floors) {
      const mesh = floorMesh(f, (f.kind as FloorKind | undefined) ?? 'screed', f.tileM ?? 0.5, envRef.current);
      (mesh.material as THREE.MeshPhysicalMaterial).color.multiplyScalar(FLOOR_GAIN);
      content.add(mesh);
      floorsRef.current.push(mesh);
      bounds.expandByObject(mesh);
    }

    const reveal = new THREE.MeshPhysicalMaterial({ color: REVEAL_HEX, roughness: 0.95, metalness: 0, envMapIntensity: 0, specularIntensity: 0 });
    const exterior = new THREE.MeshPhysicalMaterial({ color: EXTERIOR_HEX, roughness: 0.96, metalness: 0, envMapIntensity: 0, specularIntensity: 0, normalMap: wallTextures().plasterNormal, normalScale: new THREE.Vector2(0.35, 0.35) });
    const cap = new THREE.MeshPhysicalMaterial({ color: CAP_HEX, roughness: 0.9, metalness: 0, envMapIntensity: 0, specularIntensity: 0 });
    for (const w of solids.walls) {
      const paint = new THREE.MeshPhysicalMaterial();
      applyWallLook(paint, w, envRef.current);
      const group = new THREE.Group();
      const full = slabObject(w, w.heightM, paint, reveal, exterior, cap);
      const stub = slabObject(w, w.stubHeightM, paint, reveal, exterior, cap);
      stub.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData.wall) o.userData = { ...o.userData, key: w.key.replace(/^wall-/, 'stub-'), stub: true };
      });
      const outlineFull = faceOutline(w, w.heightM);
      const outlineStub = faceOutline(w, w.stubHeightM);
      group.add(full, stub, outlineFull, outlineStub);
      placeWall(w, group);
      content.add(group);
      group.updateMatrixWorld(true);
      wallsRef.current.push({ solid: w, group, full, stub, paint, baseHex: w.hex, outlineFull, outlineStub, show: 'full', ghost: false });
      bounds.expandByObject(full);
    }

    const buildId = ++buildRef.current;
    for (const it of solids.items) {
      // The product's own art on a box at its size until (unless) its body arrives.
      const mesh = artBox(it, requestRender);
      content.add(mesh);
      itemsRef.current.push(mesh);
      bounds.expandByObject(mesh);
      // Grounded on the floor: a soft contact shadow under every standing body.
      const shadow = contactShadow(it);
      if (shadow) {
        content.add(shadow);
        shadowsRef.current.push(shadow);
      }
      // A lamp: a warm light at its source, off by day, on after dark.
      if (it.emitsLight) {
        const lamp = nightLight(it, it.lightMountM ?? Math.min(it.z1, solids.wallHeightM - 0.3));
        lamp.light.intensity = 0;
        content.add(lamp.light, lamp.glow);
        lampsRef.current.push(lamp);
      }
      // Swap the box for the product's body once it has loaded — unless the
      // plan has been rebuilt since (a stale load must not resurrect).
      if (it.meshUrl) {
        loadBody(it.meshUrl)
          .then((tpl) => {
            if (buildRef.current !== buildId || !contentRef.current) return;
            const body = bodyObject(it, tpl);
            // A product's PBR textures pick up a little of the room, and
            // stay sharp at grazing angles (anisotropy is free on a GPU).
            const env = envRef.current;
            const aniso = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 1;
            body.traverse((o) => {
              const bm = o as THREE.Mesh;
              if (!bm.isMesh) return;
              const mats = Array.isArray(bm.material) ? bm.material : [bm.material];
              for (const mat of mats) {
                const std = mat as THREE.MeshStandardMaterial;
                if (env && 'envMapIntensity' in std) {
                  std.envMap = env;
                  std.envMapIntensity = 0.35;
                }
                for (const tex of [std.map, std.normalMap, std.roughnessMap, std.metalnessMap]) {
                  if (tex && tex.anisotropy < aniso) {
                    tex.anisotropy = aniso;
                    tex.needsUpdate = true;
                  }
                }
                mat.needsUpdate = true;
              }
            });
            contentRef.current.remove(mesh);
            disposeObject(mesh);
            contentRef.current.add(body);
            const i = itemsRef.current.indexOf(mesh);
            if (i >= 0) itemsRef.current[i] = body;
            if (selectedRootRef.current === mesh) {
              selectedRootRef.current = body;
              tintItem(body, SELECT_HEX, 0.12);
              const oldHull = hullRef.current;
              if (oldHull) {
                oldHull.parent?.remove(oldHull);
                disposeObject(oldHull);
              }
              const hull = makeHull(body);
              contentRef.current.add(hull);
              hullRef.current = hull;
            }
            requestRender();
          })
          .catch(() => {
            /* the box stays */
          });
      }
    }

    // The sun's shadow camera hugs whatever is drawn; the rig for the hour follows.
    boundsRef.current = {
      centre: bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3()),
      radius: bounds.isEmpty() ? 6 : Math.max(4, bounds.getSize(new THREE.Vector3()).length() / 2),
    };
    applyHour(hour);
    // Compile every shader variant OFF the main thread's critical path before
    // the first frame (a room with several finishes used to block the page
    // while it compiled on that frame); a renderer without the async path
    // just draws.
    const r = rendererRef.current;
    const s = sceneRef.current;
    const c = cameraRef.current;
    if (r && s && c && typeof r.compileAsync === 'function') {
      r.compileAsync(s, c).then(() => requestRender()).catch(() => requestRender());
    } else {
      requestRender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solids]);

  // ---- the hour: sun, sky, lamps -----------------------------------------
  useEffect(() => {
    applyHour(hour);
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, doy]);

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

    // The fill rides with the camera, a little above it, so whichever walls
    // face the viewer are lit to their colour. The sky dome rides too, so
    // its horizon never comes into reach.
    const fill = fillRef.current;
    if (fill) {
      fill.position.copy(c.position).add(new THREE.Vector3(0, 4, 0));
      fill.target.position.copy(toThree(camera.target));
      fill.target.updateMatrixWorld();
    }
    if (skyRef.current) skyRef.current.position.set(c.position.x, 0, c.position.z);

    // Walls Up / Cutaway / Down: the same slabs, only visibility flips.
    const state = wallView === 'cutaway' ? cutawayState(solids, pos, camera.target) : null;
    for (const e of wallsRef.current) {
      const show: WallShow = wallView === 'up' ? 'full' : wallView === 'down' ? 'stub' : (state?.get(e.solid.key) ?? 'full');
      e.show = show;
      if (e.ghost && show !== 'stub') setGhost(e, false);
      e.full.visible = show === 'full' || e.ghost;
      e.stub.visible = show === 'stub';
      const target = hoveredRef.current === e;
      e.outlineFull.visible = target && (show === 'full' || e.ghost);
      e.outlineStub.visible = target && show === 'stub' && !e.ghost;
    }
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, width, height, solids, wallView]);

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
    const oldHull = hullRef.current;
    if (oldHull) {
      oldHull.parent?.remove(oldHull);
      disposeObject(oldHull);
      hullRef.current = null;
    }
    const next = selectedInstanceId ? itemsRef.current.find((o) => o.userData.instanceId === selectedInstanceId) ?? null : null;
    // A hint of mint on the body and a rim around it — the product keeps its
    // own colours (a 0.5 emissive turned a black machine into a mint ghost).
    if (next) {
      tintItem(next, SELECT_HEX, 0.12);
      if (contentRef.current) {
        const hull = makeHull(next);
        contentRef.current.add(hull);
        hullRef.current = hull;
      }
    }
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

  // ---- the paint target (The Sims' wallpaper preview) ------------------------------
  // The hovered wall shows the BRUSH colour before the click and a mint
  // outline says which wall; leaving it restores its own colour. A yellow
  // glow used to sit on the wall instead — the same glow before and after
  // the click, so a paint looked like nothing happened.
  useEffect(() => {
    const prev = hoveredRef.current;
    if (prev) {
      applyWallLook(prev.paint, prev.solid, envRef.current);
      prev.outlineFull.visible = false;
      prev.outlineStub.visible = false;
      setGhost(prev, false);
    }
    const next = hover ? wallsRef.current.find((e) => sameHit(hover, e.solid.hit)) ?? null : null;
    if (next) {
      if (brushHex !== undefined) {
        applyWallLook(next.paint, { hex: brushHex ?? BARE_PLASTER_HEX, finish: brushHex ? brushFinish : null }, envRef.current);
      }
      // A cut wall under the brush stands up as a ghost so the whole face previews.
      const ghost = brushHex !== undefined && next.show === 'stub';
      setGhost(next, ghost);
      next.outlineFull.visible = next.show === 'full' || ghost;
      next.outlineStub.visible = next.show === 'stub' && !ghost;
    }
    hoveredRef.current = next;
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, solids, brushHex, brushFinish]);

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
        const wall = hits[0];
        if (!wall) return null;
        // What is under the cursor is what gets hit: an item (its exact
        // catalog box — the Sims pick the box, and a hollow frame must not
        // let the brush through) or the floor in front of the wall blocks
        // the brush; the wall behind a treadmill used to take the paint.
        let block = Infinity;
        const box = new THREE.Box3();
        const p = new THREE.Vector3();
        for (const o of itemsRef.current) {
          box.setFromObject(o);
          if (!box.isEmpty() && ray.ray.intersectBox(box, p)) block = Math.min(block, p.distanceTo(ray.ray.origin));
        }
        const floorHit = ray.intersectObjects(floorsRef.current, false)[0];
        if (floorHit) block = Math.min(block, floorHit.distance);
        if (block < wall.distance - 1e-4) return null;
        return (wall.object.userData.hit as WallHit | undefined) ?? null;
      },
      wallMaterial(hit) {
        const e = wallsRef.current.find((x) => sameHit(hit, x.solid.hit));
        if (!e) return null;
        return {
          hex: `#${e.paint.color.getHexString().toUpperCase()}`,
          baseHex: e.baseHex,
          finish: e.solid.finish ?? null,
          roughness: e.paint.roughness,
          sheen: e.paint.specularIntensity,
          hasMap: !!e.paint.map,
          show: e.show,
        };
      },
      tune(opts) {
        // DEV bridge: bisect the rig live (a probe sets one thing at a time).
        const s = sceneRef.current;
        if (!s) return;
        s.traverse((o) => {
          const l = o as THREE.Light;
          if ((l as THREE.HemisphereLight).isHemisphereLight && opts.hemi !== undefined) l.intensity = opts.hemi;
          if ((l as THREE.DirectionalLight).isDirectionalLight) {
            if (l === sunRef.current && opts.sun !== undefined) l.intensity = opts.sun;
            if (l === fillRef.current && opts.fill !== undefined) l.intensity = opts.fill;
          }
        });
        if (opts.env !== undefined) {
          for (const e of wallsRef.current) {
            e.paint.envMap = opts.env && e.paint.specularIntensity > 0 ? envRef.current : null;
            e.paint.needsUpdate = true;
          }
        }
        if (opts.normals !== undefined) {
          for (const e of wallsRef.current) {
            e.paint.normalScale.set(opts.normals, opts.normals);
            e.paint.needsUpdate = true;
          }
        }
        if (opts.maps !== undefined) {
          for (const e of wallsRef.current) {
            e.paint.map = opts.maps ? wallTextures().plasterMap : null;
            e.paint.needsUpdate = true;
          }
        }
        requestRender();
      },
      samplePixel(x, y) {
        const r = rendererRef.current;
        const s = sceneRef.current;
        const c = cameraRef.current;
        if (!r || !s || !c) return null;
        // Render now and read straight back, before the compositor swaps.
        r.render(s, c);
        const gl = r.getContext();
        const dpr = r.getPixelRatio();
        const px = new Uint8Array(4);
        gl.readPixels(Math.round(x * dpr), Math.round((height - y) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { r: px[0], g: px[1], b: px[2] };
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
        // The body's own surface first (precise for a tap on a leg or a screen)…
        const hits = ray.intersectObjects(itemsRef.current, true);
        const root = hits.length ? itemRootOf(hits[0].object) : null;
        if (root) return { instanceId: root.userData.instanceId as string };
        // …then the exact catalog box the fit guarantees: a treadmill is air
        // above its deck, a lamp is a thin pole — the Sims pick the box.
        let best: { instanceId: string; d: number } | null = null;
        const box = new THREE.Box3();
        const p = new THREE.Vector3();
        for (const o of itemsRef.current) {
          box.setFromObject(o);
          if (box.isEmpty() || !ray.ray.intersectBox(box, p)) continue;
          const d = p.distanceTo(ray.ray.origin);
          if (!best || d < best.d) best = { instanceId: o.userData.instanceId as string, d };
        }
        return best ? { instanceId: best.instanceId } : null;
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
        // The pad and the contact shadow ride with the body they mark.
        const pad = padRef.current;
        if (pad && selectedRootRef.current === root) {
          let padHome = previewRef.current.get(`pad:${instanceId}`);
          if (!padHome) {
            padHome = pad.position.clone();
            previewRef.current.set(`pad:${instanceId}`, padHome);
          }
          pad.position.set(padHome.x + dxM, padHome.y, padHome.z + dyM);
        }
        const shadow = shadowsRef.current.find((s) => s.userData.key === `shadow-${root.userData.key}`);
        if (shadow) {
          let shadowHome = previewRef.current.get(`shadow:${instanceId}`);
          if (!shadowHome) {
            shadowHome = shadow.position.clone();
            previewRef.current.set(`shadow:${instanceId}`, shadowHome);
          }
          shadow.position.set(shadowHome.x + dxM, shadowHome.y, shadowHome.z + dyM);
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
        const shadowHome = previewRef.current.get(`shadow:${instanceId}`);
        if (root && shadowHome) {
          const shadow = shadowsRef.current.find((s) => s.userData.key === `shadow-${root.userData.key}`);
          if (shadow) shadow.position.copy(shadowHome);
        }
        previewRef.current.delete(instanceId);
        previewRef.current.delete(`pad:${instanceId}`);
        previewRef.current.delete(`shadow:${instanceId}`);
        requestRender();
      },
      dressing() {
        let joinery = 0;
        let shades = 0;
        for (const e of wallsRef.current) {
          const node = e.show === 'full' ? e.full : e.show === 'stub' ? e.stub : null;
          if (!node) continue;
          node.traverse((o) => {
            if (o.userData?.joinery && o.userData.joinery !== 'wall') joinery += 1;
            if (o.name === 'corner-shades') shades += o.children.length;
          });
        }
        return {
          joinery,
          shades,
          lamps: lampsRef.current.length,
          contactShadows: shadowsRef.current.length,
          floors: floorsRef.current.map((f) => ({ key: f.userData.key as string, kind: String(f.userData.kind ?? '') })),
          bodies: itemsRef.current.filter((o) => o.userData.body).length,
          artBoxes: itemsRef.current.filter((o) => o.userData.art).length,
        };
      },
      debug() {
        const r = rendererRef.current;
        return {
          frames: framesRef.current,
          children: contentRef.current?.children.length ?? 0,
          camera: cameraRef.current?.position.toArray() ?? [],
          target: targetRef.current,
          renderer: r ? `${r.domElement.width}x${r.domElement.height} calls=${r.info.render.calls} tris=${r.info.render.triangles}` : 'none',
          hour: hour ?? null,
          sun: sunStateRef.current,
        };
      },
    }),
    [width, height, hour],
  );

  return <canvas ref={canvasRef} data-testid="wallpaint-3d-gl" style={{ display: 'block', width: '100%', height: '100%' }} />;
});

export default ThreeStage;
