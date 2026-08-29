/**
 * Sims-Parity M2 — wall draw layer + HUD.
 *
 * Two-click polyline FSM (per `ppw-gaming-walls.md`). The Layer mounts
 * as a direct child of the existing Konva <Stage> and the HUD mounts
 * as a DOM sibling — the same shape `RoomDrawMode.tsx` uses for the
 * closed-polygon room editor. Wall mode and Room-draw mode are
 * exclusive (the mode strip enforces this).
 *
 * Coordinate system: `wallStore` stores endpoints in millimetres. The
 * Konva render layer converts to pixels via `mm / 1000 * pxPerMetre`.
 * Mouse events arrive in stage-local pixels and round-trip through
 * `screenToRoom` (metres) → `* 1000` → snap to 500 mm.
 *
 * Tagged namespace `.walldraw` on Stage events so this layer can wire
 * and unwire cleanly without clobbering the room-draw listeners.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Layer, Line, Circle, Group, Rect, Text } from 'react-konva';
// Paper theme (2026-08-29) + legible measurements (Vic 2026-08-25, complaint 3).
import {
  MEASURE_BG,
  MEASURE_BG_OPACITY,
  MEASURE_MIN_SCREEN_PX,
  MEASURE_TEXT,
  DOCK_ACCENT,
  DOCK_BORDER,
  DOCK_TEXT,
  LABEL_HALO,
  SELECT_STROKE,
  WALL_INK,
  measureChipMetrics,
} from './blueprintTheme';
import type Konva from 'konva';
import { screenToRoom } from '../lib/geometry';
import type { Viewport } from '../lib/geometry';
import {
  useWallStore,
  snapToWallEndpointOrGrid,
  DEFAULT_THICKNESS_MM,
  DEFAULT_HEIGHT_MM,
  detectClosedRoomVertices,
  polygonAreaM2,
  type WallSegment,
} from '../store/wallStore';
// Units brief (2026-08-28) — wall drawing honours the selected snap unit.
import { currentSnapStepMm } from '../store/designerUIStore';
import { useToastStore } from '../store/toastStore';
import { useHistoryStore } from '../store/historyStore';
import { wallLinePoints, wallStrokeWidthPx, formatWallLengthM } from './wallGeometry';

// Compatibility re-export of the wall geometry helpers that used to live here;
// the canonical module is ./wallGeometry. Kept so no importer breaks.
// eslint-disable-next-line react-refresh/only-export-components
export { wallLinePoints, wallStrokeWidthPx, segmentLengthM, formatWallLengthM } from './wallGeometry';

const DBG = '[wall-draw]';

export interface WallDrawLayerProps {
  enabled: boolean;
  stageRef: React.RefObject<Konva.Stage>;
  containerRef: React.RefObject<HTMLDivElement>;
  viewport: Viewport;
  pxPerMetre: number;
}

export function WallDrawLayer({
  enabled,
  stageRef,
  containerRef,
  viewport,
  pxPerMetre,
}: WallDrawLayerProps): JSX.Element | null {
  // Subscribe to walls + draw so the React-Konva render reflects state, but
  // always read the CURRENT zustand state inside click/move handlers via
  // `useWallStore.getState()`. React re-renders are async — two rapid CDP
  // clicks dispatched in the same JS turn can both run before React commits,
  // which leaves any render-time snapshot stale and causes the FSM to
  // mis-route (clicks meant to commit walls re-arm the anchor instead).
  const walls = useWallStore((s) => s.walls);
  const draw = useWallStore((s) => s.draw);
  const addWall = useWallStore((s) => s.addWall);
  const setDraw = useWallStore((s) => s.setDraw);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const cursorRef = useRef<{ x_mm: number; y_mm: number } | null>(null);
  const cursorLineRef = useRef<Konva.Line | null>(null);
  const lengthLabelRef = useRef<Konva.Text | null>(null);
  const lengthPlateRef = useRef<Konva.Rect | null>(null);

  // Stage event wiring: only while enabled. Tagged namespace `.walldraw`.
  useEffect(() => {
    if (!enabled) return;
    const stage = stageRef.current;
    const container = containerRef.current;
    if (!stage || !container) return;

    function clientToMm(clientX: number, clientY: number): { x_mm: number; y_mm: number } | null {
      const rect = container!.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        clientX,
        clientY,
        { left: rect.left, top: rect.top },
        viewportRef.current,
        pxPerMetre,
      );
      return { x_mm: xM * 1000, y_mm: yM * 1000 };
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

    function snapPoint(point: { x_mm: number; y_mm: number }): { x_mm: number; y_mm: number } {
      const out = snapToWallEndpointOrGrid(
        point,
        useWallStore.getState().walls,
        currentSnapStepMm(),
      );
      return { x_mm: out.x_mm, y_mm: out.y_mm };
    }

    function handleMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
      const c = readClient(e.evt as MouseEvent | TouchEvent);
      if (!c) return;
      const raw = clientToMm(c.x, c.y);
      if (!raw) return;
      cursorRef.current = snapPoint(raw);
      const node = cursorLineRef.current;
      const liveDraw = useWallStore.getState().draw;
      if (node && liveDraw.phase === 'drawing') {
        const anchor = liveDraw.anchor;
        const cur = cursorRef.current;
        node.points([
          (anchor.x_mm / 1000) * pxPerMetre,
          (anchor.y_mm / 1000) * pxPerMetre,
          (cur.x_mm / 1000) * pxPerMetre,
          (cur.y_mm / 1000) * pxPerMetre,
        ]);
        // Live length chip at the segment midpoint (Sims "wall grows as you
        // drag" feel). Updated imperatively alongside the cursor line.
        //
        // 2026-08-25 (complaint 3): sized in SCREEN px. A Konva fontSize is
        // in stage space, so the old fixed 13 rendered at 3.9 px at the
        // 0.3 minimum zoom. Everything below divides by the live viewport
        // scale, so the number is always ~16 px on screen.
        const label = lengthLabelRef.current;
        const plate = lengthPlateRef.current;
        if (label) {
          const midX = ((anchor.x_mm + cur.x_mm) / 2 / 1000) * pxPerMetre;
          const midY = ((anchor.y_mm + cur.y_mm) / 2 / 1000) * pxPerMetre;
          const sc = viewportRef.current.scale;
          const cm = measureChipMetrics(sc);
          label.text(formatWallLengthM(anchor, cur));
          label.fontSize(cm.fontSize);
          label.width(cm.halfWidth * 2);
          label.position({ x: midX - cm.halfWidth, y: midY - cm.fontSize * 0.58 });
          if (plate) {
            plate.position({ x: midX - cm.halfWidth, y: midY - cm.height / 2 });
            plate.width(cm.halfWidth * 2);
            plate.height(cm.height);
            plate.cornerRadius(cm.cornerRadius);
            plate.visible(true);
          }
        }
        node.getLayer()?.batchDraw();
      }
    }

    function handleClickOrTap(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
      const c = readClient(e.evt as MouseEvent | TouchEvent);
      if (!c) return;
      const raw = clientToMm(c.x, c.y);
      if (!raw) return;
      const snapped = snapPoint(raw);
      const current = useWallStore.getState().draw;
      if (current.phase === 'idle') return; // mode-strip not engaged
      if (current.phase === 'armed') {
        console.log(DBG, 'anchor', snapped);
        setDraw({ phase: 'drawing', anchor: snapped });
        cursorRef.current = snapped;
        return;
      }
      // current.phase === 'drawing'
      const anchor = current.anchor;
      if (anchor.x_mm === snapped.x_mm && anchor.y_mm === snapped.y_mm) {
        // Zero-length click: ignore (Sims-style).
        return;
      }
      // Pre-add closure check: does `snapped` coincide with an existing
      // wall endpoint? Read live (not stale ref) so behavior is the same
      // when clicks fire back-to-back in the same React turn.
      const wallsBeforeAdd = useWallStore.getState().walls;
      const closes = wallsBeforeAdd.some((w) =>
        (w.start.x_mm === snapped.x_mm && w.start.y_mm === snapped.y_mm) ||
        (w.end.x_mm === snapped.x_mm && w.end.y_mm === snapped.y_mm)
      );
      const segment: Omit<WallSegment, 'id'> = {
        start: anchor,
        end: snapped,
        thickness_mm: DEFAULT_THICKNESS_MM,
        height_mm: DEFAULT_HEIGHT_MM,
        type: 'full',
      };
      addWall(segment);
      console.log(DBG, 'commit', segment);
      if (closes) {
        setDraw({ phase: 'idle' });
      } else {
        // Chain: next anchor is the just-clicked endpoint.
        setDraw({ phase: 'drawing', anchor: snapped });
        // Clear the live length label so it doesn't linger at the previous
        // segment's midpoint after a commit (esp. touch taps, which fire no
        // mousemove to overwrite it). Cursor line resets via its bound props.
        const label = lengthLabelRef.current;
        if (label) {
          label.text('');
          label.getLayer()?.batchDraw();
        }
      }
    }

    function handleContextMenu(e: Konva.KonvaEventObject<MouseEvent>): void {
      // Right-click exits drawing without committing the in-flight segment.
      e.evt.preventDefault();
      console.log(DBG, 'right-click → exit');
      setDraw({ phase: 'idle' });
    }

    stage.on('mousemove.walldraw', handleMove);
    stage.on('touchmove.walldraw', handleMove);
    stage.on('click.walldraw', handleClickOrTap);
    stage.on('tap.walldraw', handleClickOrTap);
    stage.on('contextmenu.walldraw', handleContextMenu);

    return () => {
      stage.off('mousemove.walldraw');
      stage.off('touchmove.walldraw');
      stage.off('click.walldraw');
      stage.off('tap.walldraw');
      stage.off('contextmenu.walldraw');
    };
  }, [enabled, stageRef, containerRef, pxPerMetre, addWall, setDraw]);

  // Keyboard: Esc cancels (back to armed). Ctrl+Z undoes the last
  // committed wall via the unified history stack (Tweak 07 / Phase A.0).
  // Enter closes via cursor-on-start handled in click.
  //
  // The Ctrl/Cmd+Z handler runs in CAPTURE phase + stopImmediatePropagation
  // so the global useKeyboardShortcuts handler (bubble) doesn't fire and
  // double-undo. Both routes converge on historyStore.undo() so the
  // semantics are identical regardless of mode.
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (useWallStore.getState().draw.phase === 'drawing') {
          setDraw({ phase: 'armed' });
        } else {
          setDraw({ phase: 'idle' });
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.shiftKey) {
          useHistoryStore.getState().redo();
        } else {
          useHistoryStore.getState().undo();
        }
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, setDraw]);

  if (!enabled) return null;

  return (
    <Layer listening={false}>
      {walls.map((w) => (
        <Line
          key={w.id}
          points={[
            (w.start.x_mm / 1000) * pxPerMetre,
            (w.start.y_mm / 1000) * pxPerMetre,
            (w.end.x_mm / 1000) * pxPerMetre,
            (w.end.y_mm / 1000) * pxPerMetre,
          ]}
          stroke={WALL_INK}
          strokeWidth={Math.max(3, (w.thickness_mm / 1000) * pxPerMetre)}
          lineCap="round"
        />
      ))}
      {draw.phase === 'drawing' && (
        <Group>
          <Line
            ref={cursorLineRef}
            points={[
              (draw.anchor.x_mm / 1000) * pxPerMetre,
              (draw.anchor.y_mm / 1000) * pxPerMetre,
              (draw.anchor.x_mm / 1000) * pxPerMetre,
              (draw.anchor.y_mm / 1000) * pxPerMetre,
            ]}
            stroke={SELECT_STROKE}
            strokeWidth={4}
            dash={[8, 8]}
          />
          <Circle
            x={(draw.anchor.x_mm / 1000) * pxPerMetre}
            y={(draw.anchor.y_mm / 1000) * pxPerMetre}
            radius={6}
            fill={SELECT_STROKE}
            stroke={LABEL_HALO}
            strokeWidth={1.5}
          />
          {/* Measurement chip: charcoal plate + paper numerals, both positioned
              and sized imperatively in handleMove so they track the cursor
              at 60 fps without a React render per pointer move. Hidden
              until the first move gives it a position. */}
          <Rect
            ref={lengthPlateRef}
            visible={false}
            fill={MEASURE_BG}
            opacity={MEASURE_BG_OPACITY}
            listening={false}
          />
          <Text
            ref={lengthLabelRef}
            text=""
            fontSize={MEASURE_MIN_SCREEN_PX}
            fontStyle="bold"
            fontFamily="Inter, sans-serif"
            fill={MEASURE_TEXT}
            align="center"
            listening={false}
          />
        </Group>
      )}
    </Layer>
  );
}

