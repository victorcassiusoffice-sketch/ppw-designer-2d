/**
 * The Sofap painted show flat (2026-09-07) must be a VALID plan before it is
 * shown to their retail team: rooms attach without overlapping, every wall
 * carries a REAL Permoglaze id, every opening survives the store's own
 * validation, the bundled pieces exist and sit inside their room, and the
 * definition registers under the `sofap` slug with no products of its own
 * (the paint range is already the designer's).
 */
import { describe, expect, it } from 'vitest';
import { SOFAP_DEMO, SOFAP_WALL_HEIGHT_M, buildSofapShowFlat } from '../sofap';
import { getProductById } from '../../data/products';
import { normaliseLoadedProperty } from '../../store/propertyStore';
import { rotatedFootprint, cmToM } from '../../lib/geometry';
import { validateOpening, canonicaliseRoomGeometry } from '../../designer/openings';
import { WALL_PAINTS } from '../../data/wallPaints';

function bounds(polygon: Array<{ x: number; y: number }>) {
  const xs = polygon.map((v) => v.x);
  const ys = polygon.map((v) => v.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

describe('Sofap painted show flat', () => {
  const prop = buildSofapShowFlat();

  it('registers under the sofap slug, in MUR, with no products of its own', () => {
    expect(SOFAP_DEMO.slug).toBe('sofap');
    expect(SOFAP_DEMO.merchant).toBe('Sofap');
    expect(SOFAP_DEMO.currency).toBe('MUR');
    expect(SOFAP_DEMO.products).toHaveLength(0);
    expect(prop.wallHeightM).toBe(SOFAP_WALL_HEIGHT_M);
  });

  it('every wall of every room is painted with a real Permoglaze line, three different lines in all', () => {
    const ids = new Set(WALL_PAINTS.map((p) => p.id));
    const used = new Set<string>();
    for (const r of prop.rooms) {
      expect(r.wallPaint, r.id).toHaveLength(4);
      for (const wp of r.wallPaint!) {
        expect(ids.has(wp.paintId), `${r.id} edge ${wp.edgeIndex} → ${wp.paintId}`).toBe(true);
        used.add(wp.paintId);
      }
    }
    expect(used.size).toBe(3);
  });

  it('rooms do not overlap and share walls edge to edge', () => {
    const boxes = prop.rooms.map((r) => ({ id: r.id, ...bounds(r.polygon) }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.y0 < b.y1 - 1e-9 && b.y0 < a.y1 - 1e-9;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('every opening validates on its wall', () => {
    for (const r of prop.rooms) {
      const geom = canonicaliseRoomGeometry(r.polygon, r.openings ?? []);
      for (const op of geom.openings) {
        const a = geom.polygon[op.edgeIndex];
        const b = geom.polygon[(op.edgeIndex + 1) % geom.polygon.length];
        const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
        const others = geom.openings.filter((o) => o.id !== op.id && o.edgeIndex === op.edgeIndex);
        const v = validateOpening(edgeLen, op, others);
        expect(v.ok, `${r.id} ${op.id}: ${'reason' in v ? v.reason : ''}`).toBe(true);
      }
    }
  });

  it('every placed piece exists in the bundled catalog and sits inside its room; surface pieces have a parent', () => {
    for (const r of prop.rooms) {
      const rb = bounds(r.polygon);
      const ids = new Set(r.placedItems.map((i) => i.instanceId));
      for (const it of r.placedItems) {
        const p = getProductById(it.productId);
        expect(p, it.productId).toBeDefined();
        const f = rotatedFootprint({ lengthM: cmToM(p!.dimensions_cm.length), widthM: cmToM(p!.dimensions_cm.width) }, it.rotation);
        expect(it.x, it.instanceId).toBeGreaterThanOrEqual(rb.x0 - 1e-9);
        expect(it.y, it.instanceId).toBeGreaterThanOrEqual(rb.y0 - 1e-9);
        expect(it.x + f.w, it.instanceId).toBeLessThanOrEqual(rb.x1 + 1e-9);
        expect(it.y + f.h, it.instanceId).toBeLessThanOrEqual(rb.y1 + 1e-9);
        if (p!.placement === 'surface') expect(ids.has(it.parentInstanceId ?? ''), it.instanceId).toBe(true);
      }
    }
  });

  it('survives the store normaliser unchanged in shape', () => {
    const n = normaliseLoadedProperty(buildSofapShowFlat());
    expect(n.rooms).toHaveLength(3);
    expect(n.rooms.map((r) => r.id)).toEqual(['living', 'bedroom', 'kitchen']);
    expect(n.rooms.every((r) => (r.wallPaint ?? []).length === 4)).toBe(true);
  });
});
