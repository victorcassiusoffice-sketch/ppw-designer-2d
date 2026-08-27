/**
 * RoomDrawMode tests - Week 4b Hotfix 5 (+ Hotfix 7 close-commit tests).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isClosingPolygon,
  screenToRoom,
  snapToGrid,
  polygonArea,
  polygonPerimeter,
  validatePlacement,
} from '../../lib/geometry';
import type { Polygon, Vertex, Viewport } from '../../lib/geometry';
import { usePropertyStore, selectActiveRoom } from '../../store/propertyStore';

const GRID_STEP_M = 0.5;
const CLOSE_THRESHOLD_M = 0.4;

interface DrawState {
  vertices: Polygon;
  closed: boolean;
  committedPolygon: Polygon | null;
}

function simulateClick(
  state: DrawState,
  clientX: number,
  clientY: number,
  containerRect: { left: number; top: number },
  viewport: Viewport,
  pxPerMetre: number,
): DrawState {
  const { xM, yM } = screenToRoom(clientX, clientY, containerRect, viewport, pxPerMetre);
  const p: Vertex = { x: snapToGrid(xM, GRID_STEP_M), y: snapToGrid(yM, GRID_STEP_M) };
  if (isClosingPolygon(state.vertices, p, CLOSE_THRESHOLD_M)) {
    if (state.vertices.length >= 3) {
      return { vertices: [], closed: true, committedPolygon: state.vertices };
    }
    return state;
  }
  return { ...state, vertices: [...state.vertices, p] };
}

const containerRect = { left: 100, top: 100 };
const viewport: Viewport = { x: 0, y: 0, scale: 1 };
const pxPerMetre = 100;
const startState: DrawState = { vertices: [], closed: false, committedPolygon: null };

const RDM_SOURCE = (() => {
  const p = join(__dirname, '..', 'RoomDrawMode.tsx');
  return readFileSync(p, 'utf8');
})();

describe('RoomDrawMode source - Hotfix 5 architecture invariants', () => {
  it('exports RoomDrawLayer', () => {
    expect(RDM_SOURCE).toMatch(/export\s+function\s+RoomDrawLayer\b/);
  });
  it('exports RoomDrawHUD', () => {
    expect(RDM_SOURCE).toMatch(/export\s+function\s+RoomDrawHUD\b/);
  });
  it('does NOT import createPortal', () => {
    expect(RDM_SOURCE).not.toMatch(/import\s*\{[^}]*createPortal/);
    const codeOnly = RDM_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/createPortal\(/);
  });
  it('does NOT export combined RoomDrawMode', () => {
    expect(RDM_SOURCE).not.toMatch(/export\s+function\s+RoomDrawMode\b/);
  });
  it('wires Stage handlers', () => {
    expect(RDM_SOURCE).toContain("stage.on('click.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.on('tap.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.on('mousemove.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.on('touchmove.roomdraw'");
  });
  it('cleans up Stage handlers', () => {
    expect(RDM_SOURCE).toContain("stage.off('click.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.off('tap.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.off('mousemove.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.off('touchmove.roomdraw'");
  });
  it('handles Enter', () => {
    expect(RDM_SOURCE).toMatch(/key\s*===\s*['"]Enter['"]/);
  });
  it('handles Escape', () => {
    expect(RDM_SOURCE).toMatch(/key\s*===\s*['"]Escape['"]/);
  });
  it('handles Ctrl/Cmd+Z', () => {
    expect(RDM_SOURCE).toMatch(/metaKey.*ctrlKey|ctrlKey.*metaKey/);
    expect(RDM_SOURCE).toMatch(/key\s*===\s*['"]z['"]/i);
  });
  it("emits [draw-mode] breadcrumbs", () => {
    expect(RDM_SOURCE).toContain("'[draw-mode]'");
    expect(RDM_SOURCE).toContain('push vertex');
    expect(RDM_SOURCE).toContain('close via click');
    expect(RDM_SOURCE).toContain('keydown Escape');
    expect(RDM_SOURCE).toContain('keydown Enter');
    expect(RDM_SOURCE).toContain('keydown Ctrl/Cmd+Z');
  });
});

describe('RoomDrawMode - click handler chain', () => {
  it('first click pushes the first vertex', () => {
    const s = simulateClick(startState, 350, 250, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(1);
    expect(s.vertices[0]).toEqual({ x: 2.5, y: 1.5 });
    expect(s.closed).toBe(false);
  });
  it('snaps off-grid clicks', () => {
    const s = simulateClick(startState, 100 + 232, 100 + 218, containerRect, viewport, pxPerMetre);
    expect(s.vertices[0]).toEqual({ x: 2.5, y: 2 });
  });
  it('sequential clicks accumulate', () => {
    let s = startState;
    const clicks: Array<[number, number]> = [[100, 100], [600, 100], [600, 500], [100, 500]];
    for (const [cx, cy] of clicks) {
      s = simulateClick(s, cx, cy, containerRect, viewport, pxPerMetre);
    }
    expect(s.vertices).toEqual([
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    expect(polygonArea(s.vertices)).toBeCloseTo(20, 6);
    expect(polygonPerimeter(s.vertices)).toBeCloseTo(18, 6);
  });
  it('respects viewport pan + zoom', () => {
    const panned: Viewport = { x: 50, y: 25, scale: 2 };
    const s = simulateClick(startState, 350, 225, containerRect, panned, pxPerMetre);
    expect(s.vertices[0]).toEqual({ x: 1, y: 0.5 });
  });
});

describe('RoomDrawMode - polygon closing', () => {
  it('closes near first vertex', () => {
    const s0: DrawState = {
      vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
      closed: false, committedPolygon: null,
    };
    const s = simulateClick(s0, 105, 105, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(true);
    expect(s.committedPolygon).toHaveLength(4);
    expect(polygonArea(s.committedPolygon!)).toBeCloseTo(20, 6);
    expect(s.vertices).toEqual([]);
  });
  it('does NOT close 2-vertex polygon', () => {
    const s0: DrawState = {
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      closed: false, committedPolygon: null,
    };
    const s = simulateClick(s0, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(false);
    expect(s.committedPolygon).toBeNull();
  });
  it('respects 0.4 m threshold', () => {
    const partial: Polygon = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }];
    expect(isClosingPolygon(partial, { x: 0.2, y: 0.2 }, CLOSE_THRESHOLD_M)).toBe(true);
    expect(isClosingPolygon(partial, { x: 0.5, y: 0 }, CLOSE_THRESHOLD_M)).toBe(false);
  });
  it('commits triangle', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 400, 400, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(3);
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(true);
    expect(s.committedPolygon).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 3, y: 3 }]);
    expect(polygonArea(s.committedPolygon!)).toBeCloseTo(6, 6);
  });
});

describe('RoomDrawMode - Rect/Draw lifecycle', () => {
  it('toggling resets state', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 100, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(2);
    function onEnter(prev: DrawState): DrawState {
      return { vertices: [], closed: false, committedPolygon: prev.committedPolygon };
    }
    s = onEnter(s);
    expect(s.vertices).toEqual([]);
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toEqual([{ x: 0, y: 0 }]);
  });
  it('Esc cancel', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 500, containerRect, viewport, pxPerMetre);
    function onEsc(prev: DrawState): DrawState {
      return { vertices: [], closed: false, committedPolygon: prev.committedPolygon };
    }
    s = onEsc(s);
    expect(s.vertices).toEqual([]);
    expect(s.committedPolygon).toBeNull();
  });
  it('Ctrl-Z undo', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 500, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(3);
    function onUndo(prev: DrawState): DrawState {
      return { ...prev, vertices: prev.vertices.slice(0, -1) };
    }
    s = onUndo(s);
    expect(s.vertices).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
  });
});

describe('RoomDrawMode - polygon-then-item placement', () => {
  it('commits 5x4 room and accepts in-bounds item', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 600, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 600, 500, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 100, 500, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(true);
    const room = s.committedPolygon!;
    expect(validatePlacement({ x: 1, y: 1, w: 2, h: 1 }, [], room)).toEqual({ ok: true });
    expect(validatePlacement({ x: 4.5, y: 1, w: 1, h: 1 }, [], room).ok).toBe(false);
  });
});

// ---------- Hotfix 7 tests ----------

function simulateCommit(polygon: Polygon, name: string): { ok: boolean; reason: string } {
  if (polygon.length < 3) return { ok: false, reason: 'too-few-vertices' };
  const id = usePropertyStore.getState().addRoom({ name, polygon });
  usePropertyStore.getState().setActiveRoom(id);
  return { ok: true, reason: 'committed' };
}

function simulateCancel(): void { /* no-op */ }

