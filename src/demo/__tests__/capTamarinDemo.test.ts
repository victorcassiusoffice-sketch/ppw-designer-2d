/**
 * The Cap Tamarin two-bedroom apartment (2026-09-08) is shown IN PERSON to the
 * people who build Cap Tamarin, on 16 September. It has to be a valid plan
 * before it is opened in front of them: rooms that tile without overlapping,
 * every piece inside its room and off its neighbours, every opening valid on
 * its wall, every product resolvable, and a total area inside the range Cap
 * Tamarin publishes for a Cosy Bay apartment (44–149 m²).
 */
import { describe, expect, it } from 'vitest';
import {
  CAPTAMARIN_DEMO,
  CT_WALL_HEIGHT_M,
  buildCapTamarinApartment,
} from '../captamarin';
import { registerAllDemos } from '..';
import { getProductById } from '../../data/products';
import { normaliseLoadedProperty } from '../../store/propertyStore';
import { rotatedFootprint, cmToM } from '../../lib/geometry';
import { validateOpening, canonicaliseRoomGeometry } from '../../designer/openings';
import { WALL_PAINTS } from '../../data/wallPaints';

registerAllDemos();

function bounds(polygon: Array<{ x: number; y: number }>) {
  const xs = polygon.map((v) => v.x);
  const ys = polygon.map((v) => v.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function areaOf(polygon: Array<{ x: number; y: number }>) {
  const b = bounds(polygon);
  return (b.x1 - b.x0) * (b.y1 - b.y0);
}

describe('Cap Tamarin — two-bedroom apartment demo', () => {
  const prop = buildCapTamarinApartment();

  it('registers under the captamarin slug in MUR, with no products of its own', () => {
    expect(CAPTAMARIN_DEMO.slug).toBe('captamarin');
    expect(CAPTAMARIN_DEMO.merchant).toBe('Cap Tamarin');
    expect(CAPTAMARIN_DEMO.currency).toBe('MUR');
    expect(CAPTAMARIN_DEMO.products).toHaveLength(0);
    expect(prop.wallHeightM).toBe(CT_WALL_HEIGHT_M);
    expect(prop.rooms).toHaveLength(7);
  });

  it('the apartment sits inside the size range Cap Tamarin publishes (44–149 m²)', () => {
    const total = prop.rooms.reduce((n, r) => n + areaOf(r.polygon), 0);
    expect(total).toBeGreaterThanOrEqual(44);
    expect(total).toBeLessThanOrEqual(149);
  });

  it('rooms tile without overlapping', () => {
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

  it('every placed piece resolves, sits inside its room, and surface pieces have a parent', () => {
    for (const r of prop.rooms) {
      const rb = bounds(r.polygon);
      const ids = new Set(r.placedItems.map((i) => i.instanceId));
      for (const it of r.placedItems) {
        const p = getProductById(it.productId);
        expect(p, `${it.instanceId} → ${it.productId}`).toBeDefined();
        const f = rotatedFootprint(
          { lengthM: cmToM(p!.dimensions_cm.length), widthM: cmToM(p!.dimensions_cm.width) },
          it.rotation,
        );
        expect(it.x, `${it.instanceId} left`).toBeGreaterThanOrEqual(rb.x0 - 1e-6);
        expect(it.y, `${it.instanceId} top`).toBeGreaterThanOrEqual(rb.y0 - 1e-6);
        expect(it.x + f.w, `${it.instanceId} right`).toBeLessThanOrEqual(rb.x1 + 1e-6);
        expect(it.y + f.h, `${it.instanceId} bottom`).toBeLessThanOrEqual(rb.y1 + 1e-6);
        if (p!.placement === 'surface') {
          expect(ids.has(it.parentInstanceId ?? ''), `${it.instanceId} needs a surface parent`).toBe(true);
        }
      }
    }
  });

  it('no two floor pieces in a room overlap', () => {
    for (const r of prop.rooms) {
      const floor = r.placedItems.filter((it) => {
        const p = getProductById(it.productId)!;
        return p.placement !== 'wall' && p.placement !== 'ceiling' && p.placement !== 'surface';
      });
      const boxes = floor.map((it) => {
        const p = getProductById(it.productId)!;
        const f = rotatedFootprint(
          { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) },
          it.rotation,
        );
        return { id: it.instanceId, x0: it.x, y0: it.y, x1: it.x + f.w, y1: it.y + f.h };
      });
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          // A rug is meant to sit under things — it is the one exception.
          if (a.id.includes('rug') || b.id.includes('rug')) continue;
          const overlap = a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6 && a.y0 < b.y1 - 1e-6 && b.y0 < a.y1 - 1e-6;
          expect(overlap, `${a.id} overlaps ${b.id} in ${r.id}`).toBe(false);
        }
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

  it('painted walls use real Permoglaze lines (the Sofap range already in the tool)', () => {
    const ids = new Set(WALL_PAINTS.map((p) => p.id));
    const painted = prop.rooms.filter((r) => (r.wallPaint ?? []).length > 0);
    expect(painted.length).toBeGreaterThanOrEqual(5);
    for (const r of painted) {
      for (const wp of r.wallPaint!) expect(ids.has(wp.paintId), `${r.id} → ${wp.paintId}`).toBe(true);
    }
  });

  it('survives the store normaliser', () => {
    const n = normaliseLoadedProperty(buildCapTamarinApartment());
    expect(n.rooms.map((r) => r.id)).toEqual(['living', 'kitchen', 'bath', 'hall', 'bed1', 'bed2', 'terrace']);
    expect(n.rooms.reduce((c, r) => c + r.placedItems.length, 0)).toBeGreaterThanOrEqual(25);
  });
});
