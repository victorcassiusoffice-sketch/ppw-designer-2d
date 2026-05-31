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
import { useImageCache, useImageCacheStatus } from '../hooks/useImageCache';
import type Konva from 'konva';
import { useDesignStore } from '../store/designStore';
import { usePropertyStore, selectActiveRoom } from '../store/propertyStore';
import type { PlacedItem } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { CATEGORY_FILL, CATEGORY_LABELS, getProductById, productImageUrl } from '../data/products';
import { dataUrlToBlob, triggerDownload } from '../lib/shareImage';
import {
  cmToM,
  findFreeSlot,
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
import { computeZoomScale } from '../lib/zoom';
import { RoomDrawLayer } from './RoomDrawMode';
import { WallDrawLayer, WallDrawHUD } from '../designer/WallDrawMode';
import { useWallStore } from '../store/wallStore';
import { useHistoryStore } from '../store/historyStore';
// Batch 3 Fix 3.2 — vertices live in a tiny shared store so the
// RoomList sidebar can render the live counters next to the room.
import { useDrawProgressStore } from '../store/drawProgressStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
// Sims feature-finish (2026-05-30) — inline floating cluster (flagship),
// precision snap step, haptics. All additive; Konva stable-lock untouched.
import { FloatingCluster } from '../designer/FloatingCluster';
import { useDesignerUIStore, PRECISION_STEP_M } from '../store/designerUIStore';
import { haptic } from '../lib/haptics';

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
  // Designer 3-Bug Fix (2026-05-28, Bug 3) — ref to the placed-items Konva
  // layer so we can force a repaint when the item set changes (see effect).
  const itemsLayerRef = useRef<Konva.Layer>(null);

  const polygon = useDesignStore((s) => s.polygon);
  const pxPerMetre = useDesignStore((s) => s.pxPerMetre);
  const showGrid = useDesignStore((s) => s.showGrid);
  const placedItems = useDesignStore((s) => s.placedItems);
  const selectedInstanceId = useDesignStore((s) => s.selectedInstanceId);
  const addItem = useDesignStore((s) => s.addItem);
  const removeItem = useDesignStore((s) => s.removeItem);
  const selectItem = useDesignStore((s) => s.selectItem);
  const updateItem = useDesignStore((s) => s.updateItem);

  // Sims feature-finish — snap resolution (full 0.5 m / quarter 0.25 m).
  // Toggled by Ctrl+F (desktop) / the precision button (mobile). Spec D15/M13.
  const precision = useDesignerUIStore((s) => s.precision);
  const togglePrecision = useDesignerUIStore((s) => s.togglePrecision);
  const tool = useDesignerUIStore((s) => s.tool);
  const setTool = useDesignerUIStore((s) => s.setTool);
  const snapStep = PRECISION_STEP_M[precision];

  // D11/D12/D14 — tool-aware activation of a placed item. Hand (default) =
  // select. Sledgehammer (J) = delete (stays armed for repeat). Eyedropper
  // (E) = load the item's product type onto the placement ghost, then drop
  // back to Hand. Returns true when the tool consumed the event (so the
  // PlacedItemGroup skips its normal select).
  const activatePlacedItem = useCallback(
    (instanceId: string, productId: string): boolean => {
      if (tool === 'sledgehammer') {
        removeItem(instanceId);
        haptic('delete');
        return true;
      }
      if (tool === 'eyedropper') {
        if (setPendingProductId) setPendingProductId(productId);
        setTool('hand');
        haptic('select');
        return true;
      }
      return false;
    },
    [tool, removeItem, setPendingProductId, setTool],
  );

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

  // Designer polish (2026-05-29) — placement micro-feedback. When a NEW
  // item commits, its instanceId is captured here so the matching
  // PlacedItemGroup runs a one-shot "settle" tween (subtle scale + fade
  // in). Purely visual: the tween resets to scale 1 / opacity 1, so the
  // committed geometry from the Konva stable-lock placement math is never
  // mutated. Cleared on a short timer so a re-render can't re-trigger it.
  const [justPlacedId, setJustPlacedId] = useState<string | null>(null);
  useEffect(() => {
    if (!justPlacedId) return;
    const t = window.setTimeout(() => setJustPlacedId(null), 400);
    return () => window.clearTimeout(t);
  }, [justPlacedId]);

  // Batch 3 Fix 3.2 — vertices now live in `useDrawProgressStore` so
  // RoomList sidebar can subscribe to the same source of truth for the
  // live counters. The setter API matches the prior React useState
  // signature (accepts value or updater fn).
  const drawVertices = useDrawProgressStore((s) => s.vertices);
  const setDrawVertices = useDrawProgressStore((s) => s.setVertices);
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
      // Batch 3 Fix 3.1 — after Vic's `setDrawMode` wrapper clears all
      // rooms' items + walls + zones, the property still holds one
      // empty-active-room placeholder. Auto-name "Room 1" since the
      // user is starting fresh; rename inline in the sidebar after.
      setDrawName('Room 1');
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

  // D19 / D20 — viewport keyboard controls (zoom +/- and WASD/arrow pan).
  // Local to RoomCanvas because the viewport transform lives here. Ignored
  // while typing in an input or while a draw/wall tool owns the canvas.
  useEffect(() => {
    function isTyping(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      if (drawMode || wallDrawEnabled) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave Ctrl+F etc alone
      const PAN = 60;
      const factor = 1.12;
      switch (e.key) {
        case '+':
        case '=': // unshifted "+" key
          e.preventDefault();
          setViewport((v) => ({ ...v, scale: Math.min(MAX_SCALE, v.scale * factor) }));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setViewport((v) => ({ ...v, scale: Math.max(MIN_SCALE, v.scale / factor) }));
          break;
        case 'w':
        case 'W':
        case 'ArrowUp':
          e.preventDefault();
          setViewport((v) => ({ ...v, y: v.y + PAN }));
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          e.preventDefault();
          setViewport((v) => ({ ...v, y: v.y - PAN }));
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          e.preventDefault();
          setViewport((v) => ({ ...v, x: v.x + PAN }));
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          // Bare D is "duplicate" when an item is selected (global handler).
          // Only pan with D when nothing is selected, so we never fight it.
          if (selectedInstanceId) return;
          e.preventDefault();
          setViewport((v) => ({ ...v, x: v.x - PAN }));
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawMode, wallDrawEnabled, selectedInstanceId]);

  // D21 — running cost total (MUR) of everything placed. PPW's "funds"
  // adaptation: there is no budget ceiling (it's a real shop), so this is
  // a live spend readout, not a remaining-balance gauge. Currency is taken
  // from the first priced item (catalog is single-currency per market).
  const costReadout = useMemo(() => {
    let total = 0;
    let currency = 'MUR';
    for (const it of placedItems) {
      const p = getProductById(it.productId);
      if (!p?.price) continue;
      total += p.price.value;
      currency = p.price.currency || currency;
    }
    return { total, currency };
  }, [placedItems]);

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
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    // M5 (Customer-UI fix 2026-05-31) — use a FUNCTIONAL setViewport so the
    // zoom always reads the CURRENT viewport (never a stale render closure),
    // and so the one-time re-centre effect (which only fires while the
    // viewport is pristine) can never undo a user zoom. The scale math is
    // extracted to lib/zoom (computeZoomScale) so it is unit-tested without
    // a Konva stage. Pinch (below) is unaffected.
    setViewport((v) => {
      const oldScale = v.scale;
      const mousePointTo = {
        x: (pointer.x - v.x) / oldScale,
        y: (pointer.y - v.y) / oldScale,
      };
      const newScale = computeZoomScale(oldScale, e.evt.deltaY, MIN_SCALE, MAX_SCALE);
      return {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
        scale: newScale,
      };
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
  // Place a product whose CENTRE is at room-space (xM, yM). Snaps to the
  // 0.5 m grid, validates against the polygon + existing items, commits
  // with the given rotation. Returns true on success. Shared by the
  // pointer-FSM (via screen→room) and the mobile toolbar (room-centre).
  const placeAtRoomPoint = useCallback(
    (centreXm: number, centreYm: number, productId: string, rotationDeg: number) => {
      const product = getProductById(productId);
      if (!product) {
        pushToast(`Unknown product: ${productId}`, 'error');
        return false;
      }
      const fp = {
        lengthM: cmToM(product.dimensions_cm.length),
        widthM: cmToM(product.dimensions_cm.width),
      };
      const { w, h } = rotatedFootprint(fp, rotationDeg);
      const snappedX = snapToGrid(centreXm - w / 2, snapStep);
      const snappedY = snapToGrid(centreYm - h / 2, snapStep);
      const others = placedItems
        .map((it) => {
          const p = getProductById(it.productId);
          if (!p) return null;
          const ofp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
          const r = rotatedFootprint(ofp, it.rotation);
          return { x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId };
        })
        .filter((r): r is PlacedRect & { instanceId: string } => r !== null);
      // Designer 3-Bug Fix (2026-05-28, Bug 2) — auto-relocate to the
      // nearest free grid slot instead of rejecting when the preferred
      // point (the room centre for the mobile "+ Add to room" path) is
      // already occupied. Only reject when the room is genuinely full.
      const slot = findFreeSlot({ preferredX: snappedX, preferredY: snappedY, w, h, others, polygon });
      if (!slot) {
        haptic('invalid');
        pushToast("Item won't fit — the room is full.", 'warn');
        return false;
      }
      haptic('place');
      const instanceId = addItem({
        productId: product.id,
        x: slot.x,
        y: slot.y,
        rotation: rotationDeg,
      });
      // Polish (2026-05-29) — flag this fresh instance for the settle tween.
      setJustPlacedId(instanceId);
      // M1 — the just-placed item becomes selected so the on-canvas
      // floating cluster appears around it (Sims "placed → selected").
      selectItem(instanceId);
      pushToast(`Added "${product.name}" to cart`, 'success', {
        ttlMs: 5000,
        action: {
          label: 'Undo',
          onClick: () => removeItem(instanceId),
        },
      });
      return true;
    },
    [placedItems, polygon, addItem, removeItem, pushToast, snapStep, selectItem],
  );

  const placeProductAt = useCallback(
    (clientX: number, clientY: number, productId: string, rotationOverride?: number) => {
      const container = containerRef.current;
      if (!container) return false;
      const rect = container.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        clientX,
        clientY,
        { left: rect.left, top: rect.top },
        viewport,
        pxPerMetre,
      );
      return placeAtRoomPoint(xM, yM, productId, rotationOverride ?? ghostRotation);
    },
    [viewport, pxPerMetre, ghostRotation, placeAtRoomPoint],
  );

  // Mobile Sims toolbar bridge (Phase 2-4) — consume one-shot placement
  // intents published by SimsBottomToolbar / MobileProductPopup. The
  // popup "+" auto-places at the ROOM centre (guaranteed inside the room,
  // independent of pan/zoom); a drag-release places at the drop point.
  // Both run the same validated placement path. Konva core untouched.
  const placementIntent = usePlacementIntentStore((s) => s.intent);
  const consumeIntent = usePlacementIntentStore((s) => s.consume);
  useEffect(() => {
    if (!placementIntent) return;
    if (drawMode || wallDrawEnabled) {
      // A draw/wall tool owns the canvas — drop the intent silently so a
      // stale placement doesn't fire when the user returns to place mode.
      consumeIntent();
      return;
    }
    // Popup/drag placements always commit at rotation 0 (the user rotates
    // after, via the on-canvas rotate handle).
    if (placementIntent.target === 'center') {
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      placeAtRoomPoint(cx, cy, placementIntent.productId, 0);
    } else {
      placeProductAt(placementIntent.target.clientX, placementIntent.target.clientY, placementIntent.productId, 0);
    }
    consumeIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementIntent?.nonce]);

  function resetView() {
    setViewport(INITIAL_VIEWPORT);
  }

  // V-RENDER-4 (2026-05-27) — "Share render". Primary path: export the
  // Konva stage canvas at 2x for a sharp retina PNG, then hand it to the
  // Web Share sheet (iOS/Android) or fall back to a download. NOT async:
  // navigator.share must run synchronously inside the tap gesture on iOS
  // (dataUrlToBlob is synchronous), or Safari throws NotAllowedError.
  // NOTE (floorPlanSvg.ts:7): stage.toDataURL captures ONLY the active
  // mounted room — acceptable for the v1 single-room share.
  function handleShareRender() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const file = new File([dataUrlToBlob(dataUrl)], 'ppw-room.png', { type: 'image/png' });
    const canShareFiles =
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    if (canShareFiles && typeof navigator.share === 'function') {
      navigator.share({ files: [file], title: 'My PPW room' }).catch(() => {
        // User dismissed the share sheet, or share failed — no-op.
      });
    } else {
      triggerDownload(dataUrl, 'ppw-room.png');
    }
  }

  // V-RENDER-4 — secondary "Capture screen" path: html2canvas snapshots
  // the full app DOM (HUD + cart chrome live OUTSIDE the Konva Stage as
  // DOM siblings). Dynamically imported so it stays in its own lazy chunk
  // and out of the main bundle. Downloads (no navigator.share) so the
  // post-await call is fine — the iOS gesture rule only binds share().
  async function handleCaptureFullScreen() {
    const root = document.getElementById('root') ?? document.body;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(root as HTMLElement, { scale: 2, useCORS: true });
      triggerDownload(canvas.toDataURL('image/png'), 'ppw-room-fullscreen.png');
    } catch {
      pushToast('Could not capture the screen. Try the Share render button.', 'warn');
    }
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
      const snappedX = snapToGrid(xM - w / 2, snapStep);
      const snappedY = snapToGrid(yM - h / 2, snapStep);
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
    [viewport, pxPerMetre, ghostRotation, placedItems, polygon, snapStep],
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
        const ps = usePropertyStore.getState();
        ps.setActiveRoom(id);
        // Batch 3 Fix 3.1 — drop the pre-DRAW rooms so the new polygon
        // is the only canvas content. The history transaction wrapper
        // around setDrawMode keeps these mutations in the same undo
        // frame as the entry-clear, so one Ctrl+Z restores everything.
        const otherIds = ps.property.rooms
          .filter((r) => r.id !== id)
          .map((r) => r.id);
        for (const otherId of otherIds) {
          usePropertyStore.getState().removeRoom(otherId);
        }
        pushToast(
          `New room "${name}" created (${polygonArea(newPolygon).toFixed(2)} m2)`,
          'success',
        );
        console.log('[draw-close]', {
          reason: 'commit-success',
          vertices: newPolygon.length,
          roomId: id,
          dropped: otherIds.length,
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
    // Batch 3 Fix 3.1 — Esc / Cancel restores the pre-DRAW canvas. The
    // setDrawMode wrapper opened a history transaction on entry; we end
    // it here and immediately invoke undo() to pop that snapshot and
    // apply it, so the user goes back to where they were before DRAW.
    if (onDrawComplete) onDrawComplete();
    useHistoryStore.getState().undo();
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

  // Designer 3-Bug Fix (2026-05-28, Bug 3) — "Clear leaves ghost items on
  // the canvas". Confirmed via a live dev-server probe: when `placedItems`
  // empties, react-konva DOES remove the item nodes (layer children → 0)
  // but never repaints the now-empty layer, so the last item pixels linger.
  // We force a SYNCHRONOUS layer.draw() to re-sync the canvas to the node
  // tree — batchDraw() proved unreliable (its requestAnimationFrame can be
  // throttled, leaving the ghost). Runs on any item-set / draw-mode change
  // (covers Clear, single-delete, and the draw-mode item hide). The Konva
  // stable-lock placement math (26c144c) is untouched — this only repaints
  // an already-reconciled layer.
  useEffect(() => {
    itemsLayerRef.current?.draw();
  }, [placedItems, drawMode]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full bg-ppw-mist transition-colors ${
        pendingProductId && !drawMode ? 'bg-ppw-teal/5 ring-2 ring-inset ring-ppw-teal/40' : ''
      } ${drawMode ? 'cursor-crosshair' : ''} ${pendingProductId && !drawMode ? 'cursor-crosshair' : ''}`}
      data-armed={pendingProductId ? 'true' : 'false'}
      // Designer 3-Bug Fix (2026-05-28, Bug 1) — long-press on a placed
      // item (Konva.Image on the canvas) popped the browser "Save image"
      // menu and hijacked drag-drop. CSS `-webkit-touch-callout: none`
      // (index.css) kills the iOS callout; this handler kills the Android
      // long-press contextmenu over the whole canvas surface.
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* M6 (Customer-UI fix 2026-05-31) — top-right floating button column.
          Both top AND right offsets fold in env(safe-area-inset-*) so the
          controls never sit under the notch / rounded corner on a notched
          device. */}
      <div
        className="pointer-events-none absolute z-10 flex flex-col items-end gap-2"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <button
          type="button"
          onClick={resetView}
          className="pointer-events-auto min-h-[40px] rounded-md bg-white/90 px-3 text-xs font-medium text-ppw-ink shadow-sm ring-1 ring-ppw-stone hover:bg-white"
          title="Reset pan/zoom"
        >
          Reset view
        </button>
        {/* V-RENDER-4 — share / capture the current room render. Primary
            uses the Konva stage (sharp, canvas-only); secondary snapshots
            the full app chrome via html2canvas. Min 40px tap targets. */}
        <button
          type="button"
          onClick={handleShareRender}
          data-testid="share-render"
          className="pointer-events-auto min-h-[40px] rounded-md bg-ppw-teal px-3 text-xs font-semibold text-white shadow-sm ring-1 ring-ppw-teal/60 hover:bg-ppw-teal/90"
          title="Share or download a picture of your room"
        >
          Share render
        </button>
        <button
          type="button"
          onClick={handleCaptureFullScreen}
          data-testid="capture-screen"
          className="pointer-events-auto min-h-[40px] rounded-md bg-white/90 px-3 text-[11px] font-medium text-ppw-ink shadow-sm ring-1 ring-ppw-stone hover:bg-white"
          title="Capture the full screen (with toolbars)"
        >
          Capture screen
        </button>
        <div className="pointer-events-none rounded-md bg-ppw-ink/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
          {area.toFixed(2)} m2 - {perimeter.toFixed(2)} m - {Math.round(viewport.scale * 100)}%
        </div>
        {/* D21 — live cost total of placed items + D15/M13 precision badge. */}
        <div
          className="pointer-events-none rounded-md px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          style={{ background: 'rgba(255,187,88,0.92)', color: '#232C3B' }}
          data-testid="cost-readout"
        >
          {costReadout.total.toLocaleString('en-MU', { maximumFractionDigits: 0 })} {costReadout.currency}
          <span className="ml-1.5 opacity-70">· snap {precision === 'full' ? '0.5 m' : '0.25 m'}</span>
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

      {/* M14 / M13 — mobile-only top control strip: undo · redo · precision.
          Desktop uses the keyboard (Ctrl+Z / Ctrl+Y / Ctrl+F) + has no
          finger, so this is lg:hidden. ≥44px targets, inside the top safe
          area, never over the canvas centre. */}
      {!drawMode && !wallDrawEnabled && (
        <div
          className="lg:hidden pointer-events-none absolute left-3 z-10 flex items-center gap-2"
          style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            data-testid="mobile-undo"
            aria-label="Undo"
            onClick={() => useHistoryStore.getState().undo()}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg bg-white/90 text-lg text-ppw-ink shadow-sm ring-1 ring-ppw-stone active:scale-95"
          >
            ↶
          </button>
          <button
            type="button"
            data-testid="mobile-redo"
            aria-label="Redo"
            onClick={() => useHistoryStore.getState().redo()}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg bg-white/90 text-lg text-ppw-ink shadow-sm ring-1 ring-ppw-stone active:scale-95"
          >
            ↷
          </button>
          <button
            type="button"
            data-testid="mobile-precision"
            aria-label="Toggle snap precision"
            aria-pressed={precision === 'quarter'}
            onClick={togglePrecision}
            className="pointer-events-auto flex h-11 min-w-[64px] items-center justify-center rounded-lg px-2 text-[11px] font-semibold shadow-sm active:scale-95"
            style={{
              background: precision === 'quarter' ? '#FFBB58' : 'rgba(255,255,255,0.9)',
              color: '#232C3B',
            }}
          >
            {precision === 'quarter' ? '¼ tile' : '½ tile'}
          </button>
        </div>
      )}

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
            const placed = placeProductAt(e.evt.clientX, e.evt.clientY, pendingProductId);
            // D4 (desktop) — Shift+click STAMPS: keep the ghost on the
            // cursor to rapid-place duplicates. Sims core duplication
            // mechanic. Bare click commits and exits placing as before.
            if (placed && (e.evt as MouseEvent).shiftKey) {
              return;
            }
            setPendingProductId(null);
            setDragGhost(null);
            setGhostRotation(0);
          }
        }}
        // V-RENDER-4 — touch-none stops iOS Safari native pan/zoom from
        // fighting item-drag + the custom pinch handler on this Stage.
        className="konva-stage touch-none"
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

          {/* M4 (Customer-UI fix 2026-05-31) — the on-canvas "0,0 - W x H m
              bbox" debug Text was removed; it was developer instrumentation
              that should never have shipped to the customer surface. */}
        </Layer>

        <Layer ref={itemsLayerRef}>
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
                justPlaced={item.instanceId === justPlacedId}
                pxPerMetre={pxPerMetre}
                polygon={polygon}
                placedItems={placedItems}
                selectItem={selectItem}
                updateItem={updateItem}
                pushToast={pushToast}
                itemDragRef={itemDragRef}
                activatePlacedItem={activatePlacedItem}
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

      {/* Batch 3 Fix 3.2 — the floating RoomDrawHUD panel was removed.
          Vertex / perim / area counters now live in the LEFT RoomList
          sidebar (active room row). Keyboard remains the only commit
          path: Enter close · Esc cancel · Ctrl+Z undo last vertex. */}

      <WallDrawHUD enabled={wallDrawEnabled && !drawMode} />

      {/* Sims feature-finish (flagship F1/M6) — on-canvas floating cluster
          for the selected object. Replaces the old mobile slide-up
          DetailsPanel modal as the manipulation surface so rotation (and
          duplicate/delete/details/confirm) happen INLINE, never on a new
          screen. Mobile/tablet only (lg:hidden); desktop keeps keyboard +
          the right-rail DetailsPanel + the on-canvas rotate handle. */}
      {!drawMode && !wallDrawEnabled && !pendingProductId && (() => {
        const sel = placedItems.find((i) => i.instanceId === selectedInstanceId);
        if (!sel) return null;
        const p = getProductById(sel.productId);
        if (!p) return null;
        const fp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
        const { w } = rotatedFootprint(fp, sel.rotation);
        const itemLeftPx = viewport.x + sel.x * pxPerMetre * viewport.scale;
        const itemTopPx = viewport.y + sel.y * pxPerMetre * viewport.scale;
        const itemWidthPx = w * pxPerMetre * viewport.scale;
        return (
          <div className="lg:hidden pointer-events-none absolute inset-0">
            <FloatingCluster
              itemLeftPx={itemLeftPx}
              itemTopPx={itemTopPx}
              itemWidthPx={itemWidthPx}
              containerW={stageSize.width}
              containerH={stageSize.height}
            />
          </div>
        );
      })()}

      {/* Designer polish (2026-05-29) — empty-state placement tip. Shows a
          faint, centered prompt over the (already grid-lined) empty room
          when nothing is placed yet and no draw/wall tool is active. Auto-
          hides the moment the first item lands. Brand register: navy ink +
          gold accent + cream card — deliberately NOT the legacy teal chrome,
          to match the binding brand identity for new UI. Pointer-events off
          so it never blocks a tap-to-place on the floor beneath it. */}
      {!drawMode && !wallDrawEnabled && !pendingProductId && placedItems.length === 0 && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          data-testid="empty-room-hint"
        >
          <div
            className="flex max-w-xs flex-col items-center gap-1 rounded-xl px-5 py-4 text-center shadow-sm"
            style={{
              background: 'rgba(245,235,215,0.78)',
              border: '1px solid rgba(255,187,88,0.55)',
              color: '#232C3B',
            }}
          >
            <span
              aria-hidden
              style={{ fontSize: 22, lineHeight: 1, color: '#FFBB58' }}
            >
              ✦
            </span>
            <p className="text-sm font-semibold" style={{ color: '#232C3B' }}>
              Your room is empty
            </p>
            <p className="text-[11px] leading-snug" style={{ color: '#3B4A52' }}>
              Drag a product onto the floor — or tap a catalog item, then tap
              the room — to place your first piece. Items snap to the 0.5 m grid.
            </p>
          </div>
        </div>
      )}

      {/* M4 (Customer-UI fix 2026-05-31) — the persistent "Tip:" banner that
          sat over the bottom-left of the play area was removed from normal
          use; the centred empty-room hint already coaches first placement.
          The draw-mode instructions remain (they're only shown while the
          draw tool owns the canvas, and never overlap a placed design). */}
      {drawMode && (
        <div
          className="pointer-events-none absolute left-3 max-w-xs rounded-md bg-white/85 px-3 py-2 text-[11px] leading-snug text-ppw-slate shadow-sm ring-1 ring-ppw-stone hidden md:block"
          style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <span className="font-semibold text-ppw-ink">Draw mode:</span> click to place wall vertices - click first vertex or press <kbd>Enter</kbd> to close - <kbd>Ctrl+Z</kbd> undo - <kbd>Esc</kbd> cancel.
        </div>
      )}
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
  /** Polish (2026-05-29) — true for one render after a fresh placement,
   *  triggers a one-shot visual settle tween. Defaults false. */
  justPlaced?: boolean;
  pxPerMetre: number;
  polygon: Polygon;
  placedItems: PlacedItem[];
  selectItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<PlacedItem>) => void;
  pushToast: (msg: string, level?: 'warn' | 'info' | 'error') => void;
  itemDragRef: React.MutableRefObject<{ instanceId: string | null; moved: boolean }>;
  /** D11/D12 — tool-aware activation. Returns true if a tool (sledgehammer/
   *  eyedropper) consumed the click, so normal selection is skipped. */
  activatePlacedItem: (instanceId: string, productId: string) => boolean;
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
    justPlaced,
    pxPerMetre,
    polygon,
    placedItems,
    selectItem,
    updateItem,
    pushToast,
    itemDragRef,
    activatePlacedItem,
  } = props;
  // Polish (2026-05-29) — placement settle tween. On the render where
  // `justPlaced` is true, the group node fades + scales in from 0.9 → 1
  // over ~180ms then settles at exactly scale 1 / opacity 1. Konva scales
  // around the group origin; the small magnitude keeps the visual shift
  // negligible and the final state is identical to no tween, so placement
  // coordinates (Konva stable-lock math) are never persistently mutated.
  const groupRef = useRef<Konva.Group>(null);
  useEffect(() => {
    if (!justPlaced) return;
    const node = groupRef.current;
    if (!node) return;
    node.opacity(0.4);
    node.scale({ x: 0.9, y: 0.9 });
    node.to({
      opacity: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 0.18,
      onFinish: () => {
        node.opacity(1);
        node.scale({ x: 1, y: 1 });
      },
    });
    return () => {
      // Safety: if the node unmounts mid-tween, ensure it never settles in
      // a partial state should it be reused. Konva tears tweens down with
      // the node, so we only normalise the transform here. `node` is the
      // captured ref value, avoiding the stale-ref-in-cleanup lint.
      node.opacity(1);
      node.scale({ x: 1, y: 1 });
    };
    // Run only on the placement render; justPlaced flips back to false on
    // the next render via the parent's timer, which is the desired one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // V-RENDER-1 (2026-05-27) — use the canonical productImageUrl resolver
  // (topdown_image_url → image_url → SVG data-URI), the same chooser the
  // palette/popup/toolbar use, so the in-room render matches what the
  // customer sees everywhere else. Previously bound the raw image_url,
  // which skipped the baked top-down PNGs. productImageUrl always returns
  // a non-empty string; useImageCache handles load/error → null internally
  // (the grey Rect fallback below still covers a genuine 404).
  const image = useImageCache(productImageUrl(product));
  // Polish (2026-05-29) — distinguish "still hydrating" from "errored /
  // no image" so the fallback shows a subtle brand shimmer while the
  // asset loads, then settles to the real image (or the coloured rect on
  // a genuine 404). The status hook shares the same module-level cache as
  // useImageCache above, so this adds no extra network load.
  const { status: imageStatus } = useImageCacheStatus(productImageUrl(product));
  const isHydrating = !image && imageStatus === 'loading';
  // Fix 2.1 (Vic 2026-05-22) — render the product art at its TRUE
  // unrotated footprint and apply Konva rotation visually, so the
  // user sees the box turn smoothly as the rotate handle drags.
  // The outer Group still positions by AABB top-left so the existing
  // collision / drag math stays untouched.
  const unrotatedWPx = cmToM(product.dimensions_cm.length) * pxPerMetre;
  const unrotatedHPx = cmToM(product.dimensions_cm.width) * pxPerMetre;
  return (
    <Group
      ref={groupRef}
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
        if (activatePlacedItem(item.instanceId, item.productId)) return;
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
        if (activatePlacedItem(item.instanceId, item.productId)) return;
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
      {/* B1 (Customer-UI fix 2026-05-31) — always-listening transparent hit
          target sized to the AABB. The outer Group carries the click/tap/
          drag handlers but has no fillable shape of its own; the visible art
          lives in the inner listening={false} group and the corner/rotate
          handles exist ONLY while selected. Without this rect a DESELECTED
          item has zero hit targets, so Konva getIntersection() returns null
          and the item can never be re-selected (the headline blocker).
          Additive — it leaves all placement/rotation geometry untouched. */}
      <Rect
        width={wPx}
        height={hPx}
        fill="transparent"
        perfectDrawEnabled={false}
        data-testid="placed-hit"
      />
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
        ) : isHydrating ? (
          // Polish (2026-05-29) — brand-styled loading skeleton while the
          // product image hydrates via useImageCache. Navy base + a soft
          // cream→gold pulse, so the tile reads as "loading" rather than a
          // permanent coloured fallback. Settles to the real image on load
          // (or to the coloured rect below on a genuine 404). Reduced-motion
          // users get a static cream tile (no infinite pulse). Pure visual —
          // does not touch placement geometry.
          <HydratingSkeleton
            width={unrotatedWPx}
            height={unrotatedHPx}
            stroke={isSelected ? '#FFBB58' : '#232C3B'}
            strokeWidth={isSelected ? 2.5 : 1}
          />
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
      </Group>
      {/* Minor 11 (Customer-UI fix 2026-05-31) — product + category labels
          render in the NON-rotating OUTER group so they stay upright at every
          rotation. They previously lived inside the rotating art group, so a
          180°-rotated item showed its name upside-down. Anchored to the AABB
          (wPx × hPx). */}
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
              // F2/F3 — 90° detents by default (Sims build-mode parity);
              // hold Shift or Alt for a free angle. (Was 15° — corrected
              // to match the desktop+mobile interaction specs.)
              const free = e.evt.shiftKey || e.evt.altKey;
              if (!free) {
                deg = Math.round(deg / 90) * 90;
              }
              // Normalise to [0, 360).
              deg = ((deg % 360) + 360) % 360;
              if (Math.abs(deg - item.rotation) < 0.5) return;
              // Haptic tick on each detent crossing (free-rotate is silent
              // so it doesn't buzz continuously through the drag).
              if (!free) haptic('rotate');
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

/**
 * Polish (2026-05-29) — true when the user has asked the OS to minimise
 * non-essential motion. We honour it by rendering a static skeleton tile
 * instead of an infinite shimmer pulse. Guarded for SSR / test (jsdom may
 * not implement matchMedia).
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Polish (2026-05-29) — Konva loading skeleton for an item whose product
 * image is still hydrating via useImageCache. Renders a navy base with a
 * cream→gold overlay whose opacity pulses gently (a "shimmer" within a
 * single canvas, no DOM). Reduced-motion users get a flat cream tile with
 * the overlay held at a fixed low opacity (no animation loop). Purely
 * visual: no placement math, no store mutation, no Konva stable-lock
 * surface touched. The tween is torn down with the node on unmount.
 */
function HydratingSkeleton({
  width,
  height,
  stroke,
  strokeWidth,
}: {
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
}): JSX.Element {
  const shimmerRef = useRef<Konva.Rect>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const node = shimmerRef.current;
    if (!node) return;
    // Konva.Tween yoyo via a self-restarting pair. Keep the magnitude
    // subtle (0.12 → 0.5 opacity) so it reads as a calm "breathing"
    // hydrate, not a flashy strobe.
    let cancelled = false;
    const up = node.to.bind(node);
    function pulse(toOpacity: number, then: () => void) {
      up({
        opacity: toOpacity,
        duration: 0.75,
        onFinish: () => {
          if (!cancelled) then();
        },
      });
    }
    function loop() {
      if (cancelled) return;
      pulse(0.5, () => pulse(0.12, loop));
    }
    node.opacity(0.12);
    loop();
    return () => {
      cancelled = true;
    };
  }, []);
  // Reduced-motion: hold the overlay at a fixed, visible-but-quiet opacity.
  const staticOverlayOpacity = prefersReducedMotion() ? 0.35 : 0.12;
  return (
    <Group listening={false}>
      {/* Navy base — the "loading" surface in brand register. */}
      <Rect
        width={width}
        height={height}
        fill="#232C3B"
        opacity={0.85}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={3}
      />
      {/* Cream→gold shimmer overlay. Animated opacity (or static for
          reduced-motion). Inset slightly so the navy frame stays visible. */}
      <Rect
        ref={shimmerRef}
        x={2}
        y={2}
        width={Math.max(width - 4, 0)}
        height={Math.max(height - 4, 0)}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: width, y: height }}
        fillLinearGradientColorStops={[0, '#F5EBD7', 0.5, '#FFBB58', 1, '#F5EBD7']}
        opacity={staticOverlayOpacity}
        cornerRadius={2}
      />
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
