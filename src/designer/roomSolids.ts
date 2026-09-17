/**
 * roomSolids — the 3D MODE's solid model (2026-09-17).
 *
 * Vic: "amplify the 3D that was built into the wall so the whole designer
 * has a 3D Mode … super realistic 3D version of the 2D."
 *
 * `roomView3d.ts` turns the plan into painter's-algorithm FACES for the
 * canvas view. A WebGL renderer wants SOLIDS: wall slabs with thickness and
 * openings cut through them, floor slabs, furniture bodies. This module is
 * that translation — PURE (no DOM, no Three, no store), fed by the very same
 * `SceneInput` the painter takes, so the two views can never disagree about
 * what is where. The truth table in `__tests__/roomSolids.test.ts` pins the
 * parity: every wall the painter draws full, this draws full.
 *
 * Frame: plan metres, x east, y south, z up (the painter's frame). The
 * renderer maps it to its own axes; nothing here knows about that.
 *
 * Camera-INDEPENDENT on purpose: the renderer builds every wall once (full
 * AND stub) and only toggles which one shows as the camera orbits
 * (`cutawayState`), so orbiting never rebuilds geometry.
 */
import type { Vertex } from '../lib/geometry';
import { cmToM, rotatedFootprint } from '../lib/geometry';
import { edgeKey, roomEdges, sharedEdgeMap } from './wallEdges';
import { OPENING_DOOR_HEIGHT_M, OPENING_WINDOW_HEIGHT_M } from '../data/wallPaints';
import {
  BARE_FLOOR_HEX,
  CAP_THICKNESS_M,
  PLASTER_HEX,
  STUB_HEIGHT_M,
  type SceneInput,
  type Vec2,
  type Vec3,
  type WallHit,
} from './roomView3d';

export interface WallOpeningSolid {
  /** Metres along the wall from `a`. */
  t0M: number;
  t1M: number;
  /** Metres above the floor. */
  bottomM: number;
  topM: number;
  kind: 'door' | 'doorway' | 'window';
}

export interface WallSolid {
  /** `wall-<roomId>-<edge>` for a room edge, `fw-<id>` for a free wall — the painter's keys. */
  key: string;
  hit: WallHit;
  /** The wall line. Room edges: the INNER face lies on this line and the slab grows outward. Free walls: the centreline. */
  a: Vec2;
  b: Vec2;
  lengthM: number;
  /** Unit normal pointing INTO the room (room edges) or to the slab's + side (free walls). */
  inward: Vec2;
  thicknessM: number;
  heightM: number;
  stubHeightM: number;
  /** Free walls straddle their line; room-edge slabs sit outside it. */
  centred: boolean;
  /** Paint on the face that looks into the room (free walls: both faces). */
  hex: string;
  openings: WallOpeningSolid[];
  /** Room edge shared with a neighbour: its near-side stub is skipped because the neighbour's full wall stands there. */
  shared: boolean;
  /** Free walls: cut away when nearer the camera than its target (the painter's rule). */
  free: boolean;
}

export interface FloorSolid {
  key: string;
  roomId: string;
  polygon: Vertex[];
  hex: string;
}

export interface ItemSolid {
  key: string;
  instanceId: string;
  /** Axis-aligned footprint of the rotated item, plan metres (the painter's convention). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
  rotationDeg: number;
  hex: string;
  placement?: string;
  /** Catalog truth for the body's fit (metres). */
  lengthM: number;
  widthM: number;
  heightM: number;
  productId?: string;
  frontEdge?: 'top' | 'bottom' | 'left' | 'right';
  meshUrl?: string;
  modelFront?: '+z' | '-z' | '+x' | '-x';
  lengthAxis?: 'x' | 'z' | 'auto';
  modelUp?: '+y' | '+z' | '-z';
}

export interface SceneSolids {
  wallHeightM: number;
  floors: FloorSolid[];
  walls: WallSolid[];
  items: ItemSolid[];
}

/** Inward normal of a clockwise (y-down) room edge: `(-dy, dx)` — the painter's rule. */
export function inwardNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: -dy / l, y: dx / l };
}

/** > 0 when the camera is on the inward side of the wall's plane. */
export function cameraSide(a: Vec2, b: Vec2, inward: Vec2, cam: Vec3): number {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return (cam.x - mx) * inward.x + (cam.y - my) * inward.y;
}

