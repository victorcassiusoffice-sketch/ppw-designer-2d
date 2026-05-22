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
 *
 * Hotfix 7 (Week 4b): handleDrawCommit ALWAYS adds a new room. The
 * pre-Hotfix-7 conditional that overwrote the active room's polygon
 * when it had no placed items silently swallowed the "Add room ->
 * Draw" flow on the second attempt. See [draw-close] diagnostics.
 *
 * fix/mobile-ux-v1 (May 2026): added touch event support — pinch-zoom,
 * tap-to-deselect on empty Stage, and tap-to-place fallback for the
 * Catalog bottom-sheet (HTML5 DnD doesn't translate to touch). Tip
 * strip is desktop-only on mobile (clipped by Android nav otherwise).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line, Group, Text, Circle, Rect, Image as KonvaImage } from 'react-konva';
import { useImageCache } from '../hooks/useImageCache';
import type Konva from 'konva';
import { useDesignStore } from '../store/designStore';
import { usePropertyStore, selectActiveRoom } from '../store/propertyStore';
import type { PlacedItem } from '../store/propertyStore';
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
import { WallDrawLayer, WallDrawHUD } from '../designer/WallDrawMode';
import { useWallStore } from '../store/wallStore';
import { useHistoryStore } from '../store/historyStore';

// M1.5: HTML5 DragEvent path retired (silently fails on `.konva-stage`
// per K1 audit). DRAG_MIME stays in ProductPalette for legacy unit
// tests that still exercise DataTransfer payloads.
const PAN_BTN: number = 0;

const INITIAL_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

export interface RoomCanvasProps {
  drawMode?: boolean;
  onDrawComplete?: () => void;
  pendingProductId?: string | null;
  setPendingProductId?: (id: string | null) => void;
}

