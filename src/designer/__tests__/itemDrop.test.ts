/**
 * itemDrop — the pure twin of the plan's drag-drop rules (3D Mode 2026-09-17).
 *
 * Room convention: 5 × 4 m rectangle at the origin, y grows DOWN, walls
 * 0.1 m thick centred on the edges (inner face = edge ± WALL_HALF_M).
 * Products are the real seeded demo items so `getProductById` (used for the
 * OTHER items' footprints and bands) resolves exactly as it does in the app.
 */
import { describe, expect, it } from 'vitest';
import { resolveItemDrop, type DropContext, type DropRoom } from '../itemDrop';
import { WALL_HALF_M } from '../wallAwarePlacement';
import { placementKind, type PlacementKind, type SurfaceRect } from '../attachmentPlacement';
import { getProductById } from '../../data/products';
import { cmToM, rotatedFootprint, isRectInsidePolygon, type PlacedRect, type Polygon } from '../../lib/geometry';
import type { PlacedItem } from '../../store/propertyStore';
import { usePropertyStore } from '../../store/propertyStore';

const ROOM: Polygon = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 4 },
  { x: 0, y: 4 },
];
/** The neighbour to the east, sharing the x = 5 wall. */
const ROOM_B: Polygon = [
  { x: 5, y: 0 },
  { x: 9, y: 0 },
  { x: 9, y: 4 },
  { x: 5, y: 4 },
];

const TABLE = getProductById('demo-console-table')!; // floor, 1.2 × 0.4, a surface
const LAMP = getProductById('demo-floor-lamp')!; // floor, 0.4 × 0.4
const MIRROR = getProductById('demo-wall-mirror')!; // wall, 1.2 × 0.05
const DIFFUSER = getProductById('demo-aroma-diffuser')!; // surface, 0.15 × 0.15
const PENDANT = getProductById('demo-pendant-light')!; // ceiling, 0.45 × 0.45

function pointInPolygon(p: { x: number; y: number }, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** RoomCanvas's `layerRects`, verbatim. */
function layerRects(placedItems: PlacedItem[], layer: PlacementKind, opts?: { parentId?: string; ignoreId?: string }): Array<PlacedRect & { instanceId: string }> {
  const out: Array<PlacedRect & { instanceId: string }> = [];
  for (const it of placedItems) {
    if (opts?.ignoreId && it.instanceId === opts.ignoreId) continue;
    const p = getProductById(it.productId);
    if (!p || placementKind(p) !== layer) continue;
    if (layer === 'surface' && opts?.parentId && it.parentInstanceId !== opts.parentId) continue;
    const r = rotatedFootprint({ lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) }, it.rotation);
    out.push({ x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId });
  }
  return out;
}

/** RoomCanvas's `surfaceRects`, verbatim. */
function surfaceRects(placedItems: PlacedItem[]): SurfaceRect[] {
  const out: SurfaceRect[] = [];
  for (const it of placedItems) {
    const p = getProductById(it.productId);
    if (!p?.is_surface) continue;
    const r = rotatedFootprint({ lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) }, it.rotation);
    out.push({ instanceId: it.instanceId, x: it.x, y: it.y, w: r.w, h: r.h });
  }
  return out;
}

function ctxFor(items: PlacedItem[], opts: { itemsB?: PlacedItem[]; snapStep?: number } = {}): DropContext {
  const roomA: DropRoom = { id: 'A', polygon: ROOM, placedItems: items };
  const roomB: DropRoom = { id: 'B', polygon: ROOM_B, placedItems: opts.itemsB ?? [] };
  return {
    snapStep: opts.snapStep ?? 0.5,
    polygon: ROOM,
    placedItems: items,
    outdoor: false,
    fitsOutdoors: () => false,
    snapWalls: [],
    wallRects: [],
    resolveContainer: (p) => {
      if (pointInPolygon(p, ROOM)) return { ok: true, room: roomA, outdoor: false };
      if (pointInPolygon(p, ROOM_B)) return { ok: true, room: roomB, outdoor: false };
      return { ok: false, reason: 'off-plot' };
    },
    layerRects,
    surfaceRects,
    allRooms: [roomA, roomB],
  };
}

