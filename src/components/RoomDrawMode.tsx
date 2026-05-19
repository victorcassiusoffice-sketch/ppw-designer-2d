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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import {
  distance,
  isClosingPolygon,
  polygonArea,
  polygonPerimeter,
  screenToRoom,
  snapToGrid,
} from '../lib/geometry';
import type { Polygon, Vertex, Viewport } from '../lib/geometry';
import { useToastStore, type ToastKind } from '../store/toastStore';

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

export interface RoomDrawLayerProps {
  enabled: boolean;
  stageRef: React.RefObject<Konva.Stage>;
  containerRef: React.RefObject<HTMLDivElement>;
  viewport: Viewport;
  pxPerMetre: number;
  vertices: Polygon;
  setVertices: (next: Polygon | ((v: Polygon) => Polygon)) => void;
  hover: Vertex | null;
  setHover: (v: Vertex | null) => void;
  name: string;
  onCommit: (polygon: Polygon, name: string) => void;
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
  onCancel,
}: RoomDrawLayerProps) {
  const verticesRef = useRef(vertices);
  verticesRef.current = vertices;
  const nameRef = useRef(name);
  nameRef.current = name;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
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

    function getRoomPoint(evt: { clientX: number; clientY: number }): Vertex {
      const rect = container!.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        evt.clientX,
        evt.clientY,
        { left: rect.left, top: rect.top },
        viewportRef.current,
        pxPerMetre,
      );
      return { x: snapToGrid(xM, GRID_STEP_M), y: snapToGrid(yM, GRID_STEP_M) };
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
      setHoverRef.current(p);
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
      if (isClosingPolygon(current, p, CLOSE_THRESHOLD_M)) {
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
      const inTextField =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        e.preventDefault();
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
        if (current.length >= 3) {
          console.log(DBG, 'keydown Enter -> close', { vertices: current.length });
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
        } else {
          console.log('[draw-close]', {
            reason: 'enter-key-too-few-vertices',
            vertices: current.length,
            success: false,
          });
          pushDrawToast('Need at least 3 walls.', 'warn');
        }
        return;
      }
      if (inTextField) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        console.log(DBG, 'keydown Ctrl/Cmd+Z -> undo');
        setVerticesRef.current((v) => v.slice(0, -1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  const closeCandidate = useMemo(() => {
    if (vertices.length < 3 || !hover) return false;
    return isClosingPolygon(vertices, hover, CLOSE_THRESHOLD_M);
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
  void viewport;

  return (
    <Layer listening={false}>
      {previewPolygon.length >= 3 && (
        <Line
          points={previewPolygon.flatMap((v) => [v.x * pxPerMetre, v.y * pxPerMetre])}
          closed
          fill="rgba(20, 184, 166, 0.08)"
          stroke="#0F766E"
          strokeWidth={1}
          dash={[6, 4]}
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
              stroke={isPreview ? '#06B6D4' : '#0E1B1F'}
              strokeWidth={isPreview ? 1.5 : 3}
              dash={isPreview ? [4, 4] : undefined}
              lineCap="round"
            />
            {s.lengthM > 0.05 && (
              <Group x={mid.x * pxPerMetre} y={mid.y * pxPerMetre}>
                <Rect x={-26} y={-9} width={52} height={18} cornerRadius={3} fill="#0E1B1F" opacity={0.85} />
                <Text
                  x={-26}
                  y={-5}
                  width={52}
                  text={`${s.lengthM.toFixed(2)} m`}
                  fontSize={11}
                  fontFamily="Inter, sans-serif"
                  fill="#FFFFFF"
                  align="center"
                />
              </Group>
            )}
          </Group>
        );
      })}

      {vertices.map((v, i) => (
        <Group key={`v-${i}`}>
          <Circle
            x={v.x * pxPerMetre}
            y={v.y * pxPerMetre}
            radius={i === 0 ? 7 : 5}
            fill={i === 0 ? '#06B6D4' : '#0E1B1F'}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
          {i === vertices.length - 1 && vertices.length >= 1 && (
            <Circle
              x={v.x * pxPerMetre}
              y={v.y * pxPerMetre}
              radius={11}
              stroke="#06B6D4"
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
          stroke="#06B6D4"
          strokeWidth={2.5}
          fill="rgba(6, 182, 212, 0.15)"
        />
      )}

      {hover && (
        <Circle
          x={hover.x * pxPerMetre}
          y={hover.y * pxPerMetre}
          radius={4}
          fill="#06B6D4"
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
  onCancel: () => void;
}

export function RoomDrawHUD({
  enabled,
  vertices,
  setVertices,
  setHover,
  name,
  setName,
  onCommit,
  onCancel,
}: RoomDrawHUDProps) {
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

  const handleClose = useCallback(() => {
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

  if (!enabled) return null;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-30 flex w-[min(94vw,520px)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-ppw-teal bg-white p-3 text-xs shadow-xl ring-1 ring-ppw-teal/40"
      data-testid="room-draw-hud"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-ppw-teal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Draw mode
        </span>
        <span className="hidden text-[10px] text-ppw-slate sm:inline">
          Click to drop vertices &middot; click first vertex or press Enter to close
        </span>
        <span className="text-[10px] text-ppw-slate sm:hidden">
          Tap to drop &middot; tap first vertex to close
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] uppercase tracking-wide text-ppw-slate">Room</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1.5 text-sm font-medium text-ppw-ink focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
          data-testid="room-draw-name"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ppw-slate">
          <span data-testid="room-draw-vertices-count">
            <b className="text-ppw-ink">{vertices.length}</b> vertices
          </span>
          <span>
            perim <b className="text-ppw-ink">{livePerimeter.toFixed(2)} m</b>
          </span>
          <span>
            area <b className="text-ppw-ink">{liveArea.toFixed(2)} m&sup2;</b>
          </span>
        </div>
        <div className="flex flex-1 gap-1.5 sm:flex-initial">
          <button
            type="button"
            onClick={handleUndo}
            disabled={vertices.length === 0}
            className="min-h-[44px] flex-1 rounded-md border border-ppw-stone bg-white px-3 text-xs font-medium text-ppw-slate hover:border-ppw-ink disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
            title="Undo last wall (Ctrl+Z)"
            data-testid="room-draw-undo"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={vertices.length < 3}
            className="min-h-[44px] flex-1 rounded-md border border-ppw-teal bg-ppw-teal px-3 text-xs font-medium text-white hover:bg-ppw-teal/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
            title={
              vertices.length < 3
                ? 'Need at least 3 walls'
                : 'Close polygon and commit as new room (Enter)'
            }
            data-testid="room-draw-close"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[44px] flex-1 rounded-md border border-ppw-coral bg-white px-3 text-xs font-medium text-ppw-coral hover:bg-ppw-coral hover:text-white sm:flex-initial"
            title="Cancel (Esc)"
            data-testid="room-draw-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