// ----------------------------------------------------------------------
// Persistent committed-walls layer.
//
// FIX (2026-07-24): drawn interior walls used to render ONLY inside
// `WallDrawLayer`, which returns null the instant the wall tool goes idle
// (`if (!enabled) return null`). So a user would draw walls, press Done, and
// watch them vanish — the data survived in `wallStore` (localStorage), but
// nothing rendered it. This layer renders committed walls ALWAYS, decoupled
// from the tool's enabled state, so walls persist on the floor plan like The
// Sims. Purely additive + `listening={false}` (no hit-testing, no FSM
// coupling) — respects the Konva stable-lock. Mounts as a Stage child so it
// shares the viewport + pxPerMetre transform.
// ----------------------------------------------------------------------

export interface CommittedWallsLayerProps {
  walls: WallSegment[];
  pxPerMetre: number;
}

/**
 * Always-on render of committed walls. Styling matches the committed-wall
 * render inside `WallDrawLayer` (WALL_INK, round cap) so there is
 * no visual jump between drawing and idle.
 */
export function CommittedWallsLayer({ walls, pxPerMetre }: CommittedWallsLayerProps): JSX.Element {
  return (
    <Layer listening={false}>
      {walls.map((w) => (
        <Line
          key={w.id}
          points={wallLinePoints(w, pxPerMetre)}
          stroke={WALL_INK}
          strokeWidth={wallStrokeWidthPx(w, pxPerMetre)}
          lineCap="round"
        />
      ))}
    </Layer>
  );
}

