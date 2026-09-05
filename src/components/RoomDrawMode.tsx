/**
 * RoomDrawMode - Week 2.5 polygon room editor, comprehensively rewired
 * in Week 4b Hotfix 5. Week 4b Hotfix 7 wired the Close button + Enter
 * key into a single "always-add-a-new-room" commit path so Vic can
 * actually add multiple rooms via Draw mode.
 *
 * The user clicks/taps on the canvas to drop polygon vertices; vertices
 * snap to the 0.5 m grid. Once a candidate vertex lands within 0.4 m of
 * the first vertex (or the user presses Enter / clicks Close with >=3
 * vertices), the polygon closes and is committed as a NEW Room in the
 * active Property. The new room becomes active.
 *
 *  - Cmd/Ctrl + Z undoes the last vertex while drawing.
 *  - Esc cancels the draw.
 *  - Enter closes the polygon when >=3 vertices are placed.
 *  - Total perimeter (m) and area (m^2) are shown live in the HUD.
 *  - The user can rename the room inline before committing.
 *
 * Console-log breadcrumbs `[draw-mode]` (state changes) and
 * `[draw-close]` (every branch point in the commit path) stay in
 * until Designer Phase 1 is stable.
 *
 * fix/mobile-ux-v1 (May 2026): HUD buttons resized to >=44px tap targets
 * and flex-wrap so they don't crush the readout strip on narrow phones.
 * Touch wiring (`stage.on('touchmove.roomdraw')` + `stage.on('tap.roomdraw')`)
 * already in place from Hotfix 5; verified on Android Chrome.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Line, Circle, Group, Text } from 'react-konva';
import type Konva from 'konva';
import {
  distance,
  isClosingPolygon,
  polygonArea,
  polygonPerimeter,
  screenToRoom,
} from '../lib/geometry';
import type { Polygon, Vertex, Viewport } from '../lib/geometry';
import { useToastStore, type ToastKind } from '../store/toastStore';
import { usePropertyStore } from '../store/propertyStore';
import { useDrawProgressStore } from '../store/drawProgressStore';
// Attached multi-room (2026-08-26) — new vertices snap onto the walls of
// rooms that already exist, so adjacent rooms share exact geometry.
import {
  snapVertexToRooms,
  wallSnapTolM,
  closeThresholdM,
  type SnapHit,
} from '../designer/roomLayout';
// Units brief (2026-08-28) — the snap step is user-selectable, so it is read
// live INSIDE each handler via this non-React accessor. It must never become
// a dep of the wiring effect below.
import {
  currentSnapStepM,
  useDesignerUIStore,
  PRECISION_STEP_M,
  SNAP_UNIT_ORDER,
  SNAP_UNIT_LABEL,
  stepSnapUnit,
} from '../store/designerUIStore';
import { formatLengthForUnit, chipVisibleAt } from '../designer/unitFormat';
import {
  quantiseVertex,
  nextVertexAtLength,
  axisLockVertex,
  type LockAxis,
} from '../designer/drawLength';
// Blueprint reskin + legible measurements (Vic 2026-08-25, complaints 3+5).
import { MeasurementChip } from '../designer/MeasurementChip';
import {
  MEASURE_TEXT,
  ROOM_FILL,
  WALL_INK,
  SELECT_STROKE,
  LABEL_HALO,
  CHROME_BG,
  CHROME_RIM,
  CHROME_TEXT,
  CHROME_TEXT_2,
  CHROME_ACTIVE_BG,
  CHROME_ACTIVE_TEXT,
} from '../designer/blueprintTheme';

function pushDrawToast(message: string, kind: ToastKind = 'info'): void {
  try {
    useToastStore.getState().push(message, kind);
  } catch {
    // Toast store optional in some test envs - never throw out of a key handler.
  }
}

export const CLOSE_THRESHOLD_M = 0.4;
export const GRID_STEP_M = 0.5;

const DBG = '[draw-mode]';

// ---------------------------------------------------------------------------
// RoomDrawLayer - Konva-only. MUST be rendered as a direct child of <Stage>.
// ---------------------------------------------------------------------------

/**
 * A hover point plus, when it landed on an existing room's geometry, WHICH
 * kind of feature it snapped to. Committed polygon vertices are always the
 * plain `Vertex` — this extra key never reaches `Room.polygon`.
 */
export type HoverVertex = Vertex & { snap?: 'vertex' | 'edge'; axis?: LockAxis };

export interface RoomDrawLayerProps {
  enabled: boolean;
  stageRef: React.RefObject<Konva.Stage>;
  containerRef: React.RefObject<HTMLDivElement>;
  viewport: Viewport;
  pxPerMetre: number;
  vertices: Polygon;
  setVertices: (next: Polygon | ((v: Polygon) => Polygon)) => void;
  /** Hover carries the snap KIND so the layer can draw the snap ring. */
  hover: HoverVertex | null;
  setHover: (v: HoverVertex | null) => void;
  name: string;
  onCommit: (polygon: Polygon, name: string) => void;
  /**
   * Sims world (2026-08-29): an OPEN run of walls is a legitimate result.
   * Called with >= 2 vertices when the user finishes without closing —
   * the run becomes free-standing walls instead of being thrown away.
   */
  onCommitWalls?: (vertices: Polygon) => void;
  onCancel: () => void;
  /**
   * Gesture veto (Vic 2026-09-05: "I needed to zoom out and move over but the
   * wall draw was still active and made me draw random walls").
   *
   * RoomCanvas owns the touch handlers that pinch-zoom and one-finger-pan the
   * stage; when a gesture turns out to be a pan or a pinch it raises this
   * flag, and the vertex commit below refuses. The flag is CLEARED by
   * RoomCanvas at the start of the next single-finger gesture, never here: a
   * touch reaches the Stage twice (Konva `tap`, then the browser's
   * compatibility `click`), so a consume-on-read would let the second event
   * through and plant the very vertex the pan was trying to avoid.
   */
  tapSuppressRef?: React.MutableRefObject<boolean>;
}

