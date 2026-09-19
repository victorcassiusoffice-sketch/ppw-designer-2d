/**
 * wallPaintBrush — the Sims keys (2026-09-17): Shift on a click paints the
 * whole room, Ctrl strips, this click only; the panel's chips are untouched.
 * The plan's tap and the 3D stroke both land here.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyWallPaintBrush, brushLabel } from '../wallPaintBrush';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePropertyStore } from '../../store/propertyStore';

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

function painted(): Array<{ edgeIndex: number; paintId: string }> {
  return (usePropertyStore.getState().property.rooms[0].wallPaint ?? []).map((e) => ({ edgeIndex: e.edgeIndex, paintId: e.paintId }));
}

describe('applyWallPaintBrush modifiers', () => {
  beforeEach(() => {
    usePropertyStore.setState((s) => ({
      property: { ...s.property, id: 'p', name: 'T', activeRoomId: 'r1', rooms: [{ ...ROOM, placedItems: [] } as never], walls: [] },
    }));
    useDesignerUIStore.setState((s) => ({ wallPaintDraft: { ...s.wallPaintDraft, paintId: 'permoglaze-matt-emulsion', scope: 'wall', erase: false } }));
  });

  it('a plain click paints the one wall and reports it for the caption', () => {
    const r = applyWallPaintBrush({ kind: 'edge', roomId: 'r1', edgeIndex: 1 });
    expect(painted()).toEqual([{ edgeIndex: 1, paintId: 'permoglaze-matt-emulsion' }]);
    expect(r.message).toBeNull();
    expect(r.detail).toBe('Wall 2 · Permoglaze Matt Emulsion');
  });

  it('Shift paints every wall of the room without changing the scope chip', () => {
    const r = applyWallPaintBrush({ kind: 'edge', roomId: 'r1', edgeIndex: 1 }, { shift: true });
    expect(painted().map((e) => e.edgeIndex).sort()).toEqual([0, 1, 2, 3]);
    expect(r.detail).toContain('Whole room');
    expect(useDesignerUIStore.getState().wallPaintDraft.scope).toBe('wall');
  });

  it('Ctrl strips the wall it lands on and leaves Erase off', () => {
    applyWallPaintBrush({ kind: 'edge', roomId: 'r1', edgeIndex: 1 }, { shift: true });
    const r = applyWallPaintBrush({ kind: 'edge', roomId: 'r1', edgeIndex: 2 }, { ctrl: true });
    expect(painted().map((e) => e.edgeIndex).sort()).toEqual([0, 1, 3]);
    expect(r.detail).toBe('Wall 3 · paint removed');
    expect(useDesignerUIStore.getState().wallPaintDraft.erase).toBe(false);
  });

  it('a miss says what to do', () => {
    expect(applyWallPaintBrush(null).message).toBe('Tap a wall to paint it.');
  });

  it('brushLabel names the paint and its tint, or Erase', () => {
    expect(brushLabel({ paintId: 'permoglaze-matt-emulsion', erase: false })).toBe('Permoglaze Matt Emulsion');
    expect(brushLabel({ paintId: 'permoglaze-matt-emulsion', colourHex: '#4C493F', colourName: 'Bronze', erase: false })).toBe('Permoglaze Matt Emulsion · Bronze');
    expect(brushLabel({ paintId: 'permoglaze-matt-emulsion', erase: true })).toBe('Erase');
  });
});
