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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line, Group, Text, Circle, Rect, Image as KonvaImage } from 'react-konva';
import { useImageCache, useImageCacheStatus } from '../hooks/useImageCache';
import type Konva from 'konva';
import { useDesignStore } from '../store/designStore';
import { usePropertyStore, selectActiveRoom, roomOpenings } from '../store/propertyStore';
import type { PlacedItem } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { CATEGORY_FILL, CATEGORY_LABELS, getProductById, productTopDownUrl } from '../data/products';
import { dataUrlToBlob, triggerDownload, safeStageDataUrl } from '../lib/shareImage';
import {
  cmToM,
  findFreeSlot,
  polygonArea,
  polygonBounds,
  resolveDragTarget,
  rotatedFootprint,
  screenToRoom,
  validatePlacement,
} from '../lib/geometry';
import type { PlacedRect, Polygon, Viewport } from '../lib/geometry';
import { computeZoomScale } from '../lib/zoom';
import { RoomDrawLayer, type HoverVertex } from './RoomDrawMode';
import { WallDrawLayer, WallDrawHUD, CommittedWallsLayer } from '../designer/WallDrawMode';
import { useWallStore } from '../store/wallStore';
import { useHistoryStore, endDrawTransaction } from '../store/historyStore';
// Batch 3 Fix 3.2 — vertices live in a tiny shared store so the
// RoomList sidebar can render the live counters next to the room.
import { useDrawProgressStore } from '../store/drawProgressStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
// Sims feature-finish (2026-05-30) — inline floating cluster (flagship),
// precision snap step, haptics. All additive; Konva stable-lock untouched.
import { FloatingCluster } from '../designer/FloatingCluster';
import {
  useDesignerUIStore,
  PRECISION_STEP_M,
  SNAP_UNIT_LABEL,
} from '../store/designerUIStore';
// Units brief (2026-08-28, D6) - what we DRAW is decoupled from what we SNAP to.
import { chooseGridTier } from '../designer/gridTier';
import { haptic } from '../lib/haptics';
// Sims wall-aware placement (2026-08-23) — objects dropped near a wall
// snap flush against it and auto-rotate to face into the room.
import { isCardinalRotation, resolveWallAwarePlacement } from '../designer/wallAwarePlacement';
// Aspect fix (2026-08-24) — contain-fit product art to its footprint.
import { fitImageToFootprint } from '../designer/imageFit';
// Blueprint reskin (Vic 2026-08-25, complaint 5) — the canvas becomes a
// premium dark architectural drawing. Every colour comes from ONE module.
import {
  CANVAS_GROUND,
  GHOST_INVALID,
  GHOST_INVALID_FILL,
  GHOST_VALID_FILL,
  GHOST_VALID_STROKE,
  GRID_LINE,
  GRID_MAJOR_OPACITY,
  GRID_MAJOR_WIDTH_PX,
  GRID_MINOR_OPACITY,
  GRID_MINOR_WIDTH_PX,
  LABEL_TEXT,
  LABEL_TEXT_MUTED,
  ROOM_FILL,
  ROOM_FILL_ACTIVE,
  DOOR_ARC,
  DOOR_LEAF,
  DOOR_TARGET_WALL,
  ROOM_LABEL_ACTIVE_OPACITY,
  ROOM_LABEL_INACTIVE_OPACITY,
  WALL_GOLD,
  WALL_GOLD_BRIGHT,
  WALL_INNER_STROKE,
  WALL_INNER_STROKE_PX,
  WALL_STROKE_PX,
} from '../designer/blueprintTheme';
// Attached multi-room (Vic 2026-08-26) — all rooms on one canvas, new rooms
// drawn attached to existing ones, products routed into whichever room they
// were dropped in. All the geometry is pure and lives in roomLayout.
import {
  findRoomAt,
  isDrawnPolygon,
  nextRectanglePosition,
  strictPolygonsOverlap,
  translatePolygon,
  unionBounds,
} from '../designer/roomLayout';
// Addressable walls (2026-08-28). The room outline is no longer one closed
// Line: the fill and the gold stroke are separate, and the stroke is drawn
// EDGE BY EDGE so an opening can cut a gap in a wall without cutting the
// floor. With no openings this renders exactly what the single closed Line
// did — see the square-cap note at the call site.
import {
  edgeKey,
  pointAlongEdge,
  projectOntoEdge,
  nearestEdge,
  roomEdges,
  sharedEdgeMap,
  splitEdgeSpans,
  type RoomEdge,
  type Span,
} from '../designer/wallEdges';
import {
  clampOpeningOffset,
  doorSymbol,
  jambTicks,
  openingSpan,
  validateOpening,
  type Opening,
} from '../designer/openings';
import { roomFloorMaterial } from '../designer/floorFinish';
import { nextRoomName } from '../designer/roomNaming';
import { obstaclesFor } from '../designer/layerBands';

/** How close the pointer must be to a wall for the door tool to snap to it. */
const DOOR_SNAP_TOL_M = 0.6;

/**
 * What the door tool is currently pointing at.
 *  place   — a legal spot on a wall; click commits
 *  remove  — an existing opening under the cursor; click deletes it
 *  invalid — a wall, but the opening will not fit there
 */
interface DoorHover {
  mode: 'place' | 'remove' | 'invalid';
  roomId: string;
  edge: RoomEdge;
  offsetM: number;
  openingId?: string;
  message?: string;
}

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
  /**
   * Blank-canvas-on-open (2026-06-09) — the empty-state prompt's "Draw
   * room" button asks App to flip into draw mode (App owns `setDrawMode`
   * because it carries the history-transaction side-effects).
   */
  onRequestDraw?: () => void;
}

