/**
 * roomView3d — the Sims-style "room view" for the wall-paint tool
 * (Vic 2026-09-14: "it's not quite like The Sims … a more 3D option needs
 * to be available when you add paint to the wall").
 *
 * PURE geometry + shading: no DOM, no Konva, no store. The React component
 * (`components/RoomView3D.tsx`) owns the <canvas>, the pointer gestures and
 * the store reads; everything it needs to draw or hit-test comes from here,
 * so the truth table in `__tests__/roomView3d.test.ts` is real evidence.
 *
 * THE MODEL
 * ---------
 * World space is the plan's own frame extended with height: x east, y south
 * (the plan is y-down, exactly as on paper), z UP in metres. A dollhouse
 * ORBIT camera looks at a target from azimuth / elevation / distance, with
 * a perspective projection — the classic build-mode camera.
 *
 * Every drawable thing becomes a `SceneFace` — a planar polygon in world
 * metres with an optional list of holes (door / window openings are holes in
 * a wall face, filled even-odd). Faces are then projected, shaded by their
 * orientation to a fixed key light, and painted far-to-near (painter's
 * algorithm on centroid depth), which is all a build-mode view of rooms of
 * this size needs.
 *
 * CUTAWAY — the rule that makes it read as The Sims
 * ------------------------------------------------
 * A room edge is painted on its INNER face. If the camera is on the inner
 * side of that wall's plane the face is drawn at full height (it is a far
 * wall). If the camera is on the OUTER side the wall would stand between
 * the viewer and the room, so it drops to a knee-high STUB — "walls
 * cutaway". A wall shared by two rooms is simply the far wall of the room
 * on the camera's side, so it stays up for that room and is never drawn
 * twice. Free-standing walls drop to a stub when they sit nearer the camera
 * than the target.
 */

import type { Polygon, Vertex } from '../lib/geometry';
import { cmToM, rotatedFootprint } from '../lib/geometry';
import { roomEdges } from './wallEdges';
import { BARE_PLASTER_HEX, OPENING_DOOR_HEIGHT_M, OPENING_WINDOW_HEIGHT_M, sheenOfFinish } from '../data/wallPaints';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitCamera {
  /** Where the camera looks, world metres. */
  target: Vec3;
  /** Rotation about the vertical axis, radians. 0 = camera SOUTH of the target looking north. */
  azimuthRad: number;
  /** Angle above the ground plane, radians. */
  elevationRad: number;
  /** Camera-to-target distance, metres. */
  distanceM: number;
  /** Vertical field of view, radians. */
  fovRad: number;
}

export type SceneFaceKind =
  | 'floor'
  | 'wall'
  | 'wall-stub'
  | 'wall-cap'
  | 'glass'
  | 'frame'
  | 'item'
  | 'item-top';

/** What a click on a wall face paints. */
export interface WallHit {
  side?: import('./wallConstruction').WallSide;
  kind: 'edge' | 'free';
  roomId?: string;
  edgeIndex?: number;
  wallId?: string;
}

export interface SceneFace {
  key: string;
  kind: SceneFaceKind;
  /** World-space polygon. */
  pts: Vec3[];
  /** Holes (openings) filled even-odd. */
  holes?: Vec3[][];
  /** Base colour before shading. */
  fill: string;
  /** Outline colour, if any. */
  stroke?: string;
  /** Alpha 0–1 (glass panes). */
  alpha?: number;
  /** Wall faces carry what a click paints. */
  hit?: WallHit;
  /** Skip the key-light shading (glass, frames). */
  flat?: boolean;
  /** Order nudge among faces of equal depth (caps over faces, tops over sides). */
  order?: number;
  /** Paint sheen 0–1. The fallback painter draws a highlight down the face. */
  sheen?: number;
}

export interface ProjectedFace {
  face: SceneFace;
  pts: Vec2[];
  holes: Vec2[][];
  /** Camera-space depth of the centroid, metres (bigger = further). */
  depth: number;
  /** Shaded fill colour. */
  fill: string;
}