describe('RoomDrawMode - close-commit (Hotfix 7)', () => {
  beforeEach(() => {
    usePropertyStore.getState().resetToDefault();
  });
  it('Close click with 3 vertices adds new room and activates it', () => {
    const before = usePropertyStore.getState().property.rooms.length;
    const triangle: Polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }];
    const result = simulateCommit(triangle, 'Sauna');
    expect(result).toEqual({ ok: true, reason: 'committed' });
    const ps = usePropertyStore.getState();
    expect(ps.property.rooms.length).toBe(before + 1);
    const active = selectActiveRoom(ps);
    expect(active?.name).toBe('Sauna');
    expect(active?.polygon).toEqual(triangle);
    expect(active?.placedItems).toEqual([]);
  });
  it('Enter with 3 vertices commits same as Close', () => {
    const before = usePropertyStore.getState().property.rooms.length;
    const triangle: Polygon = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }];
    const result = simulateCommit(triangle, 'Ice Plunge');
    expect(result).toEqual({ ok: true, reason: 'committed' });
    const ps = usePropertyStore.getState();
    expect(ps.property.rooms.length).toBe(before + 1);
    expect(selectActiveRoom(ps)?.name).toBe('Ice Plunge');
  });
  it('Close with 2 vertices rejects', () => {
    const before = usePropertyStore.getState().property.rooms.length;
    const stub: Polygon = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const result = simulateCommit(stub, 'No');
    expect(result).toEqual({ ok: false, reason: 'too-few-vertices' });
    expect(usePropertyStore.getState().property.rooms.length).toBe(before);
  });
  it('Cancel with 5 in-progress vertices adds nothing', () => {
    const before = usePropertyStore.getState().property.rooms.length;
    simulateCancel();
    expect(usePropertyStore.getState().property.rooms.length).toBe(before);
  });
  it('Draw mode ALWAYS creates new room even when active is empty', () => {
    const ps = usePropertyStore.getState();
    const initialRooms = ps.property.rooms.length;
    expect(selectActiveRoom(ps)?.placedItems.length).toBe(0);
    simulateCommit([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }], 'Studio A');
    expect(usePropertyStore.getState().property.rooms.length).toBe(initialRooms + 1);
    const secondNew: Polygon = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }];
    simulateCommit(secondNew, 'Studio B');
    const after = usePropertyStore.getState();
    expect(after.property.rooms.length).toBe(initialRooms + 2);
    expect(selectActiveRoom(after)?.name).toBe('Studio B');
    expect(selectActiveRoom(after)?.polygon).toEqual(secondNew);
  });
});