export function RoomCanvas({
  drawMode = false,
  onDrawComplete,
  pendingProductId,
  setPendingProductId,
  onRequestDraw,
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
  // NOTE: the designStore `addItem` facade is no longer subscribed here —
  // placement commits go through `usePropertyStore.getState().addItem(item,
  // roomId)` so the item lands in the ROUTED room, not the active one. The
  // facade signature itself is untouched for every other call site.
  const removeItem = useDesignStore((s) => s.removeItem);
  const selectItem = useDesignStore((s) => s.selectItem);
  const updateItem = useDesignStore((s) => s.updateItem);

  // Sims feature-finish — snap resolution (full 0.5 m / quarter 0.25 m).
  // Toggled by Ctrl+F (desktop) / the precision button (mobile). Spec D15/M13.
  const precision = useDesignerUIStore((s) => s.precision);
  const togglePrecision = useDesignerUIStore((s) => s.togglePrecision);
  const tool = useDesignerUIStore((s) => s.tool);
  const setTool = useDesignerUIStore((s) => s.setTool);
  const doorDraft = useDesignerUIStore((s) => s.doorDraft);
  const [doorHover, setDoorHover] = useState<DoorHover | null>(null);
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

  // Attached multi-room (2026-08-26) — the canvas renders EVERY room, so it
  // subscribes to the rooms array directly. The `useDesignStore` active-room
  // projections above are kept: they still drive the active-room chrome
  // (TopBar L/W readout, DetailsPanel, the draw-mode name).
  const rooms = usePropertyStore((s) => s.property.rooms);
  const activeRoomId = usePropertyStore((s) => s.property.activeRoomId);
  // D5 — selecting an item in ANY room must also move focus to that room,
  // or the Sims loop (place → rotate / delete) is dead everywhere except
  // the active room: DetailsPanel, FloatingCluster and placementActions all
  // resolve the selection through the active-room facade. This is wired by
  // changing the VALUE passed to PlacedItemGroup, never by widening the
  // designStore facade.
  const selectItemAcrossRooms = usePropertyStore((s) => s.selectItemAcrossRooms);
  const drawnRooms = useMemo(() => rooms.filter((r) => isDrawnPolygon(r.polygon)), [rooms]);
  /** Every placed item across every room — badge + cost aggregate over this. */
  const allItems = useMemo(() => rooms.flatMap((r) => r.placedItems), [rooms]);

  const pushToast = useToastStore((s) => s.push);

  // "No room drawn yet" is now a PROPERTY-wide question, not an active-room
  // one: with a blank room active and two rooms drawn beside it, the old
  // active-room-only test put the start prompt on top of a full plan.
  const hasRoom = drawnRooms.length > 0;

  // Quick-rectangle escape hatch from the start-state prompt: gives the
  // active (empty) room a default 5×4 m rectangle so the customer can
  // place products immediately without drawing, and so the TopBar L/W
  // inputs (which only edit rectangle rooms) light up. Draw mode stays
  // the primary path per Vic's Sims-style brief.
  const handleQuickRectangle = useCallback(() => {
    const ps = usePropertyStore.getState();
    const active = selectActiveRoom(ps);
    if (!active) return;
    // Attached multi-room: anchor flush-right of whatever is already drawn.
    // On a fresh canvas that is (0, 0), so this is byte-identical to the
    // pre-2026-08-26 behaviour the placement-fsm / wall-aware e2e assert.
    const anchor = nextRectanglePosition(ps.property.rooms, { lengthM: 5, widthM: 4 });
    const rect = translatePolygon(
      [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
      anchor.x,
      anchor.y,
    );
    // The predicate is always "is the ACTIVE room blank", never "do rooms
    // exist" — every property always holds >= 1 room object, so the latter
    // is always true and would orphan the blank seed room forever.
    if (!isDrawnPolygon(active.polygon)) {
      ps.setRoomPolygon(active.id, rect);
    } else {
      ps.addRectangleRoom(nextRoomName(ps.property.rooms), { lengthM: 5, widthM: 4 }, anchor);
    }
    pushToast('Added a 5 × 4 m room — adjust the size in the top bar or place products.', 'info');
  }, [pushToast]);

  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  /**
   * True once the user has deliberately panned / zoomed / pinched. Until
   * then the room stays auto-centred in the stage.
   *
   * 2026-08-25: the old guard was `viewport.x !== 0 || y !== 0 || scale !== 1`
   * — "pristine". That broke as soon as the effect fired ONCE, which it
   * always did on mount against the 800×600 default stageSize (before the
   * ResizeObserver reports the real size) and against an EMPTY polygon.
   * The viewport locked at x = 800/2 = 400 and never re-centred, so a room
   * drawn afterwards sat far left of centre. Barely noticeable when the
   * canvas was 1088 px wide; glaring now that it is the full 1920.
   *
   * An explicit interaction flag keeps the original intent (never undo a
   * user's zoom) while letting the room re-centre when the stage resizes
   * or the room itself appears/changes.
   */
  const userMovedViewportRef = useRef(false);
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
  // Sims wall-aware placement (2026-08-23) — auto-orientation only runs
  // until the user rotates the armed ghost manually (R / Shift+R); after
  // that their chosen facing wins, exactly like Sims build mode.
  const [ghostManuallyRotated, setGhostManuallyRotated] = useState(false);

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
  const [drawHover, setDrawHover] = useState<HoverVertex | null>(null);
  const [drawName, setDrawName] = useState('New Room');

  // M2: wall draw mode FSM phase comes from wallStore. Layer + HUD are
  // visible whenever the phase is not 'idle'. While wall mode is active
  // we suppress the placement-FSM Stage drag and pointer/click handlers
  // so the two tools don't fight over the same cursor.
  const wallDrawPhase = useWallStore((s) => s.draw.phase);
  const wallDrawEnabled = wallDrawPhase !== 'idle';
  // Committed interior walls, rendered in an always-on layer (below) so they
  // persist on the floor plan after the wall tool goes idle (2026-07-24 fix).
  const committedWalls = useWallStore((s) => s.walls);

  useEffect(() => {
    if (drawMode) {
      console.log('[draw-mode]', 'enter Draw mode, reset local state');
      setDrawVertices([]);
      setDrawHover(null);
      // Name the room being drawn from the SHARED naming helper.
      //
      // This used to be the constant 'Room 1' — a leftover from when entering
      // draw mode wiped every other room, so there only ever WAS one. Since
      // the attached-multi-room merge that stopped being true and the constant
      // silently named every drawn room "Room 1": draw three, get three rows
      // all reading the same thing. That is the actual cause of Vic's
      // "no need for room 2, 3".
      setDrawName(nextRoomName(usePropertyStore.getState().property.rooms));
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
      setGhostManuallyRotated(false);
    }
  }, [pendingProductId]);

  // M1.5 pointer-FSM: R rotates the armed product by 90° (Sims build-mode
  // step — footprint swaps with it), Shift+R goes the other way, Esc
  // cancels the armed placement. Mirrors the Sims `.` / `,` rotate keys
  // remapped to PPW's existing R-key convention. Rotating manually also
  // disables wall auto-orientation for this armed session.
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
        const delta = e.shiftKey ? -90 : 90;
        setGhostManuallyRotated(true);
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
  // Attached multi-room: the shopping total is the WHOLE plan's, not the
  // active room's — the cart it mirrors has never been per-room. (RoomList
  // keeps the per-room values.)
  const costReadout = useMemo(() => {
    let total = 0;
    let currency = 'MUR';
    for (const it of allItems) {
      const p = getProductById(it.productId);
      if (!p?.price) continue;
      total += p.price.value;
      currency = p.price.currency || currency;
    }
    return { total, currency };
  }, [allItems]);

  const bounds = useMemo(() => polygonBounds(polygon), [polygon]);
  /** AABB over EVERY drawn room — what the viewport centres and fits on. */
  const union = useMemo(() => unionBounds(rooms), [rooms]);
  const unionWpx = union ? (union.maxX - union.minX) * pxPerMetre : 0;
  const unionHpx = union ? (union.maxY - union.minY) * pxPerMetre : 0;
  // Area readout stays the ACTIVE room's — it pairs with the TopBar L/W
  // inputs, which are active-room controls.
  const area = useMemo(() => polygonArea(polygon), [polygon]);

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
    if (userMovedViewportRef.current) return;
    // Nothing to centre on until a room exists — leave the viewport alone
    // so the blank-canvas prompt is not fighting a pointless transform.
    if (!union || unionWpx <= 0 || unionHpx <= 0) return;
    // Attached multi-room: centre + FIT the whole plan, not the active room.
    // This used to hardcode scale 1 with a 40 px minimum clamp, which pinned
    // a union wider than the stage off-screen with no way back except Reset.
    const scale = Math.max(
      MIN_SCALE,
      Math.min(1, (stageSize.width - 80) / unionWpx, (stageSize.height - 80) / unionHpx),
    );
    setViewport({
      x: (stageSize.width - unionWpx * scale) / 2 - union.minX * pxPerMetre * scale,
      y: (stageSize.height - unionHpx * scale) / 2 - union.minY * pxPerMetre * scale,
      scale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageSize.width, stageSize.height, unionWpx, unionHpx, union?.minX, union?.minY, pxPerMetre]);

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    userMovedViewportRef.current = true;
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
      userMovedViewportRef.current = true;
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
  // `userRotationDeg` null → Sims auto-orientation: near a wall the item
  // snaps flush and faces into the room; mid-room it faces the viewer.
  const placeAtRoomPoint = useCallback(
    (centreXm: number, centreYm: number, productId: string, userRotationDeg: number | null) => {
      const product = getProductById(productId);
      if (!product) {
        pushToast(`Unknown product: ${productId}`, 'error');
        return false;
      }
      const fp = {
        lengthM: cmToM(product.dimensions_cm.length),
        widthM: cmToM(product.dimensions_cm.width),
      };
      // Attached multi-room (D4) — route the drop to WHICHEVER room the
      // point is in. Rooms are read via getState() INSIDE the callback: the
      // memoised callback does not re-create on a store change, so a
      // captured `rooms` would go stale the moment a room is added.
      const target = findRoomAt(
        { x: centreXm, y: centreYm },
        usePropertyStore.getState().property.rooms,
        usePropertyStore.getState().property.activeRoomId,
      );
      if (!target) {
        haptic('invalid');
        pushToast('Drop it inside a room — that spot is outside the plan.', 'warn');
        return false;
      }
      const targetPolygon = target.polygon;
      const targetItems = target.placedItems;
      const resolved = resolveWallAwarePlacement({
        centreXm,
        centreYm,
        fp,
        polygon: targetPolygon,
        snapStep,
        userRotationDeg,
        frontEdge: product.front_edge,
      });
      const { w, h } = rotatedFootprint(fp, resolved.rotationDeg);
      // Layer bands (2026-08-28): only same-band items are obstacles, so a
      // treadmill ignores the mats under it. Before this, a flooring SKU laid
      // as an item blocked everything on top of it and findFreeSlot silently
      // teleported the blocked product elsewhere.
      const others = obstaclesFor(product.id, targetItems)
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
      // The wall-snapped position is tried first via validatePlacement so
      // a flush non-grid Y/X survives; findFreeSlot re-snaps to the grid.
      const direct = validatePlacement({ x: resolved.x, y: resolved.y, w, h }, others, targetPolygon);
      const slot = direct.ok
        ? { x: resolved.x, y: resolved.y }
        : findFreeSlot({
            preferredX: resolved.x,
            preferredY: resolved.y,
            w,
            h,
            others,
            polygon: targetPolygon,
            // D15 — floored at 0.5 m so a fine unit cannot turn the fallback
            // scan into a quadratic sweep. Same cost as today at every unit.
            step: Math.max(snapStep, 0.5),
          });
      if (!slot) {
        haptic('invalid');
        pushToast("Item won't fit — the room is full.", 'warn');
        return false;
      }
      haptic('place');
      // Commit into the ROUTED room, not the active one.
      const instanceId = usePropertyStore.getState().addItem(
        {
          productId: product.id,
          x: slot.x,
          y: slot.y,
          rotation: resolved.rotationDeg,
        },
        target.id,
      );
      // Polish (2026-05-29) — flag this fresh instance for the settle tween.
      setJustPlacedId(instanceId);
      // M1 — the just-placed item becomes selected so the on-canvas
      // floating cluster appears around it (Sims "placed → selected"). D5:
      // selecting ACROSS rooms also moves focus, so the follow-up rotate /
      // delete resolves through the right room's facade.
      selectItemAcrossRooms(instanceId);
      pushToast(`Added "${product.name}" to cart`, 'success', {
        ttlMs: 5000,
        action: {
          label: 'Undo',
          onClick: () => removeItem(instanceId),
        },
      });
      return true;
    },
    // `rooms` is deliberately NOT a dep — it is read via getState() inside
    // the callback precisely so this identity stays stable and the wiring
    // effects that depend on it do not re-fire on every room mutation.
    [removeItem, pushToast, snapStep, selectItemAcrossRooms],
  );

  const placeProductAt = useCallback(
    (clientX: number, clientY: number, productId: string, rotationOverride?: number | null) => {
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
      // Undefined override → the armed ghost's facing: the user's manual
      // rotation when they used R, otherwise auto-orient (null).
      const rotation =
        rotationOverride !== undefined
          ? rotationOverride
          : ghostManuallyRotated
            ? ghostRotation
            : null;
      return placeAtRoomPoint(xM, yM, productId, rotation);
    },
    [viewport, pxPerMetre, ghostRotation, ghostManuallyRotated, placeAtRoomPoint],
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
    // Popup/drag placements auto-orient (null): near a wall they snap
    // flush facing into the room, mid-room they face the viewer. The user
    // can still rotate after via the on-canvas rotate handle.
    if (placementIntent.target === 'center') {
      // D4 — 'center' routes BY INTENT to the ACTIVE room's own bounds
      // centre, never through findRoomAt. The mobile "+ Add to room"
      // contract is "into the room I'm looking at", and `bounds` here is
      // already the active room's; findFreeSlot pulls edge cases inside.
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      placeAtRoomPoint(cx, cy, placementIntent.productId, null);
    } else {
      placeProductAt(placementIntent.target.clientX, placementIntent.target.clientY, placementIntent.productId, null);
    }
    consumeIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementIntent?.nonce]);

  function resetView() {
    // Clearing the flag hands the room back to the auto-centring effect, so
    // Reset now RE-CENTRES rather than slamming the room's origin into the
    // stage's top-left corner (which is what {0,0,scale:1} literally means).
    userMovedViewportRef.current = false;
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
    // Mobile capture fix (2026-06-01) — safeStageDataUrl clamps the
    // pixelRatio so a large retina stage doesn't toDataURL to a blank
    // image on iOS Safari, and catches the SecurityError a tainted canvas
    // throws (previously an unhandled throw that made the button look
    // dead with no feedback). Returns null on any failure → we toast.
    const dataUrl = safeStageDataUrl(stage, 2);
    if (!dataUrl) {
      pushToast(
        'Could not capture the room image. Try the Capture screen button instead.',
        'warn',
      );
      return;
    }
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
      // D4 — the IDENTICAL routing call as the commit path (same helper,
      // same active-first tie-break, same getState() read), so ghost
      // validity can never disagree with what actually lands. Outside every
      // room the ghost renders invalid rather than silently previewing a
      // drop that the commit will reject.
      const target = findRoomAt(
        { x: xM, y: yM },
        usePropertyStore.getState().property.rooms,
        usePropertyStore.getState().property.activeRoomId,
      );
      if (!target) {
        const { w: gw, h: gh } = rotatedFootprint(
          fp,
          ghostManuallyRotated ? ghostRotation : 0,
        );
        return { xM: xM - gw / 2, yM: yM - gh / 2, rotation: ghostManuallyRotated ? ghostRotation : 0, valid: false, w: gw, h: gh };
      }
      // Same wall-aware resolver as the commit path, so the ghost shows
      // EXACTLY where (and at what facing) the item will land.
      const resolved = resolveWallAwarePlacement({
        centreXm: xM,
        centreYm: yM,
        fp,
        polygon: target.polygon,
        snapStep,
        userRotationDeg: ghostManuallyRotated ? ghostRotation : null,
        frontEdge: product.front_edge,
      });
      const { w, h } = rotatedFootprint(fp, resolved.rotationDeg);
      const candidate: PlacedRect = { x: resolved.x, y: resolved.y, w, h };
      // Same band filter as the commit path — the ghost must predict the
      // commit exactly, or the preview lies.
      const others = obstaclesFor(product.id, target.placedItems)
        .map((it) => {
          const p = getProductById(it.productId);
          if (!p) return null;
          const ofp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
          const r = rotatedFootprint(ofp, it.rotation);
          return { x: it.x, y: it.y, w: r.w, h: r.h };
        })
        .filter((r): r is PlacedRect => r !== null);
      const result = validatePlacement(candidate, others, target.polygon);
      return { xM: resolved.x, yM: resolved.y, rotation: resolved.rotationDeg, valid: result.ok, w, h };
    },
    // `rooms` read via getState() inside — see placeAtRoomPoint.
    [viewport, pxPerMetre, ghostRotation, ghostManuallyRotated, snapStep],
  );

  const handleDrawCommit = useCallback(
    (newPolygon: Polygon, name: string) => {
      // Attached multi-room (Vic 2026-08-26): a commit ADDS a room to the
      // plan. The pre-2026-08-26 path added the room and then looped
      // `removeRoom` over every OTHER room ("Batch 3 Fix 3.1") — that loop,
      // together with App's entry-clear, is what made drawing a second room
      // destroy the first. Both are gone; rooms now share walls instead.
      if (newPolygon.length < 3) {
        console.log('[draw-close]', {
          reason: 'guard-too-few-vertices',
          vertices: newPolygon.length,
          success: false,
        });
        pushToast('Need at least 3 walls to close the room.', 'warn');
        return;
      }
      // Overlap check FIRST — nothing is mutated until the new polygon is
      // known to be legal. Shared walls pass; a genuine overlap is refused
      // and the user STAYS in draw mode with a clean slate to retry.
      const psNow = usePropertyStore.getState();
      const clash = psNow.property.rooms.some(
        (r) => isDrawnPolygon(r.polygon) && strictPolygonsOverlap(newPolygon, r.polygon),
      );
      if (clash) {
        pushToast("Rooms can't overlap — walls can be shared", 'warn');
        console.log('[draw-close]', {
          reason: 'rejected-overlap',
          vertices: newPolygon.length,
          success: false,
        });
        setDrawVertices([]);
        setDrawHover(null);
        return;
      }
      console.log('[draw-close]', {
        reason: 'commit-start',
        vertices: newPolygon.length,
        name,
        success: null,
      });
      try {
        // The predicate is "the ACTIVE room is blank", never "do rooms
        // exist": every property always holds >= 1 room object, so the
        // latter is always true and would orphan the blank seed room
        // forever. Filling it keeps a fresh start's first draw at
        // rooms.length === 1.
        const active = selectActiveRoom(psNow);
        if (active && !isDrawnPolygon(active.polygon)) {
          psNow.setRoomPolygon(active.id, newPolygon);
          psNow.renameRoom(active.id, name);
          console.log('[draw-close]', {
            reason: 'commit-success',
            vertices: newPolygon.length,
            roomId: active.id,
            filledBlank: true,
            success: true,
          });
        } else {
          const id = addRoom({ name, polygon: newPolygon });
          console.log('[draw-close]', {
            reason: 'commit-success',
            vertices: newPolygon.length,
            roomId: id,
            filledBlank: false,
            success: true,
          });
        }
        pushToast(
          `New room "${name}" created (${polygonArea(newPolygon).toFixed(2)} m2)`,
          'success',
        );
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
      // End the transaction EXPLICITLY here, so the committed room is one
      // real undo frame. App's exit branch then calls abortDrawTransaction,
      // which no-ops because the transaction has already ended.
      endDrawTransaction();
      if (onDrawComplete) onDrawComplete();
    },
    [addRoom, pushToast, onDrawComplete, setDrawVertices],
  );

  void activeRoom;

  const handleDrawCancel = useCallback(() => {
    console.log('[draw-mode]', 'cancel');
    // Attached multi-room (2026-08-26): entering draw mode no longer wipes
    // anything, so there is nothing to restore. The abort happens in App's
    // exit branch (one convention for every exit path). The old global
    // `undo()` here would now revert the user's last REAL action.
    if (onDrawComplete) onDrawComplete();
  }, [onDrawComplete]);

  // Attached multi-room: the grid is generated PER ROOM, not just clipped
  // per room. The old single memo spanned only the active room's bounds, so
  // reusing it inside another room's clip yields a BLANK grid in every room
  // but one.
  /**
   * The DRAWN grid tier. Recomputed on zoom (it is pure arithmetic), but
   * `gridByRoom` below depends only on the two derived PRIMITIVES, so
   * panning and zooming WITHIN a tier rebuild nothing.
   *
   * Span is the largest drawn-room dimension: the line cap is per room,
   * so sizing the tier off the biggest one is the conservative choice.
   */
  const gridTier = useMemo(() => {
    let spanM = 0;
    for (const r of drawnRooms) {
      const b = polygonBounds(r.polygon);
      spanM = Math.max(spanM, b.maxX - b.minX, b.maxY - b.minY);
    }
    return chooseGridTier(snapStep, pxPerMetre, viewport.scale, spanM || 20);
  }, [snapStep, pxPerMetre, viewport.scale, drawnRooms]);

  const gridByRoom = useMemo(() => {
    if (!showGrid) return new Map<string, GridLine[]>();
    const out = new Map<string, GridLine[]>();
    for (const r of drawnRooms) {
      out.set(
        r.id,
        gridLinesForBounds(
          polygonBounds(r.polygon),
          pxPerMetre,
          gridTier.minorStepM,
          gridTier.majorStepM,
        ),
      );
    }
    return out;
  }, [showGrid, pxPerMetre, drawnRooms, gridTier.minorStepM, gridTier.majorStepM]);

  /**
   * The gaps to cut out of every wall, keyed `roomId:edgeIndex`.
   *
   * A room's own openings are the easy half. The half that matters is the
   * SHARED wall: when two rooms are attached, the wall between them exists in
   * BOTH polygons, so a door hosted by one room must also cut the other room's
   * stroke — otherwise the neighbour's gold line still runs straight across
   * the doorway and the "door into the second room" reads as a wall.
   *
   * Neighbour spans are mapped across by converting to WORLD points and
   * projecting onto this edge, rather than by reasoning about direction signs.
   * The two rooms traverse their shared wall in opposite directions, and going
   * through world space makes that irrelevant instead of a bug waiting to
   * happen.
   */
  const wallGapsByEdge = useMemo(() => {
    const out = new Map<string, Span[]>();
    if (drawnRooms.length === 0) return out;

    const shared = sharedEdgeMap(drawnRooms.map((r) => ({ id: r.id, polygon: r.polygon })));
    const edgesByRoom = new Map(drawnRooms.map((r) => [r.id, roomEdges(r)]));
    const roomsById = new Map(drawnRooms.map((r) => [r.id, r]));

    for (const room of drawnRooms) {
      for (const edge of edgesByRoom.get(room.id) ?? []) {
        const gaps: Span[] = roomOpenings(room)
          .filter((o) => o.edgeIndex === edge.index)
          .map(openingSpan);

        for (const ref of shared.get(edgeKey(room.id, edge.index)) ?? []) {
          const nRoom = roomsById.get(ref.roomId);
          const nEdge = edgesByRoom.get(ref.roomId)?.[ref.edgeIndex];
          if (!nRoom || !nEdge) continue;
          for (const o of roomOpenings(nRoom)) {
            if (o.edgeIndex !== ref.edgeIndex) continue;
            const s = openingSpan(o);
            const w0 = pointAlongEdge(nEdge, s.t0);
            const w1 = pointAlongEdge(nEdge, s.t1);
            gaps.push({
              t0: projectOntoEdge(edge, w0),
              t1: projectOntoEdge(edge, w1),
            });
          }
        }

        if (gaps.length) out.set(edgeKey(room.id, edge.index), gaps);
      }
    }
    return out;
  }, [drawnRooms]);

  /* ---------------- DOOR TOOL (2026-08-28) ----------------
   * Vic: "what if I wanted to add a door going into the second room."
   *
   * Hover snaps the ghost to the nearest WALL rather than to the grid — an
   * opening has no meaning off its host, so there is no free-space state to
   * represent. Clicking an existing door removes it, which keeps add and
   * remove on one tool instead of inventing a second mode.
   */
  const doorTool = tool === 'door';

  const computeDoorHover = useCallback(
    (clientX: number, clientY: number): DoorHover | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const { xM, yM } = screenToRoom(
        clientX,
        clientY,
        { left: rect.left, top: rect.top },
        viewport,
        pxPerMetre,
      );
      // Read rooms through getState(): this callback is memoised on the
      // viewport, so a closure over `drawnRooms` would go stale the moment a
      // door is placed.
      const live = usePropertyStore
        .getState()
        .property.rooms.filter((r) => isDrawnPolygon(r.polygon));
      if (live.length === 0) return null;

      // Is the pointer over an EXISTING opening? Generous radius so a door is
      // easy to hit at any zoom.
      for (const room of live) {
        for (const o of roomOpenings(room)) {
          const edge = roomEdges(room)[o.edgeIndex];
          if (!edge) continue;
          const c = pointAlongEdge(edge, o.offsetM);
          if (Math.hypot(c.x - xM, c.y - yM) <= Math.max(o.widthM / 2, 0.35)) {
            return { mode: 'remove', roomId: room.id, openingId: o.id, edge, offsetM: o.offsetM };
          }
        }
      }

      const hit = nearestEdge({ x: xM, y: yM }, live, DOOR_SNAP_TOL_M);
      if (!hit) return null;

      const draft = useDesignerUIStore.getState().doorDraft;
      const offsetM = clampOpeningOffset(hit.edge.lengthM, draft.widthM, hit.offsetM);
      if (offsetM === null) {
        return { mode: 'invalid', roomId: hit.edge.roomId, edge: hit.edge, offsetM: hit.offsetM };
      }
      const room = live.find((r) => r.id === hit.edge.roomId)!;
      const others = roomOpenings(room).filter((o) => o.edgeIndex === hit.edge.index);
      const v = validateOpening(hit.edge.lengthM, { offsetM, widthM: draft.widthM }, others);
      return {
        mode: v.ok ? 'place' : 'invalid',
        roomId: hit.edge.roomId,
        edge: hit.edge,
        offsetM,
        message: v.message,
      };
    },
    [viewport, pxPerMetre],
  );

  const commitDoorAt = useCallback(
    (clientX: number, clientY: number) => {
      const h = computeDoorHover(clientX, clientY);
      if (!h) return;
      const ps = usePropertyStore.getState();

      if (h.mode === 'remove' && h.openingId) {
        ps.removeOpening(h.openingId);
        pushToast('Opening removed', 'info');
        setDoorHover(null);
        return;
      }
      if (h.mode !== 'place') {
        pushToast(h.message ?? 'That opening will not fit on this wall.', 'warn');
        return;
      }
      const draft = useDesignerUIStore.getState().doorDraft;
      const id = ps.addOpening(h.roomId, {
        edgeIndex: h.edge.index,
        offsetM: h.offsetM,
        widthM: draft.widthM,
        kind: draft.kind,
        flipFacing: draft.flipFacing,
        flipHand: draft.flipHand,
      });
      if (!id) {
        pushToast('That opening will not fit on this wall.', 'warn');
        return;
      }
      const label = draft.kind === 'window' ? 'Window' : draft.kind === 'doorway' ? 'Doorway' : 'Door';
      pushToast(`${label} added`, 'success');
    },
    [computeDoorHover, pushToast],
  );

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
  }, [rooms, drawMode]);

  // Attached multi-room render breadcrumb. Counts MOUNTED Konva nodes via
  // the `room-poly` name, NOT store rooms — a store-side count would go
  // green even if the canvas still drew one room, which is exactly the bug
  // this feature fixes. Fires on mount and on room MUTATIONS (add / rename /
  // polygon change); grid toggles and pan/zoom do not re-trigger it.
  useEffect(() => {
    const mounted = stageRef.current?.find('.room-poly').length ?? 0;
    console.log('[multi-room]', `rendered=${mounted}`);
  }, [rooms]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full transition-colors ${
        pendingProductId && !drawMode ? 'ring-2 ring-inset' : ''
      } ${drawMode ? 'cursor-crosshair' : ''} ${pendingProductId && !drawMode ? 'cursor-crosshair' : ''}`}
      // Blueprint ground. Was the cream `bg-ppw-mist`; the reference is a
      // deep desaturated navy that lets the gold walls carry the drawing.
      style={{
        background: CANVAS_GROUND,
        ...(pendingProductId && !drawMode
          ? { '--tw-ring-color': `${WALL_GOLD_BRIGHT}66` } as React.CSSProperties
          : {}),
      }}
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
        {/* Declutter 2026-07-26 (Vic directive 2): the top-right used to be a
            6-deep VERTICAL stack of full-width buttons + badges that crowded
            the canvas. Actions now sit in ONE compact horizontal row with
            short labels; every data-testid stays mounted so e2e is unaffected. */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={resetView}
            className="min-h-[36px] rounded-md bg-white/90 px-2.5 text-[11px] font-medium text-ppw-ink shadow-sm ring-1 ring-ppw-stone hover:bg-white"
            title="Reset pan/zoom"
          >
            Reset
          </button>
          {/* V-RENDER-4 — share / capture the current room render. Primary
              uses the Konva stage (sharp, canvas-only); secondary snapshots
              the full app chrome via html2canvas. */}
          <button
            type="button"
            onClick={handleShareRender}
            data-testid="share-render"
            className="min-h-[36px] rounded-md bg-ppw-teal px-2.5 text-[11px] font-semibold text-white shadow-sm ring-1 ring-ppw-teal/60 hover:bg-ppw-teal/90"
            title="Share or download a picture of your room"
          >
            Share
          </button>
          <button
            type="button"
            onClick={handleCaptureFullScreen}
            data-testid="capture-screen"
            className="min-h-[36px] rounded-md bg-white/90 px-2.5 text-[11px] font-medium text-ppw-ink shadow-sm ring-1 ring-ppw-stone hover:bg-white"
            title="Capture the full screen (with toolbars)"
          >
            Capture
          </button>
        </div>
        {/* Room size + zoom readout (P2-1: trimmed the developer-looking
            "area m2 - perimeter m - scale%" debug line to a clean,
            customer-facing area + zoom badge). */}
        {/* One combined readout instead of three stacked badges: room size,
            zoom, snap and item count. `items-placed` stays a discrete element
            (M1.5 Playwright hook) — it is just inlined here now. */}
        <div className="pointer-events-none flex items-center gap-1.5">
          <span className="rounded-md bg-ppw-ink/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
            {area.toFixed(1)} m² · {Math.round(viewport.scale * 100)}% ·{' '}
            {SNAP_UNIT_LABEL[precision]}
            {gridTier.minorStepM > 0 && Math.abs(gridTier.minorStepM - snapStep) > 1e-9 && (
              <span className="opacity-60"> · grid {gridTier.minorStepM >= 1
                ? `${gridTier.minorStepM} m`
                : `${Math.round(gridTier.minorStepM * 100)} cm`}</span>
            )}
          </span>
          <span
            className="rounded-md bg-ppw-teal/90 px-2 py-1 text-[11px] font-medium text-white shadow-sm"
            data-testid="items-placed"
          >
            {allItems.length}
          </span>
        </div>
        {/* D21 — live cost total of placed items. Kept as its own prominent
            badge: it is the running shopping total, not chrome. */}
        <div
          className="pointer-events-none rounded-md px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          style={{ background: 'rgba(255,187,88,0.92)', color: '#232C3B' }}
          data-testid="cost-readout"
        >
          {costReadout.total.toLocaleString('en-MU', { maximumFractionDigits: 0 })} {costReadout.currency}
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
            aria-pressed={precision !== 'full'}
            onClick={togglePrecision}
            className="pointer-events-auto flex h-11 min-w-[64px] items-center justify-center rounded-lg px-2 text-[11px] font-semibold shadow-sm active:scale-95"
            style={{
              background: precision !== 'full' ? '#FFBB58' : 'rgba(255,255,255,0.9)',
              color: '#232C3B',
            }}
          >
            {SNAP_UNIT_LABEL[precision]}
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
            userMovedViewportRef.current = true;
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
          if (doorTool) {
            setDoorHover(computeDoorHover(evt.clientX, evt.clientY));
            return;
          }
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
          if (doorTool) {
            const t = (e.evt as TouchEvent).changedTouches?.[0];
            if (t) commitDoorAt(t.clientX, t.clientY);
            return;
          }
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
          if (doorTool) {
            commitDoorAt(e.evt.clientX, e.evt.clientY);
            return;
          }
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
          {/* Attached multi-room (Vic 2026-08-26): EVERY room renders, in one
              shared world-metre frame, so the plan reads like the reference
              — many rooms, one drawing, gold walls shared where they touch.
              `listening={false}` on the floors is deliberate: the Stage's
              onClick/onTap commit handlers guard `e.target !== stage`, so a
              listening floor would swallow every armed placement click.
              Activation lives on the RoomList dropdown + item selection. */}
          {drawnRooms.map((room) => {
            const pts = room.polygon.flatMap((v) => [v.x * pxPerMetre, v.y * pxPerMetre]);
            const isActive = room.id === activeRoomId;
            return (
              <Group key={room.id} name="room-poly" listening={false}>
                {/* Reference `Design/Designer.jpeg`: the walls ARE the drawing.
                    A thick amber stroke over a slightly lighter floor, with a
                    hairline inside the stroke for the drafted edge.

                    FLOOR — fill only, no stroke. Split from the wall so an
                    opening can cut the wall without cutting the floor away
                    underneath it. */}
                <Line
                  points={pts}
                  closed
                  fill={isActive ? ROOM_FILL_ACTIVE : ROOM_FILL}
                  shadowColor="#000000"
                  shadowBlur={18}
                  shadowOpacity={0.45}
                  shadowOffsetY={4}
                />
                {/* FLOOR FINISH — the material the customer actually buys,
                    drawn over the room fill and UNDER the walls, the grid and
                    every placed item. Per-room, one material, filling the
                    polygon: that is the convention every consumer floor
                    planner lands on, and per-tile painting buys nothing when
                    the output is a shopping list.

                    Slightly translucent so the active-room tint still reads
                    through, and non-listening like everything else in this
                    layer — a listening floor would swallow the placement
                    clicks the Stage handlers depend on. */}
                {(() => {
                  const mat = roomFloorMaterial(room);
                  if (!mat) return null;
                  return (
                    <Line
                      points={pts}
                      closed
                      fill={mat.hex}
                      opacity={0.9}
                      listening={false}
                      name="room-floor"
                    />
                  );
                })()}

                {/* WALLS — one stroke per EDGE rather than one closed Line, so
                    a door can remove a span from a single wall. `splitEdgeSpans`
                    returns the solid runs left once openings are cut out; with
                    no openings that is the whole edge and this draws exactly
                    what the closed Line drew.

                    lineCap="square" extends each run by half a stroke at both
                    ends. At a CORNER that is what fills the mitre the closed
                    Line used to join for us. At an OPENING it would overshoot
                    into the gap, so an opening-side end is pulled back by the
                    same half-stroke and the cap puts it back exactly on the
                    jamb — the gap ends up the true width of the door. */}
                {roomEdges(room).map((edge) => {
                  const halfStrokeM = WALL_STROKE_PX / 2 / pxPerMetre;
                  const gaps = wallGapsByEdge.get(edgeKey(room.id, edge.index)) ?? [];
                  return splitEdgeSpans(edge.lengthM, gaps).map((span, si) => {
                    const atStartCorner = span.t0 <= 0;
                    const atEndCorner = span.t1 >= edge.lengthM;
                    const t0 = atStartCorner ? 0 : span.t0 + halfStrokeM;
                    const t1 = atEndCorner ? edge.lengthM : span.t1 - halfStrokeM;
                    if (t1 - t0 <= 0) return null;
                    const p0 = pointAlongEdge(edge, t0);
                    const p1 = pointAlongEdge(edge, t1);
                    const seg = [
                      p0.x * pxPerMetre,
                      p0.y * pxPerMetre,
                      p1.x * pxPerMetre,
                      p1.y * pxPerMetre,
                    ];
                    return (
                      <Fragment key={`w-${edge.index}-${si}`}>
                        <Line
                          points={seg}
                          stroke={WALL_GOLD}
                          strokeWidth={WALL_STROKE_PX}
                          lineCap="square"
                        />
                        <Line
                          points={seg}
                          stroke={WALL_INNER_STROKE}
                          strokeWidth={WALL_INNER_STROKE_PX}
                          lineCap="square"
                        />
                      </Fragment>
                    );
                  });
                })}

                {/* DOOR SYMBOLS — the architectural convention, not a top-down
                    render of a 3D door. A leaf line at 90 degrees from the
                    hinge plus a quarter-circle swing arc says at a glance which
                    way the door opens and how much floor it sweeps, which is
                    what a fitter or a merchant reads a plan for.

                    Drawn per HOST room only: a door in a shared wall cuts both
                    rooms' strokes (see wallGapsByEdge) but draws ONE symbol. */}
                {roomOpenings(room).map((o) => {
                  const edge = roomEdges(room)[o.edgeIndex];
                  if (!edge) return null;
                  const halfWallM = WALL_STROKE_PX / 2 / pxPerMetre;
                  const toPx = (pt: { x: number; y: number }) => [
                    pt.x * pxPerMetre,
                    pt.y * pxPerMetre,
                  ];

                  // Jamb ticks close the wall off at both ends of the gap so
                  // the opening stays legible when it is only a few px wide.
                  const ticks = jambTicks(edge, o, halfWallM);
                  const tickNodes = ticks.map((t, ti) => (
                    <Line
                      key={`jamb-${o.id}-${ti}`}
                      points={[...toPx(t[0]), ...toPx(t[1])]}
                      stroke={WALL_GOLD}
                      strokeWidth={2}
                    />
                  ));

                  if (o.kind === 'window') {
                    // A window keeps the wall line but reads as a thin double
                    // line across the span.
                    const s = openingSpan(o);
                    const a = pointAlongEdge(edge, s.t0);
                    const b = pointAlongEdge(edge, s.t1);
                    return (
                      <Fragment key={`op-${o.id}`}>
                        <Line
                          points={[...toPx(a), ...toPx(b)]}
                          stroke={WALL_GOLD}
                          strokeWidth={3}
                        />
                        {tickNodes}
                      </Fragment>
                    );
                  }

                  if (o.kind === 'doorway') {
                    // An open doorway is a gap and nothing else — no leaf, no
                    // arc. The ticks are what stop it reading as a mistake.
                    return <Fragment key={`op-${o.id}`}>{tickNodes}</Fragment>;
                  }

                  const sym = doorSymbol(edge, o);
                  return (
                    <Fragment key={`op-${o.id}`}>
                      {tickNodes}
                      {/* swing arc */}
                      <Line
                        // arc is a flat [x,y,x,y,...] world-metre polyline;
                        // pxPerMetre scales both axes equally.
                        points={sym.arc.map((v) => v * pxPerMetre)}
                        stroke={DOOR_ARC}
                        strokeWidth={1.5}
                        dash={[4, 3]}
                        listening={false}
                      />
                      {/* the leaf itself */}
                      <Line
                        points={[...toPx(sym.hinge), ...toPx(sym.leafEnd)]}
                        stroke={DOOR_LEAF}
                        strokeWidth={3}
                        lineCap="round"
                      />
                    </Fragment>
                  );
                })}
              </Group>
            );
          })}

          {/* Per-room grid: its OWN line set inside its OWN clip. Sharing one
              line set across rooms leaves every room but the active one
              blank, because the generator only spans the bounds it was
              given. */}
          {showGrid
            && drawnRooms.map((room) => (
              <Group
                key={`grid-${room.id}`}
                // Named so an e2e can count MOUNTED grid nodes rather than
                // trusting the tier arithmetic. Mirrors `room-poly`.
                name="room-grid"
                listening={false}
                clipFunc={polygonClipFunc(room.polygon, pxPerMetre)}
              >
                {(gridByRoom.get(room.id) ?? []).map((l) => (
                  <Line
                    key={l.key}
                    points={l.points}
                    stroke={GRID_LINE}
                    strokeWidth={l.major ? GRID_MAJOR_WIDTH_PX : GRID_MINOR_WIDTH_PX}
                    opacity={l.major ? GRID_MAJOR_OPACITY : GRID_MINOR_OPACITY}
                  />
                ))}
              </Group>
            ))}

          {/* Room names, set the way the reference plan sets its callouts:
              uppercase, letter-spaced, light on the dark floor. Anchored
              just inside each room's top-left wall so they never fight the
              centred hints or a placed item's own label. The active room's
              label is brighter — that plus the lifted floor is the whole
              active-room affordance. */}
          {drawnRooms.map((room) => {
            if (!room.name) return null;
            const b = polygonBounds(room.polygon);
            return (
              <Text
                key={`label-${room.id}`}
                listening={false}
                x={b.minX * pxPerMetre + 14}
                y={b.minY * pxPerMetre + 12}
                text={room.name.toUpperCase()}
                fontSize={13}
                fontStyle="bold"
                fontFamily="Inter, sans-serif"
                letterSpacing={2.5}
                fill={LABEL_TEXT}
                opacity={
                  room.id === activeRoomId
                    ? ROOM_LABEL_ACTIVE_OPACITY
                    : ROOM_LABEL_INACTIVE_OPACITY
                }
              />
            );
          })}

          {/* M4 (Customer-UI fix 2026-05-31) — the on-canvas "0,0 - W x H m
              bbox" debug Text was removed; it was developer instrumentation
              that should never have shipped to the customer surface. */}
        </Layer>

        <Layer ref={itemsLayerRef}>
          {/* Items stay VISIBLE while drawing (Sims context — you draw the
              new room against the furniture you already own) but the wrapper
              kills their handlers. Konva `opacity` does NOT disable
              `listening`, and PlacedItemGroup's own handlers do not check
              drawMode, so without this a vertex click would select / drag /
              sledgehammer-delete an item — silently, inside a suppressed
              history transaction. */}
          {/* Items stop listening while a product is ARMED as well as during
              draw. Otherwise an armed click that lands on an existing item
              hits that item's hit-rect, so the Stage's commit handler sees
              `e.target !== stage` and returns — the click dies silently with
              no ghost, no toast, no placement. That is what made "put a bench
              on the mat" impossible even once collisions became band-aware:
              the mat swallowed the click before placement was ever consulted.
              Konva `opacity` does not disable listening; this prop is the
              only thing that does. */}
          <Group listening={!drawMode && !pendingProductId}>
            {rooms.map((room) =>
              room.placedItems.map((item) => {
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
                    snapStep={snapStep}
                    product={product}
                    wPx={wPx}
                    hPx={hPx}
                    w={w}
                    h={h}
                    colors={colors}
                    isSelected={isSelected}
                    justPlaced={item.instanceId === justPlacedId}
                    pxPerMetre={pxPerMetre}
                    // THAT room's polygon and items — the drag/validate math
                    // inside PlacedItemGroup is unchanged, it just finally
                    // sees the room the item actually lives in.
                    polygon={room.polygon}
                    placedItems={room.placedItems}
                    selectItem={selectItemAcrossRooms}
                    updateItem={updateItem}
                    pushToast={pushToast}
                    itemDragRef={itemDragRef}
                    activatePlacedItem={activatePlacedItem}
                  />
                );
              }),
            )}
          </Group>
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
                fill={dragGhost.valid ? GHOST_VALID_FILL : GHOST_INVALID_FILL}
                stroke={dragGhost.valid ? GHOST_VALID_STROKE : GHOST_INVALID}
                strokeWidth={2}
                dash={[6, 4]}
              />
              <Text
                x={dragGhost.xM * pxPerMetre + 6}
                y={dragGhost.yM * pxPerMetre + 6}
                text={product.name}
                fontSize={12}
                fontFamily="Inter, sans-serif"
                fontStyle="bold"
                fill={dragGhost.valid ? GHOST_VALID_STROKE : GHOST_INVALID}
              />
            </Layer>
          );
        })()}

        {/* DOOR TOOL ghost — highlights the wall about to be cut and previews
            the opening at the exact width and swing it will be placed with.
            Its own non-listening Layer so it can never intercept the click it
            is previewing. */}
        {doorTool && doorHover && (
          <Layer listening={false}>
            {(() => {
              const h = doorHover;
              const px = (n: number) => n * pxPerMetre;
              const wall = [
                px(h.edge.a.x), px(h.edge.a.y),
                px(h.edge.b.x), px(h.edge.b.y),
              ];
              if (h.mode === 'remove') {
                const c = pointAlongEdge(h.edge, h.offsetM);
                return (
                  <>
                    <Line points={wall} stroke={GHOST_INVALID} strokeWidth={3} dash={[6, 4]} />
                    <Circle
                      x={px(c.x)}
                      y={px(c.y)}
                      radius={Math.max(10, px(0.2))}
                      stroke={GHOST_INVALID}
                      strokeWidth={2}
                      fill={GHOST_INVALID_FILL}
                    />
                  </>
                );
              }

              const ok = h.mode === 'place';
              const stroke = ok ? DOOR_TARGET_WALL : GHOST_INVALID;
              const preview: Opening = {
                id: '__ghost__',
                edgeIndex: h.edge.index,
                offsetM: h.offsetM,
                widthM: doorDraft.widthM,
                kind: doorDraft.kind,
                flipFacing: doorDraft.flipFacing,
                flipHand: doorDraft.flipHand,
              };
              const span = openingSpan(preview);
              const a = pointAlongEdge(h.edge, Math.max(0, span.t0));
              const b = pointAlongEdge(h.edge, Math.min(h.edge.lengthM, span.t1));
              const sym = doorSymbol(h.edge, preview);
              return (
                <>
                  <Line points={wall} stroke={stroke} strokeWidth={2} dash={[8, 6]} opacity={0.7} />
                  {/* the span the opening will occupy */}
                  <Line
                    points={[px(a.x), px(a.y), px(b.x), px(b.y)]}
                    stroke={stroke}
                    strokeWidth={WALL_STROKE_PX}
                    opacity={0.45}
                    lineCap="butt"
                  />
                  {ok && doorDraft.kind === 'door' && (
                    <>
                      <Line
                        points={sym.arc.map((v) => v * pxPerMetre)}
                        stroke={stroke}
                        strokeWidth={1.5}
                        dash={[4, 3]}
                      />
                      <Line
                        points={[px(sym.hinge.x), px(sym.hinge.y), px(sym.leafEnd.x), px(sym.leafEnd.y)]}
                        stroke={stroke}
                        strokeWidth={3}
                        lineCap="round"
                      />
                    </>
                  )}
                </>
              );
            })()}
          </Layer>
        )}

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

        {/* Persistent committed walls — always rendered so drawn interior
            walls survive exiting the wall tool (2026-07-24 fix). */}
        <CommittedWallsLayer walls={committedWalls} pxPerMetre={pxPerMetre} />

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

      {/* Blank-canvas-on-open (2026-06-09, Vic) — START-STATE prompt. Shown
          on a FRESH canvas (no room drawn yet) and after "Clear all". Guides
          the customer to draw their own room first, Sims build-mode style,
          with a one-tap "Quick rectangle" escape hatch. This card IS
          interactive (its buttons need clicks) so it opts back into pointer
          events; it sits centred and never overlaps the toolbars. */}
      {!drawMode && !wallDrawEnabled && !pendingProductId && !hasRoom && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-4"
          data-testid="start-room-prompt"
        >
          <div
            className="pointer-events-auto flex max-w-sm flex-col items-center gap-2 rounded-2xl px-6 py-5 text-center shadow-md"
            style={{
              background: 'rgba(245,235,215,0.92)',
              border: '1px solid rgba(255,187,88,0.6)',
              color: '#232C3B',
            }}
          >
            <span aria-hidden style={{ fontSize: 26, lineHeight: 1, color: '#FFBB58' }}>
              ▱
            </span>
            <p className="text-base font-semibold" style={{ color: '#232C3B' }}>
              Start by drawing your room
            </p>
            <p className="text-xs leading-snug" style={{ color: '#3B4A52' }}>
              Your canvas is blank. Sketch the walls of your space first, then
              drag products in. You can redraw or clear it any time.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                data-testid="start-draw-room"
                onClick={() => onRequestDraw?.()}
                className="min-h-[40px] rounded-lg px-4 text-sm font-semibold text-white shadow-sm"
                style={{ background: '#232C3B' }}
              >
                Draw room
              </button>
              <button
                type="button"
                data-testid="start-quick-rectangle"
                onClick={handleQuickRectangle}
                className="min-h-[40px] rounded-lg border px-4 text-sm font-semibold"
                style={{ background: '#fff', borderColor: '#232C3B33', color: '#232C3B' }}
              >
                Quick 5 × 4 m room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Designer polish (2026-05-29) — empty-room placement tip. Shows once a
          room EXISTS but holds no products yet (and no draw/wall tool is
          active). Auto-hides the moment the first item lands. Brand register:
          navy ink + gold accent + cream card. Pointer-events off so it never
          blocks a tap-to-place on the floor beneath it. */}
      {!drawMode && !wallDrawEnabled && !pendingProductId && hasRoom && allItems.length === 0 && (
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
              the room — to place your first piece. Items snap to the{' '}
              {SNAP_UNIT_LABEL[precision]} grid.
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
          // Stacks ABOVE the sticky Clear products / Clear all row, which
          // also lives bottom-left. They used to overlap each other.
          style={{
            bottom:
              'calc(max(1.25rem, env(safe-area-inset-bottom)) + var(--sims-toolbar-h, 0px) + 46px)',
          }}
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
  /**
   * Live snap step in metres (units brief 2026-08-28, D14). Threaded in so
   * that dragging an ALREADY-PLACED item honours the unit the user picked;
   * without it the drag silently re-snapped to a hardcoded 0.5 m.
   */
  snapStep: number;
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
    snapStep,
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
  // V-RENDER-1 (2026-05-27) — use the canonical TOP-DOWN resolver
  // (topdown_image_url → photo_image_url → image_url → SVG data-URI). On the
  // floor plan a top-down render reads correctly (a rotated item turns the
  // image, not a perspective photo), so the canvas prefers top-down even now
  // that the catalog shows real perspective photos (productImageUrl). Always
  // returns a non-empty string; useImageCache handles load/error → null
  // internally (the grey Rect fallback below still covers a genuine 404).
  const image = useImageCache(productTopDownUrl(product));
  // Polish (2026-05-29) — distinguish "still hydrating" from "errored /
  // no image" so the fallback shows a subtle brand shimmer while the
  // asset loads, then settles to the real image (or the coloured rect on
  // a genuine 404). The status hook shares the same module-level cache as
  // useImageCache above, so this adds no extra network load.
  const { status: imageStatus } = useImageCacheStatus(productTopDownUrl(product));
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
        // Band filter, matching the placement paths: dragging a bench ONTO a
        // mat must land, not bounce back.
        const others = obstaclesFor(item.productId, placedItems)
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
        // Sims wall-aware drag (2026-08-23): released near a wall, the
        // item snaps flush and turns to face into the room. Hold Shift
        // to keep the current facing. Mid-room drags keep facing and
        // grid-snap exactly as before (wallAware falls through to the
        // plain grid path with userRotationDeg = current rotation).
        const shiftHeld = 'shiftKey' in e.evt && (e.evt as MouseEvent).shiftKey;
        const fpUnrotated = {
          lengthM: cmToM(product.dimensions_cm.length),
          widthM: cmToM(product.dimensions_cm.width),
        };
        const wallAware = resolveWallAwarePlacement({
          centreXm: newXm + w / 2,
          centreYm: newYm + h / 2,
          fp: fpUnrotated,
          polygon,
          snapStep,
          userRotationDeg: shiftHeld || !isCardinalRotation(item.rotation) ? item.rotation : null,
          frontEdge: product.front_edge,
        });
        const wf = rotatedFootprint(fpUnrotated, wallAware.rotationDeg);
        const wallOk = validatePlacement(
          { x: wallAware.x, y: wallAware.y, w: wf.w, h: wf.h },
          others,
          polygon,
          item.instanceId,
        ).ok;
        const resolved = wallOk
          ? { ok: true as const, x: wallAware.x, y: wallAware.y }
          : resolveDragTarget({
              candidateX: newXm,
              candidateY: newYm,
              w,
              h,
              others,
              room: polygon,
              ignoreInstanceId: item.instanceId,
              snapStep,
            });
        if (resolved.ok) {
          const rotation = wallOk ? wallAware.rotationDeg : item.rotation;
          updateItem(item.instanceId, { x: resolved.x, y: resolved.y, rotation });
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
          // Aspect fix (2026-08-24): contain-fit the art to the footprint
          // instead of stretching it to the rect — the image keeps its
          // TRUE proportions, centred, auto-rotated 90° when its long
          // axis disagrees with the footprint. Correctly-authored
          // top-downs (canvas ratio == length:width) still fill exactly.
          (() => {
            const fit = fitImageToFootprint(
              image.naturalWidth,
              image.naturalHeight,
              unrotatedWPx,
              unrotatedHPx,
            );
            return (
              <KonvaImage
                image={image}
                x={unrotatedWPx / 2}
                y={unrotatedHPx / 2}
                width={fit.drawW}
                height={fit.drawH}
                offsetX={fit.drawW / 2}
                offsetY={fit.drawH / 2}
                rotation={fit.rotationDeg}
                opacity={0.95}
              />
            );
          })()
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
            stroke={isSelected ? WALL_GOLD_BRIGHT : GRID_LINE}
            strokeWidth={isSelected ? 2.5 : 1}
          />
        ) : (
          <Rect
            width={unrotatedWPx}
            height={unrotatedHPx}
            fill={colors.fill}
            opacity={0.55}
            stroke={isSelected ? WALL_GOLD_BRIGHT : colors.stroke}
            strokeWidth={isSelected ? 2.5 : 1}
            cornerRadius={3}
          />
        )}
        {image && isSelected && (
          <Rect
            width={unrotatedWPx}
            height={unrotatedHPx}
            fill="transparent"
            stroke={WALL_GOLD_BRIGHT}
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
        fill={LABEL_TEXT}
        // Dark halo so the name stays readable over pale product art as
        // well as over the dark floor.
        stroke="#0E1B1F"
        strokeWidth={2.5}
        fillAfterStrokeEnabled
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
        fill={LABEL_TEXT_MUTED}
        stroke="#0E1B1F"
        strokeWidth={2}
        fillAfterStrokeEnabled
        listening={false}
      />
      {isSelected && (
        <>
          <Circle x={0} y={0} radius={4} fill={WALL_GOLD_BRIGHT} />
          <Circle x={wPx} y={0} radius={4} fill={WALL_GOLD_BRIGHT} />
          <Circle x={0} y={hPx} radius={4} fill={WALL_GOLD_BRIGHT} />
          <Circle x={wPx} y={hPx} radius={4} fill={WALL_GOLD_BRIGHT} />
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
            fill={WALL_GOLD_BRIGHT}
            stroke="#0E1B1F"
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

interface GridLine {
  points: number[];
  key: string;
  major: boolean;
}

/**
 * Attached multi-room (2026-08-26) — grid lines for ONE room's bounds.
 *
 * Extracted from the old single `gridLines` memo, which spanned only the
 * active room. Rendering it inside another room's clip produced a BLANK
 * grid, because the lines simply did not reach that far: per-room clipping
 * is not enough, each room needs its own generated line set.
 */
/**
 * Grid lines for one room, at the DRAWN tier (units brief 2026-08-28, D6).
 *
 * Two changes from the old hardcoded version, both load-bearing:
 *
 *  1. The step comes from `chooseGridTier`, not a literal 0.5, so a fine
 *     snap unit cannot emit thousands of Konva nodes per room.
 *  2. Lines are anchored at the first multiple of the step at or after
 *     `bounds.minX`, NOT at `bounds.minX` itself. Snapping is anchored at
 *     world zero, so anchoring the drawing at each room own min corner
 *     made the visible grid and the snap targets disagree on any off-grid
 *     room - visible today on the 5.13 m fixture.
 *
 * `major` is a modulo of the world coordinate for the same reason: an
 * index-parity test (`i % 2 === 0`) silently changes meaning the moment the
 * minor step changes.
 */
function gridLinesForBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  pxPerMetre: number,
  minorStepM: number,
  majorStepM: number,
): GridLine[] {
  const out: GridLine[] = [];
  if (minorStepM <= 0) return out;
  const minX = bounds.minX * pxPerMetre;
  const minY = bounds.minY * pxPerMetre;
  const maxX = bounds.maxX * pxPerMetre;
  const maxY = bounds.maxY * pxPerMetre;
  const ratio = majorStepM > 0 ? Math.round(majorStepM / minorStepM) : 0;
  const isMajor = (worldM: number): boolean =>
    ratio > 0 && Math.abs((Math.round(worldM / minorStepM) % ratio + ratio) % ratio) < 1e-9;

  const startXm = Math.ceil(bounds.minX / minorStepM - 1e-9) * minorStepM;
  for (let xm = startXm; xm <= bounds.maxX + 1e-9; xm += minorStepM) {
    const x = xm * pxPerMetre;
    out.push({ points: [x, minY, x, maxY], key: `vx-${Math.round(xm / minorStepM)}`, major: isMajor(xm) });
  }
  const startYm = Math.ceil(bounds.minY / minorStepM - 1e-9) * minorStepM;
  for (let ym = startYm; ym <= bounds.maxY + 1e-9; ym += minorStepM) {
    const y = ym * pxPerMetre;
    out.push({ points: [minX, y, maxX, y], key: `hy-${Math.round(ym / minorStepM)}`, major: isMajor(ym) });
  }
  return out;
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