/** A mouse press that travelled further than this is a drag, not a vertex. */
const DRAW_TAP_SLOP_PX = 12;

export function RoomDrawLayer({
  enabled,
  stageRef,
  containerRef,
  viewport,
  pxPerMetre,
  vertices,
  setVertices,
  hover,
  setHover,
  name,
  onCommit,
  onCommitWalls,
  onCancel,
  tapSuppressRef,
}: RoomDrawLayerProps) {
  // Units brief (2026-08-28, D8) - the measurement chips are RENDER output,
  // so unlike the pointer handlers they subscribe reactively: picking a new
  // unit must re-label the chips without needing a mouse move.
  const stepM = useDesignerUIStore((s) => PRECISION_STEP_M[s.precision]);
  const verticesRef = useRef(vertices);
  verticesRef.current = vertices;
  const nameRef = useRef(name);
  nameRef.current = name;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const onCommitWallsRef = useRef(onCommitWalls);
  onCommitWallsRef.current = onCommitWalls;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const setVerticesRef = useRef(setVertices);
  setVerticesRef.current = setVertices;
  const setHoverRef = useRef(setHover);
  setHoverRef.current = setHover;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const tapSuppressRefRef = useRef(tapSuppressRef);
  tapSuppressRefRef.current = tapSuppressRef;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const stage = stageRef.current;
    const container = containerRef.current;
    if (!stage || !container) {
      console.warn(DBG, 'layer effect: stage or container ref not ready', {
        hasStage: !!stage,
        hasContainer: !!container,
      });
      return;
    }
    console.log(DBG, 'layer effect: wiring Stage handlers');

    /**
     * Attached multi-room (2026-08-26): wall-snap runs FIRST and its output
     * is NEVER re-grid-snapped — re-snapping would drift a vertex off the
     * wall it was just attached to (5.13 m → 5.0 m) and open the exact
     * overlap strip the snap exists to prevent.
     *
     * Returns a CLEAN `{x, y}`. Any extra key on a vertex object would
     * JSON-persist straight into `Room.polygon` — a silent schema leak —
     * because this feeds BOTH the hover path and the click path that pushes
     * committed vertices. The snap KIND is computed separately in
     * `handleMove` and attached only to the hover value.
     */
    /**
     * Straight-line assist (2026-08-31, complaint A). The grid branch runs the
     * candidate through `axisLockVertex(prev, …)` so a run the user means to be
     * horizontal/vertical commits exactly on the axis instead of a cell-drift
     * slant. `freed` (Shift held) releases the lock for a deliberate diagonal.
     *
     * The wall-snap branch is left UNTOUCHED and un-locked — re-projecting a
     * wall-snapped vertex onto an axis would drift it off the wall it was just
     * attached to and reopen the overlap the snap exists to prevent (same
     * reason grid quantisation skips it). `axis` rides on the return so the HUD
     * can show the "straight" affordance; it is stripped before commit.
     */
    function resolveDrawPoint(
      evt: { clientX: number; clientY: number },
      freed: boolean,
    ): { point: Vertex; snap?: 'vertex' | 'edge'; axis: LockAxis } {
      const hit = snapHitFor(evt);
      if (hit) return { point: { x: hit.v.x, y: hit.v.y }, snap: hit.kind, axis: 'none' };
      const raw = rawRoomPoint(evt);
      const gridPt = quantiseVertex(raw, currentSnapStepM());
      const verts = verticesRef.current;
      const prev = verts.length > 0 ? verts[verts.length - 1] : null;
      const locked = axisLockVertex(prev, gridPt, { freed });
      return { point: locked.vertex, axis: locked.axis };
    }

    /** Shift releases the axis lock. Touch events carry no `shiftKey`. */
    function shiftFrom(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): boolean {
      const evt = e.evt as MouseEvent;
      return !!(evt && evt.shiftKey);
    }

    function rawRoomPoint(evt: { clientX: number; clientY: number }): Vertex {
      const rect = container!.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        evt.clientX,
        evt.clientY,
        { left: rect.left, top: rect.top },
        viewportRef.current,
        pxPerMetre,
      );
      return { x: xM, y: yM };
    }

    /**
     * Rooms are read via `getState()` INSIDE the handler — the wiring effect
     * below must NOT gain store deps, or it would tear down and re-attach
     * every Stage handler on every room mutation.
     */
    function snapHitFor(evt: { clientX: number; clientY: number }): SnapHit | null {
      return snapVertexToRooms(
        rawRoomPoint(evt),
        usePropertyStore.getState().property.rooms,
        wallSnapTolM(currentSnapStepM()),
      );
    }

    function readClient(evt: MouseEvent | TouchEvent): { x: number; y: number } | null {
      if ('changedTouches' in evt && evt.changedTouches && evt.changedTouches[0]) {
        return { x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY };
      }
      if ('touches' in evt && evt.touches && evt.touches[0]) {
        return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
      }
      const m = evt as MouseEvent;
      if (typeof m.clientX === 'number' && typeof m.clientY === 'number') {
        return { x: m.clientX, y: m.clientY };
      }
      return null;
    }

    function handleMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
      const c = readClient(e.evt as MouseEvent | TouchEvent);
      if (!c) return;
      // The snap KIND and axis-lock flag ride on the HOVER value only — they
      // drive the gold ring + "straight" readout below and must never reach a
      // committed polygon vertex (both are stripped when the click pushes).
      const r = resolveDrawPoint({ clientX: c.x, clientY: c.y }, shiftFrom(e));
      setHoverRef.current({ ...r.point, snap: r.snap, axis: r.axis });
    }

    /** Where the current mouse press started, for the drag-is-not-a-vertex test. */
    let mouseDownAt: { x: number; y: number } | null = null;

    function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
      const c = readClient(e.evt as MouseEvent);
      // A finger also fires a COMPATIBILITY mousedown a few ms after its
      // tap. Recording that would leave a stale press position behind, and
      // the NEXT tap (a fresh touch, tens of px away) would then be read as
      // a drag and refused — every tap after the first would be swallowed.
      if (c && isCompatAfterTap(c)) return;
      mouseDownAt = c ? { x: c.x, y: c.y } : null;
    }

    function handleClickOrTap(
      e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
      fromTap = false,
    ) {
      const c = readClient(e.evt as MouseEvent | TouchEvent);
      if (!c) {
        console.warn(DBG, 'click: no client coords');
        return;
      }
      // The gesture was a pinch or a pan (RoomCanvas raised the veto) — the
      // user was moving the view, not dropping a point.
      if (tapSuppressRefRef.current?.current) {
        console.log(DBG, 'tap ignored: view gesture (pan/pinch)');
        return;
      }
      // Mouse only: a press that travelled is a drag, not a vertex. A touch
      // tap is already guarded by the pan/pinch veto above, and it must never
      // be measured against a compat mousedown.
      const down = fromTap ? null : mouseDownAt;
      mouseDownAt = null;
      if (down && Math.hypot(c.x - down.x, c.y - down.y) > DRAW_TAP_SLOP_PX) {
        console.log(DBG, 'click ignored: pointer travelled', {
          dist: Math.round(Math.hypot(c.x - down.x, c.y - down.y)),
        });
        return;
      }
      const p = resolveDrawPoint({ clientX: c.x, clientY: c.y }, shiftFrom(e)).point;
      const current = verticesRef.current;
      console.log(DBG, 'click', {
        candidate: p,
        verticesBefore: current.length,
      });
      if (isClosingPolygon(current, p, closeThresholdM(currentSnapStepM()))) {
        if (current.length >= 3) {
          console.log(DBG, 'close via click', { vertices: current.length });
          console.log('[draw-close]', {
            reason: 'click-first-vertex',
            vertices: current.length,
            success: null,
          });
          onCommitRef.current(current, nameRef.current.trim() || 'New Room');
          setVerticesRef.current([]);
          setHoverRef.current(null);
        } else {
          console.log(DBG, 'close gesture ignored, < 3 vertices');
          console.log('[draw-close]', {
            reason: 'click-first-vertex-too-few-vertices',
            vertices: current.length,
            success: false,
          });
        }
        return;
      }
      const next = [...current, p];
      console.log(DBG, 'push vertex', { vertex: p, verticesAfter: next.length });
      setVerticesRef.current(next);
    }

    /**
     * Polish (2026-08-29) — touch double-vertex. A finger tap reaches the
     * Stage TWICE: Konva's `tap` (from touchend) and then the browser's
     * compatibility `click` (a synthesised MouseEvent at the same point,
     * a few ms later). Both used to run `handleClickOrTap`, so every tap on
     * a phone dropped TWO vertices (4 taps → 8). Konva also fires `click`
     * for a real mouse, so the tap handler cannot simply own the gesture:
     * instead the tap records where + when it landed, and a click arriving
     * within TAP_CLICK_DEDUPE_MS of that point is the ghost and is dropped.
     * A mouse click never has a recent tap on record, so it still adds
     * exactly one vertex.
     */
    const TAP_CLICK_DEDUPE_MS = 500;
    const TAP_CLICK_DEDUPE_PX = 16;
    let lastTap: { t: number; x: number; y: number } | null = null;

    /** True when this mouse event is the compat echo of the tap just handled. */
    function isCompatAfterTap(c: { x: number; y: number }): boolean {
      if (!lastTap) return false;
      return (
        performance.now() - lastTap.t < TAP_CLICK_DEDUPE_MS
        && Math.hypot(c.x - lastTap.x, c.y - lastTap.y) < TAP_CLICK_DEDUPE_PX
      );
    }

    function handleTap(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
      const c = readClient(e.evt as MouseEvent | TouchEvent);
      if (c) lastTap = { t: performance.now(), x: c.x, y: c.y };
      // A finger never leaves a mouse press behind.
      mouseDownAt = null;
      handleClickOrTap(e, true);
    }

    function handleClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
      const c = readClient(e.evt as MouseEvent | TouchEvent);
      if (c && lastTap) {
        const dt = performance.now() - lastTap.t;
        const dist = Math.hypot(c.x - lastTap.x, c.y - lastTap.y);
        if (dt < TAP_CLICK_DEDUPE_MS && dist < TAP_CLICK_DEDUPE_PX) {
          console.log(DBG, 'click after tap ignored (compat click)', { dt: Math.round(dt), dist });
          return;
        }
      }
      handleClickOrTap(e);
    }

    stage.on('mousemove.roomdraw', handleMove);
    stage.on('touchmove.roomdraw', handleMove);
    stage.on('mousedown.roomdraw', handleMouseDown);
    stage.on('click.roomdraw', handleClick);
    stage.on('tap.roomdraw', handleTap);

    return () => {
      console.log(DBG, 'layer effect: cleanup Stage handlers');
      stage.off('mousemove.roomdraw');
      stage.off('touchmove.roomdraw');
      stage.off('mousedown.roomdraw');
      stage.off('click.roomdraw');
      stage.off('tap.roomdraw');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stageRef, containerRef, pxPerMetre]);

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Units brief (2026-08-28, D9): the segment-length field owns its own
      // Enter (commit the length) and Escape (revert the field). This window
      // listener is CAPTURE phase, and the Escape and Enter branches below
      // both return BEFORE the inTextField guard - so without this early
      // return the field could never win: Enter would close the polygon and
      // Escape would discard every vertex the user had placed.
      if (target?.dataset?.testid === 'draw-segment-length') return;
      const inTextField =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        e.preventDefault();
        // Sims world (Vic 2026-08-29): Esc lifts the pen and KEEPS what was
        // drawn — walls do not need to connect to anything. With two or more
        // points the run is kept as free walls; a lone point is dropped.
        // Discard (the HUD button) is the only path that throws a run away.
        const current = verticesRef.current;
        if (current.length >= 2 && onCommitWallsRef.current) {
          console.log(DBG, 'keydown Escape -> keep open run as walls', { vertices: current.length });
          onCommitWallsRef.current(current);
          setVerticesRef.current([]);
          setHoverRef.current(null);
          return;
        }
        console.log(DBG, 'keydown Escape -> cancel');
        setVerticesRef.current([]);
        setHoverRef.current(null);
        onCancelRef.current();
        return;
      }
      if (e.key === 'Enter') {
        // Hotfix 7: Enter MUST close the polygon even when focus is in
        // the HUD's room-name input. The pre-Hotfix-7 guard bailed out
        // here whenever the input had focus, which is the most common
        // state right before the user finishes drawing (they tab over
        // to rename the room, then hit Enter to close).
        const current = verticesRef.current;
        e.preventDefault();
        // Sims world (2026-08-29): Alt+Enter finishes the run as OPEN walls
        // regardless of vertex count — walls do not have to join.
        if (e.altKey && current.length >= 2 && onCommitWallsRef.current) {
          console.log('[draw-close]', {
            reason: 'alt-enter-open-walls',
            vertices: current.length,
            success: null,
          });
          onCommitWallsRef.current(current);
          setVerticesRef.current([]);
          setHoverRef.current(null);
          return;
        }
        if (current.length >= 3) {
          console.log(DBG, 'keydown Enter -> close', { vertices: current.length });
          // Units brief D12 - Shift+Enter closes AND stays in draw mode, so a
          // plan of several rooms is one continuous gesture.
          if (e.shiftKey) {
            useDrawProgressStore.getState().setContinueAfterCommit(true);
          }
          console.log('[draw-close]', {
            reason: 'enter-key',
            vertices: current.length,
            success: null,
          });
          if (inTextField && target && typeof target.blur === 'function') {
            target.blur();
          }
          onCommitRef.current(current, nameRef.current.trim() || 'New Room');
          setVerticesRef.current([]);
          setHoverRef.current(null);
        } else if (current.length === 2 && onCommitWallsRef.current) {
          // Two vertices cannot enclose anything, so Enter keeps them as ONE
          // free-standing wall rather than refusing — the Sims contract.
          console.log('[draw-close]', {
            reason: 'enter-key-open-walls',
            vertices: current.length,
            success: null,
          });
          onCommitWallsRef.current(current);
          setVerticesRef.current([]);
          setHoverRef.current(null);
        } else {
          console.log('[draw-close]', {
            reason: 'enter-key-too-few-vertices',
            vertices: current.length,
            success: false,
          });
          pushDrawToast('Place at least 2 points for a wall.', 'warn');
        }
        return;
      }
      if (inTextField) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        // Tweak 07 / Phase A.0 coordination: only intercept Ctrl+Z while
        // there are in-flight vertices to pop. Otherwise let the global
        // useKeyboardShortcuts handler route to the unified history stack.
        if (verticesRef.current.length === 0) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log(DBG, 'keydown Ctrl/Cmd+Z -> undo');
        setVerticesRef.current((v) => v.slice(0, -1));
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);

  const segments = useMemo(() => {
    if (vertices.length === 0) return [];
    const segs: { from: Vertex; to: Vertex; lengthM: number }[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      segs.push({
        from: vertices[i],
        to: vertices[i + 1],
        lengthM: distance(vertices[i], vertices[i + 1]),
      });
    }
    if (hover && vertices.length > 0) {
      const last = vertices[vertices.length - 1];
      segs.push({ from: last, to: hover, lengthM: distance(last, hover) });
    }
    return segs;
  }, [vertices, hover]);

  /** Length of the in-progress segment (last committed vertex → cursor). */
  const liveSegmentLengthM = useMemo(() => {
    if (!hover || vertices.length === 0) return 0;
    return distance(vertices[vertices.length - 1], hover);
  }, [vertices, hover]);

  /**
   * Straight-line assist readout (complaint A): the angle of the in-progress
   * segment, 0°/90°/… when axis-locked, the true angle when Shift frees it or
   * the run is a deliberate diagonal. `null` when there is no segment yet.
   * Normalised to 0–180 (a wall reads the same drawn either way).
   */
  const liveSegment = useMemo(() => {
    if (!hover || vertices.length === 0) return null;
    const last = vertices[vertices.length - 1];
    const dx = hover.x - last.x;
    const dy = hover.y - last.y;
    if (Math.hypot(dx, dy) < 1e-6) return null;
    let deg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    if (deg > 90) deg = 180 - deg; // 0 = level, 90 = upright, both directions
    const locked = hover.axis === 'horizontal' || hover.axis === 'vertical';
    return { deg, locked };
  }, [vertices, hover]);

  const closeCandidate = useMemo(() => {
    if (vertices.length < 3 || !hover) return false;
    return isClosingPolygon(vertices, hover, closeThresholdM(currentSnapStepM()));
  }, [vertices, hover]);

  const previewPolygon: Polygon = useMemo(() => {
    if (vertices.length < 2 || !hover) return vertices;
    if (closeCandidate) return vertices;
    return [...vertices, hover];
  }, [vertices, hover, closeCandidate]);

  if (!enabled) return null;

  void name;
  void onCommit;
  void onCancel;
  void setVertices;
  void setHover;

  // Measurement text lives in SCREEN space: everything the chip draws is
  // divided by this so the numbers stay ~16 px however far the user has
  // zoomed. See `measureFontSize` in blueprintTheme.
  const scale = viewport.scale;

  return (
    <Layer listening={false}>
      {previewPolygon.length >= 3 && (
        <Line
          points={previewPolygon.flatMap((v) => [v.x * pxPerMetre, v.y * pxPerMetre])}
          closed
          fill={`${ROOM_FILL}CC`}
          stroke={WALL_INK}
          strokeWidth={1.5}
          dash={[6, 4]}
          opacity={0.9}
        />
      )}

      {segments.map((s, i) => {
        const isPreview = i === segments.length - 1 && hover && i >= vertices.length - 1;
        const mid: Vertex = {
          x: (s.from.x + s.to.x) / 2,
          y: (s.from.y + s.to.y) / 2,
        };
        return (
          <Group key={`seg-${i}`}>
            <Line
              points={[
                s.from.x * pxPerMetre,
                s.from.y * pxPerMetre,
                s.to.x * pxPerMetre,
                s.to.y * pxPerMetre,
              ]}
              stroke={isPreview ? SELECT_STROKE : WALL_INK}
              strokeWidth={isPreview ? 2 : 6}
              dash={isPreview ? [6, 5] : undefined}
              lineCap="square"
            />
            {/* Legible dimension callout at the segment midpoint. Screen-
                space sized, so it reads the same at 30 % and 300 % zoom.
                Skipped for the PREVIEW segment — the cursor chip below
                already shows that length, and two chips reading the same
                number on one line is noise. */}
            {chipVisibleAt(s.lengthM, stepM) && !isPreview && (
              <MeasurementChip
                x={mid.x * pxPerMetre}
                y={mid.y * pxPerMetre}
                text={formatLengthForUnit(s.lengthM, stepM)}
                scale={scale}
              />
            )}
          </Group>
        );
      })}

      {/* Attached multi-room (2026-08-26) — the snap ring. When the cursor
          has been pulled onto an existing room's corner or wall, a gold ring
          says so BEFORE the click, which is the only feedback that the new
          room is about to share that wall exactly. Screen-space radius, so
          it stays the same size at any zoom. */}
      {hover?.snap && (
        <Circle
          x={hover.x * pxPerMetre}
          y={hover.y * pxPerMetre}
          radius={8 / viewport.scale}
          stroke={SELECT_STROKE}
          strokeWidth={2 / viewport.scale}
          listening={false}
        />
      )}

      {/* Running length of the segment being drawn, parked just above the
          cursor so the number is where the user is actually looking. */}
      {hover && chipVisibleAt(liveSegmentLengthM, stepM) && (
        <MeasurementChip
          x={hover.x * pxPerMetre}
          y={hover.y * pxPerMetre}
          text={formatLengthForUnit(liveSegmentLengthM, stepM)}
          scale={scale}
          offsetYPx={-26}
          live
        />
      )}

      {/* Straight-line assist readout (complaint A). The angle of the segment
          the cursor is drawing, parked just below it. When the axis lock is
          engaged the number reads 0°/90° and carries a "straight" tag in the
          highlight colour; a deliberate diagonal (or Shift-freed run) shows the
          true angle in the muted colour. Screen-space sized like the chips. */}
      {hover && liveSegment && (
        <Text
          x={hover.x * pxPerMetre}
          y={hover.y * pxPerMetre + 14 / scale}
          text={
            liveSegment.locked
              ? `${Math.round(liveSegment.deg)}° · straight`
              : `${Math.round(liveSegment.deg)}°`
          }
          fontSize={12 / scale}
          fontStyle={liveSegment.locked ? 'bold' : 'normal'}
          fill={liveSegment.locked ? SELECT_STROKE : MEASURE_TEXT}
          align="center"
          offsetX={0}
          listening={false}
        />
      )}

      {vertices.map((v, i) => (
        <Group key={`v-${i}`}>
          <Circle
            x={v.x * pxPerMetre}
            y={v.y * pxPerMetre}
            radius={i === 0 ? 7 : 5}
            fill={i === 0 ? SELECT_STROKE : WALL_INK}
            stroke={LABEL_HALO}
            strokeWidth={2}
          />
          {i === vertices.length - 1 && vertices.length >= 1 && (
            <Circle
              x={v.x * pxPerMetre}
              y={v.y * pxPerMetre}
              radius={11}
              stroke={SELECT_STROKE}
              strokeWidth={1.5}
              dash={[3, 3]}
            />
          )}
        </Group>
      ))}

      {closeCandidate && vertices.length >= 3 && (
        <Circle
          x={vertices[0].x * pxPerMetre}
          y={vertices[0].y * pxPerMetre}
          radius={14}
          stroke={SELECT_STROKE}
          strokeWidth={2.5}
          fill="rgba(61, 143, 121, 0.2)"
        />
      )}

      {hover && (
        <Circle
          x={hover.x * pxPerMetre}
          y={hover.y * pxPerMetre}
          radius={4}
          fill={MEASURE_TEXT}
          opacity={closeCandidate ? 1 : 0.7}
        />
      )}
    </Layer>
  );
}

