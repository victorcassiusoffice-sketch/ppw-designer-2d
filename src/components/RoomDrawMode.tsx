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
import { Layer, Line, Circle, Group } from 'react-konva';
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
import { quantiseVertex, nextVertexAtLength } from '../designer/drawLength';
// Blueprint reskin + legible measurements (Vic 2026-08-25, complaints 3+5).
import { MeasurementChip } from '../designer/MeasurementChip';
import {
  MEASURE_TEXT,
  ROOM_FILL,
  WALL_INK,
  SELECT_STROKE,
  LABEL_HALO,
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
export type HoverVertex = Vertex & { snap?: 'vertex' | 'edge' };

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
}

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
    function getRoomPoint(evt: { clientX: number; clientY: number }): Vertex {
      const hit = snapHitFor(evt);
      if (hit) return { x: hit.v.x, y: hit.v.y };
      const raw = rawRoomPoint(evt);
      const stepM = currentSnapStepM();
      // Grid branch ONLY. The wall-snap branch above returns its hit verbatim.
      return quantiseVertex(raw, stepM);
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
      const p = getRoomPoint({ clientX: c.x, clientY: c.y });
      // The snap KIND rides on the HOVER value only — it drives the gold
      // ring below and must never reach a committed polygon vertex.
      const hit = snapHitFor({ clientX: c.x, clientY: c.y });
      setHoverRef.current({ ...p, snap: hit?.kind });
    }

    function handleClickOrTap(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
      const c = readClient(e.evt as MouseEvent | TouchEvent);
      if (!c) {
        console.warn(DBG, 'click: no client coords');
        return;
      }
      const p = getRoomPoint({ clientX: c.x, clientY: c.y });
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

    stage.on('mousemove.roomdraw', handleMove);
    stage.on('touchmove.roomdraw', handleMove);
    stage.on('click.roomdraw', handleClickOrTap);
    stage.on('tap.roomdraw', handleClickOrTap);

    return () => {
      console.log(DBG, 'layer effect: cleanup Stage handlers');
      stage.off('mousemove.roomdraw');
      stage.off('touchmove.roomdraw');
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
}

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
  const btn =
    'pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border border-ppw-stone bg-white text-base font-semibold text-ppw-ink hover:border-ppw-ink disabled:cursor-not-allowed disabled:opacity-40';
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
        className={`min-w-[52px] rounded-md bg-ppw-ink px-2 py-1 text-center text-[11px] font-semibold text-white ${
          compact ? '' : 'min-w-[60px]'
        }`}
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
}: RoomDrawHUDProps) {
  const stepM = useDesignerUIStore((s) => PRECISION_STEP_M[s.precision]);
  const [lengthText, setLengthText] = useState('');

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

  return (
    <div
      className="pointer-events-none absolute left-1/2 bottom-3 z-30 flex w-[min(94vw,560px)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-ppw-stone bg-white p-3 text-xs shadow-xl ring-1 ring-ppw-ink/10"
      data-testid="room-draw-hud"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-ppw-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Wall pen
        </span>
        <span className="hidden text-[10px] text-ppw-slate sm:inline">
          Click to drop wall points &middot; walls stay where you stop &middot;{' '}
          {stepM <= 0.1 ? 'Enter closes a room' : 'click the first point or Enter to close a room'}
        </span>
        <span className="text-[10px] text-ppw-slate sm:hidden">
          Tap to drop &middot; Done keeps the walls &middot; tap the first point for a room
        </span>
        {/* The unit stepper lives INSIDE the HUD so it is reachable mid-draw
            on a phone with a thumb; +/- keys step the same ladder. */}
        <SnapUnitStepper compact />
      </div>
      {/* Fix 2.4 (Vic 2026-05-22): the ROOM name input was removed from
          the HUD — auto-named "Room N", renamed inline from the left
          sidebar after close. The HUD now shows only vertex/perim/area
          counters + instruction + action buttons. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ppw-slate">
          <span data-testid="room-draw-vertices-count">
            <b className="text-ppw-ink">{vertices.length}</b> vertices
          </span>
          <span>
            perim <b className="text-ppw-ink">{formatLengthForUnit(livePerimeter, stepM)}</b>
          </span>
          <span>
            area <b className="text-ppw-ink">{liveArea.toFixed(2)} m&sup2;</b>
          </span>
        </div>
        {/* Typed segment length (units brief D9). The cursor gives the
            direction, this gives the magnitude. */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-ppw-slate">
            Length
          </label>
          <input
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
            className="w-20 rounded-md border border-ppw-stone bg-white px-2 py-1 text-right text-xs text-ppw-ink disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="text-[10px] text-ppw-slate">
            {stepM >= 1 ? 'm' : stepM <= 0.1 ? 'm (cm grid)' : 'm'}
          </span>
        </div>

        <div className="flex flex-1 gap-1.5 sm:flex-initial">
          <button
            type="button"
            onClick={handleUndo}
            disabled={vertices.length === 0}
            className="pointer-events-auto min-h-[44px] flex-1 rounded-md border border-ppw-stone bg-white px-3 text-xs font-medium text-ppw-slate hover:border-ppw-ink disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
            title="Undo last wall (Ctrl+Z)"
            data-testid="room-draw-undo"
          >
            Undo
          </button>
          {/* DONE keeps the run as walls — the Sims contract: walls are real
              the moment you stop. Primary on the phone, where it is the
              button a thumb reaches first. */}
          <button
            type="button"
            onClick={vertices.length >= 2 && onCommitWalls ? handleFinishWalls : handleCancel}
            data-testid="room-draw-finish-walls"
            className="pointer-events-auto min-h-[44px] flex-1 rounded-md border border-ppw-ink bg-ppw-ink px-3 text-xs font-semibold text-white hover:bg-ppw-ink/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
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
            className="pointer-events-auto min-h-[44px] flex-1 rounded-md border border-ppw-teal bg-ppw-teal px-3 text-xs font-medium text-white hover:bg-ppw-teal/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
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
            className="pointer-events-auto hidden min-h-[44px] flex-1 rounded-md border border-ppw-stone bg-white px-3 text-xs font-medium text-ppw-slate hover:border-ppw-teal disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex sm:flex-initial sm:items-center sm:justify-center"
            title="Make the room and keep drawing another (Shift+Enter)"
          >
            Room + next
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="pointer-events-auto min-h-[44px] flex-1 rounded-md border border-ppw-coral bg-white px-3 text-xs font-medium text-ppw-coral hover:bg-ppw-coral hover:text-white sm:flex-initial"
            title="Throw these points away (the only exit that does)"
            data-testid="room-draw-cancel"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