// ----------------------------------------------------------------------
// DOM HUD — wall count, room area, undo, exit. Mounts as a sibling of
// <Stage>, never inside it.
// ----------------------------------------------------------------------

export interface WallDrawHUDProps {
  enabled: boolean;
}

export function WallDrawHUD({ enabled }: WallDrawHUDProps): JSX.Element | null {
  const walls = useWallStore((s) => s.walls);
  const draw = useWallStore((s) => s.draw);
  const setDraw = useWallStore((s) => s.setDraw);
  const undoLast = useWallStore((s) => s.undoLast);
  const pushToast = useToastStore((s) => s.push);

  const closedRoom = useMemo(() => detectClosedRoomVertices(walls), [walls]);
  const areaM2 = useMemo(() => (closedRoom ? polygonAreaM2(closedRoom) : 0), [closedRoom]);

  if (!enabled) return null;

  const tip = (() => {
    if (draw.phase === 'armed') return 'Click on the floor to drop the first wall point.';
    if (draw.phase === 'drawing') return 'Click again to drop the next wall. Esc to lift the pen.';
    return 'Walls saved.';
  })();

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-30 flex w-[min(94vw,520px)] -translate-x-1/2 flex-col gap-2 rounded-lg bg-white p-3 text-xs shadow-xl"
      style={{ border: `1px solid ${DOCK_BORDER}`, boxShadow: '0 4px 14px rgba(14,14,16,0.18)' }}
      data-testid="wall-draw-hud"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: DOCK_ACCENT, color: DOCK_TEXT }}
        >
          Wall mode
        </span>
        <span className="text-[10px] text-ppw-slate">
          Snap 50 cm · Esc to cancel · Right-click to lift
        </span>
      </div>
      <p className="text-[11px] text-ppw-slate">{tip}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ppw-slate">
          <span>
            walls <b className="text-ppw-ink" data-testid="wall-count">{walls.length}</b>
          </span>
          <span data-testid="room-area">
            {closedRoom
              ? <>room <b className="text-ppw-ink">{areaM2.toFixed(2)} m²</b></>
              : <span className="opacity-60">no closed room yet</span>
            }
          </span>
        </div>
        <div className="flex flex-1 gap-1.5 sm:flex-initial">
          <button
            type="button"
            onClick={() => {
              undoLast();
              pushToast('Removed last wall.', 'info');
            }}
            disabled={walls.length === 0}
            className="min-h-[44px] flex-1 rounded-md border border-ppw-stone bg-white px-3 text-xs font-medium text-ppw-slate hover:border-ppw-ink disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
            data-testid="wall-undo"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setDraw({ phase: 'idle' })}
            className="min-h-[44px] flex-1 rounded-md border border-ppw-coral bg-white px-3 text-xs font-medium text-ppw-coral hover:bg-ppw-coral hover:text-white sm:flex-initial"
            data-testid="wall-exit"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