// ---------------------------------------------------------------------------
// RoomDrawHUD - DOM-only. MUST be rendered as a SIBLING of <Stage>.
// ---------------------------------------------------------------------------

export interface RoomDrawHUDProps {
  enabled: boolean;
  vertices: Polygon;
  setVertices: (next: Polygon | ((v: Polygon) => Polygon)) => void;
  hover: Vertex | null;
  setHover: (v: Vertex | null) => void;
  name: string;
  setName: (n: string) => void;
  onCommit: (polygon: Polygon, name: string) => void;
  /** Finish the run as free-standing walls (>= 2 vertices). */
  onCommitWalls?: (vertices: Polygon) => void;
  onCancel: () => void;
  /**
   * Repair round 1 (2026-08-29): whether the HUD hosts the unit stepper.
   * RoomCanvas passes `false` below sm (640 px), where it mounts its own
   * bottom-left copy (`mobile-draw-unit-stepper`) instead — so exactly one
   * `snap-unit-stepper` / `-coarser` / `-current` / `-finer` set is in the
   * DOM at any width (Playwright strict mode). Defaults to `true`.
   */
  showUnitStepper?: boolean;
  /**
   * Polish (2026-08-29): below sm (390 px phones) the card is COMPACT —
   * badge + readout on one line, the unit stepper inline with the Length
   * field, Undo as an icon. The stepper is hosted HERE on the phone (the old
   * separate fixed strip is gone), inside the `mobile-draw-unit-stepper`
   * wrapper. RoomCanvas passes `useBelowSm()`.
   */
  phone?: boolean;
  /** Parent ref onto the card element (RoomCanvas fit-to-view reads its rect). */
  cardRef?: React.MutableRefObject<HTMLDivElement | null>;
  /** Live card height (0 when closed) — the CSS var `--draw-hud-h` as a callback. */
  onHeightChange?: (heightPx: number) => void;
}