const table = (x: number, y: number, rotation = 0): PlacedItem => ({ instanceId: 'table', productId: TABLE.id, x, y, rotation });
const lamp = (x: number, y: number, id = 'lamp'): PlacedItem => ({ instanceId: id, productId: LAMP.id, x, y, rotation: 0 });

describe('resolveItemDrop — floor items', () => {
  it('previews an outdoor move without creating a room, then creates it only on drop', () => {
    const store = usePropertyStore.getState();
    store.resetToDefault();
    const item = lamp(1, 1);
    const context = ctxFor([item]);
    context.fitsOutdoors = () => true;
    context.resolveContainer = (_point, options) => {
      const id = options.create ? store.ensureOutdoorRoom('ground') : '__outdoor_preview__';
      return { ok: true, outdoor: true, room: { id, polygon: [], placedItems: [] } };
    };
    const propertyBefore = usePropertyStore.getState().property;
    const result = resolveItemDrop(context, item, LAMP, 20.12, 20.2, false, { createContainer: false });
    expect(result).toMatchObject({ ok: true, roomId: '__outdoor_preview__', crossRoom: true });
    expect(usePropertyStore.getState().property).toBe(propertyBefore);
    expect(usePropertyStore.getState().property.rooms.some((room) => room.kind === 'outdoor')).toBe(false);

    const committed = resolveItemDrop(context, item, LAMP, 20.12, 20.2, false);
    expect(committed.ok).toBe(true);
    if (!committed.ok || !result.ok) return;
    expect(committed.roomId).not.toBe('__outdoor_preview__');
    expect(committed.x).toBe(result.x);
    expect(committed.y).toBe(result.y);
    expect(committed.rotation).toBe(result.rotation);
    expect(usePropertyStore.getState().property.rooms.filter((room) => room.kind === 'outdoor')).toHaveLength(1);
  });

  it('lands on the grid in open floor, keeps its facing, stays in its room', () => {
    const item = table(2, 1.5);
    const r = resolveItemDrop(ctxFor([item]), item, TABLE, 1.37, 2.12, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.roomId).toBe('A');
    expect(r.crossRoom).toBe(false);
    expect(r.rotation).toBe(0);
    expect(r.x % 0.5).toBeCloseTo(0, 6);
    expect(r.y % 0.5).toBeCloseTo(0, 6);
    expect(isRectInsidePolygon({ x: r.x, y: r.y, w: 1.2, h: 0.4 }, ROOM)).toBe(true);
  });

  it('released near a wall it snaps flush to the inner face, the Sims way', () => {
    const item = table(2, 1.5);
    // Top-left wanted 0.12 m below the north wall: within reach → flush.
    const r = resolveItemDrop(ctxFor([item]), item, TABLE, 1.5, 0.12, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.y).toBeCloseTo(WALL_HALF_M, 6);
    expect(r.reason).toBe('wall-aware');
  });

  it('Shift keeps the current facing on a wall snap', () => {
    const item = table(2, 1.5, 90);
    const plain = resolveItemDrop(ctxFor([item]), item, TABLE, 0.1, 1.5, false);
    const held = resolveItemDrop(ctxFor([item]), item, TABLE, 0.1, 1.5, true);
    expect(plain.ok && held.ok).toBe(true);
    if (!plain.ok || !held.ok) return;
    expect(held.rotation).toBe(90);
    // Flush on the west wall either way.
    expect(held.x).toBeCloseTo(WALL_HALF_M, 6);
    expect(plain.x).toBeCloseTo(WALL_HALF_M, 6);
  });

  it('refuses a drop onto another floor item with the plan\'s words', () => {
    const a = table(2, 2);
    const b = lamp(0.5, 0.5);
    const r = resolveItemDrop(ctxFor([a, b]), b, LAMP, 2.3, 2.0, false);
    expect(r).toMatchObject({ ok: false, reason: 'collision', message: "Item won't fit there." });
  });

  it('refuses a centre off the plot', () => {
    const item = lamp(1, 1);
    const r = resolveItemDrop(ctxFor([item]), item, LAMP, -3, -3, false);
    expect(r).toMatchObject({ ok: false, reason: 'off-plot', message: 'That is off the plot.' });
  });

  it('routes into the neighbour when the centre crosses the shared wall', () => {
    const item = lamp(4, 2);
    const r = resolveItemDrop(ctxFor([item]), item, LAMP, 6.8, 2.0, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.roomId).toBe('B');
    expect(r.crossRoom).toBe(true);
    expect(isRectInsidePolygon({ x: r.x, y: r.y, w: 0.4, h: 0.4 }, ROOM_B)).toBe(true);
  });

  it('a lamp may stand next to a table but not on it — same-band collision only', () => {
    const t = table(1, 1);
    const l = lamp(3, 3);
    // Just east of the table: no overlap → fine.
    const beside = resolveItemDrop(ctxFor([t, l]), l, LAMP, 2.5, 1.0, false);
    expect(beside.ok).toBe(true);
    // On the tabletop: overlap → refused.
    const on = resolveItemDrop(ctxFor([t, l]), l, LAMP, 1.4, 1.0, false);
    expect(on.ok).toBe(false);
  });
});