export interface SceneRoomInput {
  id: string;
  name: string;
  polygon: Polygon;
  openings?: Array<{ edgeIndex: number; offsetM: number; widthM: number; kind: 'door' | 'doorway' | 'window'; sillM?: number }>;
  /** Resolved colour per painted edge (paint product hex or the chosen tint). */
  wallColourByEdge?: Map<number, string>;
  /** The paint's finish per painted edge (3D Mode: roughness / sheen); absent = bare plaster. */
  wallFinishByEdge?: Map<number, string>;
  exteriorColourByEdge?: Map<number, string>;
  exteriorFinishByEdge?: Map<number, string>;
  wallConstructionByEdge?: Map<number, import('./wallConstruction').WallConstruction>;
  floorHex?: string;
  /** What the laid floor reads as (designer/floorKind.ts) and its tile size, for the 3D surface (P3). */
  floorKind?: string;
  floorTileM?: number;
  /** Ignored for walls/floor when `kind === 'outdoor'`; items still render. */
  kind?: string;
  items?: SceneItemInput[];
}

export interface SceneFreeWallInput {
  construction?: import('./wallConstruction').WallConstruction;
  exteriorHex?: string;
  exteriorFinish?: string;
  id: string;
  a: Vertex;
  b: Vertex;
  thicknessM?: number;
  colourHex?: string;
  finish?: string;
}

export interface SceneItemInput {
  /** A lamp: the 3D stage lights it after dark (P3). */
  emitsLight?: boolean;
  /** Height of the lamp's light source above the floor, metres. */
  lightMountM?: number;
  instanceId: string;
  /** Footprint top-left, metres (the plan's own convention). */
  x: number;
  y: number;
  rotation: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** 'floor' | 'wall' | 'surface' | 'ceiling' | 'roof' */
  placement?: string;
  mountHeightCm?: number;
  fill?: string;
  /**
   * The product's own art for a product with NO body (Vic 2026-09-20: no
   * stand-in models — "no random table"): the plan's top-down image lies on
   * the box's top, the photo dresses its sides, so 3D shows what 2D shows.
   */
  artTopUrl?: string;
  artSideUrl?: string;
  /** 3D Mode bodies (2026-09-17): the product this is, and how its body is fitted. */
  productId?: string;
  frontEdge?: 'top' | 'bottom' | 'left' | 'right';
  /** A textured body (glTF) fitted to `dimensions_cm`; absent → the shaded box. */
  meshUrl?: string;
  /** Fit hints from the model manifest. */
  modelFront?: '+z' | '-z' | '+x' | '-x';
  lengthAxis?: 'x' | 'z' | 'auto';
  /** Which model axis points up ('+y' glTF default; '-z' lays a photo-slab panel face-up). */
  modelUp?: '+y' | '+z' | '-z';
}

export interface SceneInput {
  rooms: SceneRoomInput[];
  walls?: SceneFreeWallInput[];
  wallHeightM: number;
  /** Camera position — decides cutaway and back-face culling. */
  cameraPos: Vec3;
  /** Camera target — free walls nearer than this drop to stubs. */
  cameraTarget: Vec3;
  /** Highlight this wall (hover) — its face gets `SELECT` tint. */
  hover?: WallHit | null;
}

// ---------------------------------------------------------------------------
// Palette (the view's own; the plan's tokens stay in blueprintTheme)
// ---------------------------------------------------------------------------

/** Unpainted plaster — same value the plan's 2.5D lift uses. */
/** Bare, unpainted plaster — shared with the 2D lift (see `BARE_PLASTER_HEX`). */
export const PLASTER_HEX = BARE_PLASTER_HEX;
/** Bare floor when no finish is laid. */
export const BARE_FLOOR_HEX = '#F1EBDD';
/** Ground plane beyond the rooms. */
export const GROUND_HEX = '#E7E2D8';
/** Wall top caps + outlines. */
export const WALL_CAP_HEX = '#3A3936';
/** Window glass. */
export const GLASS_HEX = '#BFD9EA';
/** Opening frames. */
export const FRAME_HEX = '#6B665C';
/** Hovered wall tint. */
export const HOVER_HEX = '#FFD98A';
/** Knee-high cutaway stub, metres. */
export const STUB_HEIGHT_M = 0.32;
/** Drawn wall thickness for caps and free walls, metres. */
export const CAP_THICKNESS_M = 0.14;