/**
 * Designer chrome (toolbar pass, 2026-08-29) — the ONE control language every
 * HUD button speaks: 120 ms colour transition (none under reduced-motion),
 * mint focus ring, inset press, 40 % disabled. Colours come from
 * `blueprintTheme` CHROME_* via the matching Tailwind `ppw-*` entries.
 */
const CTRL =
  'pointer-events-auto inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[12px] font-medium leading-none transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:cursor-not-allowed disabled:opacity-40';
/** Rest: paper ground + hairline rim. Hover deepens both. */
const CTRL_REST =
  'bg-ppw-chrome border-ppw-rim text-[#37362f] hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]';
/** Primary: ink fill, paper text — the same pressed/tool-on state as the bars. */
const CTRL_PRIMARY = 'bg-ppw-inkDeep border-ppw-inkDeep text-ppw-paper hover:bg-[#3a3835]';
/** Secondary: outlined ink. */
const CTRL_OUTLINED = 'bg-ppw-chrome border-ppw-inkDeep text-ppw-inkDeep hover:bg-[#f3f1ec]';
/**
 * Destructive: ink label, terracotta icon + rim; hover fills terracotta with
 * white text. Terracotta is never used as small text (3.9:1 on paper).
 */
const CTRL_DANGER =
  'group bg-ppw-chrome border-ppw-clay text-ppw-inkDeep hover:bg-ppw-clay hover:border-ppw-clay hover:text-white';
