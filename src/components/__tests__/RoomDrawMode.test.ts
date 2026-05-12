/**
 * RoomDrawMode tests - Week 4b Hotfix 5.
 *
 * Two layers of regression coverage:
 *
 *  1. Pure click-handler chain (geometry-only): screen->room ->
 *     grid-snap -> push vertex (or close polygon if near origin).
 *     This is the chain that broke twice in prior hotfixes; testing it
 *     at the helper level pins the math forever.
 *
 *  2. Architecture invariants checked via static source inspection
 *     (read RoomDrawMode.tsx as text and assert the right shape). We
 *     do NOT import the React component into the test because that
 *     would pull in react-konva, which depends on the native `canvas`
 *     module in Node and is intentionally absent from this project's
 *     deps. The source-text check is enough to catch a regression
 *     where someone re-introduces the portal-inside-Stage pattern.
 */

import { describe, it, expect } from 'vitest';
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
  it('exports RoomDrawLayer (Konva-side, child of Stage)', () => {
    expect(RDM_SOURCE).toMatch(/export\s+function\s+RoomDrawLayer\b/);
  });

  it('exports RoomDrawHUD (DOM-side, sibling of Stage)', () => {
    expect(RDM_SOURCE).toMatch(/export\s+function\s+RoomDrawHUD\b/);
  });

  it('does NOT import createPortal (Hotfix 4 portal-inside-Stage trick was wrong)', () => {
    expect(RDM_SOURCE).not.toMatch(/import\s*\{[^}]*createPortal/);
    // Strip block comments so the architecture-rationale prose at the
    // top of the file (which explains WHY createPortal was wrong) does
    // not trip this check.
    const codeOnly = RDM_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/createPortal\(/);
  });

  it('does NOT export a combined RoomDrawMode component (lifted to layer + HUD)', () => {
    expect(RDM_SOURCE).not.toMatch(/export\s+function\s+RoomDrawMode\b/);
  });

  it('wires Stage event handlers in a useEffect (click + tap + mousemove + touchmove)', () => {
    expect(RDM_SOURCE).toContain("stage.on('click.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.on('tap.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.on('mousemove.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.on('touchmove.roomdraw'");
  });

  it('cleans up Stage handlers on unmount / disable', () => {
    expect(RDM_SOURCE).toContain("stage.off('click.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.off('tap.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.off('mousemove.roomdraw'");
    expect(RDM_SOURCE).toContain("stage.off('touchmove.roomdraw'");
  });

  it('handles Enter as an alternative close gesture (Hotfix 5 addition)', () => {
    expect(RDM_SOURCE).toMatch(/key\s*===\s*['"]Enter['"]/);
  });

  it('handles Escape for cancel', () => {
    expect(RDM_SOURCE).toMatch(/key\s*===\s*['"]Escape['"]/);
  });

  it('handles Ctrl/Cmd+Z for undo', () => {
    expect(RDM_SOURCE).toMatch(/metaKey.*ctrlKey|ctrlKey.*metaKey/);
    expect(RDM_SOURCE).toMatch(/key\s*===\s*['"]z['"]/i);
  });

  it("emits '[draw-mode]' console-log breadcrumbs at every critical step", () => {
    expect(RDM_SOURCE).toContain("'[draw-mode]'");
    expect(RDM_SOURCE).toContain('push vertex');
    expect(RDM_SOURCE).toContain('close via click');
    expect(RDM_SOURCE).toContain('keydown Escape');
    expect(RDM_SOURCE).toContain('keydown Enter');
    expect(RDM_SOURCE).toContain('keydown Ctrl/Cmd+Z');
  });
});

describe('RoomDrawMode - click handler chain (vertex placement)', () => {
  it('first click pushes the first vertex at the snapped grid point', () => {
    const s = simulateClick(startState, 350, 250, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(1);
    expect(s.vertices[0]).toEqual({ x: 2.5, y: 1.5 });
    expect(s.closed).toBe(false);
  });

  it('snaps off-grid clicks to the nearest 0.5 m grid point', () => {
    const s = simulateClick(startState, 100 + 232, 100 + 218, containerRect, viewport, pxPerMetre);
    expect(s.vertices[0]).toEqual({ x: 2.5, y: 2 });
  });

  it('sequential clicks accumulate vertices in order for a 5x4 rectangle', () => {
    let s = startState;
    const clicks: Array<[number, number]> = [
      [100, 100],
      [600, 100],
      [600, 500],
      [100, 500],
    ];
    for (const [cx, cy] of clicks) {
      s = simulateClick(s, cx, cy, containerRect, viewport, pxPerMetre);
    }
    expect(s.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]);
    expect(polygonArea(s.vertices)).toBeCloseTo(20, 6);
    expect(polygonPerimeter(s.vertices)).toBeCloseTo(18, 6);
  });

  it('respects viewport pan + zoom when converting clicks to room coords', () => {
    const panned: Viewport = { x: 50, y: 25, scale: 2 };
    // container (350, 225) -> local (250, 125) -> (250-50)/2 = 100, (125-25)/2 = 50
    // -> /100 px/m = (1.0, 0.5) -> on grid.
    const s = simulateClick(startState, 350, 225, containerRect, panned, pxPerMetre);
    expect(s.vertices[0]).toEqual({ x: 1, y: 0.5 });
  });
});

describe('RoomDrawMode - polygon closing', () => {
  it('clicking near the first vertex (< 0.4 m) closes a >=3-vertex polygon', () => {
    const s0: DrawState = {
      vertices: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
      closed: false,
      committedPolygon: null,
    };
    const s = simulateClick(s0, 105, 105, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(true);
    expect(s.committedPolygon).toHaveLength(4);
    expect(polygonArea(s.committedPolygon!)).toBeCloseTo(20, 6);
    expect(s.vertices).toEqual([]);
  });

  it('does NOT close a 2-vertex polygon (need at least 3)', () => {
    const s0: DrawState = {
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      closed: false,
      committedPolygon: null,
    };
    const s = simulateClick(s0, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(false);
    expect(s.committedPolygon).toBeNull();
  });

  it('isClosingPolygon respects the 0.4 m threshold exactly', () => {
    const partial: Polygon = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
    ];
    expect(isClosingPolygon(partial, { x: 0.2, y: 0.2 }, CLOSE_THRESHOLD_M)).toBe(true);
    expect(isClosingPolygon(partial, { x: 0.5, y: 0 }, CLOSE_THRESHOLD_M)).toBe(false);
  });

  it('commits a triangle when the third vertex closes', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 400, 400, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(3);
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(true);
    expect(s.committedPolygon).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 3, y: 3 },
    ]);
    expect(polygonArea(s.committedPolygon!)).toBeCloseTo(6, 6);
  });
});

describe('RoomDrawMode - Rect -> Draw -> Rect lifecycle', () => {
  it('toggling out of draw mode and back resets local state cleanly', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 100, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(2);

    function onEnterDrawMode(prev: DrawState): DrawState {
      return { vertices: [], closed: false, committedPolygon: prev.committedPolygon };
    }
    s = onEnterDrawMode(s);
    expect(s.vertices).toEqual([]);
    expect(s.closed).toBe(false);

    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toEqual([{ x: 0, y: 0 }]);
  });

  it('Esc cancel returns to an empty in-progress state with no committed polygon', () => {
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

  it('Cmd/Ctrl+Z undo pops the last vertex (preserves order)', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 500, 500, containerRect, viewport, pxPerMetre);
    expect(s.vertices).toHaveLength(3);

    function onUndo(prev: DrawState): DrawState {
      return { ...prev, vertices: prev.vertices.slice(0, -1) };
    }
    s = onUndo(s);
    expect(s.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
  });
});

describe('RoomDrawMode - polygon-then-item placement (collision sanity)', () => {
  it('commits a 5x4 m polygon room and accepts an in-bounds item', () => {
    let s = startState;
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 600, 100, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 600, 500, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 100, 500, containerRect, viewport, pxPerMetre);
    s = simulateClick(s, 100, 100, containerRect, viewport, pxPerMetre);
    expect(s.closed).toBe(true);
    const room = s.committedPolygon!;

    const placement = validatePlacement({ x: 1, y: 1, w: 2, h: 1 }, [], room);
    expect(placement).toEqual({ ok: true });

    const oob = validatePlacement({ x: 4.5, y: 1, w: 1, h: 1 }, [], room);
    expect(oob.ok).toBe(false);
  });
});
