/**
 * flooringLattice — Sims-style floor tiles as ITEMS (Vic 2026-08-29:
 * "flooring in The Sims allows you to drag and duplicate the flooring which
 * fits tight next to each other").
 *
 * A catalog flooring product (a 0.92 m gym tile, a 1 m mat) placed as an
 * item used to snap to the 0.5 m room grid like a treadmill does — so two
 * tiles could never butt up (0.92 is not on the grid) and a duplicate landed
 * 0.5 m away, overlapping or gapped. A floor tile is not furniture: its
 * natural grid is ITSELF. This module gives flooring items their own
 * lattice — pitch = the tile's rotated footprint, anchored on the first tile
 * of that product in the room (or the room's inner corner) — so every drop,
 * drag and duplicate lands edge-to-edge with its neighbours.
 *
 * Pure functions; the callers in RoomCanvas / placementActions decide WHEN
 * a product is flooring (`isFlooringProduct`).
 */
import type { PlacedRect, Polygon, Vertex } from '../lib/geometry';
import { cmToM, polygonBounds, rectsOverlap, rotatedFootprint, isRectInsidePolygon } from '../lib/geometry';
import type { Product } from '../data/products.schema';
import { WALL_HALF_M } from './wallAwarePlacement';

export function isFlooringProduct(p: Pick<Product, 'category'> | null | undefined): boolean {
  return p?.category === 'flooring';
}

/**
 * Products that snap to THEIR OWN lattice rather than the room grid: floor
 * tiles, and (eco / solar 2026-09-04) roof-placed PV panels — a panel array
 * is laid edge-to-edge exactly like tiles, so Duplicate lands the next
 * panel flush and "Fill" carpets the slab. Collision layering is untouched:
 * panels still collide like floor items (`layerBands`), only the snap
 * differs.
 */
export function usesTileLattice(
  p: Pick<Product, 'category'> & Partial<Pick<Product, 'placement' | 'pv_wp'>> | null | undefined,
): boolean {
  if (!p) return false;
  if (isFlooringProduct(p)) return true;
  if (p.placement === 'roof') return true;
  return p.category === 'solar' && typeof p.pv_wp === 'number' && p.pv_wp > 0;
}

/** The lattice a flooring item snaps to: origin + pitch in metres. */
export interface TileLattice {
  originX: number;
  originY: number;
  pitchW: number;
  pitchH: number;
}

/**
 * Where the lattice for `productId` starts in this room.
 *
 * The FIRST placed tile of the same product fixes the origin, so a customer
 * who lays the first tile by eye gets every later tile aligned to it (the
 * Sims rule: the floor is one lattice per room). With no tile yet, the
 * lattice starts at the room's inner corner (polygon min + the wall's inner
 * face) so a tile dropped near the wall meets it exactly.
 */
export function tileLatticeFor(input: {
  productId: string;
  fp: { lengthM: number; widthM: number };
  rotationDeg: number;
  polygon: Polygon;
  items: ReadonlyArray<{ productId: string; x: number; y: number }>;
  inset?: number;
}): TileLattice {
  const { w, h } = rotatedFootprint(input.fp, input.rotationDeg);
  const first = input.items.find((it) => it.productId === input.productId);
  if (first) return { originX: first.x, originY: first.y, pitchW: w, pitchH: h };
  const inset = input.inset ?? WALL_HALF_M;
  if (input.polygon.length >= 3) {
    const b = polygonBounds(input.polygon);
    return { originX: b.minX + inset, originY: b.minY + inset, pitchW: w, pitchH: h };
  }
  // Outdoors / unbounded: the world grid.
  return { originX: 0, originY: 0, pitchW: w, pitchH: h };
}

/** Snap a top-left to the lattice (nearest cell). */
export function snapToTileLattice(x: number, y: number, lat: TileLattice): Vertex {
  const sx = lat.originX + Math.round((x - lat.originX) / lat.pitchW) * lat.pitchW;
  const sy = lat.originY + Math.round((y - lat.originY) / lat.pitchH) * lat.pitchH;
  return { x: Number(sx.toFixed(4)), y: Number(sy.toFixed(4)) };
}

/**
 * Adjacent slots for a duplicate of `rect`, nearest first: right, below,
 * left, above — each exactly one tile away so the copy fits tight.
 */
export function adjacentTileSlots(rect: PlacedRect): Vertex[] {
  return [
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x - rect.w, y: rect.y },
    { x: rect.x, y: rect.y - rect.h },
  ].map((v) => ({ x: Number(v.x.toFixed(4)), y: Number(v.y.toFixed(4)) }));
}

/**
 * Every lattice cell that fits WHOLLY inside the room and collides with none
 * of `others` — what "Fill floor" lays. Cells touching the boundary are
 * skipped (a customer cuts those with the paint tool's cut-tile pricing, not
 * with whole items).
 */
export function fillLatticeInside(input: {
  lat: TileLattice;
  polygon: Polygon;
  others: ReadonlyArray<PlacedRect>;
  inset?: number;
  maxCells?: number;
}): Vertex[] {
  const { lat, polygon } = input;
  if (polygon.length < 3) return [];
  const inset = input.inset ?? WALL_HALF_M;
  const b = polygonBounds(polygon);
  const shrunk: Polygon = polygon.length === 4
    ? [
        { x: b.minX + inset, y: b.minY + inset },
        { x: b.maxX - inset, y: b.minY + inset },
        { x: b.maxX - inset, y: b.maxY - inset },
        { x: b.minX + inset, y: b.maxY - inset },
      ]
    : polygon;
  const out: Vertex[] = [];
  const max = input.maxCells ?? 4000;
  const c0 = Math.floor((b.minX - lat.originX) / lat.pitchW) - 1;
  const c1 = Math.ceil((b.maxX - lat.originX) / lat.pitchW) + 1;
  const r0 = Math.floor((b.minY - lat.originY) / lat.pitchH) - 1;
  const r1 = Math.ceil((b.maxY - lat.originY) / lat.pitchH) + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = Number((lat.originX + c * lat.pitchW).toFixed(4));
      const y = Number((lat.originY + r * lat.pitchH).toFixed(4));
      const rect = { x, y, w: lat.pitchW, h: lat.pitchH };
      if (!isRectInsidePolygon(rect, shrunk)) continue;
      if (input.others.some((o) => rectsOverlap(rect, o))) continue;
      out.push({ x, y });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Footprint of a product at a rotation, metres. */
export function productFootprint(p: Product, rotationDeg: number): { w: number; h: number } {
  return rotatedFootprint(
    { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) },
    rotationDeg,
  );
}