/** 44 px targets on the phone, 40 px from sm up. */
const CTRL_H = 'min-h-[44px] sm:min-h-[40px]';

/**
 * The unit stepper chip: [-] 0.5 m [+]. Shared by the draw HUD (desktop +
 * mobile) so the unit can change MID-DRAW with a thumb, not a menu. The
 * ladder itself is `stepSnapUnit` in designerUIStore (keyboard shares it).
 */
export function SnapUnitStepper({ compact = false }: { compact?: boolean }): JSX.Element {
  const precision = useDesignerUIStore((s) => s.precision);
  const idx = SNAP_UNIT_ORDER.indexOf(precision);
  const canFiner = idx > 0;
  const canCoarser = idx < SNAP_UNIT_ORDER.length - 1;
  const btn = `${CTRL} ${CTRL_REST} h-11 w-11 !px-0 text-base font-semibold sm:h-10 sm:w-10`;
  return (
    <div
      className="pointer-events-auto flex items-center gap-1"
      data-testid="snap-unit-stepper"
      role="group"
      aria-label="Snap unit"
    >
      <button
        type="button"
        className={btn}
        onClick={() => stepSnapUnit(-1)}
        disabled={!canCoarser}
        aria-label="Coarser unit"
        title="Coarser unit ( - )"
        data-testid="snap-unit-coarser"
      >
        −
      </button>
      <span
        className={`flex h-11 items-center justify-center rounded-lg px-2 text-center text-[12px] font-semibold tabular-nums sm:h-10 ${
          compact ? 'min-w-[52px]' : 'min-w-[60px]'
        }`}
        style={{ background: CHROME_ACTIVE_BG, color: CHROME_ACTIVE_TEXT }}
        data-testid="snap-unit-current"
        aria-live="polite"
      >
        {SNAP_UNIT_LABEL[precision]}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => stepSnapUnit(1)}
        disabled={!canFiner}
        aria-label="Finer unit"
        title="Finer unit ( + )"
        data-testid="snap-unit-finer"
      >
        +
      </button>
    </div>
  );
}

