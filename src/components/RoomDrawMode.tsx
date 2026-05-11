/**
 * RoomDrawMode — Week 2.5 polygon room editor.
 *
 * Renders inside the RoomCanvas overlay when the parent has switched to
 * "Draw mode". The user clicks/taps on the canvas to drop polygon
 * vertices; vertices snap to the 0.5 m grid. Once a candidate vertex
 * lands within 0.4 m of the first vertex, the polygon closes and is
 * committed as the new active-room polygon.
 *
 * - Cmd/Ctrl + Z undoes the last vertex while drawing.
 * - Esc cancels the draw (clears the in-progress polygon).
 * - Total perimeter (m) and area (m²) are shown live in the HUD.
 * - The user can rename the room inline before committing.
 *
 * The component is a controlled overlay: it owns the in-progress vertex
 * list and notifies the parent (RoomCanvas) via callbacks. It does NOT
 * mutate the property store itself; the parent commits on close.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const CLOSE_THRESHOLD_M = 0.4;
const GRID_STEP_M = 0.5;

export interface RoomDrawModeProps {
  /** Whether draw mode is active. When false, this component is a no-op. */
  enabled: boolean;
  /** Konva Stage reference — used to grab pointer position. */
  stageRef: React.RefObject<Konva.Stage>;
  /** Container bounding rect — needed for screenToRoom math. */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Current viewport transform on the Konva Stage. */
  viewport: Viewport;
  /** Pixels per metre. */
  pxPerMetre: number;
  /** Callback fired once the polygon closes (≥ 3 vertices). */
  onCommit: (polygon: Polygon, name: string) => void;
  /** Callback fired when the user hits Esc (clears in-progress state). */
  onCancel: () => void;
  /** Default room name shown in the HUD input. */
  initialName?: string;
}