/** Everything the plan says is there, with no camera in the picture. */
export function buildSolids(input: SceneInput): SceneSolids {
  const H = Math.max(0.5, input.wallHeightM);
  const floors: FloorSolid[] = [];
  const walls: WallSolid[] = [];
  const items: ItemSolid[] = [];

  const indoorRooms = input.rooms.filter((r) => r.kind !== 'outdoor' && r.polygon.length >= 3);
  const shared = sharedEdgeMap(indoorRooms.map((r) => ({ id: r.id, polygon: r.polygon })));

  for (const room of input.rooms) {
    const indoor = room.kind !== 'outdoor' && room.polygon.length >= 3;
    if (indoor) {
      floors.push({ key: `floor-${room.id}`, roomId: room.id, polygon: room.polygon.map((v) => ({ x: v.x, y: v.y })), hex: room.floorHex ?? BARE_FLOOR_HEX });

      for (const e of roomEdges(room)) {
        const inward = inwardNormal(e.a, e.b);
        const openings: WallOpeningSolid[] = [];
        for (const o of room.openings ?? []) {
          if (o.edgeIndex !== e.index) continue;
          const t0 = Math.max(0, o.offsetM - o.widthM / 2);
          const t1 = Math.min(e.lengthM, o.offsetM + o.widthM / 2);
          if (t1 <= t0) continue;
          const isWin = o.kind === 'window';
          const sill = isWin ? Math.min(o.sillM ?? 0.9, H) : 0;
          const top = Math.min(isWin ? sill + OPENING_WINDOW_HEIGHT_M : OPENING_DOOR_HEIGHT_M, H);
          if (top <= sill) continue;
          openings.push({ t0M: t0, t1M: t1, bottomM: sill, topM: top, kind: o.kind });
        }
        walls.push({
          key: `wall-${room.id}-${e.index}`,
          hit: { kind: 'edge', roomId: room.id, edgeIndex: e.index },
          a: { x: e.a.x, y: e.a.y },
          b: { x: e.b.x, y: e.b.y },
          lengthM: e.lengthM,
          inward,
          thicknessM: CAP_THICKNESS_M,
          heightM: H,
          stubHeightM: Math.min(STUB_HEIGHT_M, H),
          centred: false,
          hex: room.wallColourByEdge?.get(e.index) ?? PLASTER_HEX,
          openings,
          shared: (shared.get(edgeKey(room.id, e.index))?.length ?? 0) > 0,
          free: false,
        });
      }
    }

    // Items — the painter's axis-aligned box of the rotated footprint; P1
    // replaces the box with a scaled proxy body, the placement rules stay.
    for (const it of room.items ?? []) {
      const fp = rotatedFootprint({ lengthM: cmToM(it.lengthCm), widthM: cmToM(it.widthCm) }, it.rotation);
      if (fp.w <= 0 || fp.h <= 0) continue;
      const hItem = Math.max(0.05, Math.min(cmToM(it.heightCm), H));
      let z0 = 0;
      if (it.placement === 'ceiling') z0 = Math.max(0, H - hItem);
      else if (it.placement === 'wall') z0 = Math.min(Math.max(0, cmToM(it.mountHeightCm ?? 120)), Math.max(0, H - hItem));
      items.push({
        key: `item-${it.instanceId}`,
        instanceId: it.instanceId,
        x0: it.x,
        y0: it.y,
        x1: it.x + fp.w,
        y1: it.y + fp.h,
        z0,
        z1: Math.min(H, z0 + hItem),
        rotationDeg: it.rotation,
        hex: it.fill ?? '#CFC7B8',
        placement: it.placement,
        lengthM: cmToM(it.lengthCm),
        widthM: cmToM(it.widthCm),
        heightM: cmToM(it.heightCm),
        productId: it.productId,
        frontEdge: it.frontEdge,
        meshUrl: it.meshUrl,
        modelFront: it.modelFront,
        lengthAxis: it.lengthAxis,
        modelUp: it.modelUp,
      });
    }
  }

  for (const w of input.walls ?? []) {
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    if (len < 1e-6) continue;
    walls.push({
      key: `fw-${w.id}`,
      hit: { kind: 'free', wallId: w.id },
      a: { x: w.a.x, y: w.a.y },
      b: { x: w.b.x, y: w.b.y },
      lengthM: len,
      inward: { x: (w.b.y - w.a.y) / len, y: -(w.b.x - w.a.x) / len },
      thicknessM: w.thicknessM ?? CAP_THICKNESS_M,
      heightM: H,
      stubHeightM: Math.min(STUB_HEIGHT_M, H),
      centred: true,
      hex: w.colourHex ?? PLASTER_HEX,
      openings: [],
      shared: false,
      free: true,
    });
  }

  return { wallHeightM: H, floors, walls, items };
}

export type WallShow = 'full' | 'stub' | 'hidden';

/**
 * The Sims cutaway for one camera: a room wall stands when the camera is on
 * its inner side, drops to a stub when it would hide the room, and a shared
 * wall's stub is hidden outright because the neighbour's full wall is there.
 * A free wall drops when it is nearer the camera than the target.
 */
export function cutawayState(solids: SceneSolids, cameraPos: Vec3, cameraTarget: Vec3): Map<string, WallShow> {
  const out = new Map<string, WallShow>();
  const dTarget = Math.hypot(cameraTarget.x - cameraPos.x, cameraTarget.y - cameraPos.y);
  for (const w of solids.walls) {
    if (w.free) {
      const mx = (w.a.x + w.b.x) / 2;
      const my = (w.a.y + w.b.y) / 2;
      const dWall = Math.hypot(mx - cameraPos.x, my - cameraPos.y);
      out.set(w.key, dWall < dTarget - 0.6 ? 'stub' : 'full');
      continue;
    }
    const side = cameraSide(w.a, w.b, w.inward, cameraPos);
    if (side > 0) out.set(w.key, 'full');
    else out.set(w.key, w.shared ? 'hidden' : 'stub');
  }
  return out;
}

/** World point at the middle of a wall's inner face, at half its shown height — what an e2e click aims at. */
export function wallAnchor(w: WallSolid, show: WallShow): Vec3 {
  const h = show === 'stub' ? w.stubHeightM : w.heightM;
  return { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2, z: h / 2 };
}
