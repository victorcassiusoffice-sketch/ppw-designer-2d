/**
 * RoomDrawMode - Week 2.5 polygon room editor, comprehensively rewired
 * in Week 4b Hotfix 5.
 *
 * The user clicks/taps on the canvas to drop polygon vertices; vertices
 * snap to the 0.5 m grid. Once a candidate vertex lands within 0.4 m of
 * the first vertex (or the user presses Enter with >=3 vertices), the
 * polygon closes and is committed as the new active-room polygon.
 *
 *  - Cmd/Ctrl + Z undoes the last vertex while drawing.
 *  - Esc cancels the draw.
 *  - Enter closes the polygon when >=3 vertices are placed.
 *  - Total perimeter (m) and area (m^2) are shown live in the HUD.
 *  - The user can rename the room inline before committing.
 *
 * --- Hotfix 5 architecture change (CRITICAL) ---
 *
 * Hotfix 4 tried to "portal the HUD out of the Stage" by rendering
 *
 *     <Stage>
 *       <RoomDrawMode>
 *         <Layer/>           // Konva node - fine
 *         <DrawHUD>          // returns createPortal(<div>...</div>, host)
 *       </RoomDrawMode>
 *     </Stage>
 *
 * Problem: react-konva is the host renderer for the Stage subtree. A
 * React portal nested inside that subtree is STILL processed by the
 * same renderer for its inner children. So the inner <div> hits
 * `Core.default['div'] === undefined`, falls back to a Konva.Group,
 * then react-konva's `appendChildToContainer(parentInstance.add(child))`
 * tries to call `.add()` on the DOM container div - which has no such
 * method. This either silently corrupts the Konva tree (no vertex
 * placement, no HUD) or throws during commit (Rect -> Draw white
 * screen).
 *
 * Real fix: split the component in two and render them as SIBLINGS of
 * the Stage, never as descendants of Stage:
 *
 *     <div ref={containerRef}>
 *       <Stage>
 *         <RoomDrawLayer .../>   // Konva-only, child of Stage
 *       </Stage>
 *       <RoomDrawHUD .../>       // DOM-only, sibling of Stage
 *     </div>
 *
 * Shared state (vertices / hover / name) lives in the parent
 * (`RoomCanvas`) and is passed in as props.
 *
 * Console-log breadcrumbs `[draw-mode]` are wired through every
 * critical step; they stay in until Designer Phase 1 is stable.
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
      console.log(DBG, 'layer effect: disabled, skipping wire');
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
          onCommitRef.current(current, nameRef.current.trim() || 'New Room');
          setVerticesRef.current([]);
          setHoverRef.current(null);
        } else {
          console.log(DBG, 'close gesture ignored, < 3 vertices');
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
  }, [enabled, stageRef, containerRef, pxPerMetre]);

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        console.log(DBG, 'keydown Escape -> cancel');
        setVerticesRef.current([]);
        setHoverRef.current(null);
        onCancelRef.current();
        return;
      }
      if (e.key === 'Enter') {
        const current = verticesRef.current;
        if (current.length >= 3) {
          e.preventDefault();
          console.log(DBG, 'keydown Enter -> close', { vertices: current.length });
          onCommitRef.current(current, nameRef.current.trim() || 'New Room');
          setVerticesRef.current([]);
          setHoverRef.current(null);
        } else {
          console.log(DBG, 'Enter ignored, < 3 vertices', { vertices: current.length });
        }
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
// RoomDrawHUD - DOM-only. MUST be rendered as a SIBLING of <Stage>,
// never inside it. (See file header for the why.)
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
      console.log(DBG, 'HUD close ignored, < 3 vertices');
      return;
    }
    console.log(DBG, 'HUD close click', { vertices: vertices.length });
    onCommit(vertices, name.trim() || 'New Room');
    setVertices([]);
    setHover(null);
  }, [vertices, name, onCommit, setVertices, setHover]);

  if (!enabled) return null;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-30 flex w-[min(92vw,520px)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-ppw-teal bg-white p-3 text-xs shadow-xl ring-1 ring-ppw-teal/40"
      data-testid="room-draw-hud"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-ppw-teal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Draw mode
        </span>
        <span className="text-[10px] text-ppw-slate">
          Click to drop vertices &middot; click first vertex or press Enter to close
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] uppercase tracking-wide text-ppw-slate">Room</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1 text-sm font-medium text-ppw-ink focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
          data-testid="room-draw-name"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-4 text-[11px] text-ppw-slate">
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
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={vertices.length === 0}
            className="rounded-md border border-ppw-stone bg-white px-2 py-1 text-[11px] font-medium text-ppw-slate hover:border-ppw-ink disabled:cursor-not-allowed disabled:opacity-50"
            title="Undo last wall (Ctrl+Z)"
            data-testid="room-draw-undo"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={vertices.length < 3}
            className="rounded-md border border-ppw-teal bg-ppw-teal px-2 py-1 text-[11px] font-medium text-white hover:bg-ppw-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
            title="Close polygon (Enter)"
            data-testid="room-draw-close"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-ppw-coral bg-white px-2 py-1 text-[11px] font-medium text-ppw-coral hover:bg-ppw-coral hover:text-white"
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