export function RoomDrawMode({
  enabled,
  stageRef,
  containerRef,
  viewport,
  pxPerMetre,
  onCommit,
  onCancel,
  initialName = 'New Room',
}: RoomDrawModeProps) {
  const [vertices, setVertices] = useState<Polygon>([]);
  const [hover, setHover] = useState<Vertex | null>(null);
  const [name, setName] = useState(initialName);
  const verticesRef = useRef(vertices);
  verticesRef.current = vertices;

  // Reset state whenever draw mode toggles on.
  useEffect(() => {
    if (enabled) {
      setVertices([]);
      setHover(null);
      setName(initialName);
    }
  }, [enabled, initialName]);

  // ---- Stage event wiring ----
  useEffect(() => {
    if (!enabled) return;
    const stage = stageRef.current;
    const container = containerRef.current;
    if (!stage || !container) return;

    function getRoomPoint(evt: { clientX: number; clientY: number }): Vertex {
      const rect = container!.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        evt.clientX,
        evt.clientY,
        { left: rect.left, top: rect.top },
        viewport,
        pxPerMetre,
      );
      return { x: snapToGrid(xM, GRID_STEP_M), y: snapToGrid(yM, GRID_STEP_M) };
    }

    function handleMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
      const evt = e.evt as MouseEvent | TouchEvent;
      const touch = 'touches' in evt ? evt.touches[0] : null;
      const clientX = touch ? touch.clientX : (evt as MouseEvent).clientX;
      const clientY = touch ? touch.clientY : (evt as MouseEvent).clientY;
      if (clientX === undefined || clientY === undefined) return;
      setHover(getRoomPoint({ clientX, clientY }));
    }

    function handleClickOrTap(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
      // Only react to clicks on empty canvas — let the placed-item layer
      // handle clicks on items, etc. In Draw mode there shouldn't be
      // anything else interactable but defensive checks don't hurt.
      const evt = e.evt as MouseEvent | TouchEvent;
      let clientX: number;
      let clientY: number;
      if ('changedTouches' in evt && evt.changedTouches[0]) {
        clientX = evt.changedTouches[0].clientX;
        clientY = evt.changedTouches[0].clientY;
      } else if ('clientX' in evt) {
        clientX = (evt as MouseEvent).clientX;
        clientY = (evt as MouseEvent).clientY;
      } else {
        return;
      }
      const p = getRoomPoint({ clientX, clientY });
      const current = verticesRef.current;
      if (isClosingPolygon(current, p, CLOSE_THRESHOLD_M)) {
        if (current.length >= 3) {
          onCommit(current, name.trim() || 'New Room');
          setVertices([]);
          setHover(null);
        }
        return;
      }
      setVertices([...current, p]);
    }

    stage.on('mousemove.roomdraw', handleMove);
    stage.on('touchmove.roomdraw', handleMove);
    stage.on('click.roomdraw', handleClickOrTap);
    stage.on('tap.roomdraw', handleClickOrTap);

    return () => {
      stage.off('mousemove.roomdraw');
      stage.off('touchmove.roomdraw');
      stage.off('click.roomdraw');
      stage.off('tap.roomdraw');
    };
  }, [enabled, stageRef, containerRef, viewport, pxPerMetre, onCommit, name]);

  // ---- Keyboard wiring (undo, cancel) ----
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      // Don't intercept when the user is typing in the name input.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setVertices([]);
        setHover(null);
        onCancel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        setVertices((v) => v.slice(0, -1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onCancel]);

  // ---- Derived geometry for rendering ----
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
    // Live preview segment to the cursor.
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

  const liveArea = polygonArea(previewPolygon);
  const livePerimeter = polygonPerimeter(previewPolygon);

  const handleUndo = useCallback(() => {
    setVertices((v) => v.slice(0, -1));
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Layer listening={false}>
        {/* Filled preview polygon (faint) once 3+ vertices */}
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

        {/* Drawn segments + length labels */}
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

        {/* Vertex dots */}
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
            {/* "drag-to-move" handle on the most recent vertex */}
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

        {/* Close indicator on the first vertex */}
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

        {/* Hover cursor crosshair */}
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

      {/* HUD — name input, undo, cancel, perimeter+area */}
      <DrawHUD
        verticesCount={vertices.length}
        name={name}
        setName={setName}
        perimeterM={livePerimeter}
        areaM2={liveArea}
        onUndo={handleUndo}
        onCancel={() => {
          setVertices([]);
          setHover(null);
          onCancel();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// HUD — DOM overlay, rendered via React Portal-equivalent (just absolute
// positioning inside RoomCanvas). Lives OUTSIDE the Konva Layer.
// ---------------------------------------------------------------------------

function DrawHUD({
  verticesCount,
  name,
  setName,
  perimeterM,
  areaM2,
  onUndo,
  onCancel,
}: {
  verticesCount: number;
  name: string;
  setName: (n: string) => void;
  perimeterM: number;
  areaM2: number;
  onUndo: () => void;
  onCancel: () => void;
}) {
  return (
    <DomOverlay>
      <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex w-[min(92vw,520px)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-ppw-teal bg-white p-3 text-xs shadow-xl ring-1 ring-ppw-teal/40">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-ppw-teal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Draw mode
          </span>
          <span className="text-[10px] text-ppw-slate">
            Click to drop vertices · close near the first one
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wide text-ppw-slate">Room</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1 text-sm font-medium text-ppw-ink focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-4 text-[11px] text-ppw-slate">
            <span><b className="text-ppw-ink">{verticesCount}</b> vertices</span>
            <span>perim <b className="text-ppw-ink">{perimeterM.toFixed(2)} m</b></span>
            <span>area <b className="text-ppw-ink">{areaM2.toFixed(2)} m²</b></span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={verticesCount === 0}
              className="rounded-md border border-ppw-stone bg-white px-2 py-1 text-[11px] font-medium text-ppw-slate hover:border-ppw-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="Undo last wall (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-ppw-coral bg-white px-2 py-1 text-[11px] font-medium text-ppw-coral hover:bg-ppw-coral hover:text-white"
              title="Cancel (Esc)"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </DomOverlay>
  );
}

/**
 * Tiny helper — renders a fragment whose absolute-positioned children
 * end up overlaid on the canvas. We don't use a real React Portal
 * because RoomCanvas already has a `position:relative` root.
 */
function DomOverlay({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