/** Neutral box colours for furniture by catalog category. */
const ITEM_FILL: Record<string, string> = {
  furniture: '#C9B79C',
  seating: '#B9A68F',
  tables: '#C4AE8E',
  beds: '#D8CDBB',
  appliance: '#D9D9D4',
  lighting: '#F1E4C2',
  plant: '#8FA68A',
  plants: '#8FA68A',
  decor: '#D6CCB9',
  storage: '#C2B39B',
  fitness: '#7A7A78',
  massage: '#B79C8F',
  sauna: '#C9A77A',
  'ice-bath': '#A9C4CF',
  'sleep-pod': '#C5C9CC',
  'ergo-chair': '#8E8E8C',
  solar: '#38445A',
  flooring: '#B7AA95',
  walls: '#D6CFC2',
  outdoor: '#A6B39B',
};
export function itemFillForCategory(category: string | undefined): string {
  return (category && ITEM_FILL[category]) || '#CFC7B8';
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** Camera position for an orbit camera. Azimuth 0 = south of the target. */
export function cameraPosition(cam: OrbitCamera): Vec3 {
  const c = Math.cos(cam.elevationRad);
  return {
    x: cam.target.x + cam.distanceM * c * Math.sin(cam.azimuthRad),
    y: cam.target.y + cam.distanceM * c * Math.cos(cam.azimuthRad),
    z: cam.target.z + cam.distanceM * Math.sin(cam.elevationRad),
  };
}

interface CameraBasis {
  pos: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

function cameraBasis(cam: OrbitCamera): CameraBasis {
  const pos = cameraPosition(cam);
  const forward = norm(sub(cam.target, pos));
  const worldUp: Vec3 = { x: 0, y: 0, z: 1 };
  // Standing south of the room looking north, east must be on the right:
  // up × forward gives (+x) for the azimuth-0 camera (verified in tests).
  const right = norm(cross(worldUp, forward));
  const up = cross(forward, right);
  return { pos, right, up, forward };
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * World → screen. Returns null for points at/behind the camera plane so a
 * caller can drop the face rather than draw garbage.
 */
export function projectPoint(p: Vec3, basis: CameraBasis, cam: OrbitCamera, vp: Viewport): { x: number; y: number; depth: number } | null {
  const v = sub(p, basis.pos);
  const depth = dot(v, basis.forward);
  if (depth <= 0.05) return null;
  const f = vp.height / 2 / Math.tan(cam.fovRad / 2);
  return {
    x: vp.width / 2 + (dot(v, basis.right) / depth) * f,
    y: vp.height / 2 - (dot(v, basis.up) / depth) * f,
    depth,
  };
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Multiply a hex colour by `f` (0 = black, 1 = unchanged, >1 lighter). */
export function shadeHex(hex: string, f: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(rgb[0])},${c(rgb[1])},${c(rgb[2])})`;
}

/** Mix two hex colours, t = weight of `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const m = (i: number) => Math.round(ra[i] + (rb[i] - ra[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/** Fixed key light: high, from the south-west, so east/north faces read lighter. */
const KEY_LIGHT = norm({ x: -0.35, y: 0.45, z: 0.82 });

function faceNormal(pts: Vec3[]): Vec3 {
  // Newell's method — robust for any planar polygon, any winding.
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    nx += (p.y - q.y) * (p.z + q.z);
    ny += (p.z - q.z) * (p.x + q.x);
    nz += (p.x - q.x) * (p.y + q.y);
  }
  return norm({ x: nx, y: ny, z: nz });
}

function centroid(pts: Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = pts.length || 1;
  return { x: x / n, y: y / n, z: z / n };
}

/**
 * Shade a face by its orientation to the key light. The normal is flipped
 * to face the camera first, so winding never matters. Range 0.72–1.06.
 */
export function shadeForFace(pts: Vec3[], cameraPos: Vec3): number {
  let n = faceNormal(pts);
  const c = centroid(pts);
  if (dot(n, sub(cameraPos, c)) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
  const lambert = Math.max(0, dot(n, KEY_LIGHT));
  return 0.72 + 0.34 * lambert;
}

// ---------------------------------------------------------------------------
// Scene building
// ---------------------------------------------------------------------------

/** Signed side of the camera relative to a wall plane: > 0 = on the inward side. */
function cameraSide(a: Vertex, b: Vertex, inward: Vec2, cameraPos: Vec3): number {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return (cameraPos.x - mx) * inward.x + (cameraPos.y - my) * inward.y;
}

/**
 * Inward unit normal of a CW (y-down) polygon edge = its LEFT normal
 * (the same convention as the plan's 2.5D lift in RoomCanvas: for the top
 * wall running east, inward is +y, i.e. down the paper into the room).
 */
function inwardNormal(a: Vertex, b: Vertex): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: -dy / l, y: dx / l };
}

function quadOnEdge(a: Vertex, b: Vertex, z0: number, z1: number, t0 = 0, t1 = 1): Vec3[] {
  const p = (t: number): Vertex => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const pa = p(t0);
  const pb = p(t1);
  return [
    { x: pa.x, y: pa.y, z: z0 },
    { x: pb.x, y: pb.y, z: z0 },
    { x: pb.x, y: pb.y, z: z1 },
    { x: pa.x, y: pa.y, z: z1 },
  ];
}

function capOnEdge(a: Vertex, b: Vertex, outward: Vec2, z: number, thick: number): Vec3[] {
  const ox = outward.x * thick;
  const oy = outward.y * thick;
  return [
    { x: a.x, y: a.y, z },
    { x: b.x, y: b.y, z },
    { x: b.x + ox, y: b.y + oy, z },
    { x: a.x + ox, y: a.y + oy, z },
  ];
}

function sameHit(a: WallHit | null | undefined, b: WallHit): boolean {
  if (!a) return false;
  if (a.kind !== b.kind) return false;
  return a.kind === 'edge'
    ? a.roomId === b.roomId && a.edgeIndex === b.edgeIndex
    : a.wallId === b.wallId;
}

/**
 * Build every face of the level. Cutaway and culling decided here from the
 * camera position; projection is a separate step so hit-testing can reuse
 * the same faces.
 */
export function buildScene(input: SceneInput): SceneFace[] {
  const faces: SceneFace[] = [];
  const H = Math.max(0.5, input.wallHeightM);
  const cam = input.cameraPos;

  for (const room of input.rooms) {
    const indoor = room.kind !== 'outdoor' && room.polygon.length >= 3;
    if (indoor) {
      // Floor.
      faces.push({
        key: `floor-${room.id}`,
        kind: 'floor',
        pts: room.polygon.map((v) => ({ x: v.x, y: v.y, z: 0 })),
        fill: room.floorHex ?? BARE_FLOOR_HEX,
        stroke: 'rgba(58,57,54,0.35)',
        order: -100,
      });

      for (const e of roomEdges(room)) {
        const inward = inwardNormal(e.a, e.b);
        const outward: Vec2 = { x: -inward.x, y: -inward.y };
        const hit: WallHit = { kind: 'edge', roomId: room.id, edgeIndex: e.index };
        const painted = room.wallColourByEdge?.get(e.index);
        const baseHex = painted ?? PLASTER_HEX;
        const sheen = sheenOfFinish(room.wallFinishByEdge?.get(e.index));
        const hovered = sameHit(input.hover, hit);
        const fill = hovered ? mixHex(baseHex, HOVER_HEX, 0.45) : baseHex;
        const side = cameraSide(e.a, e.b, inward, cam);

        if (side > 0) {
          // Far wall: the inner face at full height, openings as holes.
          const holes: Vec3[][] = [];
          for (const o of room.openings ?? []) {
            if (o.edgeIndex !== e.index) continue;
            const t0 = Math.max(0, (o.offsetM - o.widthM / 2) / e.lengthM);
            const t1 = Math.min(1, (o.offsetM + o.widthM / 2) / e.lengthM);
            if (t1 <= t0) continue;
            const isWin = o.kind === 'window';
            const sill = isWin ? Math.min(o.sillM ?? 0.9, H) : 0;
            const top = Math.min(isWin ? sill + OPENING_WINDOW_HEIGHT_M : OPENING_DOOR_HEIGHT_M, H);
            if (top <= sill) continue;
            holes.push(quadOnEdge(e.a, e.b, sill, top, t0, t1));
            // Window glass sits in the hole, slightly behind the face plane
            // so it never fights the wall for depth.
            if (isWin) {
              const glass = quadOnEdge(e.a, e.b, sill, top, t0, t1).map((p) => ({
                x: p.x - inward.x * 0.02,
                y: p.y - inward.y * 0.02,
                z: p.z,
              }));
              faces.push({ key: `glass-${room.id}-${e.index}-${o.offsetM}`, kind: 'glass', pts: glass, fill: GLASS_HEX, alpha: 0.72, flat: true, order: 5 });
            }
            faces.push({
              key: `frame-${room.id}-${e.index}-${o.offsetM}`,
              kind: 'frame',
              pts: quadOnEdge(e.a, e.b, sill, top, t0, t1),
              fill: 'transparent',
              stroke: FRAME_HEX,
              flat: true,
              order: 6,
            });
          }
          faces.push({
            key: `wall-${room.id}-${e.index}`,
            kind: 'wall',
            pts: quadOnEdge(e.a, e.b, 0, H),
            holes: holes.length ? holes : undefined,
            fill,
            stroke: WALL_CAP_HEX,
            hit,
            sheen,
          });
          faces.push({
            key: `cap-${room.id}-${e.index}`,
            kind: 'wall-cap',
            pts: capOnEdge(e.a, e.b, outward, H, CAP_THICKNESS_M),
            fill: WALL_CAP_HEX,
            flat: true,
            order: 10,
          });
        } else {
          // Near wall: cut away to a stub so the room stays visible. The
          // stub shows its OUTER face and top; a click on it still paints
          // this edge (its inner face is what the paint goes on).
          const stubZ = Math.min(STUB_HEIGHT_M, H);
          const outerA: Vertex = { x: e.a.x + outward.x * CAP_THICKNESS_M, y: e.a.y + outward.y * CAP_THICKNESS_M };
          const outerB: Vertex = { x: e.b.x + outward.x * CAP_THICKNESS_M, y: e.b.y + outward.y * CAP_THICKNESS_M };
          faces.push({
            key: `stub-${room.id}-${e.index}`,
            kind: 'wall-stub',
            pts: quadOnEdge(outerA, outerB, 0, stubZ),
            fill: room.exteriorColourByEdge?.get(e.index) ?? PLASTER_HEX,
            stroke: WALL_CAP_HEX,
            hit: { ...hit, side: 'exterior' },
            order: 20,
          });
          // The inner face of the stub — painted, seen from above.
          faces.push({
            key: `stub-in-${room.id}-${e.index}`,
            kind: 'wall-stub',
            pts: quadOnEdge(e.a, e.b, 0, stubZ),
            fill,
            stroke: WALL_CAP_HEX,
            hit,
            sheen,
            order: 19,
          });
          faces.push({
            key: `stubcap-${room.id}-${e.index}`,
            kind: 'wall-cap',
            pts: capOnEdge(e.a, e.b, outward, stubZ, CAP_THICKNESS_M),
            fill: WALL_CAP_HEX,
            flat: true,
            hit,
            order: 21,
          });
        }
      }
    }

    // Items — simple shaded boxes; the plan keeps the photos.
    for (const it of room.items ?? []) {
      const fp = rotatedFootprint({ lengthM: cmToM(it.lengthCm), widthM: cmToM(it.widthCm) }, it.rotation);
      const w = fp.w;
      const d = fp.h;
      if (w <= 0 || d <= 0) continue;
      const hItem = Math.max(0.05, Math.min(cmToM(it.heightCm), H));
      let z0 = 0;
      if (it.placement === 'ceiling') z0 = Math.max(0, H - hItem);
      else if (it.placement === 'wall') z0 = Math.min(Math.max(0, cmToM(it.mountHeightCm ?? 120)), Math.max(0, H - hItem));
      const z1 = Math.min(H, z0 + hItem);
      const x0 = it.x;
      const y0 = it.y;
      const x1 = it.x + w;
      const y1 = it.y + d;
      const fill = it.fill ?? '#CFC7B8';
      const box = (pts: Vec3[], kind: SceneFaceKind, suffix: string, order: number): SceneFace => ({
        key: `item-${it.instanceId}-${suffix}`,
        kind,
        pts,
        fill,
        stroke: 'rgba(58,57,54,0.55)',
        order,
      });
      const c: Vec3 = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 };
      const sides: Array<{ pts: Vec3[]; n: Vec3; s: string }> = [
        { pts: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x0, y: y0, z: z1 }], n: { x: 0, y: -1, z: 0 }, s: 'n' },
        { pts: [{ x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y0, z: z1 }], n: { x: 1, y: 0, z: 0 }, s: 'e' },
        { pts: [{ x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }, { x: x0, y: y1, z: z1 }, { x: x1, y: y1, z: z1 }], n: { x: 0, y: 1, z: 0 }, s: 's' },
        { pts: [{ x: x0, y: y1, z: z0 }, { x: x0, y: y0, z: z0 }, { x: x0, y: y0, z: z1 }, { x: x0, y: y1, z: z1 }], n: { x: -1, y: 0, z: 0 }, s: 'w' },
      ];
      for (const side of sides) {
        // Back-face culling: only sides that face the camera.
        if (dot(side.n, sub(cam, c)) <= 0) continue;
        faces.push(box(side.pts, 'item', side.s, 30));
      }
      if (cam.z > z1) {
        faces.push(box([{ x: x0, y: y0, z: z1 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }], 'item-top', 'top', 31));
      }
    }
  }

  // Free-standing walls — a slab; both long faces carry the wall's paint.
  const targetDepthRef = input.cameraTarget;
  for (const w of input.walls ?? []) {
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    if (len < 1e-6) continue;
    const t = (w.thicknessM ?? CAP_THICKNESS_M) / 2;
    const nx = (w.b.y - w.a.y) / len;
    const ny = -(w.b.x - w.a.x) / len;
    const hit: WallHit = { kind: 'free', wallId: w.id };
    const hovered = sameHit(input.hover, hit);
    const baseHex = w.colourHex ?? PLASTER_HEX;
    const sheen = sheenOfFinish(w.finish);
    const fill = hovered ? mixHex(baseHex, HOVER_HEX, 0.45) : baseHex;
    // Nearer the camera than the target → stub, like a front wall.
    const mid: Vec3 = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2, z: 0 };
    const dWall = Math.hypot(mid.x - cam.x, mid.y - cam.y);
    const dTarget = Math.hypot(targetDepthRef.x - cam.x, targetDepthRef.y - cam.y);
    const hFace = dWall < dTarget - 0.6 ? Math.min(STUB_HEIGHT_M, H) : H;
    const sideA: Vertex = { x: w.a.x + nx * t, y: w.a.y + ny * t };
    const sideB: Vertex = { x: w.b.x + nx * t, y: w.b.y + ny * t };
    const otherA: Vertex = { x: w.a.x - nx * t, y: w.a.y - ny * t };
    const otherB: Vertex = { x: w.b.x - nx * t, y: w.b.y - ny * t };
    const facesOfSlab: Array<{ pts: Vec3[]; n: Vec3; s: string }> = [
      { pts: quadOnEdge(sideA, sideB, 0, hFace), n: { x: nx, y: ny, z: 0 }, s: 'p' },
      { pts: quadOnEdge(otherA, otherB, 0, hFace), n: { x: -nx, y: -ny, z: 0 }, s: 'q' },
      { pts: quadOnEdge(sideA, otherA, 0, hFace), n: { x: (w.a.x - w.b.x) / len, y: (w.a.y - w.b.y) / len, z: 0 }, s: 'a' },
      { pts: quadOnEdge(sideB, otherB, 0, hFace), n: { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len, z: 0 }, s: 'b' },
    ];
    for (const f of facesOfSlab) {
      if (dot(f.n, sub(cam, mid)) <= 0) continue;
      faces.push({ key: `fw-${w.id}-${f.s}`, kind: hFace < H ? 'wall-stub' : 'wall', pts: f.pts, fill, stroke: WALL_CAP_HEX, hit, sheen, order: 15 });
    }
    faces.push({
      key: `fw-${w.id}-cap`,
      kind: 'wall-cap',
      pts: [
        { x: sideA.x, y: sideA.y, z: hFace },
        { x: sideB.x, y: sideB.y, z: hFace },
        { x: otherB.x, y: otherB.y, z: hFace },
        { x: otherA.x, y: otherA.y, z: hFace },
      ],
      fill: WALL_CAP_HEX,
      flat: true,
      hit,
      order: 16,
    });
  }

  return faces;
}