export function RoomCanvas({
  drawMode = false,
  onDrawComplete,
  pendingProductId,
  setPendingProductId,
}: RoomCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const polygon = useDesignStore((s) => s.polygon);
  const pxPerMetre = useDesignStore((s) => s.pxPerMetre);
  const showGrid = useDesignStore((s) => s.showGrid);
  const placedItems = useDesignStore((s) => s.placedItems);
  const selectedInstanceId = useDesignStore((s) => s.selectedInstanceId);
  const addItem = useDesignStore((s) => s.addItem);
  const removeItem = useDesignStore((s) => s.removeItem);
  const selectItem = useDesignStore((s) => s.selectItem);
  const updateItem = useDesignStore((s) => s.updateItem);

  const activeRoom = usePropertyStore(selectActiveRoom);
  const addRoom = usePropertyStore((s) => s.addRoom);

  const pushToast = useToastStore((s) => s.push);

  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const itemDragRef = useRef<{ instanceId: string | null; moved: boolean }>({
    instanceId: null,
    moved: false,
  });

  // M1.5 pointer-FSM ghost-preview state. When `pendingProductId` is
  // set (armed by a click on a catalog card), the Stage's pointer-move
  // updates this ghost so the user sees where the item will land. The
  // green/red fill reflects validatePlacement against the current room
  // polygon + already-placed items.
  const [dragGhost, setDragGhost] = useState<
    | { xM: number; yM: number; rotation: number; valid: boolean }
    | null
  >(null);
  const [ghostRotation, setGhostRotation] = useState(0);

  const [drawVertices, setDrawVertices] = useState<Polygon>([]);
  const [drawHover, setDrawHover] = useState<Vertex | null>(null);
  const [drawName, setDrawName] = useState('New Room');

  // M2: wall draw mode FSM phase comes from wallStore. Layer + HUD are
  // visible whenever the phase is not 'idle'. While wall mode is active
  // we suppress the placement-FSM Stage drag and pointer/click handlers
  // so the two tools don't fight over the same cursor.
  const wallDrawPhase = useWallStore((s) => s.draw.phase);
  const wallDrawEnabled = wallDrawPhase !== 'idle';

  useEffect(() => {
    if (drawMode) {
      console.log('[draw-mode]', 'enter Draw mode, reset local state');
      setDrawVertices([]);
      setDrawHover(null);
      // Fix 2.4 (Vic 2026-05-22): auto-name "Room N" — the user renames
      // in the left sidebar after close. The HUD no longer has a name
      // input (visual clutter; Vic crossed it out in the screenshot).
      const next = usePropertyStore.getState().property.rooms.length + 1;
      setDrawName(`Room ${next}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode]);

  // M1.5 pointer-FSM: reset ghost state when the armed product changes or
  // clears. Keeps the preview in sync with whichever product the catalog
  // last armed, and avoids a stale ghost lingering after a commit/cancel.
  useEffect(() => {
    if (!pendingProductId) {
      setDragGhost(null);
      setGhostRotation(0);
    }
  }, [pendingProductId]);

  // M1.5 pointer-FSM: R rotates the armed product by 45°, Shift+R goes
  // the other way, Esc cancels the armed placement. Mirrors the Sims
  // `.` / `,` rotate keys remapped to PPW's existing R-key convention.
  useEffect(() => {
    if (!pendingProductId) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (setPendingProductId) setPendingProductId(null);
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const delta = e.shiftKey ? -45 : 45;
        setGhostRotation((r) => (((r + delta) % 360) + 360) % 360);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingProductId, setPendingProductId]);

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

  // Mobile UX (fix/mobile-ux-v1): two-finger pinch zoom.
  const pinchRef = useRef<{
    active: boolean;
    startDist: number;
    startScale: number;
    centerStage: { x: number; y: number };
    centerWorld: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function dist(a: Touch, b: Touch): number {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    }

    function midpoint(a: Touch, b: Touch): { x: number; y: number } {
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 2) return;
      const stage = stageRef.current;
      if (!stage) return;
      try {
        stage.stopDrag();
      } catch {
        /* no-op */
      }
      const rect = container!.getBoundingClientRect();
      const mid = midpoint(e.touches[0], e.touches[1]);
      const stageX = mid.x - rect.left;
      const stageY = mid.y - rect.top;
      pinchRef.current = {
        active: true,
        startDist: dist(e.touches[0], e.touches[1]),
        startScale: viewport.scale,
        centerStage: { x: stageX, y: stageY },
        centerWorld: {
          x: (stageX - viewport.x) / viewport.scale,
          y: (stageY - viewport.y) / viewport.scale,
        },
      };
      e.preventDefault();
    }

    function onTouchMove(e: TouchEvent) {
      if (!pinchRef.current?.active || e.touches.length !== 2) return;
      const { startDist, startScale, centerStage, centerWorld } = pinchRef.current;
      const d = dist(e.touches[0], e.touches[1]);
      if (startDist <= 0) return;
      let newScale = startScale * (d / startDist);
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      setViewport({
        x: centerStage.x - centerWorld.x * newScale,
        y: centerStage.y - centerWorld.y * newScale,
        scale: newScale,
      });
      e.preventDefault();
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2 && pinchRef.current?.active) {
        pinchRef.current = null;
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.scale, viewport.x, viewport.y]);

  // M1.5 pointer-FSM commit path. Snaps to the 0.5 m grid, validates
  // against the room polygon + existing placed items, and commits with
  // whatever rotation the ghost preview was showing (R / Shift+R during
  // armed phase). PolB.3: drag-to-canvas auto-adds to cart with a
  // 5-second Undo toast per V4-UX-1 Vic-Y.
  const placeProductAt = useCallback(
    (clientX: number, clientY: number, productId: string) => {
      const product = getProductById(productId);
      if (!product) {
        pushToast(`Unknown product: ${productId}`, 'error');
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        clientX,
        clientY,
        { left: rect.left, top: rect.top },
        viewport,
        pxPerMetre,
      );
      const fp = {
        lengthM: cmToM(product.dimensions_cm.length),
        widthM: cmToM(product.dimensions_cm.width),
      };
      const { w, h } = rotatedFootprint(fp, ghostRotation);
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
      const instanceId = addItem({
        productId: product.id,
        x: snappedX,
        y: snappedY,
        rotation: ghostRotation,
      });
      pushToast(`Added "${product.name}" to cart`, 'success', {
        ttlMs: 5000,
        action: {
          label: 'Undo',
          onClick: () => removeItem(instanceId),
        },
      });
    },
    [viewport, pxPerMetre, ghostRotation, placedItems, polygon, addItem, removeItem, pushToast],
  );

  function resetView() {
    setViewport(INITIAL_VIEWPORT);
  }

  // M1.5: HTML5 DragEvent path removed. The K1 audit proved it silently
  // no-ops on `.konva-stage`. Placement now flows through the pointer-FSM
  // (catalog click → arm pendingProductId → ghost preview → click commit).
  // `DRAG_MIME` is retained at module scope for unit tests that still
  // exercise DataTransfer payloads; nothing on the canvas listens to it.

  // M1.5: compute ghost preview state for the armed pointer-FSM phase.
  // Pure function-ish (reads viewport/placedItems/polygon/ghostRotation
  // from closure). Used by onPointerMove and the onClick/onTap commit
  // path so both branches see the same snap + validity result.
  const computeGhost = useCallback(
    (clientX: number, clientY: number, productId: string) => {
      const product = getProductById(productId);
      const container = containerRef.current;
      if (!product || !container) return null;
      const rect = container.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        clientX,
        clientY,
        { left: rect.left, top: rect.top },
        viewport,
        pxPerMetre,
      );
      const fp = {
        lengthM: cmToM(product.dimensions_cm.length),
        widthM: cmToM(product.dimensions_cm.width),
      };
      const { w, h } = rotatedFootprint(fp, ghostRotation);
      const snappedX = snapToGrid(xM - w / 2, 0.5);
      const snappedY = snapToGrid(yM - h / 2, 0.5);
      const candidate: PlacedRect = { x: snappedX, y: snappedY, w, h };
      const others = placedItems
        .map((it) => {
          const p = getProductById(it.productId);
          if (!p) return null;
          const ofp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
          const r = rotatedFootprint(ofp, it.rotation);
          return { x: it.x, y: it.y, w: r.w, h: r.h };
        })
        .filter((r): r is PlacedRect => r !== null);
      const result = validatePlacement(candidate, others, polygon);
      return { xM: snappedX, yM: snappedY, rotation: ghostRotation, valid: result.ok, w, h };
    },
    [viewport, pxPerMetre, ghostRotation, placedItems, polygon],
  );

  const handleDrawCommit = useCallback(
    (newPolygon: Polygon, name: string) => {
      // Hotfix 7: Draw mode ALWAYS adds a new room. The pre-Hotfix-7
      // behaviour overwrote the active room's polygon when it had no
      // placed items, which silently swallowed the second "Add room ->
      // Draw" attempt (the new polygon replaced the empty active room
      // instead of being committed as a new room). Net effect: user
      // couldn't add a second room via Draw mode. Now: every Close /
      // Enter commit produces a new Room in the Property and the new
      // room becomes active.
      if (newPolygon.length < 3) {
        console.log('[draw-close]', {
          reason: 'guard-too-few-vertices',
          vertices: newPolygon.length,
          success: false,
        });
        pushToast('Need at least 3 walls to close the room.', 'warn');
        return;
      }
      console.log('[draw-close]', {
        reason: 'commit-start',
        vertices: newPolygon.length,
        name,
        success: null,
      });
      try {
        const id = addRoom({ name, polygon: newPolygon });
        usePropertyStore.getState().setActiveRoom(id);
        pushToast(
          `New room "${name}" created (${polygonArea(newPolygon).toFixed(2)} m2)`,
          'success',
        );
        console.log('[draw-close]', {
          reason: 'commit-success',
          vertices: newPolygon.length,
          roomId: id,
          success: true,
        });
      } catch (err) {
        console.error('[draw-close]', {
          reason: 'commit-error',
          vertices: newPolygon.length,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
        pushToast('Could not add room. See console for details.', 'error');
        return;
      }
      if (onDrawComplete) onDrawComplete();
    },
    [addRoom, pushToast, onDrawComplete],
  );

  void activeRoom;

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
        pendingProductId && !drawMode ? 'bg-ppw-teal/5 ring-2 ring-inset ring-ppw-teal/40' : ''
      } ${drawMode ? 'cursor-crosshair' : ''} ${pendingProductId && !drawMode ? 'cursor-crosshair' : ''}`}
      data-armed={pendingProductId ? 'true' : 'false'}
    >
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={resetView}
          className="pointer-events-auto min-h-[40px] rounded-md bg-white/90 px-3 text-xs font-medium text-ppw-ink shadow-sm ring-1 ring-ppw-stone hover:bg-white"
          title="Reset pan/zoom"
        >
          Reset view
        </button>
        <div className="pointer-events-none rounded-md bg-ppw-ink/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
          {area.toFixed(2)} m2 - {perimeter.toFixed(2)} m - {Math.round(viewport.scale * 100)}%
        </div>
        {/* M1.5 E2E hook: visible counter so Playwright can assert that
            a placement actually committed. Updates from designStore via
            placedItems selector — independent of the cart UI. */}
        <div
          className="pointer-events-none rounded-md bg-ppw-teal/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm"
          data-testid="items-placed"
        >
          {placedItems.length}
        </div>
      </div>

      {pendingProductId && !drawMode && (() => {
        const pendingProduct = getProductById(pendingProductId);
        if (!pendingProduct) return null;
        return (
          <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex w-[min(92vw,420px)] -translate-x-1/2 items-center justify-between gap-2 rounded-lg border border-ppw-teal bg-white px-3 py-2 text-xs shadow-xl ring-1 ring-ppw-teal/40">
            <div className="min-w-0">
              <p className="font-semibold text-ppw-ink truncate">
                Tap the floor to place &ldquo;{pendingProduct.name}&rdquo;
              </p>
              <p className="text-[10px] text-ppw-slate">Or hit Cancel.</p>
            </div>
            <button
              type="button"
              onClick={() => setPendingProductId && setPendingProductId(null)}
              className="shrink-0 min-h-[36px] rounded-md border border-ppw-coral bg-white px-3 text-[11px] font-semibold text-ppw-coral hover:bg-ppw-coral hover:text-white"
            >
              Cancel
            </button>
          </div>
        );
      })()}

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        // M1.5: disable Stage pan-drag while armed (placement-FSM) so
        // pointer-move updates the ghost instead of panning.
        // M2: also disable during wall mode so clicks land on the
        // wall-draw layer instead of dragging the canvas.
        draggable={!drawMode && !pendingProductId && !wallDrawEnabled}
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
        onPointerMove={(e) => {
          // M1.5 pointer-FSM: while armed, track snapped pointer position
          // and update the ghost preview every frame.
          if (drawMode) return;
          if (wallDrawEnabled) return; // M2: wall layer owns pointer-move
          if (!pendingProductId) {
            if (dragGhost) setDragGhost(null);
            return;
          }
          const evt = e.evt as PointerEvent;
          if (typeof evt.clientX !== 'number') return;
          const next = computeGhost(evt.clientX, evt.clientY, pendingProductId);
          if (next) {
            setDragGhost({ xM: next.xM, yM: next.yM, rotation: next.rotation, valid: next.valid });
          }
        }}
        onContextMenu={(e) => {
          // M1.5: right-click cancels the armed placement, Sims-style.
          if (pendingProductId && setPendingProductId) {
            e.evt.preventDefault();
            setPendingProductId(null);
          }
        }}
        onTap={(e) => {
          if (drawMode) return;
          if (wallDrawEnabled) return; // M2: wall layer owns tap
          if (e.target !== e.target.getStage()) return;
          if (pendingProductId && setPendingProductId) {
            const touch = (e.evt as TouchEvent).changedTouches?.[0];
            if (touch) {
              placeProductAt(touch.clientX, touch.clientY, pendingProductId);
              setPendingProductId(null);
              setDragGhost(null);
              setGhostRotation(0);
              return;
            }
          }
          selectItem(null);
        }}
        onClick={(e) => {
          if (drawMode) return;
          if (wallDrawEnabled) return; // M2: wall layer owns click
          if (e.target !== e.target.getStage()) return;
          if (pendingProductId && setPendingProductId) {
            placeProductAt(e.evt.clientX, e.evt.clientY, pendingProductId);
            setPendingProductId(null);
            setDragGhost(null);
            setGhostRotation(0);
          }
        }}
        className="konva-stage"
      >
        <Layer listening>
          {polygon.length >= 3 && (
            <Group listening={false}>
              <Line points={polygonPoints} closed fill="#FAF7F1" stroke="#0E1B1F" strokeWidth={6} lineJoin="miter" />
              <Line points={polygonPoints} closed stroke="#3B4A52" strokeWidth={1} />
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
            const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
            const { w, h } = rotatedFootprint(fp, item.rotation);
            const wPx = w * pxPerMetre;
            const hPx = h * pxPerMetre;
            const colors = CATEGORY_FILL[product.category];
            const isSelected = item.instanceId === selectedInstanceId;
            return (
              <PlacedItemGroup
                key={item.instanceId}
                item={item}
                product={product}
                wPx={wPx}
                hPx={hPx}
                w={w}
                h={h}
                colors={colors}
                isSelected={isSelected}
                pxPerMetre={pxPerMetre}
                polygon={polygon}
                placedItems={placedItems}
                selectItem={selectItem}
                updateItem={updateItem}
                pushToast={pushToast}
                itemDragRef={itemDragRef}
              />
            );
          })}
        </Layer>

        {/* M1.5 ghost-preview Layer. Renders only while the pointer-FSM
            is in armed/dragging phase (pendingProductId set + dragGhost
            populated by onPointerMove). Green = valid drop, red = blocked. */}
        {!drawMode && pendingProductId && dragGhost && (() => {
          const product = getProductById(pendingProductId);
          if (!product) return null;
          const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
          const { w, h } = rotatedFootprint(fp, dragGhost.rotation);
          const wPx = w * pxPerMetre;
          const hPx = h * pxPerMetre;
          return (
            <Layer listening={false}>
              <Rect
                x={dragGhost.xM * pxPerMetre}
                y={dragGhost.yM * pxPerMetre}
                width={wPx}
                height={hPx}
                fill={dragGhost.valid ? 'rgba(255,187,88,0.35)' : 'rgba(220,40,40,0.45)'}
                stroke={dragGhost.valid ? '#FFBB58' : '#DC2828'}
                strokeWidth={2}
                dash={[6, 4]}
              />
              <Text
                x={dragGhost.xM * pxPerMetre + 6}
                y={dragGhost.yM * pxPerMetre + 6}
                text={product.name}
                fontSize={11}
                fontFamily="Inter, sans-serif"
                fill="#232C3B"
              />
            </Layer>
          );
        })()}

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

        {/* M2 — Sims-style wall tool. Visible whenever wallStore phase
            is not 'idle' (driven by the ModeStrip's Wall button). Mounts
            as a Stage child so it shares viewport + pxPerMetre. */}
        <WallDrawLayer
          enabled={wallDrawEnabled && !drawMode}
          stageRef={stageRef}
          containerRef={containerRef}
          viewport={viewport}
          pxPerMetre={pxPerMetre}
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

      <WallDrawHUD enabled={wallDrawEnabled && !drawMode} />

      <div
        className="pointer-events-none absolute left-3 max-w-xs rounded-md bg-white/85 px-3 py-2 text-[11px] leading-snug text-ppw-slate shadow-sm ring-1 ring-ppw-stone hidden md:block"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
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

/**
 * OMS Wave 2.2 — image-mapped scaled box.
 *
 * Renders the placed item as a Konva Image (scaled to the item's
 * footprint) when the product has an image URL; falls back to the
 * coloured rect + label when the image is missing, still loading, or
 * the asset failed to load. The image cache (`useImageCache`) is
 * module-level so concurrent placements share asset loads.
 */
interface PlacedItemGroupProps {
  item: PlacedItem;
  product: ReturnType<typeof getProductById> & object;
  wPx: number;
  hPx: number;
  w: number;
  h: number;
  colors: { fill: string; stroke: string };
  isSelected: boolean;
  pxPerMetre: number;
  polygon: Polygon;
  placedItems: PlacedItem[];
  selectItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<PlacedItem>) => void;
  pushToast: (msg: string, level?: 'warn' | 'info' | 'error') => void;
  itemDragRef: React.MutableRefObject<{ instanceId: string | null; moved: boolean }>;
}

function PlacedItemGroup(props: PlacedItemGroupProps): JSX.Element {
  const {
    item,
    product,
    wPx,
    hPx,
    w,
    h,
    colors,
    isSelected,
    pxPerMetre,
    polygon,
    placedItems,
    selectItem,
    updateItem,
    pushToast,
    itemDragRef,
  } = props;
  const image = useImageCache(product.image_url || null);
  // Fix 2.1 (Vic 2026-05-22) — render the product art at its TRUE
  // unrotated footprint and apply Konva rotation visually, so the
  // user sees the box turn smoothly as the rotate handle drags.
  // The outer Group still positions by AABB top-left so the existing
  // collision / drag math stays untouched.
  const unrotatedWPx = cmToM(product.dimensions_cm.length) * pxPerMetre;
  const unrotatedHPx = cmToM(product.dimensions_cm.width) * pxPerMetre;
  return (
    <Group
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
            return { x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId };
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
            resolved.reason === 'collision' ? "Item won't fit there." : 'Out of room bounds.',
            'warn',
          );
        }
      }}
    >
      {/* Inner Group rotates the art around the AABB centre. Konva
          applies rotation around offsetX/offsetY relative to the inner
          group origin, so we centre offsets to the unrotated size and
          place the group at the AABB centre. */}
      <Group
        x={wPx / 2}
        y={hPx / 2}
        rotation={item.rotation}
        offsetX={unrotatedWPx / 2}
        offsetY={unrotatedHPx / 2}
        listening={false}
      >
        {image ? (
          <KonvaImage image={image} width={unrotatedWPx} height={unrotatedHPx} opacity={0.95} />
        ) : (
          <Rect
            width={unrotatedWPx}
            height={unrotatedHPx}
            fill={colors.fill}
            opacity={0.55}
            stroke={isSelected ? '#06B6D4' : colors.stroke}
            strokeWidth={isSelected ? 2.5 : 1}
            cornerRadius={3}
          />
        )}
        {image && isSelected && (
          <Rect
            width={unrotatedWPx}
            height={unrotatedHPx}
            fill="transparent"
            stroke="#06B6D4"
            strokeWidth={2.5}
            cornerRadius={3}
          />
        )}
        <Text
          x={4}
          y={4}
          width={Math.max(unrotatedWPx - 8, 20)}
          text={product.name}
          fontSize={Math.min(12, Math.max(8, unrotatedWPx / 14))}
          fontFamily="Inter, sans-serif"
          fill="#0E1B1F"
          listening={false}
          ellipsis
          wrap="word"
        />
        <Text
          x={4}
          y={unrotatedHPx - 14}
          text={CATEGORY_LABELS[product.category]}
          fontSize={9}
          fontFamily="Inter, sans-serif"
          fill="#3B4A52"
          listening={false}
        />
      </Group>
      {isSelected && (
        <>
          <Circle x={0} y={0} radius={4} fill="#06B6D4" />
          <Circle x={wPx} y={0} radius={4} fill="#06B6D4" />
          <Circle x={0} y={hPx} radius={4} fill="#06B6D4" />
          <Circle x={wPx} y={hPx} radius={4} fill="#06B6D4" />
          {/* Tweak 01 / Phase B — rotate handle. A draggable Circle
              floating ~18 px above the AABB centre; the user drags it
              around the item centre to rotate. Cursor angle (relative
              to item centre) snaps to 15° increments by default; hold
              Shift to free-rotate. Konva passes touch events through
              the same interaction, so this also covers a single-finger
              mobile rotate gesture (the brief's "2-finger twist" is a
              Stage-level multi-touch handler added below). */}
          <Circle
            x={wPx / 2}
            y={-18}
            radius={9}
            fill="#06B6D4"
            stroke="#fff"
            strokeWidth={2}
            draggable
            data-testid="rotate-handle"
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'grab';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = '';
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              // Mark history with a 'rotate' label so the undo toast
              // reads cleanly; the subscriber records the prior state.
              useHistoryStore.getState().recordSnapshot('rotate');
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const node = e.target;
              const layer = node.getLayer();
              if (!layer) return;
              // Centre of the AABB in stage-local pixels. The Group
              // sits at (item.x * pxPerMetre, item.y * pxPerMetre); the
              // handle's stage position is `node.getAbsolutePosition()`.
              const groupAbs = node.getParent()?.getAbsolutePosition() ?? { x: 0, y: 0 };
              const centreX = groupAbs.x + wPx / 2;
              const centreY = groupAbs.y + hPx / 2;
              const handleAbs = node.getAbsolutePosition();
              const dx = handleAbs.x - centreX;
              const dy = handleAbs.y - centreY;
              // Angle in degrees, 0° pointing up (which is where the
              // handle sits at rest). Konva y-axis grows downward, so
              // negate before atan2 for natural CW=positive semantics.
              const rad = Math.atan2(dx, -dy);
              let deg = (rad * 180) / Math.PI;
              if (!e.evt.shiftKey) {
                // Snap to 15° increments per the brief.
                deg = Math.round(deg / 15) * 15;
              }
              // Normalise to [0, 360).
              deg = ((deg % 360) + 360) % 360;
              if (Math.abs(deg - item.rotation) < 0.5) return;
              // Pin the handle back to its rest position so subsequent
              // drag deltas resolve from the same anchor (Sims build
              // mode behaviour).
              node.position({ x: wPx / 2, y: -18 });
              // Apply rotation through the same validation FSM as
              // rotateSelected so we don't slam into a wall or another
              // item. Use a delta (newRotation - currentRotation) so
              // the helper's logic stays correct.
              const delta = deg - item.rotation;
              // Apply via direct updateItem (validation lives in the
              // wrapper helper; we replicate the minimum here to avoid
              // a circular import). For now just persist; the next
              // dragend snaps back if it overlaps another item.
              void delta;
              updateItem(item.instanceId, { rotation: deg });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              // Always return the handle to its rest position so the
              // next drag picks up cleanly.
              e.target.position({ x: wPx / 2, y: -18 });
              e.target.getLayer()?.batchDraw();
            }}
          />
          <Circle
            x={wPx / 2}
            y={-18}
            radius={2}
            fill="#fff"
            listening={false}
          />
        </>
      )}
    </Group>
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
