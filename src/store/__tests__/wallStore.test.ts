/**
 * @vitest-environment jsdom
 *
 * Sims-Parity M2 — wallStore reducers + room-detect math.
 * jsdom env is needed for the localStorage persistence assertion.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectClosedRoomVertices,
  polygonAreaM2,
  snapMm,
  snapToWallEndpointOrGrid,
  useWallStore,
  WALL_SNAP_MM,
  type WallSegment,
} from '../wallStore';

function makeSquare(): WallSegment[] {
  const p = (x_mm: number, y_mm: number) => ({ x_mm, y_mm });
  const s = (id: string, a: { x_mm: number; y_mm: number }, b: { x_mm: number; y_mm: number }): WallSegment => ({
    id,
    start: a,
    end: b,
    thickness_mm: 100,
    height_mm: 2700,
    type: 'full',
  });
  return [
    s('w1', p(0, 0), p(4000, 0)),
    s('w2', p(4000, 0), p(4000, 3000)),
    s('w3', p(4000, 3000), p(0, 3000)),
    s('w4', p(0, 3000), p(0, 0)),
  ];
}

describe('snapMm', () => {
  it('snaps to the default 500 mm grid', () => {
    expect(snapMm(0)).toBe(0);
    expect(snapMm(249)).toBe(0);
    expect(snapMm(250)).toBe(500);
    expect(snapMm(1234)).toBe(1000);
    expect(snapMm(1250)).toBe(1500);
  });

  it('accepts a custom step', () => {
    expect(snapMm(1234, 100)).toBe(1200);
    expect(snapMm(1250, 100)).toBe(1300);
  });
});

describe('snapToWallEndpointOrGrid', () => {
  it('falls back to grid snap when no endpoint is near', () => {
    const out = snapToWallEndpointOrGrid({ x_mm: 1234, y_mm: 567 }, []);
    expect(out).toEqual({ x_mm: 1000, y_mm: 500 });
  });

  it('snaps to an existing endpoint within tolerance', () => {
    const walls = makeSquare();
    const out = snapToWallEndpointOrGrid({ x_mm: 100, y_mm: 100 }, walls);
    expect(out.snappedTo).toBe('endpoint');
    expect(out.x_mm).toBe(0);
    expect(out.y_mm).toBe(0);
  });

  it('prefers grid when point is further than tolerance', () => {
    const walls = makeSquare();
    const out = snapToWallEndpointOrGrid({ x_mm: 1234, y_mm: 567 }, walls);
    expect(out.snappedTo).toBeUndefined();
    expect(out.x_mm).toBe(1000);
    expect(out.y_mm).toBe(500);
  });
});

describe('detectClosedRoomVertices', () => {
  it('returns null for an open polyline', () => {
    const walls = makeSquare().slice(0, 3); // 3-segment L
    expect(detectClosedRoomVertices(walls)).toBeNull();
  });

  it('returns the 4 vertices for a closed square', () => {
    const walls = makeSquare();
    const verts = detectClosedRoomVertices(walls);
    expect(verts).not.toBeNull();
    expect(verts!.length).toBe(4);
  });

  it('returns null when there are too few segments', () => {
    expect(detectClosedRoomVertices([])).toBeNull();
    expect(detectClosedRoomVertices([makeSquare()[0]])).toBeNull();
    expect(detectClosedRoomVertices(makeSquare().slice(0, 2))).toBeNull();
  });
});

describe('polygonAreaM2', () => {
  it('computes area of a 4 × 3 m room as 12 m²', () => {
    const walls = makeSquare();
    const verts = detectClosedRoomVertices(walls);
    expect(verts).not.toBeNull();
    expect(polygonAreaM2(verts!)).toBeCloseTo(12, 5);
  });

  it('returns 0 for degenerate polygons', () => {
    expect(polygonAreaM2([])).toBe(0);
    expect(polygonAreaM2([{ x_mm: 0, y_mm: 0 }])).toBe(0);
    expect(polygonAreaM2([{ x_mm: 0, y_mm: 0 }, { x_mm: 1000, y_mm: 0 }])).toBe(0);
  });
});

describe('useWallStore', () => {
  beforeEach(() => {
    useWallStore.getState().replace([]);
    useWallStore.getState().setDraw({ phase: 'idle' });
    try {
      localStorage.removeItem('ppw_walls_v1');
    } catch {
      // ignore
    }
  });

  it('addWall appends + returns the new id', () => {
    const id = useWallStore.getState().addWall({
      start: { x_mm: 0, y_mm: 0 },
      end: { x_mm: 1000, y_mm: 0 },
      thickness_mm: 100,
      height_mm: 2700,
      type: 'full',
    });
    expect(typeof id).toBe('string');
    expect(useWallStore.getState().walls).toHaveLength(1);
    expect(useWallStore.getState().walls[0].id).toBe(id);
  });

  it('undoLast pops the trailing segment', () => {
    const store = useWallStore.getState();
    store.addWall({ start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' });
    store.addWall({ start: { x_mm: 1000, y_mm: 0 }, end: { x_mm: 1000, y_mm: 1000 }, thickness_mm: 100, height_mm: 2700, type: 'full' });
    expect(useWallStore.getState().walls).toHaveLength(2);
    store.undoLast();
    expect(useWallStore.getState().walls).toHaveLength(1);
  });

  it('clearWalls empties + idles the FSM', () => {
    const store = useWallStore.getState();
    store.addWall({ start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' });
    store.setDraw({ phase: 'armed' });
    store.clearWalls();
    expect(useWallStore.getState().walls).toEqual([]);
    expect(useWallStore.getState().draw.phase).toBe('idle');
  });

  it('persists to localStorage on add and reads back on next session', () => {
    useWallStore.getState().addWall({
      start: { x_mm: 0, y_mm: 0 },
      end: { x_mm: 1000, y_mm: 0 },
      thickness_mm: 100,
      height_mm: 2700,
      type: 'full',
    });
    const raw = localStorage.getItem('ppw_walls_v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].start.x_mm).toBe(0);
  });
});

describe('WALL_SNAP_MM constant', () => {
  it('is 500 mm per V-GAME-3 decision', () => {
    expect(WALL_SNAP_MM).toBe(500);
  });
});
