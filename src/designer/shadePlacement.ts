/**
 * Where a NEW shade sail lands (2026-11-01, Victor: "make sure the StretchTek
 * can be fitted outside").
 *
 * A shade sail is outdoor kit: it goes over a terrace, a pool or the garden
 * beside the house, never in the middle of a room. The first placement used
 * the active room's centroid, which put the first sail inside a bedroom and,
 * in 3D, under the roof. This module picks an outdoor spot instead:
 *
 *   1. a ground-level room whose name says it is outdoors (terrace, patio,
 *      veranda / varangue, deck, courtyard, pergola, carport, pool, ...): its
 *      centroid, so a sail over a drawn terrace lands on the terrace;
 *   2. the largest hard garden surface that takes the whole sail (concrete,
 *      paved path, gravel, swimming pool): its centre;
 *   3. the garden beside the house footprint, clear of the walls, on the
 *      sunny north side first (Mauritius sits in the southern hemisphere, the
 *      winter sun stands in the north; the plan frame runs x east, y south,
 *      so north is -y), then east, west, south; when the design has a plot,
 *      the side where the sail fits inside the plot wins and the sail is kept
 *      inside the plot;
 *   4. no rooms: the plot centre, else the plan origin area.
 *
 * Pure geometry on structural inputs so the store, the workspace and the
 * tests share one answer. Coordinates snap to 0.05 m like a dragged point.
 */
import { GROUND_LEVEL_ID, roomLevelId } from './levels';

export interface ShadePlacementRoom {
  polygon: readonly { x: number; y: number }[];
  name?: string;
  kind?: string;
  levelId?: string;
}
export interface ShadePlacementSurface { kind: string; x: number; y: number; widthM: number; depthM: number }
export interface ShadePlacementInput {
  rooms: readonly ShadePlacementRoom[];
  site?: { widthM: number; depthM: number; originM: { x: number; y: number } } | null;
  garden?: { surfaces: readonly ShadePlacementSurface[] } | null;
  /** Storey the sail belongs to; sails are ground-level kit. */
  levelId?: string;
  /** Half of the new sail's side, metres (`defaultShadeSail` is 3.6 m square → 1.8). */
  halfM?: number;
  /** Clear gap between the house wall and the nearest fixing point, metres. */
  clearanceM?: number;
}
export type ShadePlacementSide = 'north' | 'east' | 'west' | 'south';
export type ShadePlacementWhere = 'outdoor-room' | 'garden-surface' | 'beside-house' | 'plot' | 'open';
export interface ShadePlacement { x: number; y: number; where: ShadePlacementWhere; side?: ShadePlacementSide }

/** Room names that mean "already outdoors" in English, French and Mauritian usage. */
export const OUTDOOR_ROOM_NAME = /\b(terrace|terrasse|patio|veranda|verandah|varangue|deck|courtyard|cour|pergola|carport|car port|pool|piscine|lanai|garden|jardin|yard|bbq|braai|balcony|balcon)\b/i;
/** Garden surfaces a sail is normally fitted over (a lawn or a planting bed is not a terrace). */
export const SAIL_SURFACE_KINDS: ReadonlySet<string> = new Set(['concrete', 'path', 'gravel', 'pool']);
/** Order the sides are tried: the sun side first. */
export const SHADE_SIDE_ORDER: readonly ShadePlacementSide[] = ['north', 'east', 'west', 'south'];

const snap = (v: number) => Math.round(v * 20) / 20;

function centroid(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross; cx += (a.x + b.x) * cross; cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    const n = points.length;
    return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

interface Box { minX: number; minY: number; maxX: number; maxY: number }
function bounds(rooms: readonly ShadePlacementRoom[]): Box {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const room of rooms) for (const p of room.polygon) {
    box.minX = Math.min(box.minX, p.x); box.minY = Math.min(box.minY, p.y);
    box.maxX = Math.max(box.maxX, p.x); box.maxY = Math.max(box.maxY, p.y);
  }
  return box;
}