describe('RoomDrawMode source - Hotfix 7 invariants', () => {
  it('Close button disabled when vertices.length < 3', () => {
    expect(RDM_SOURCE).toMatch(/disabled=\{vertices\.length\s*<\s*3\}/);
  });
  it('Close button tooltip "Need at least 3 walls"', () => {
    expect(RDM_SOURCE).toMatch(/Need at least 3 walls/);
  });
  it('emits [draw-close] diagnostics', () => {
    expect(RDM_SOURCE).toContain("'[draw-close]'");
    expect(RDM_SOURCE).toMatch(/reason:\s*'hud-close-button'/);
    expect(RDM_SOURCE).toMatch(/reason:\s*'enter-key'/);
    expect(RDM_SOURCE).toMatch(/reason:\s*'click-first-vertex'/);
  });
  it('Enter handler does NOT early-return when in INPUT (Hotfix 7)', () => {
    expect(RDM_SOURCE).toMatch(/const\s+inTextField\s*=/);
    expect(RDM_SOURCE).toMatch(/Enter MUST close the polygon/);
  });
});

/**
 * SUPERSEDES `RoomCanvas source - Hotfix 7 always-add-new-room`.
 *
 * Hotfix 7's contract was "every commit adds a NEW room, and the commit
 * body must never touch setRoomPolygon". Attached multi-room (Vic
 * 2026-08-26) deliberately replaces it:
 *
 *   - the commit still calls `addRoom({ name, polygon: newPolygon })` — the
 *     Hotfix-7 behaviour survives, in the else branch;
 *   - but a BLANK active room is now FILLED in place rather than orphaned,
 *     so `setRoomPolygon` inside the commit body is now REQUIRED, not
 *     forbidden. The two Hotfix-7 negative pins asserted the opposite of
 *     the new contract and are removed here — the only sanctioned pin
 *     rewrite in this change (see the brief, rule §2.5).
 *   - and the commit now REJECTS an overlapping polygon before it mutates
 *     anything, which gets its own positive pin.
 *
 * Everything else in this file is untouched: the behaviour tests below
 * drive a store-level `simulateCommit` and needed no change.
 */
