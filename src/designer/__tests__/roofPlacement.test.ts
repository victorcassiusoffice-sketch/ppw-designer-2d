import { describe, expect, it } from 'vitest';
import { getProductById } from '../../data/products';
import { collidesWithAny, isRectInsidePolygon } from '../../lib/geometry';
import type { Property } from '../../store/propertyStore';
import { roofPlacementPoint } from '../roofPlacement';

const panel = getProductById('emcar-jinko-475')!;
const polygon = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 8 }, { x: 0, y: 8 }];
const property = (): Property => ({ id: 'p', name: 'House', activeRoomId: 'roof-room', activeLevelId: 'roof',
  roof: { style: 'gable', material: 'felt', pitchDeg: 25, overhangM: 0.2 },
  levels: [{ id: 'ground', index: 0, name: 'Ground' }, { id: 'roof', index: 1, kind: 'roof', name: 'Roof' }],
  rooms: [{ id: 'roof-room', name: 'Roof', levelId: 'roof', kind: 'roof', polygon, placedItems: [] }],
});
describe('roof centre-add position', () => {
  it('finds repeated non-overlapping real catalog panel slots on the saved roof footprint', () => {
    const p = property();
    const w = panel.dimensions_cm.length / 100, h = panel.dimensions_cm.width / 100;
    for (let i = 0; i < 4; i++) {
      const before = JSON.stringify(p);
      const point = roofPlacementPoint(p, panel)!;
      expect(point).not.toBeNull();
      const rect = { x: point.x - w / 2, y: point.y - h / 2, w, h };
      expect(isRectInsidePolygon(rect, polygon)).toBe(true);
      expect(collidesWithAny(rect, p.rooms[0].placedItems.map((item) => ({ ...item, w, h })))).toBe(false);
      expect(JSON.stringify(p)).toBe(before);
      p.rooms[0].placedItems.push({ instanceId: `pv-${i}`, productId: panel.id, x: rect.x, y: rect.y, rotation: 0 });
    }
  });
  it('reports no slot when a real panel cannot fit without extending off the roof', () => {
    const p = property();
    p.rooms[0].polygon = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    expect(roofPlacementPoint(p, panel)).toBeNull();
  });
});
