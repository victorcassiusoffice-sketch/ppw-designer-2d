/**
 * geomBridge — DEV-ONLY `window.__ppwGeom` bridge exposing the canvas's live
 * world→screen transform to Playwright.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every multi-room e2e spec derives its click coordinates from `roomOrigin()`,
 * which pixel-scans the first Konva canvas for the leftmost/topmost GOLD pixel
 * (`ROOM_BORDER_SCAN` in `designer/blueprintTheme.ts`) and calls that world
 * (0, 0). That works only while gold appears nowhere but a room's outer wall.
 *
 * The moment the canvas gains warm-toned FLOOR MATERIALS or gold DOOR symbols,
 * the scan can latch onto a floor pixel or a swing arc instead of the wall —
 * and it fails SILENTLY: the specs still pass, they just assert against a
 * coordinate frame that is quietly wrong. That is the worst failure mode a test
 * harness can have, so the coordinate basis moves off colour and onto geometry
 * BEFORE any of that render work lands.
 *
 * This bridge reads the Konva Stage's own absolute transform — the same matrix
 * the renderer uses — so it is exact by construction and immune to any palette
 * change.
 *
 * SAFETY
 * ------
 * Gated on `import.meta.env.DEV`, a Vite build-time literal: the install call
 * in `main.tsx` becomes `if (false)` in a production build and both it and this
 * module are dead-code-eliminated. It is also strictly READ-ONLY — it exposes
 * no mutators, so even if it did ship it could not change application state.
 *
 * Deliberately NOT reusing the `__TEST_HOOKS__` flag: that is false unless
 * `VITE_TEST_HOOKS=1` is set on the dev server, which is one more thing to
 * forget. A forgotten flag here means falling back to the colour scan, i.e. the
 * exact silent-wrongness this module removes.
 */
import Konva from 'konva';
import { usePropertyStore } from '../store/propertyStore';
import { useDrawProgressStore } from '../store/drawProgressStore';
import { polygonBounds } from './geometry';

export interface GeomPoint {
  x: number;
  y: number;
}

export interface GeomRoomBounds {
  id: string;
  name: string;
  /** World metres. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Vertex count; < 3 means an undrawn (blank) seed room. */
  vertices: number;
}

export interface GeomStageInfo {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  pxPerMetre: number;
}

export interface GeomBridgeApi {
  /** True once a Konva Stage is mounted and measurable. */
  ready: () => boolean;
  /** Stage pan/zoom + the metre→pixel factor. */
  stage: () => GeomStageInfo | null;
  /** World metres → PAGE pixels (what Playwright's mouse wants). */
  worldToScreen: (xM: number, yM: number) => GeomPoint | null;
  /** PAGE pixels → world metres. */
  screenToWorld: (px: number, py: number) => GeomPoint | null;
  /** Every room's world-metre AABB, in property order. */
  rooms: () => GeomRoomBounds[];
  /** Count of MOUNTED `.room-poly` Konva nodes — the render-side room count. */
  renderedRoomCount: () => number;
  /** Vertices currently in flight in room-draw mode. */
  drawVertexCount: () => number;
}

/**
 * The live Stage. Konva keeps a global registry; pick the first stage whose
 * container is actually attached to the document, so a stale stage left behind
 * by an unmounted component can never be measured by accident.
 */
function liveStage(): Konva.Stage | null {
  const stages = Konva.stages ?? [];
  for (const s of stages) {
    try {
      const c = s.container();
      if (c && c.isConnected) return s;
    } catch {
      /* a disposed stage throws on container() — skip it */
    }
  }
  return null;
}

export function installGeomBridge(): void {
  if (typeof window === 'undefined') return;

  const api: GeomBridgeApi = {
    ready() {
      return liveStage() !== null;
    },

    stage() {
      const s = liveStage();
      if (!s) return null;
      return {
        x: s.x(),
        y: s.y(),
        scale: s.scaleX(),
        width: s.width(),
        height: s.height(),
        pxPerMetre: usePropertyStore.getState().pxPerMetre,
      };
    },

    worldToScreen(xM, yM) {
      const s = liveStage();
      if (!s) return null;
      const { pxPerMetre } = usePropertyStore.getState();
      // Layer space is world-metres × pxPerMetre; the Stage transform carries
      // the pan/zoom on top of it. Ask Konva for its own matrix rather than
      // re-deriving it — that way this can never drift from the renderer.
      const p = s.getAbsoluteTransform().point({ x: xM * pxPerMetre, y: yM * pxPerMetre });
      const rect = s.container().getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y };
    },

    screenToWorld(px, py) {
      const s = liveStage();
      if (!s) return null;
      const { pxPerMetre } = usePropertyStore.getState();
      const rect = s.container().getBoundingClientRect();
      const inv = s.getAbsoluteTransform().copy().invert();
      const p = inv.point({ x: px - rect.left, y: py - rect.top });
      return { x: p.x / pxPerMetre, y: p.y / pxPerMetre };
    },

    rooms() {
      return usePropertyStore.getState().property.rooms.map((r) => {
        const b = polygonBounds(r.polygon);
        return {
          id: r.id,
          name: r.name,
          minX: b.minX,
          minY: b.minY,
          maxX: b.maxX,
          maxY: b.maxY,
          vertices: r.polygon.length,
        };
      });
    },

    drawVertexCount() {
      return useDrawProgressStore.getState().vertices.length;
    },

    renderedRoomCount() {
      const s = liveStage();
      if (!s) return 0;
      try {
        return s.find('.room-poly').length;
      } catch {
        return 0;
      }
    },
  };

  (window as unknown as { __ppwGeom?: GeomBridgeApi }).__ppwGeom = api;
}
