/**
 * The Courts Mammouth show home (2026-09-05) must be a VALID plan before it
 * is ever loaded in front of their CEO: every placed product exists in the
 * range, every footprint sits inside its room, no two floor pieces overlap,
 * every opening survives the store's own validation, and the range itself
 * is clean (positive prices in MUR, positive dimensions, namespaced ids,
 * a source page for every row).
 */
import { describe, expect, it } from 'vitest';
import { COURTS_DEMO, COURTS_PRODUCTS, buildCourtsShowHome } from '../courts';
import { normaliseLoadedProperty } from '../../store/propertyStore';
import { rotatedFootprint, cmToM } from '../../lib/geometry';
import { validateOpening, canonicaliseRoomGeometry } from '../../designer/openings';
import { findFloorMaterialById } from '../../data/floorMaterials';
import { WALL_PAINTS } from '../../data/wallPaints';

const byId = new Map(COURTS_PRODUCTS.map((p) => [p.id, p]));

function box(item: { productId: string; x: number; y: number; rotation: number }) {
  const p = byId.get(item.productId)!;
  const r = rotatedFootprint({ lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) }, item.rotation);
  return { x0: item.x, y0: item.y, x1: item.x + r.w, y1: item.y + r.h };
}

function bounds(polygon: Array<{ x: number; y: number }>) {
  const xs = polygon.map((v) => v.x);
  const ys = polygon.map((v) => v.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

describe('Courts Mammouth range', () => {
  it('has 30+ products, all namespaced, priced in MUR, sized, sourced', () => {
    expect(COURTS_PRODUCTS.length).toBeGreaterThanOrEqual(30);
    for (const p of COURTS_PRODUCTS) {
      expect(p.id.startsWith('courts-')).toBe(true);
      expect(p.price.currency).toBe('MUR');
      expect(p.price.value).toBeGreaterThan(0);
      expect(p.dimensions_cm.length).toBeGreaterThan(0);
      expect(p.dimensions_cm.width).toBeGreaterThan(0);
      expect(p.dimensions_cm.height).toBeGreaterThan(0);
      expect(p.source_url).toMatch(/^https:\/\/www\.courtsmammouth\.mu\/product\//);
      expect(p.supplier.startsWith('Courts Mammouth')).toBe(true);
      expect(p.notes).toContain('Courts price shown as Rs');
    }
  });

  it('every energy consumer carries a wattage and hours', () => {
    for (const p of COURTS_PRODUCTS.filter((x) => x.energy_role === 'consumer')) {
      expect(p.power_w, p.id).toBeGreaterThan(0);
      expect(p.duty_hours_per_day, p.id).toBeGreaterThan(0);
    }
  });

  it('the demo definition is registered under the courts slug with its page', () => {
    expect(COURTS_DEMO.slug).toBe('courts');
    expect(COURTS_DEMO.merchant).toBe('Courts Mammouth');
    expect(COURTS_DEMO.pageName).toContain('Courts Mammouth');
  });
});

describe('Courts show home', () => {
  const property = buildCourtsShowHome();

  it('is five attached rooms and survives the store normaliser unchanged in shape', () => {
    expect(property.rooms.map((r) => r.id)).toEqual(['living', 'dining', 'wellness', 'office', 'bedroom']);
    const norm = normaliseLoadedProperty(property);
    expect(norm.rooms).toHaveLength(5);
    for (const r of norm.rooms) {
      expect(r.polygon).toHaveLength(4);
      expect(r.placedItems.length).toBeGreaterThan(0);
    }
    expect(norm.name).toBe(COURTS_DEMO.pageName);
  });

  it('places only products from the range, every footprint inside its room', () => {
    for (const room of property.rooms) {
      const b = bounds(room.polygon);
      for (const item of room.placedItems) {
        expect(byId.has(item.productId), `${room.id}: ${item.productId}`).toBe(true);
        const f = box(item);
        expect(f.x0, `${item.instanceId} left`).toBeGreaterThanOrEqual(b.x0 - 1e-9);
        expect(f.y0, `${item.instanceId} top`).toBeGreaterThanOrEqual(b.y0 - 1e-9);
        expect(f.x1, `${item.instanceId} right`).toBeLessThanOrEqual(b.x1 + 1e-9);
        expect(f.y1, `${item.instanceId} bottom`).toBeLessThanOrEqual(b.y1 + 1e-9);
      }
    }
  });

  it('no two floor pieces overlap (rugs, wall and surface items excepted)', () => {
    for (const room of property.rooms) {
      const floor = room.placedItems.filter((it) => {
        const p = byId.get(it.productId)!;
        return !it.parentInstanceId && p.placement !== 'wall' && p.placement !== 'ceiling' && p.placement !== 'surface' && p.id !== 'courts-elit-rug';
      });
      for (let i = 0; i < floor.length; i++) {
        for (let j = i + 1; j < floor.length; j++) {
          const a = box(floor[i]);
          const b = box(floor[j]);
          const overlap = a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.y0 < b.y1 - 1e-9 && b.y0 < a.y1 - 1e-9;
          expect(overlap, `${room.id}: ${floor[i].instanceId} overlaps ${floor[j].instanceId}`).toBe(false);
        }
      }
    }
  });

  it('surface items sit on a surface product in the same room', () => {
    for (const room of property.rooms) {
      for (const item of room.placedItems.filter((it) => it.parentInstanceId)) {
        const parent = room.placedItems.find((it) => it.instanceId === item.parentInstanceId);
        expect(parent, item.instanceId).toBeTruthy();
        expect(byId.get(parent!.productId)!.is_surface, parent!.productId).toBe(true);
        expect(byId.get(item.productId)!.placement).toBe('surface');
        const a = box(item);
        const b = box(parent!);
        expect(a.x0).toBeGreaterThanOrEqual(b.x0 - 1e-9);
        expect(a.y0).toBeGreaterThanOrEqual(b.y0 - 1e-9);
        expect(a.x1).toBeLessThanOrEqual(b.x1 + 1e-9);
        expect(a.y1).toBeLessThanOrEqual(b.y1 + 1e-9);
      }
    }
  });

  it('every opening validates on its wall after canonicalisation', () => {
    for (const room of property.rooms) {
      const canon = canonicaliseRoomGeometry(room.polygon, room.openings ?? []);
      expect(canon.openings.length).toBe((room.openings ?? []).length);
      for (const o of canon.openings) {
        const a = canon.polygon[o.edgeIndex];
        const b = canon.polygon[(o.edgeIndex + 1) % canon.polygon.length];
        const edgeLengthM = Math.hypot(b.x - a.x, b.y - a.y);
        const others = canon.openings.filter((x) => x.id !== o.id && x.edgeIndex === o.edgeIndex);
        const v = validateOpening(edgeLengthM, o, others);
        expect(v.ok, `${room.id} ${o.id}: ${v.message ?? v.reason}`).toBe(true);
      }
    }
  });

  it('paint and floor finishes reference real materials', () => {
    const paintIds = new Set(WALL_PAINTS.map((p) => p.id));
    for (const room of property.rooms) {
      for (const wp of room.wallPaint ?? []) expect(paintIds.has(wp.paintId), wp.paintId).toBe(true);
      if (room.floorFinish) expect(findFloorMaterialById(room.floorFinish.materialId)).toBeTruthy();
    }
  });

  it('every room has a door or a window and the plan spans about 11.5 x 8.5 m', () => {
    for (const room of property.rooms) expect((room.openings ?? []).length, room.id).toBeGreaterThan(0);
    const all = property.rooms.flatMap((r) => r.polygon);
    const b = bounds(all);
    expect(b.x1 - b.x0).toBeCloseTo(11.5, 5);
    expect(b.y1 - b.y0).toBeCloseTo(8.5, 5);
  });
});
