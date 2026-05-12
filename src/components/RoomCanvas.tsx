/**
 * RoomCanvas - react-konva Stage. Week 2.5 build:
 *   - Renders the active room's polygon (Week 2.5 generalisation of
 *     the rectangle from W1/W2).
 *   - Drag-drop landing from ProductPalette - bounds check now uses
 *     `isRectInsidePolygon` so concave rooms reject correctly.
 *   - Draw mode overlay (RoomDrawLayer + RoomDrawHUD) wires into the
 *     same Stage so vertices snap to the same 0.5 m grid the placed
 *     items use.
 *   - Pan / zoom / reset (carried from W1/2).
 *
 * Hotfix 5 (Week 4b): draw-mode state (vertices / hover / name) is
 * lifted here so the Konva-side RoomDrawLayer (Stage child) and the
 * DOM-side RoomDrawHUD (Stage sibling) can share it without ever
 * forcing react-konva to reconcile DOM nodes inside the Konva tree.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line, Group, Text, Circle, Rect } from 'react-konva';
import type Konva from 'konva';
import { useDesignStore } from '../store/designStore';
import { usePropertyStore, selectActiveRoom } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { CATEGORY_FILL, CATEGORY_LABELS, getProductById } from '../data/products';
import {
  cmToM,
  polygonArea,
  polygonBounds,
  polygonPerimeter,
  resolveDragTarget,
  rotatedFootprint,
  screenToRoom,
  snapToGrid,
  validatePlacement,
} from '../lib/geometry';
import type { PlacedRect, Polygon, Vertex, Viewport } from '../lib/geometry';
import { RoomDrawLayer, RoomDrawHUD } from './RoomDrawMode';

const DRAG_MIME = 'application/x-ppw-product-id';
const PAN_BTN: number = 0;

const INITIAL_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

export interface RoomCanvasProps {
  drawMode?: boolean;
  onDrawComplete?: () => void;
}

export function RoomCanvas({ drawMode = false, onDrawComplete }: RoomCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const polygon = useDesignStore((s) => s.polygon);
  const pxPerMetre = useDesignStore((s) => s.pxPerMetre);
  const showGrid = useDesignStore((s) => s.showGrid);
  const placedItems = useDesignStore((s) => s.placedItems);
  const selectedInstanceId = useDesignStore((s) => s.selectedInstanceId);
  const addItem = useDesignStore((s) => s.addItem);
  const selectItem = useDesignStore((s) => s.selectItem);
  const updateItem = useDesignStore((s) => s.updateItem);

  const activeRoom = usePropertyStore(selectActiveRoom);
  const setRoomPolygon = usePropertyStore((s) => s.setRoomPolygon);
  const addRoom = usePropertyStore((s) => s.addRoom);

  const pushToast = useToastStore((s) => s.push);

  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [dragOver, setDragOver] = useState(false);
  const itemDragRef = useRef<{ instanceId: string | null; moved: boolean }>({
    instanceId: null,
    moved: false,
  });

  // ---- Draw mode shared state (lifted from RoomDrawMode in Hotfix 5)
  const [drawVertices, setDrawVertices] = useState<Polygon>([]);
  const [drawHover, setDrawHover] = useState<Vertex | null>(null);
  const [drawName, setDrawName] = useState('New Room');

  // Reset draw state every time we toggle into Draw mode.
  useEffect(() => {
    if (drawMode) {
      console.log('[draw-mode]', 'enter Draw mode, reset local state');
      setDrawVertices([]);
      setDrawHover(null);
      setDrawName(activeRoom?.name ?? 'New Room');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode]);

  const bounds = useMemo(() => polygonBounds(polygon), [polygon]);
  const roomWpx = (bounds.maxX - bounds.minX) * pxPerMetre;
  const roomHpx = (bounds.maxY - bounds.minY) * pxPerMetre;
  const perimeter = useMemo(() => polygonPerimeter(polygon), [polygon]);
  const area = useMemo(() => polygonArea(polygon), [polygon]);
  const polygonPoints = useMemo(
    () => polygon.flatMap((v) => [v.x * pxPerMetre, v.y * pxPerMetre]),
    [polygon, pxPerMetre],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      setStageSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (viewport.x !== 0 || viewport.y !== 0 || viewport.scale !== 1) return;
    setViewport({
      x: Math.max(40, (stageSize.width - roomWpx) / 2 - bounds.minX * pxPerMetre),
      y: Math.max(40, (stageSize.height - roomHpx) / 2 - bounds.minY * pxPerMetre),
      scale: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageSize.width, stageSize.height, roomWpx, roomHpx, bounds.minX, bounds.minY, pxPerMetre]);

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = viewport.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    setViewport({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
      scale: newScale,
    });
  }

  function resetView() {
    setViewport(INITIAL_VIEWPORT);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (drawMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOver) setDragOver(true);
  }
  function handleDragLeave(_e: React.DragEvent<HTMLDivElement>) {
    setDragOver(false);
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (drawMode) return;
    e.preventDefault();
    setDragOver(false);
    const productId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!productId) return;
    const product = getProductById(productId);
    if (!product) {
      pushToast(`Unknown product: ${productId}`, 'error');
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { xM, yM } = screenToRoom(
      e.clientX,
      e.clientY,
      { left: rect.left, top: rect.top },
      viewport,
      pxPerMetre,
    );

    const fp = {
      lengthM: cmToM(product.dimensions_cm.length),
      widthM: cmToM(product.dimensions_cm.width),
    };
    const { w, h } = rotatedFootprint(fp, 0);
    const snappedX = snapToGrid(xM - w / 2, 0.5);
    const snappedY = snapToGrid(yM - h / 2, 0.5);
    const candidate: PlacedRect = { x: snappedX, y: snappedY, w, h };

    const others = placedItems
      .map((it) => {
        const p = getProductById(it.productId);
        if (!p) return null;
        const ofp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
        const r = rotatedFootprint(ofp, it.rotation);
        return { x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId };
      })
      .filter((r): r is PlacedRect & { instanceId: string } => r !== null);

    const result = validatePlacement(candidate, others, polygon);
    if (!result.ok) {
      pushToast("Item won't fit here.", 'warn');
      return;
    }
    addItem({ productId: product.id, x: snappedX, y: snappedY, rotation: 0 });
  }

  const handleDrawCommit = useCallback(
    (newPolygon: Polygon, name: string) => {
      console.log('[draw-mode]', 'commit', {
        vertices: newPolygon.length,
        name,
        area: polygonArea(newPolygon),
      });
      const ar = activeRoom;
      if (ar && ar.placedItems.length === 0) {
        setRoomPolygon(ar.id, newPolygon);
        if (name && name !== ar.name) {
          usePropertyStore.getState().renameRoom(ar.id, name);
        }
        pushToast(`Room shape set (${polygonArea(newPolygon).toFixed(2)} m2)`, 'success');
      } else {
        const id = addRoom({ name, polygon: newPolygon });
        usePropertyStore.getState().setActiveRoom(id);
        pushToast(`New room "${name}" created`, 'success');
      }
      if (onDrawComplete) onDrawComplete();
    },
    [activeRoom, setRoomPolygon, addRoom, pushToast, onDrawComplete],
  );

  const handleDrawCancel = useCallback(() => {
    console.log('[draw-mode]', 'cancel');
    if (onDrawComplete) onDrawComplete();
  }, [onDrawComplete]);

  const gridLines = useMemo(() => {
    const out: { points: number[]; key: string; major: boolean }[] = [];
    if (!showGrid) return out;
    const stepPx = 0.5 * pxPerMetre;
    const minX = bounds.minX * pxPerMetre;
    const minY = bounds.minY * pxPerMetre;
    const maxX = bounds.maxX * pxPerMetre;
    const maxY = bounds.maxY * pxPerMetre;
    for (let i = 0; i * stepPx <= maxX - minX + 0.001; i++) {
      const x = minX + i * stepPx;
      const major = i % 2 === 0;
      out.push({ points: [x, minY, x, maxY], key: `vx-${i}`, major });
    }
    for (let j = 0; j * stepPx <= maxY - minY + 0.001; j++) {
      const y = minY + j * stepPx;
      const major = j % 2 === 0;
      out.push({ points: [minX, y, maxX, y], key: `hy-${j}`, major });
    }
    return out;
  }, [showGrid, pxPerMetre, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full bg-ppw-mist transition-colors ${
        dragOver ? 'bg-ppw-teal/10 ring-2 ring-inset ring-ppw-teal' : ''
      } ${drawMode ? 'cursor-crosshair' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={resetView}
          className="pointer-events-auto rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-ppw-ink shadow-sm ring-1 ring-ppw-stone hover:bg-white"
          title="Reset pan/zoom"
        >
          Reset view
        </button>
        <div className="pointer-events-none rounded-md bg-ppw-ink/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
          {area.toFixed(2)} m2 - {perimeter.toFixed(2)} m - {Math.round(viewport.scale * 100)}%
        </div>
      </div>

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable={!drawMode}
        onDragMove={(e) => {
          if (e.target === e.target.getStage()) {
            setViewport((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }
        }}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (drawMode) return;
          if (e.target === e.target.getStage() && e.evt.button === PAN_BTN) {
            selectItem(null);
          }
        }}
        className="konva-stage"
      >
        <Layer listening>
          {polygon.length >= 3 && (
            <Group listening={false}>
              <Line
                points={polygonPoints}
                closed
                fill="#FAF7F1"
                stroke="#0E1B1F"
                strokeWidth={6}
                lineJoin="miter"
              />
              <Line
                points={polygonPoints}
                closed
                stroke="#3B4A52"
                strokeWidth={1}
              />
            </Group>
          )}

          {showGrid && (
            <Group listening={false} clipFunc={polygonClipFunc(polygon, pxPerMetre)}>
              {gridLines.map((l) => (
                <Line
                  key={l.key}
                  points={l.points}
                  stroke="#C4CBCD"
                  strokeWidth={l.major ? 1 : 0.5}
                  opacity={l.major ? 0.9 : 0.55}
                />
              ))}
            </Group>
          )}

          <Text
            x={bounds.minX * pxPerMetre + 6}
            y={bounds.minY * pxPerMetre + 6}
            text={`0,0 - ${(bounds.maxX - bounds.minX).toFixed(1)} x ${(bounds.maxY - bounds.minY).toFixed(1)} m bbox`}
            fontSize={12}
            fontFamily="Inter, sans-serif"
            fill="#3B4A52"
            listening={false}
          />
        </Layer>

        <Layer>
          {!drawMode && placedItems.map((item) => {
            const product = getProductById(item.productId);
            if (!product) return null;
            const fp = {
              lengthM: cmToM(product.dimensions_cm.length),
              widthM: cmToM(product.dimensions_cm.width),
            };
            const { w, h } = rotatedFootprint(fp, item.rotation);
            const wPx = w * pxPerMetre;
            const hPx = h * pxPerMetre;
            const colors = CATEGORY_FILL[product.category];
            const isSelected = item.instanceId === selectedInstanceId;
            return (
              <Group
                key={item.instanceId}
                x={item.x * pxPerMetre}
                y={item.y * pxPerMetre}
                draggable
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'grab';
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = '';
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  selectItem(item.instanceId);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  if (
                    itemDragRef.current.instanceId === item.instanceId &&
                    itemDragRef.current.moved
                  ) {
                    itemDragRef.current = { instanceId: null, moved: false };
                    return;
                  }
                  selectItem(item.instanceId);
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  itemDragRef.current = { instanceId: item.instanceId, moved: false };
                  selectItem(item.instanceId);
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'grabbing';
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  itemDragRef.current.moved = true;
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'grab';
                  const newXm = e.target.x() / pxPerMetre;
                  const newYm = e.target.y() / pxPerMetre;
                  const others = placedItems
                    .map((it) => {
                      const p = getProductById(it.productId);
                      if (!p) return null;
                      const ofp = {
                        lengthM: cmToM(p.dimensions_cm.length),
                        widthM: cmToM(p.dimensions_cm.width),
                      };
                      const r = rotatedFootprint(ofp, it.rotation);
                      return {
                        x: it.x,
                        y: it.y,
                        w: r.w,
                        h: r.h,
                        instanceId: it.instanceId,
                      };
                    })
                    .filter((r): r is PlacedRect & { instanceId: string } => r !== null);
                  const resolved = resolveDragTarget({
                    candidateX: newXm,
                    candidateY: newYm,
                    w,
                    h,
                    others,
                    room: polygon,
                    ignoreInstanceId: item.instanceId,
                  });
                  if (resolved.ok) {
                    updateItem(item.instanceId, { x: resolved.x, y: resolved.y });
                    e.target.position({
                      x: resolved.x * pxPerMetre,
                      y: resolved.y * pxPerMetre,
                    });
                  } else {
                    e.target.position({
                      x: item.x * pxPerMetre,
                      y: item.y * pxPerMetre,
                    });
                    pushToast(
                      resolved.reason === 'collision'
                        ? "Item won't fit there."
                        : 'Out of room bounds.',
                      'warn',
                    );
                  }
                }}
              >
                <Rect
                  width={wPx}
                  height={hPx}
                  fill={colors.fill}
                  opacity={0.55}
                  stroke={isSelected ? '#06B6D4' : colors.stroke}
                  strokeWidth={isSelected ? 2.5 : 1}
                  cornerRadius={3}
                />
                <Text
                  x={4}
                  y={4}
                  width={Math.max(wPx - 8, 20)}
                  text={product.name}
                  fontSize={Math.min(12, Math.max(8, wPx / 14))}
                  fontFamily="Inter, sans-serif"
                  fill="#0E1B1F"
                  listening={false}
                  ellipsis
                  wrap="word"
                />
                <Text
                  x={4}
                  y={hPx - 14}
                  text={CATEGORY_LABELS[product.category]}
                  fontSize={9}
                  fontFamily="Inter, sans-serif"
                  fill="#3B4A52"
                  listening={false}
                />
                {isSelected && (
                  <>
                    <Circle x={0} y={0} radius={4} fill="#06B6D4" />
                    <Circle x={wPx} y={0} radius={4} fill="#06B6D4" />
                    <Circle x={0} y={hPx} radius={4} fill="#06B6D4" />
                    <Circle x={wPx} y={hPx} radius={4} fill="#06B6D4" />
                  </>
                )}
              </Group>
            );
          })}
        </Layer>

        <RoomDrawLayer
          enabled={drawMode}
          stageRef={stageRef}
          containerRef={containerRef}
          viewport={viewport}
          pxPerMetre={pxPerMetre}
          vertices={drawVertices}
          setVertices={setDrawVertices}
          hover={drawHover}
          setHover={setDrawHover}
          name={drawName}
          onCommit={handleDrawCommit}
          onCancel={handleDrawCancel}
        />
      </Stage>

      <RoomDrawHUD
        enabled={drawMode}
        vertices={drawVertices}
        setVertices={setDrawVertices}
        hover={drawHover}
        setHover={setDrawHover}
        name={drawName}
        setName={setDrawName}
        onCommit={handleDrawCommit}
        onCancel={handleDrawCancel}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 max-w-xs rounded-md bg-white/85 px-3 py-2 text-[11px] leading-snug text-ppw-slate shadow-sm ring-1 ring-ppw-stone">
        {drawMode ? (
          <>
            <span className="font-semibold text-ppw-ink">Draw mode:</span> click to place wall vertices - click first vertex or press <kbd>Enter</kbd> to close - <kbd>Ctrl+Z</kbd> undo - <kbd>Esc</kbd> cancel.
          </>
        ) : (
          <>
            <span className="font-semibold text-ppw-ink">Tip:</span> drag a product onto the floor; scroll to zoom; click an item to edit. Keys: <kbd>R</kbd> rotate - <kbd>D</kbd> duplicate - <kbd>Del</kbd> delete - <kbd>Esc</kbd> deselect.
          </>
        )}
      </div>
    </div>
  );
}

function polygonClipFunc(polygon: Polygon, pxPerMetre: number) {
  return (ctx: Konva.Context) => {
    if (polygon.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(polygon[0].x * pxPerMetre, polygon[0].y * pxPerMetre);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i].x * pxPerMetre, polygon[i].y * pxPerMetre);
    }
    ctx.closePath();
  };
}
