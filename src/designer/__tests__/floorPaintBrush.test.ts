/**
 * floorPaintBrush — 3D Mode flooring (2026-09-22): Shift fills the room,
 * Ctrl strips, this click only; the panel's chips are untouched. Drag-rect
 * commits on release as one undo (Sims floor paint).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyFloorPaintBrush, floorBrushLabel, previewFloorDrag } from '../floorPaintBrush';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePropertyStore } from '../../store/propertyStore';
import { runsToSet } from '../floorTiles';

const ROOM = {
  id: 'r1',
  name: 'Room 1',
  polygon: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
  ],
  placedItems: [],
};

function zones() {
  return usePropertyStore.getState().property.rooms[0].floorTiles ?? [];
}

function tileCount(): number {
  const z = zones()[0];
  return z ? runsToSet(z.runs).size : 0;
}

describe('applyFloorPaintBrush', () => {
  beforeEach(() => {
    usePropertyStore.setState((s) => ({
      property: {
        ...s.property,
        id: 'p',
        name: 'T',
        activeRoomId: 'r1',
        rooms: [{ ...ROOM, placedItems: [], floorTiles: [], floorFinish: undefined } as never],
        walls: [],
      },
    }));
    useDesignerUIStore.setState((s) => ({
      floorDraft: { ...s.floorDraft, materialId: 'outdoor-1m', scope: 'tile', erase: false },
    }));
  });

  it('a miss says what to do', () => {
    expect(applyFloorPaintBrush(null).message).toBe('Tap the floor to lay it.');
  });

  it('a tap outside every room warns', () => {
    expect(applyFloorPaintBrush({ x: -10, y: -10 }).message).toBe('Tap inside a room to lay the floor.');
  });

  it('Room scope (or Shift) fills the whole room without changing the scope chip', () => {
    useDesignerUIStore.setState((s) => ({
      floorDraft: { ...s.floorDraft, scope: 'tile', materialId: 'outdoor-1m', erase: false },
    }));
    const r = applyFloorPaintBrush({ x: 2, y: 2 }, { shift: true });
    expect(zones().length).toBe(1);
    expect(zones()[0].materialId).toBe('outdoor-1m');
    expect(r.detail).toContain('Room 1');
    expect(useDesignerUIStore.getState().floorDraft.scope).toBe('tile');
  });

  it('Ctrl clears the room floor and leaves Erase off', () => {
    applyFloorPaintBrush({ x: 2, y: 2 }, { shift: true });
    expect(zones().length).toBe(1);
    const r = applyFloorPaintBrush({ x: 2, y: 2 }, { ctrl: true, shift: true });
    expect(zones().length).toBe(0);
    expect(r.detail).toContain('cleared');
    expect(useDesignerUIStore.getState().floorDraft.erase).toBe(false);
  });

  it('tile scope paints one tile under the cursor', () => {
    const r = applyFloorPaintBrush({ x: 0.5, y: 0.5 });
    expect(zones().length).toBe(1);
    expect(zones()[0].runs.length).toBeGreaterThan(0);
    expect(r.detail).toContain('Outdoor');
  });

  it('a drag rectangle lays many tiles in one stroke', () => {
    const r = applyFloorPaintBrush({ x: 0.5, y: 0.5 }, {}, { x: 2.5, y: 2.5 });
    expect(tileCount()).toBeGreaterThan(1);
    expect(r.detail).toMatch(/\d+ tiles/);
  });

  it('previewFloorDrag reports the pending count without writing', () => {
    const prev = previewFloorDrag({ x: 0.5, y: 0.5 }, { x: 2.5, y: 2.5 });
    expect(prev).not.toBeNull();
    expect(prev!.count).toBeGreaterThan(1);
    expect(zones().length).toBe(0);
  });

  it('floorBrushLabel names the material or Erase', () => {
    expect(floorBrushLabel({ materialId: 'outdoor-1m', erase: false })).toMatch(/Outdoor/i);
    expect(floorBrushLabel({ materialId: 'outdoor-1m', erase: true })).toBe('Erase');
  });
});