// ---------------------------------------------------------------------------
// Projection + ordering
// ---------------------------------------------------------------------------

/**
 * Project and shade every face, then order far → near (floors first). A face
 * with any vertex behind the camera is dropped rather than drawn wrong.
 */
export function projectScene(faces: SceneFace[], cam: OrbitCamera, vp: Viewport): ProjectedFace[] {
  const basis = cameraBasis(cam);
  const out: ProjectedFace[] = [];
  for (const face of faces) {
    const pts: Vec2[] = [];
    let depthSum = 0;
    let ok = true;
    for (const p of face.pts) {
      const s = projectPoint(p, basis, cam, vp);
      if (!s) {
        ok = false;
        break;
      }
      pts.push({ x: s.x, y: s.y });
      depthSum += s.depth;
    }
    if (!ok || pts.length < 3) continue;
    const holes: Vec2[][] = [];
    for (const hole of face.holes ?? []) {
      const hp: Vec2[] = [];
      let hok = true;
      for (const p of hole) {
        const s = projectPoint(p, basis, cam, vp);
        if (!s) {
          hok = false;
          break;
        }
        hp.push({ x: s.x, y: s.y });
      }
      if (hok && hp.length >= 3) holes.push(hp);
    }
    const shade = face.flat ? 1 : shadeForFace(face.pts, basis.pos);
    const fill = face.fill === 'transparent' ? face.fill : face.flat ? face.fill : shadeHex(face.fill, shade);
    out.push({ face, pts, holes, depth: depthSum / face.pts.length, fill });
  }
  out.sort((a, b) => {
    // Floors always underneath everything.
    const fa = a.face.kind === 'floor' ? 1 : 0;
    const fb = b.face.kind === 'floor' ? 1 : 0;
    if (fa !== fb) return fb - fa;
    if (fa && fb) return b.depth - a.depth;
    const dd = b.depth - a.depth;
    if (Math.abs(dd) > 0.02) return dd;
    return (a.face.order ?? 0) - (b.face.order ?? 0);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

export function pointInPoly(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersects = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-12) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * The wall under a screen point: the NEAREST wall face containing it. Holes
 * (doorways, windows) are not walls — a click through a doorway reaches
 * whatever wall is behind it, exactly as it would in the room.
 */
export function hitTestWall(projected: ProjectedFace[], x: number, y: number): WallHit | null {
  let best: ProjectedFace | null = null;
  const p = { x, y };
  for (const f of projected) {
    if (!f.face.hit) continue;
    if (!pointInPoly(p, f.pts)) continue;
    if (f.holes.some((h) => pointInPoly(p, h))) continue;
    if (!best || f.depth < best.depth) best = f;
  }
  return best?.face.hit ?? null;
}

// ---------------------------------------------------------------------------
// Camera fitting
// ---------------------------------------------------------------------------

export interface Bounds2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(rooms: Array<{ polygon: Polygon; kind?: string }>, walls: Array<{ a: Vertex; b: Vertex }> = []): Bounds2 | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (v: Vertex) => {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  };
  for (const r of rooms) {
    if (r.kind === 'outdoor') continue;
    for (const v of r.polygon) add(v);
  }
  for (const w of walls) {
    add(w.a);
    add(w.b);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

export const DEFAULT_FOV_RAD = (38 * Math.PI) / 180;
export const DEFAULT_ELEVATION_RAD = (30 * Math.PI) / 180;
export const DEFAULT_AZIMUTH_RAD = (-32 * Math.PI) / 180;
export const MIN_ELEVATION_RAD = (12 * Math.PI) / 180;
export const MAX_ELEVATION_RAD = (78 * Math.PI) / 180;

/**
 * A camera that frames the whole plan from the default three-quarter angle.
 * `aspect` = width / height of the viewport; wider viewports can sit closer.
 *
 * P3 (2026-09-19, the 3D audit): the old fit left the room 6–16 % of the
 * view, floating in a void. The plan's half-diagonal plus a third of the
 * wall height, at the limiting field of view, plus a little standoff —
 * the room now fills the frame the way a Sims lot does; the wheel and the
 * pinch zoom out from there.
 */
export function fitCamera(b: Bounds2, wallHeightM: number, aspect = 1.4): OrbitCamera {
  const w = Math.max(1, b.maxX - b.minX);
  const d = Math.max(1, b.maxY - b.minY);
  const radius = Math.hypot(w, d) / 2;
  const fov = DEFAULT_FOV_RAD;
  const hfov = 2 * Math.atan(Math.tan(fov / 2) * Math.max(0.6, aspect));
  const limiting = Math.min(fov, hfov);
  const distance = (radius + wallHeightM * 0.3) / Math.tan(limiting / 2) + wallHeightM * 0.4;
  return {
    target: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: wallHeightM * 0.42 },
    azimuthRad: DEFAULT_AZIMUTH_RAD,
    elevationRad: DEFAULT_ELEVATION_RAD,
    distanceM: distance,
    fovRad: fov,
  };
}

export function clampCamera(cam: OrbitCamera, minDistance: number, maxDistance: number): OrbitCamera {
  return {
    ...cam,
    elevationRad: Math.min(MAX_ELEVATION_RAD, Math.max(MIN_ELEVATION_RAD, cam.elevationRad)),
    distanceM: Math.min(maxDistance, Math.max(minDistance, cam.distanceM)),
  };
}

// ---------------------------------------------------------------------------
// Drawing (canvas 2D) — kept here so the component is only wiring.
// ---------------------------------------------------------------------------

export interface DrawTarget {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  lineJoin: CanvasLineJoin;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(rule?: CanvasFillRule): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
}

function tracePoly(ctx: DrawTarget, pts: Vec2[]): void {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Paint an ordered projected scene onto a 2D context (already DPR-scaled). */
export function drawScene(ctx: DrawTarget, projected: ProjectedFace[], vp: Viewport, ground = GROUND_HEX): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, vp.width, vp.height);
  ctx.lineJoin = 'round';
  for (const f of projected) {
    ctx.beginPath();
    tracePoly(ctx, f.pts);
    for (const h of f.holes) tracePoly(ctx, h);
    ctx.globalAlpha = f.face.alpha ?? 1;
    if (f.fill !== 'transparent') {
      ctx.fillStyle = f.fill;
      ctx.fill('evenodd');
    }
    if (f.face.stroke) {
      ctx.strokeStyle = f.face.stroke;
      ctx.lineWidth = f.face.kind === 'frame' ? 1.5 : f.face.kind === 'wall-cap' ? 0.8 : 1;
      ctx.stroke();
    }
    const sheen = f.face.sheen ?? 0;
    if (sheen > 0.02 && f.pts.length >= 3 && 'createLinearGradient' in ctx) {
      let top = f.pts[0];
      let bot = f.pts[0];
      for (const p of f.pts) {
        if (p.y < top.y) top = p;
        if (p.y > bot.y) bot = p;
      }
      const g = (ctx as CanvasRenderingContext2D).createLinearGradient(top.x, top.y, bot.x, bot.y);
      const a = Math.min(0.55, sheen * 0.5);
      g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
      g.addColorStop(0.45, `rgba(255,255,255,${(a * 0.28).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = 1;
      ctx.fill('evenodd');
    }
  }
  ctx.globalAlpha = 1;
}