export function RoomDrawHUD({
  enabled,
  vertices,
  setVertices,
  hover,
  setHover,
  name,
  onCommit,
  onCommitWalls,
  onCancel,
  showUnitStepper = true,
  phone = false,
  cardRef,
  onHeightChange,
}: RoomDrawHUDProps) {
  const stepM = useDesignerUIStore((s) => PRECISION_STEP_M[s.precision]);
  const [lengthText, setLengthText] = useState('');
  const hudRef = useRef<HTMLDivElement | null>(null);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;
  // One element, two owners: the local ResizeObserver below and the parent's
  // `cardRef` (RoomCanvas reads the card's rect inside its fit-to-view).
  const setHudEl = useCallback(
    (el: HTMLDivElement | null) => {
      hudRef.current = el;
      if (cardRef) cardRef.current = el;
    },
    [cardRef],
  );

  // Toolbar pass (2026-08-29): the card publishes its live height as
  // `--draw-hud-h` (and the older alias `--room-draw-hud-h`) so anything
  // bottom-anchored can park itself ABOVE the card instead of guessing.
  // Polish: it also reports the height to the parent (`onHeightChange`) so
  // RoomCanvas can subtract it from the fit-to-view height while the pen is
  // open. Resolves to 0 px the moment the pen closes. ResizeObserver is
  // absent in jsdom — there the one-shot apply is all that runs.
  useEffect(() => {
    const root = document.documentElement;
    const el = hudRef.current;
    const publish = (h: number) => {
      root.style.setProperty('--draw-hud-h', `${h}px`);
      root.style.setProperty('--room-draw-hud-h', `${h}px`);
      onHeightChangeRef.current?.(h);
    };
    if (!enabled || !el) {
      publish(0);
      return undefined;
    }
    const apply = () => publish(el.offsetHeight);
    apply();
    if (typeof ResizeObserver === 'undefined') {
      return () => publish(0);
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      publish(0);
    };
  }, [enabled]);

  const last = vertices.length > 0 ? vertices[vertices.length - 1] : null;
  // The field needs a vertex to measure FROM and a cursor to take the
  // direction from. Sitting exactly on the last vertex gives no direction,
  // so the control disables rather than guessing an axis.
  const lengthReady =
    last !== null &&
    hover !== null &&
    Math.hypot(hover.x - last.x, hover.y - last.y) > 1e-9;

  const commitLength = useCallback(() => {
    if (!last) return;
    const typed = Number(lengthText);
    if (!Number.isFinite(typed) || typed <= 0) return;
    const next = nextVertexAtLength(last, hover, typed, stepM);
    if (!next) return;
    console.log(DBG, 'HUD typed length', { lengthM: typed, next });
    setVertices((v) => [...v, next]);
    setLengthText('');
  }, [last, hover, lengthText, stepM, setVertices]);
  const livePerimeter = useMemo(() => polygonPerimeter(vertices), [vertices]);
  const liveArea = useMemo(() => polygonArea(vertices), [vertices]);

  const handleUndo = useCallback(() => {
    console.log(DBG, 'HUD undo click');
    setVertices((v) => v.slice(0, -1));
  }, [setVertices]);

  const handleCancel = useCallback(() => {
    console.log(DBG, 'HUD cancel click');
    setVertices([]);
    setHover(null);
    onCancel();
  }, [setVertices, setHover, onCancel]);

  const handleCloseAnd = useCallback((keepDrawing: boolean) => {
    if (keepDrawing) {
      useDrawProgressStore.getState().setContinueAfterCommit(true);
    }
    if (vertices.length < 3) {
      console.log('[draw-close]', {
        reason: 'hud-close-button-too-few-vertices',
        vertices: vertices.length,
        success: false,
      });
      pushDrawToast('Need at least 3 walls.', 'warn');
      return;
    }
    console.log('[draw-close]', {
      reason: 'hud-close-button',
      vertices: vertices.length,
      success: null,
    });
    onCommit(vertices, name.trim() || 'New Room');
    setVertices([]);
    setHover(null);
  }, [vertices, name, onCommit, setVertices, setHover]);

  const handleClose = useCallback(() => handleCloseAnd(false), [handleCloseAnd]);
  const handleCloseContinue = useCallback(() => handleCloseAnd(true), [handleCloseAnd]);

  /** Sims world: keep the run as open walls — no room, no discard. */
  const handleFinishWalls = useCallback(() => {
    if (!onCommitWalls) return;
    if (vertices.length < 2) {
      pushDrawToast('Place at least 2 points for a wall.', 'warn');
      return;
    }
    console.log('[draw-close]', {
      reason: 'hud-finish-walls',
      vertices: vertices.length,
      success: null,
    });
    onCommitWalls(vertices);
    setVertices([]);
    setHover(null);
  }, [vertices, onCommitWalls, setVertices, setHover]);

  if (!enabled) return null;

  const unitSuffix = stepM >= 1 ? 'm' : stepM <= 0.1 ? 'm (cm grid)' : 'm';

  // ONE readout element at any width (the `room-draw-vertices-count` testid
  // must exist exactly once). On the phone it shares the badge's line with
  // short labels; from sm it heads the second row with the long ones.
  const readout = (
    <div
      className={`flex items-center text-[12px] font-medium tabular-nums ${
        phone ? 'min-w-0 flex-1 gap-x-1.5 overflow-hidden whitespace-nowrap' : 'flex-wrap gap-x-3 gap-y-1'
      }`}
      style={{ color: CHROME_TEXT_2 }}
    >
      <span data-testid="room-draw-vertices-count">
        <b className="font-semibold" style={{ color: CHROME_TEXT }}>{vertices.length}</b>{' '}
        {phone ? 'pts' : 'vertices'}
      </span>
      {phone && <span aria-hidden="true">&middot;</span>}
      <span>
        {!phone && 'perim '}
        <b className="font-semibold" style={{ color: CHROME_TEXT }}>{formatLengthForUnit(livePerimeter, stepM)}</b>
      </span>
      {phone && <span aria-hidden="true">&middot;</span>}
      <span>
        {!phone && 'area '}
        <b className="font-semibold" style={{ color: CHROME_TEXT }}>{liveArea.toFixed(2)} m&sup2;</b>
      </span>
    </div>
  );

  return (
    <div
      ref={setHudEl}
      // Toolbar pass (2026-08-29): FIXED, not absolute. The card used to sit
      // at `absolute bottom-3` inside the canvas section, which on a phone
      // put every button UNDER the fixed Sims toolbar (the audit's
      // elementFromPoint at Done / Make room / Discard returned the
      // toolbar). Below lg it now clears the toolbar's live height plus the
      // 56 px band the Clear pills / cart pill occupy; from lg up it sits
      // 12 px above the desktop dock (`--sims-dock-h`) — exactly where the
      // old `bottom-3` put it.
      // Polish (2026-08-29): below sm the card is COMPACT — three rows
      // (badge + readout · stepper + length · actions), 8 px padding, 6 px
      // gaps — so the phone keeps its drawable canvas.
      className={`pointer-events-auto fixed left-1/2 z-30 flex w-[min(94vw,600px)] -translate-x-1/2 flex-col rounded-xl text-xs bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))_+_var(--sims-toolbar-h,0px))] lg:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_var(--sims-dock-h,0px))] ${
        phone ? 'gap-1 p-1.5' : 'gap-2 p-3'
      }`}
      style={{
        background: CHROME_BG,
        border: `1px solid ${CHROME_RIM}`,
        boxShadow: '0 12px 32px rgba(42,41,38,0.18)',
        color: CHROME_TEXT,
      }}
      data-testid="room-draw-hud"
      data-compact={phone ? 'true' : 'false'}
    >
      <div className={`flex items-center gap-2 ${phone ? 'flex-nowrap' : 'flex-wrap'}`}>
        <span
          className={`shrink-0 rounded-lg px-2 text-[11px] font-semibold uppercase leading-none tracking-[0.06em] ${
            phone ? 'py-1' : 'py-1.5'
          }`}
          style={{ background: CHROME_ACTIVE_BG, color: CHROME_ACTIVE_TEXT }}
          title={phone ? 'Tap to drop wall points · Done keeps the walls · tap the first point for a room' : undefined}
        >
          Wall pen
        </span>
        {/* ONE instruction line (the duplicate bottom-left tip card is gone).
            The compact phone card has no room for it — the badge's title
            carries the same words. */}
        {!phone && (
          <span
            className="hidden min-w-0 flex-1 text-[12px] font-medium leading-snug sm:inline"
            style={{ color: CHROME_TEXT_2 }}
          >
            Click to drop wall points &middot; walls stay where you stop &middot;{' '}
            {stepM <= 0.1 ? 'Enter closes a room' : 'click the first point or Enter to close a room'}
          </span>
        )}
        {phone && readout}
        {/* The unit stepper lives INSIDE the HUD so it is reachable mid-draw
            with a thumb; +/- keys step the same ladder. On the phone it
            heads the second row (below) instead — one `snap-unit-*` set in
            the DOM at any width. */}
        {!phone && showUnitStepper && (
          <div className="ml-auto">
            <SnapUnitStepper compact />
          </div>
        )}
      </div>
      {/* Fix 2.4 (Vic 2026-05-22): the ROOM name input was removed from
          the HUD — auto-named "Room N", renamed inline from the left
          sidebar after close. The HUD now shows only vertex/perim/area
          counters + instruction + action buttons. */}
      <div className={`flex items-center justify-between gap-2 ${phone ? 'flex-nowrap' : 'flex-wrap'}`}>
        {!phone && readout}
        {/* Polish (2026-08-29): the phone's unit stepper used to be a
            separate fixed strip parked above this card (RoomCanvas); it now
            sits INLINE here so the card is the only thing over the canvas.
            Same wrapper testid, same control. */}
        {phone && (
          <div className="pointer-events-auto shrink-0" data-testid="mobile-draw-unit-stepper">
            <SnapUnitStepper compact />
          </div>
        )}
        {/* Typed segment length (units brief D9). The cursor gives the
            direction, this gives the magnitude. */}
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          <label
            htmlFor="draw-segment-length"
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: CHROME_TEXT_2 }}
          >
            Length
          </label>
          <input
            id="draw-segment-length"
            type="number"
            min={0}
            step={stepM}
            value={lengthText}
            disabled={!lengthReady}
            data-testid="draw-segment-length"
            onChange={(e) => setLengthText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLength();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setLengthText('');
                e.currentTarget.blur();
              }
            }}
            placeholder={lengthReady ? formatLengthForUnit(0, stepM) : undefined}
            title={
              lengthReady
                ? 'Type an exact length and press Enter'
                : 'Point the cursor, then type a length'
            }
            className={`h-11 rounded-lg border border-ppw-rim bg-ppw-chrome px-2 text-right text-[12px] font-semibold tabular-nums text-[#37362f] transition-colors duration-[120ms] ease-out placeholder:text-[#3D4655]/60 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none sm:h-10 ${
              phone ? 'w-[76px]' : 'w-24'
            }`}
          />
          <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
            {phone ? 'm' : unitSuffix}
          </span>
        </div>
      </div>

      {/* Actions. Hierarchy: Done (the ONE ink button) · Make room (ink
          rim) · Room + next (rest, sm+ only) · Undo (rest; icon-only on the
          phone) · Discard (terracotta rim). Polish (2026-08-29): Room + next
          and Undo were ghost buttons (no rim) between rimmed siblings — they
          now wear the rest recipe like every other control. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* DONE keeps the run as walls — the Sims contract: walls are real
            the moment you stop. Primary on the phone, where it is the
            button a thumb reaches first. */}
        <button
          type="button"
          onClick={vertices.length >= 2 && onCommitWalls ? handleFinishWalls : handleCancel}
          data-testid="room-draw-finish-walls"
          className={`${CTRL} ${CTRL_PRIMARY} ${CTRL_H} flex-1 sm:flex-initial`}
          title={
            vertices.length >= 2
              ? 'Done — keep these walls as they are (Esc or Alt+Enter)'
              : 'Done — leave the pen'
          }
        >
          Done
        </button>
        <button
          type="button"
          onClick={handleClose}
          disabled={vertices.length < 3}
          className={`${CTRL} ${CTRL_OUTLINED} ${CTRL_H} flex-1 sm:flex-initial`}
          title={
            vertices.length < 3
              ? 'A room needs at least 3 points'
              : 'Close the shape and make it a room (Enter)'
          }
          data-testid="room-draw-close"
        >
          Make room
        </button>
        <button
          type="button"
          onClick={handleCloseContinue}
          disabled={vertices.length < 3}
          data-testid="room-draw-close-continue"
          className={`${CTRL} ${CTRL_REST} ${CTRL_H} hidden sm:inline-flex`}
          title="Make the room and keep drawing another (Shift+Enter)"
        >
          Room + next
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={vertices.length === 0}
          className={`${CTRL} ${CTRL_REST} ${CTRL_H} w-11 shrink-0 !px-0 sm:w-auto sm:!px-3`}
          title="Undo last wall (Ctrl+Z)"
          aria-label="Undo last wall point"
          data-testid="room-draw-undo"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 sm:hidden" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 4.5L3 7.5l3 3M3.5 7.5H10a3 3 0 0 1 0 6H7"
            />
          </svg>
          <span className="hidden sm:inline">Undo</span>
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className={`${CTRL} ${CTRL_DANGER} ${CTRL_H} flex-1 sm:ml-auto sm:flex-initial`}
          title="Throw these points away (the only exit that does)"
          data-testid="room-draw-cancel"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 text-ppw-clay transition-colors duration-[120ms] group-hover:text-white motion-reduce:transition-none"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
            />
          </svg>
          Discard
        </button>
      </div>
    </div>
  );
}