describe('resolveItemDrop — wall items', () => {
  it('re-snaps to the nearest wall and turns with it', () => {
    const m: PlacedItem = { instanceId: 'm', productId: MIRROR.id, x: 1, y: WALL_HALF_M, rotation: 0 };
    // Carried over to the west wall.
    const r = resolveItemDrop(ctxFor([m]), m, MIRROR, 0.2, 1.5, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reason).toBe('wall');
    expect(r.x).toBeCloseTo(WALL_HALF_M, 6);
    // Along the west wall the 1.2 m length runs down y.
    expect(r.rotation % 180).toBe(90);
  });

  it('refuses the middle of the room', () => {
    const m: PlacedItem = { instanceId: 'm', productId: MIRROR.id, x: 1, y: WALL_HALF_M, rotation: 0 };
    const r = resolveItemDrop(ctxFor([m]), m, MIRROR, 2.0, 2.0, false);
    expect(r).toMatchObject({ ok: false, reason: 'wall', message: 'Wall items need a free bit of wall.' });
  });
});

describe('resolveItemDrop — surface items', () => {
  const t = table(1, 1);
  const d: PlacedItem = { instanceId: 'd', productId: DIFFUSER.id, x: 1.1, y: 1.1, rotation: 0, parentInstanceId: 'table' };

  it('lands on the table it is dropped on and names it as the parent', () => {
    const r = resolveItemDrop(ctxFor([t, d]), d, DIFFUSER, 1.8, 1.15, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reason).toBe('surface');
    expect(r.parentInstanceId).toBe('table');
    expect(r.x).toBeGreaterThanOrEqual(1);
    expect(r.x + 0.15).toBeLessThanOrEqual(2.2 + 1e-6);
    expect(r.y).toBeGreaterThanOrEqual(1);
    expect(r.y + 0.15).toBeLessThanOrEqual(1.4 + 1e-6);
  });

  it('refuses the bare floor', () => {
    const r = resolveItemDrop(ctxFor([t, d]), d, DIFFUSER, 3, 3, false);
    expect(r).toMatchObject({ ok: false, reason: 'surface', message: 'This item sits on a surface — drop it onto a table.' });
  });
});

describe('resolveItemDrop — ceiling items', () => {
  it('snaps to the grid and ignores what stands on the floor beneath', () => {
    const t = table(1, 1);
    const p: PlacedItem = { instanceId: 'p', productId: PENDANT.id, x: 3, y: 3, rotation: 0 };
    const r = resolveItemDrop(ctxFor([t, p]), p, PENDANT, 1.3, 1.1, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reason).toBe('ceiling');
    expect(r.x).toBeCloseTo(1.5, 6);
    expect(r.y).toBeCloseTo(1.0, 6);
  });
});