const clamp = (v: number, lo: number, hi: number) => lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

export function placeShadeSail(input: ShadePlacementInput): ShadePlacement {
  const levelId = input.levelId ?? GROUND_LEVEL_ID;
  const half = input.halfM ?? 1.8;
  const clearance = input.clearanceM ?? 1;
  const rooms = input.rooms.filter(r => roomLevelId(r) === levelId && r.kind !== 'outdoor' && r.kind !== 'roof' && r.polygon.length >= 3
    && r.polygon.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));

  const outdoorRoom = rooms.find(r => typeof r.name === 'string' && OUTDOOR_ROOM_NAME.test(r.name));
  if (outdoorRoom) {
    const c = centroid(outdoorRoom.polygon);
    return { x: snap(c.x), y: snap(c.y), where: 'outdoor-room' };
  }

  const surfaces = (input.garden?.surfaces ?? [])
    .filter(s => SAIL_SURFACE_KINDS.has(s.kind) && [s.x, s.y, s.widthM, s.depthM].every(Number.isFinite) && s.widthM >= 2 * half && s.depthM >= 2 * half)
    .sort((a, b) => b.widthM * b.depthM - a.widthM * a.depthM);
  if (surfaces.length > 0) {
    const s = surfaces[0];
    return { x: snap(s.x + s.widthM / 2), y: snap(s.y + s.depthM / 2), where: 'garden-surface' };
  }

  const site = input.site && [input.site.widthM, input.site.depthM, input.site.originM?.x, input.site.originM?.y].every(Number.isFinite) ? input.site : null;
  const plot = site ? { minX: site.originM.x, minY: site.originM.y, maxX: site.originM.x + site.widthM, maxY: site.originM.y + site.depthM } : null;

  if (rooms.length === 0) {
    if (plot) return { x: snap((plot.minX + plot.maxX) / 2), y: snap((plot.minY + plot.maxY) / 2), where: 'plot' };
    return { x: 5, y: 5, where: 'open' };
  }

  const box = bounds(rooms);
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const off = clearance + half;
  const candidate: Record<ShadePlacementSide, { x: number; y: number }> = {
    north: { x: cx, y: box.minY - off },
    east: { x: box.maxX + off, y: cy },
    west: { x: box.minX - off, y: cy },
    south: { x: cx, y: box.maxY + off },
  };

  let side: ShadePlacementSide = SHADE_SIDE_ORDER[0];
  let point = candidate[side];
  if (plot) {
    // Free depth between the house and the plot edge on each side; the sail needs the clearance plus its own width.
    const gap: Record<ShadePlacementSide, number> = {
      north: box.minY - plot.minY, east: plot.maxX - box.maxX, west: box.minX - plot.minX, south: plot.maxY - box.maxY,
    };
    const fits = SHADE_SIDE_ORDER.filter(s => gap[s] >= clearance + 2 * half);
    const alongX = (s: ShadePlacementSide) => s === 'north' || s === 'south';
    if (fits.length > 0) {
      // The sail fits whole on this side: keep all of it inside the plot (the clearance keeps it off the house).
      side = fits[0];
      point = candidate[side];
      point = { x: clamp(point.x, plot.minX + half, plot.maxX - half), y: clamp(point.y, plot.minY + half, plot.maxY - half) };
    } else {
      // A plot too tight for a 3.6 m sail beside the house: take the widest side, stay OUTSIDE the house
      // (the sail may overhang the boundary until the points are dragged in or set to the wall), and only
      // keep the sail inside the plot along the wall.
      side = [...SHADE_SIDE_ORDER].sort((a, b) => gap[b] - gap[a])[0];
      point = candidate[side];
      point = alongX(side)
        ? { x: clamp(point.x, plot.minX + half, plot.maxX - half), y: point.y }
        : { x: point.x, y: clamp(point.y, plot.minY + half, plot.maxY - half) };
    }
  }
  return { x: snap(point.x), y: snap(point.y), where: 'beside-house', side };
}