describe('RoomCanvas source - attached multi-room commit contract', () => {
  const RC_SOURCE = (() => {
    const p = join(__dirname, '..', 'RoomCanvas.tsx');
    return readFileSync(p, 'utf8');
  })();

  // The body-extraction regex requires `[addRoom` in the useCallback deps.
  const commitFnBody = (() => {
    const m = RC_SOURCE.match(/const\s+handleDrawCommit[\s\S]*?\[addRoom[\s\S]*?\]\s*\);/);
    expect(m).not.toBeNull();
    return m![0];
  })();

  it('still calls addRoom with the drawn polygon (Hotfix 7 path survives)', () => {
    expect(RC_SOURCE).toMatch(/addRoom\(\{\s*name,\s*polygon:\s*newPolygon\s*\}\)/);
    expect(commitFnBody).toMatch(/addRoom\(\{\s*name,\s*polygon:\s*newPolygon\s*\}\)/);
  });

  it('FILLS a blank active room in place instead of orphaning it', () => {
    // The predicate is "the ACTIVE room is blank" (isDrawnPolygon is the
    // shared `polygon.length >= 3` test), never "do rooms exist" — every
    // property always holds >= 1 room object, so the latter is always true.
    expect(commitFnBody).toMatch(/!isDrawnPolygon\(active\.polygon\)/);
    expect(commitFnBody).toMatch(/setRoomPolygon\(active\.id,\s*newPolygon\)/);
  });

  it('REJECTS an overlapping polygon before mutating anything', () => {
    expect(commitFnBody).toMatch(/strictPolygonsOverlap\(newPolygon,\s*r\.polygon\)/);
    expect(commitFnBody).toMatch(/reason:\s*'rejected-overlap'/);
  });

  it('no longer destroys the other rooms on commit', () => {
    // The "Batch 3 Fix 3.1" removeRoom loop is what made drawing a second
    // room delete the first. It must never come back.
    expect(commitFnBody).not.toMatch(/removeRoom\(/);
  });

  it('ends the draw transaction explicitly so the commit is one undo frame', () => {
    expect(commitFnBody).toMatch(/endDrawTransaction\(\)/);
  });

  it('handleDrawCommit emits [draw-close] diagnostics', () => {
    expect(RC_SOURCE).toContain("'[draw-close]'");
    expect(RC_SOURCE).toMatch(/reason:\s*'commit-start'/);
    expect(RC_SOURCE).toMatch(/reason:\s*'commit-success'/);
    expect(RC_SOURCE).toMatch(/reason:\s*'commit-error'/);
  });
});

/**
 * Attached multi-room — the entry-clear deletion (App.tsx). Draw mode used
 * to mass-clear items / walls / zones / treatments so the user drew onto an
 * empty stage; that, plus the commit-side removeRoom loop, is what made a
 * second room destroy the first. Both had to go in the SAME change —
 * removing only one still destroys rooms.
 */
describe('App source - draw mode no longer destroys the canvas', () => {
  const APP_SOURCE = (() => {
    const p = join(__dirname, '..', '..', 'App.tsx');
    return readFileSync(p, 'utf8');
  })();

  const setDrawModeBody = (() => {
    const m = APP_SOURCE.match(/const\s+setDrawMode\s*=\s*useCallback[\s\S]*?\}\s*,\s*\[\]\s*\);/);
    expect(m).not.toBeNull();
    return m![0];
  })();

  it('drops the four entry clears', () => {
    expect(setDrawModeBody).not.toMatch(/clearActiveRoomItems\(\)/);
    expect(setDrawModeBody).not.toMatch(/clearWalls\(\)/);
    expect(setDrawModeBody).not.toMatch(/clearZones\(\)/);
    expect(setDrawModeBody).not.toMatch(/clearTreatments\(\)/);
  });

  it('still opens the history transaction, and nulls the SELECTION on entry', () => {
    // The entry-wipe used to null the selection as a side effect. A
    // selection surviving into draw mode leaves DetailsPanel/FloatingCluster
    // over the canvas eating vertex clicks, and lets item shortcut keys
    // mutate the property inside the suppressed transaction.
    expect(setDrawModeBody).toMatch(/beginDrawTransaction\('draw new room'\)/);
    expect(setDrawModeBody).toMatch(/selectItem\(null\)/);
  });

  it('ABORTS rather than ends the transaction on exit', () => {
    expect(setDrawModeBody).toMatch(/abortDrawTransaction\(\)/);
    expect(setDrawModeBody).not.toMatch(/endDrawTransaction\(\)/);
  });
});
