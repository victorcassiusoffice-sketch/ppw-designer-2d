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
import {
  Stage,
  Layer,
  Line,
  Group,
  Text,
  Circle,
  Rect,
  Shape,
  Image as KonvaImage,
} from 'react-konva';
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
  rotatedFootprint,
  screenToRoom,
} from '../lib/geometry';
import type { PlacedRect, Polygon, Viewport } from '../lib/geometry';
import { computeZoomScale } from '../lib/zoom';
import { RoomDrawLayer, RoomDrawHUD, type HoverVertex } from './RoomDrawMode';
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
// Sims drag-drop (2026-08-28, D-B3) - the transport seam between a catalog
// drag gesture and this canvas.
import { useDragPointerStore } from '../store/dragPointerStore';
// Units brief (2026-08-28, D10) - retype the length of a wall that exists.
import { resizeRoomEdge } from '../designer/edgeResize';
import { formatLengthForUnit } from '../designer/unitFormat';
import { haptic } from '../lib/haptics';
// Sims wall-aware placement (2026-08-23; inner-face + corners + free walls
// 2026-08-29) — objects dropped near a wall snap flush against its inner
// face, tuck into corners, and auto-rotate to face into the room.
import {
  findFreeSlotAlongWall,
  freeWallObstacleRects,
  isCardinalRotation,
  resolveWallAwarePlacement,
  WALL_HALF_M,
  WALL_THICKNESS_M,
  type FreeWallLike,
} from '../designer/wallAwarePlacement';
// Ratio fix (2026-08-29) — the art is cropped to its CONTENT box and mapped
// onto the footprint so a product visibly touches the wall it is flush to.
import { planImageFit } from '../designer/imageFit';
import { contentBoxForImage } from '../designer/imageContent';
// Sims world (2026-08-29): storeys, outdoor areas, free walls, land plot.
import {
  activeLevelIdOf,
  isOutdoorRoom,
  levelBelow,
  levelsOf,
  roomsOnLevel,
} from '../designer/levels';
import { runToFreeWalls, wallsOnLevel } from '../designer/freeWalls';
import { emitsLight, lightRadiusM, planSymbolOf } from '../designer/lighting';
import { pointInPolygon, isRectInsidePolygon } from '../lib/geometry';
import { SnapUnitStepper } from './RoomDrawMode';
// Architectural paper theme (2026-08-29): cream paper, charcoal poche walls
// with a soft shadow, quiet grid. Every colour comes from ONE module.
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
  LABEL_HALO,
  ROOM_FILL,
  ROOM_FILL_ACTIVE,
  DOOR_ARC,
  DOOR_LEAF,
  DOOR_TARGET_WALL,
  ROOM_LABEL_ACTIVE_OPACITY,
  ROOM_LABEL_INACTIVE_OPACITY,
  WALL_INK,
  WALL_INK_GHOST,
  WALL_SHADOW,
  WALL_SHADOW_BLUR_PX,
  WALL_SHADOW_OFFSET,
  WALL_INNER_STROKE,
  WALL_INNER_STROKE_PX,
  WALL_STROKE_PX,
  SELECT_STROKE,
  HANDLE_FILL,
  SITE_FILL,
  SITE_STROKE,
  DIM_LINE,
  LIGHT_GLOW_CORE,
  LIGHT_GLOW_EDGE,
  GREENERY_FILL,
  GREENERY_STROKE,
  ITEM_SHADOW,
  measureFontSize,
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
// Per-tile floor painting (floor-painting brief 2026-08-28).
import {
  tileRect,
  tileAt,
  zoneForMaterial,
  tilesInDragRect,
  tilesCoveringPolygon,
  dragRectTileCount,
  type FloorZone,
} from '../designer/floorTiles';
import { findFloorMaterialById } from '../data/floorMaterials';
import { nextRoomName } from '../designer/roomNaming';
import { obstaclesFor } from '../designer/layerBands';
// Surface slots + wall-mounted items (2026-08-24) — placement:'wall'
// products hang on walls; placement:'surface' products sit on is_surface
// items. Each layer collides only within itself.
import {
  findSurfaceUnder,
  placementKind,
  resolveSurfaceItemPlacement,
  resolveWallItemPlacement,
  type PlacementKind,
  type SurfaceRect,
} from '../designer/attachmentPlacement';
import { collidesWithAny } from '../lib/geometry';

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

/**
 * Footprint rects of the placed items on ONE placement layer ('floor' |
 * 'wall' | 'surface'), for layer-scoped collision. For 'surface', pass
 * `parentId` to keep only siblings on that surface.
 */
function layerRects(
  placedItems: PlacedItem[],
  layer: PlacementKind,
  opts?: { parentId?: string; ignoreId?: string },
): Array<PlacedRect & { instanceId: string }> {
  const out: Array<PlacedRect & { instanceId: string }> = [];
  for (const it of placedItems) {
    if (opts?.ignoreId && it.instanceId === opts.ignoreId) continue;
    const p = getProductById(it.productId);
    if (!p || placementKind(p) !== layer) continue;
    if (layer === 'surface' && opts?.parentId && it.parentInstanceId !== opts.parentId) continue;
    const fp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
    const r = rotatedFootprint(fp, it.rotation);
    out.push({ x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId });
  }
  return out;
}

/** Footprint rects of every placed item whose product is a surface. */
function surfaceRects(placedItems: PlacedItem[]): SurfaceRect[] {
  const out: SurfaceRect[] = [];
  for (const it of placedItems) {
    const p = getProductById(it.productId);
    if (!p?.is_surface) continue;
    const fp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
    const r = rotatedFootprint(fp, it.rotation);
    out.push({ instanceId: it.instanceId, x: it.x, y: it.y, w: r.w, h: r.h });
  }
  return out;
}

// Surface + wall items draw ABOVE floor items (Konva z = array order): a
// diffuser renders on top of its table, a mirror on top of the wall line.
// Stable sort keeps within-layer placement order. Applied per room so the
// attached multi-room render preserves the same z-order everywhere.
function sortItemsForRender(items: PlacedItem[]): PlacedItem[] {
  const rank = (it: PlacedItem) => {
    const k = placementKind(getProductById(it.productId));
    return k === 'floor' ? 0 : k === 'surface' ? 1 : 2;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
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
  /** The wall the measure tool has selected, if any. */
  const [measureSel, setMeasureSel] = useState<{
    roomId: string;
    edgeIndex: number;
    lengthM: number;
    anchor: 'start' | 'end';
  } | null>(null);
  const [measureText, setMeasureText] = useState('');
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
  const allRooms = usePropertyStore((s) => s.property.rooms);
  const activeRoomId = usePropertyStore((s) => s.property.activeRoomId);
  // Sims world (2026-08-29): storeys. The canvas shows ONE level at a time;
  // the level below is drawn as a faint ghost so upper floors line up with
  // the walls beneath, the way The Sims does it.
  const propertyLevels = usePropertyStore((s) => s.property.levels);
  const propertyActiveLevelId = usePropertyStore((s) => s.property.activeLevelId);
  const propertyWalls = usePropertyStore((s) => s.property.walls);
  const site = usePropertyStore((s) => s.property.site ?? null);
  const levels = useMemo(() => levelsOf({ levels: propertyLevels }), [propertyLevels]);
  const activeLevelId = activeLevelIdOf({ levels: propertyLevels, activeLevelId: propertyActiveLevelId });
  const activeLevel = levels.find((l) => l.id === activeLevelId) ?? levels[0];
  const belowLevelId = useMemo(() => levelBelow(levels, activeLevelId)?.id ?? null, [levels, activeLevelId]);
  /** Rooms on the level the canvas is showing (outdoor containers included). */
  const rooms = useMemo(() => roomsOnLevel(allRooms, activeLevelId), [allRooms, activeLevelId]);
  /** Free-standing walls on this level (open wall runs). */
  const freeWalls = useMemo(
    () => wallsOnLevel(propertyWalls ?? [], activeLevelId),
    [propertyWalls, activeLevelId],
  );
  /** Room outlines one storey down — rendered as a ghost, never interactive. */
  const belowRooms = useMemo(
    () =>
      belowLevelId
        ? roomsOnLevel(allRooms, belowLevelId).filter(
            (r) => !isOutdoorRoom(r) && isDrawnPolygon(r.polygon),
          )
        : [],
    [allRooms, belowLevelId],
  );
  /** The land plot as a polygon in world metres, or null = unlimited land. */
  const sitePolygon = useMemo<Polygon | null>(() => {
    if (!site) return null;
    const ox = site.originM?.x ?? 0;
    const oy = site.originM?.y ?? 0;
    return [
      { x: ox, y: oy },
      { x: ox + site.widthM, y: oy },
      { x: ox + site.widthM, y: oy + site.depthM },
      { x: ox, y: oy + site.depthM },
    ];
  }, [site]);
  // D5 — selecting an item in ANY room must also move focus to that room,
  // or the Sims loop (place → rotate / delete) is dead everywhere except
  // the active room: DetailsPanel, FloatingCluster and placementActions all
  // resolve the selection through the active-room facade. This is wired by
  // changing the VALUE passed to PlacedItemGroup, never by widening the
  // designStore facade.
  const selectItemAcrossRooms = usePropertyStore((s) => s.selectItemAcrossRooms);
  /** Drawn, walled rooms on this level — what gets floors, walls and a grid. */
  const drawnRooms = useMemo(
    () => rooms.filter((r) => !isOutdoorRoom(r) && isDrawnPolygon(r.polygon)),
    [rooms],
  );
  /** Every placed item across every room and level — badge + cost aggregate. */
  const allItems = useMemo(() => allRooms.flatMap((r) => r.placedItems), [allRooms]);
  /** Items on the level being shown (what actually renders + collides). */
  const levelItems = useMemo(() => rooms.flatMap((r) => r.placedItems), [rooms]);
  /**
   * Building outlines double as walls for OUTDOOR placement: an item set down
   * beside a building snaps to the outside face of its wall exactly as an
   * indoor item snaps to the inside face. Two-sided by construction.
   */
  const buildingWallsAsFree = useMemo<FreeWallLike[]>(() => {
    const out: FreeWallLike[] = [];
    for (const r of drawnRooms) {
      for (const e of roomEdges(r)) out.push({ a: e.a, b: e.b, thicknessM: WALL_THICKNESS_M });
    }
    return out;
  }, [drawnRooms]);
  /** Site area + built area, for the capacity readout. */
  const capacity = useMemo(() => {
    const built = drawnRooms.reduce((sum, r) => sum + polygonArea(r.polygon), 0);
    const plot = site ? site.widthM * site.depthM : 0;
    return { built, plot, pct: plot > 0 ? Math.round((built / plot) * 100) : 0 };
  }, [drawnRooms, site]);

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
      // ',' and '.' are the Sims-native rotate keys; R is PPW's existing
      // convention. All three do the same thing while a product is armed.
      if (e.key === 'r' || e.key === 'R' || e.key === ',' || e.key === '.') {
        e.preventDefault();
        // The global shortcut hook ALSO binds r / , / . to rotateSelected.
        // Nothing deselects on arm, so from the second placement onward a
        // selection exists and one keypress would rotate BOTH the ghost and
        // a bystander item - the latter into a real undo frame. This handler
        // is registered in capture phase (see the listener below), so
        // stopping immediate propagation here wins regardless of which
        // listener was registered first.
        e.stopImmediatePropagation();
        const delta = e.key === ',' ? -90 : e.shiftKey ? -90 : 90;
        setGhostManuallyRotated(true);
        setGhostRotation((r) => (((r + delta) % 360) + 360) % 360);
        console.log('[drag-place]', { reason: 'rotate' });
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
  /**
   * AABB the viewport centres and fits on: the land plot when one is locked
   * (the plot IS the world), else every drawn room + free wall on this level.
   */
  const union = useMemo(() => {
    if (sitePolygon) return polygonBounds(sitePolygon);
    let u = unionBounds(drawnRooms);
    for (const w of freeWalls) {
      const b = {
        minX: Math.min(w.a.x, w.b.x),
        minY: Math.min(w.a.y, w.b.y),
        maxX: Math.max(w.a.x, w.b.x),
        maxY: Math.max(w.a.y, w.b.y),
      };
      u = u
        ? {
            minX: Math.min(u.minX, b.minX),
            minY: Math.min(u.minY, b.minY),
            maxX: Math.max(u.maxX, b.maxX),
            maxY: Math.max(u.maxY, b.maxY),
          }
        : b;
    }
    // A single wall has zero extent on one axis; give it a metre to fit on.
    if (u && u.maxX - u.minX < 1) u = { ...u, maxX: u.minX + 1 };
    if (u && u.maxY - u.minY < 1) u = { ...u, maxY: u.minY + 1 };
    return u;
  }, [sitePolygon, drawnRooms, freeWalls]);
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
  /**
   * Sims world (2026-08-29): where does a world point land?
   *
   *   - inside a walled room on this level → that room (active-first tie-break)
   *   - anywhere else → the level's OUTDOOR container (created on demand),
   *     unless a land plot is locked and the point is off the plot.
   *
   * Read via getState() so the memoised callbacks below never go stale.
   */
  const resolveContainer = useCallback(
    (
      pM: { x: number; y: number },
      opts: { create: boolean },
    ):
      | { ok: true; room: { id: string; polygon: Polygon; placedItems: PlacedItem[] }; outdoor: boolean }
      | { ok: false; reason: 'off-plot' } => {
      const ps = usePropertyStore.getState();
      const lvl = activeLevelIdOf(ps.property);
      const levelRooms = roomsOnLevel(ps.property.rooms, lvl).filter((r) => !isOutdoorRoom(r));
      const room = findRoomAt(pM, levelRooms, ps.property.activeRoomId);
      if (room) return { ok: true, room, outdoor: false };
      if (sitePolygon && !pointInPolygon(pM, sitePolygon)) return { ok: false, reason: 'off-plot' };
      const existing = roomsOnLevel(ps.property.rooms, lvl).find((r) => isOutdoorRoom(r));
      if (existing) return { ok: true, room: existing, outdoor: true };
      if (!opts.create) {
        return { ok: true, room: { id: '__outdoor_preview__', polygon: [], placedItems: [] }, outdoor: true };
      }
      const id = ps.ensureOutdoorRoom(lvl);
      const created = usePropertyStore.getState().property.rooms.find((r) => r.id === id);
      return created
        ? { ok: true, room: created, outdoor: true }
        : { ok: true, room: { id, polygon: [], placedItems: [] }, outdoor: true };
    },
    [sitePolygon],
  );

  /**
   * Bounds check for an item that lives OUTDOORS: inside the plot when one is
   * locked, and never overlapping a building. Buildings are tested by their
   * corners + centre against every drawn room polygon (an outdoor item can
   * touch a wall's outer face, so edge contact is allowed).
   */
  const fitsOutdoors = useCallback(
    (rect: PlacedRect): boolean => {
      if (sitePolygon && !isRectInsidePolygon(rect, sitePolygon)) return false;
      const probes = [
        { x: rect.x + 0.01, y: rect.y + 0.01 },
        { x: rect.x + rect.w - 0.01, y: rect.y + 0.01 },
        { x: rect.x + rect.w - 0.01, y: rect.y + rect.h - 0.01 },
        { x: rect.x + 0.01, y: rect.y + rect.h - 0.01 },
        { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
      ];
      for (const r of drawnRooms) {
        for (const p of probes) if (pointInPolygon(p, r.polygon)) return false;
      }
      return true;
    },
    [sitePolygon, drawnRooms],
  );

  /**
   * Nearest free slot for an UNBOUNDED area (no polygon to scan): a square
   * spiral on the grid around the preferred point, up to `maxRM` away.
   */
  const findFreeSlotNear = useCallback(
    (
      preferredX: number,
      preferredY: number,
      step: number,
      fits: (x: number, y: number) => boolean,
      maxRM = 6,
    ): { x: number; y: number } | null => {
      const px = Math.round(preferredX / step) * step;
      const py = Math.round(preferredY / step) * step;
      if (fits(px, py)) return { x: px, y: py };
      const rings = Math.ceil(maxRM / step);
      for (let ring = 1; ring <= rings; ring++) {
        for (let i = -ring; i <= ring; i++) {
          const cands: Array<[number, number]> = [
            [px + i * step, py - ring * step],
            [px + i * step, py + ring * step],
            [px - ring * step, py + i * step],
            [px + ring * step, py + i * step],
          ];
          for (const [x, y] of cands) if (fits(x, y)) return { x, y };
        }
      }
      return null;
    },
    [],
  );

  /** Every free wall on this level as collision rectangles (thickness real). */
  const freeWallRects = useMemo(() => freeWallObstacleRects(freeWalls), [freeWalls]);

  const placeAtRoomPoint = useCallback(
    (
      centreXm: number,
      centreYm: number,
      productId: string,
      userRotationDeg: number | null,
      /**
       * Sims drag-drop (D-B9 / Vic Q2). When the exact point is blocked,
       * should we relocate to the nearest free slot?
       *
       * TRUE by default so every existing caller is byte-identical. Only
       * the DRAG drop passes false: you physically carried the object to a
       * spot, so silently teleporting it metres away reads as a bug. The
       * mobile "+ Add to room" button and the click commit KEEP relocation
       * - the popup centre-place is a deliberate 2026-05-28 fix with its
       * own spec asserting two taps both land.
       */
      relocateIfBlocked: boolean = true,
    ) => {
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
      // Sims world (2026-08-29): a point outside every room is OUTDOORS, not
      // an error — gardens, terraces and second buildings all live there.
      const container = resolveContainer({ x: centreXm, y: centreYm }, { create: true });
      if (!container.ok) {
        haptic('invalid');
        pushToast('That spot is off the plot — enlarge the land or drop it inside.', 'warn');
        return false;
      }
      const target = container.room;
      const outdoor = container.outdoor;
      const targetPolygon = target.polygon;
      const targetItems = target.placedItems;
      // Indoors the walls that matter are the room's own edges plus any free
      // wall on this level; outdoors every building outline is a wall too.
      const snapWalls: FreeWallLike[] = outdoor ? [...freeWalls, ...buildingWallsAsFree] : freeWalls;
      const wallRects = outdoor
        ? [...freeWallRects, ...freeWallObstacleRects(buildingWallsAsFree)]
        : freeWallRects;
      /** Bounds test for the container: polygon indoors, plot/buildings outdoors. */
      const inBounds = (rect: PlacedRect): boolean =>
        outdoor ? fitsOutdoors(rect) : isRectInsidePolygon(rect, targetPolygon);

      const kind = placementKind(product);

      // ---- Wall-mounted items (shelves, mirrors) --------------------
      // Routed into the dropped-in room (targetPolygon/targetItems) like
      // every other kind, per the attached multi-room model.
      if (kind === 'wall') {
        const r = resolveWallItemPlacement({
          centreXm,
          centreYm,
          fp,
          polygon: targetPolygon,
          snapStep,
          frontEdge: product.front_edge,
          freeWalls: snapWalls,
        });
        if (!r.ok) {
          haptic('invalid');
          pushToast('This item hangs on a wall — drop it closer to one.', 'warn');
          return false;
        }
        const wf = rotatedFootprint(fp, r.rotationDeg);
        const wallOthers = layerRects(targetItems, 'wall');
        const wallRect = { x: r.x, y: r.y, w: wf.w, h: wf.h };
        if (!inBounds(wallRect) || collidesWithAny(wallRect, wallOthers)) {
          haptic('invalid');
          pushToast("No space on that bit of wall.", 'warn');
          return false;
        }
        haptic('place');
        // Commit into the ROUTED room, not the active one (same as the floor path).
        const wallId = usePropertyStore
          .getState()
          .addItem({ productId: product.id, x: r.x, y: r.y, rotation: r.rotationDeg }, target.id);
        setJustPlacedId(wallId);
        selectItemAcrossRooms(wallId);
        pushToast(`Added "${product.name}" to cart`, 'success', {
          ttlMs: 5000,
          action: { label: 'Undo', onClick: () => removeItem(wallId) },
        });
        return true;
      }

      // ---- Surface items (sit ON a table/console) -------------------
      if (kind === 'surface') {
        const under = findSurfaceUnder({ x: centreXm, y: centreYm }, surfaceRects(targetItems));
        if (!under) {
          haptic('invalid');
          pushToast('This item sits on a surface — drop it onto a table.', 'warn');
          return false;
        }
        const rot = userRotationDeg ?? 0;
        const res = resolveSurfaceItemPlacement({
          centreXm,
          centreYm,
          fp,
          rotationDeg: rot,
          surface: under,
        });
        if (!res.ok) {
          haptic('invalid');
          pushToast('Too big for that surface.', 'warn');
          return false;
        }
        const sf = rotatedFootprint(fp, rot);
        const sibs = layerRects(targetItems, 'surface', { parentId: under.instanceId });
        if (collidesWithAny({ x: res.x, y: res.y, w: sf.w, h: sf.h }, sibs)) {
          haptic('invalid');
          pushToast('No space left on that surface.', 'warn');
          return false;
        }
        haptic('place');
        // Commit into the ROUTED room (the table's room), not the active one.
        const surfId = usePropertyStore.getState().addItem(
          {
            productId: product.id,
            x: res.x,
            y: res.y,
            rotation: rot,
            parentInstanceId: res.parentInstanceId,
          },
          target.id,
        );
        setJustPlacedId(surfId);
        selectItemAcrossRooms(surfId);
        pushToast(`Added "${product.name}" to cart`, 'success', {
          ttlMs: 5000,
          action: { label: 'Undo', onClick: () => removeItem(surfId) },
        });
        return true;
      }

      // ---- Floor + ceiling items (the Sims wall-aware path) --------
      // A ceiling-hung light never snaps to a wall: it sits where it is
      // dropped, on the grid, colliding only with other ceiling items.
      const ceiling = kind === 'ceiling';
      const resolved = ceiling
        ? (() => {
            const rot = userRotationDeg ?? 0;
            const f = rotatedFootprint(fp, rot);
            return {
              x: Math.round((centreXm - f.w / 2) / snapStep) * snapStep,
              y: Math.round((centreYm - f.h / 2) / snapStep) * snapStep,
              rotationDeg: rot,
              wallSnapped: false,
              snappedEdges: 0,
              cornerSnapped: false,
              primaryAxis: null,
            };
          })()
        : resolveWallAwarePlacement({
            centreXm,
            centreYm,
            fp,
            polygon: outdoor ? [] : targetPolygon,
            snapStep,
            userRotationDeg,
            frontEdge: product.front_edge,
            wallInsetM: WALL_HALF_M,
            freeWalls: snapWalls,
          });
      const { w, h } = rotatedFootprint(fp, resolved.rotationDeg);
      // Floor items collide with floor items only (wall items hang above,
      // surface items sit on a tabletop, ceiling items hang from above) AND
      // only within the same layer band — so a treadmill still ignores the
      // mats laid under it. Free walls are solid for everything on the floor.
      const sameKindItems = targetItems.filter((it) => {
        const p = getProductById(it.productId);
        return p ? placementKind(p) === kind : true;
      });
      const others: Array<PlacedRect & { instanceId: string }> = obstaclesFor(product.id, sameKindItems)
        .map((it) => {
          const p = getProductById(it.productId);
          if (!p) return null;
          const ofp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
          const r = rotatedFootprint(ofp, it.rotation);
          return { x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId };
        })
        .filter((r): r is PlacedRect & { instanceId: string } => r !== null);
      if (!ceiling) others.push(...wallRects);
      const fitsAt = (x: number, y: number): boolean => {
        const rect = { x, y, w, h };
        return inBounds(rect) && !collidesWithAny(rect, others);
      };
      // Designer 3-Bug Fix (2026-05-28, Bug 2) — auto-relocate to the
      // nearest free grid slot instead of rejecting when the preferred
      // point (the room centre for the mobile "+ Add to room" path) is
      // already occupied. Only reject when the room is genuinely full.
      // Sims world: a wall-snapped item first SLIDES ALONG ITS WALL to the
      // nearest free stretch (keeping the flush face), and only then falls
      // back to the grid scan — so a blocked drop no longer teleports the
      // item off the wall.
      const directOk = fitsAt(resolved.x, resolved.y);
      if (!directOk && !relocateIfBlocked) {
        haptic('invalid');
        pushToast("That spot is blocked — try somewhere else.", 'warn');
        console.log('[drag-place]', { reason: 'drop-rejected', cause: 'blocked' });
        return false;
      }
      const relocateStep = Math.max(snapStep, 0.25);
      const slot = directOk
        ? { x: resolved.x, y: resolved.y }
        : (resolved.wallSnapped
            ? findFreeSlotAlongWall({
                resolved,
                w,
                h,
                step: relocateStep,
                fits: (rect) => fitsAt(rect.x, rect.y),
              })
            : null)
          ?? (outdoor
            ? findFreeSlotNear(resolved.x, resolved.y, relocateStep, fitsAt)
            : findFreeSlot({
                preferredX: resolved.x,
                preferredY: resolved.y,
                w,
                h,
                others,
                polygon: targetPolygon,
                // D15 — floored so a fine unit cannot turn the fallback
                // scan into a quadratic sweep.
                step: Math.max(snapStep, 0.5),
              }));
      if (!slot) {
        haptic('invalid');
        pushToast(outdoor ? 'No space there.' : "Item won't fit — the room is full.", 'warn');
        return false;
      }
      haptic('place');
      // Commit into the ROUTED room, not the active one.
      const instanceId = usePropertyStore.getState().addItem(
        {
          productId: product.id,
          x: Number(slot.x.toFixed(4)),
          y: Number(slot.y.toFixed(4)),
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
      console.log('[place]', {
        outdoor,
        wallSnapped: resolved.wallSnapped,
        corner: resolved.cornerSnapped,
        x: slot.x,
        y: slot.y,
        rotation: resolved.rotationDeg,
      });
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
    [
      removeItem,
      pushToast,
      snapStep,
      selectItemAcrossRooms,
      resolveContainer,
      fitsOutdoors,
      findFreeSlotNear,
      freeWalls,
      freeWallRects,
      buildingWallsAsFree,
    ],
  );

  const placeProductAt = useCallback(
    (
      clientX: number,
      clientY: number,
      productId: string,
      rotationOverride?: number | null,
      relocateIfBlocked: boolean = true,
    ) => {
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
      return placeAtRoomPoint(xM, yM, productId, rotation, relocateIfBlocked);
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
      // validity can never disagree with what actually lands. Off the plot
      // the ghost renders invalid rather than silently previewing a drop
      // that the commit will reject.
      const routed = resolveContainer({ x: xM, y: yM }, { create: false });
      if (!routed.ok) {
        const { w: gw, h: gh } = rotatedFootprint(
          fp,
          ghostManuallyRotated ? ghostRotation : 0,
        );
        return { xM: xM - gw / 2, yM: yM - gh / 2, rotation: ghostManuallyRotated ? ghostRotation : 0, valid: false, w: gw, h: gh };
      }
      const target = routed.room;
      const outdoor = routed.outdoor;
      const snapWalls: FreeWallLike[] = outdoor ? [...freeWalls, ...buildingWallsAsFree] : freeWalls;
      const wallRects = outdoor
        ? [...freeWallRects, ...freeWallObstacleRects(buildingWallsAsFree)]
        : freeWallRects;
      const inBounds = (rect: PlacedRect): boolean =>
        outdoor ? fitsOutdoors(rect) : isRectInsidePolygon(rect, target.polygon);

      const kind = placementKind(product);

      // Wall-mounted ghost: snaps to the nearest wall in range; out of
      // range it follows the cursor in red so the user sees "not here".
      if (kind === 'wall') {
        const r = resolveWallItemPlacement({
          centreXm: xM,
          centreYm: yM,
          fp,
          polygon: target.polygon,
          snapStep,
          frontEdge: product.front_edge,
          freeWalls: snapWalls,
        });
        const { w, h } = rotatedFootprint(fp, r.rotationDeg);
        if (!r.ok) {
          return { xM: xM - w / 2, yM: yM - h / 2, rotation: 0, valid: false, w, h };
        }
        const rect = { x: r.x, y: r.y, w, h };
        const ok = inBounds(rect) && !collidesWithAny(rect, layerRects(target.placedItems, 'wall'));
        return { xM: r.x, yM: r.y, rotation: r.rotationDeg, valid: ok, w, h };
      }

      // Surface-item ghost: green only over a table with room for it.
      if (kind === 'surface') {
        const rot = ghostManuallyRotated ? ghostRotation : 0;
        const { w, h } = rotatedFootprint(fp, rot);
        const under = findSurfaceUnder({ x: xM, y: yM }, surfaceRects(target.placedItems));
        if (!under) {
          return { xM: xM - w / 2, yM: yM - h / 2, rotation: rot, valid: false, w, h };
        }
        const res = resolveSurfaceItemPlacement({
          centreXm: xM,
          centreYm: yM,
          fp,
          rotationDeg: rot,
          surface: under,
        });
        if (!res.ok) {
          return { xM: xM - w / 2, yM: yM - h / 2, rotation: rot, valid: false, w, h };
        }
        const sibs = layerRects(target.placedItems, 'surface', { parentId: under.instanceId });
        const ok = !collidesWithAny({ x: res.x, y: res.y, w, h }, sibs);
        return { xM: res.x, yM: res.y, rotation: rot, valid: ok, w, h };
      }

      // Same wall-aware resolver as the commit path, so the ghost shows
      // EXACTLY where (and at what facing) the item will land.
      const ceiling = kind === 'ceiling';
      const userRot = ghostManuallyRotated ? ghostRotation : null;
      const resolved = ceiling
        ? (() => {
            const rot = userRot ?? 0;
            const f = rotatedFootprint(fp, rot);
            return {
              x: Math.round((xM - f.w / 2) / snapStep) * snapStep,
              y: Math.round((yM - f.h / 2) / snapStep) * snapStep,
              rotationDeg: rot,
            };
          })()
        : resolveWallAwarePlacement({
            centreXm: xM,
            centreYm: yM,
            fp,
            polygon: outdoor ? [] : target.polygon,
            snapStep,
            userRotationDeg: userRot,
            frontEdge: product.front_edge,
            wallInsetM: WALL_HALF_M,
            freeWalls: snapWalls,
          });
      const { w, h } = rotatedFootprint(fp, resolved.rotationDeg);
      const candidate: PlacedRect = { x: resolved.x, y: resolved.y, w, h };
      // Same combined filter as the commit path — same-kind items only,
      // in the same band, plus solid free walls — so the ghost predicts
      // the commit exactly.
      const sameKind = target.placedItems.filter((it) => {
        const p = getProductById(it.productId);
        return p ? placementKind(p) === kind : true;
      });
      const others: PlacedRect[] = obstaclesFor(product.id, sameKind)
        .map((it) => {
          const p = getProductById(it.productId);
          if (!p) return null;
          const ofp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
          const r = rotatedFootprint(ofp, it.rotation);
          return { x: it.x, y: it.y, w: r.w, h: r.h };
        })
        .filter((r): r is PlacedRect => r !== null);
      if (!ceiling) others.push(...wallRects);
      const ok = inBounds(candidate) && !collidesWithAny(candidate, others);
      return { xM: resolved.x, yM: resolved.y, rotation: resolved.rotationDeg, valid: ok, w, h };
    },
    // `rooms` read via getState() inside — see placeAtRoomPoint.
    [
      viewport,
      pxPerMetre,
      ghostRotation,
      ghostManuallyRotated,
      snapStep,
      resolveContainer,
      fitsOutdoors,
      freeWalls,
      freeWallRects,
      buildingWallsAsFree,
    ],
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
      // Only rooms on THIS level can clash — the floor above may sit exactly
      // over the one below (that is the whole point of storeys).
      const lvlNow = activeLevelIdOf(psNow.property);
      const clash = roomsOnLevel(psNow.property.rooms, lvlNow).some(
        (r) => !isOutdoorRoom(r) && isDrawnPolygon(r.polygon) && strictPolygonsOverlap(newPolygon, r.polygon),
      );
      if (sitePolygon && newPolygon.some((v) => !pointInPolygon(v, sitePolygon))) {
        pushToast('Keep the room inside the plot — or enlarge the land.', 'warn');
        console.log('[draw-close]', { reason: 'rejected-off-plot', vertices: newPolygon.length, success: false });
        setDrawVertices([]);
        setDrawHover(null);
        return;
      }
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
    [addRoom, pushToast, onDrawComplete, setDrawVertices, sitePolygon],
  );

  void activeRoom;

  /**
   * Sims world (2026-08-29): an open run of wall points becomes FREE WALLS
   * on this level — walls do not have to join. Each consecutive pair is one
   * wall; a run that closed would have gone through handleDrawCommit.
   */
  const handleDrawCommitWalls = useCallback(
    (vertices: Polygon) => {
      const ps = usePropertyStore.getState();
      const lvl = activeLevelIdOf(ps.property);
      const walls = runToFreeWalls(vertices, lvl);
      if (walls.length === 0) {
        pushToast('Place at least 2 points for a wall.', 'warn');
        return;
      }
      // Walls off the plot are refused, same as rooms and items.
      if (sitePolygon && vertices.some((v) => !pointInPolygon(v, sitePolygon))) {
        pushToast('Keep the walls inside the plot.', 'warn');
        setDrawVertices([]);
        setDrawHover(null);
        return;
      }
      ps.addFreeWalls(walls);
      console.log('[draw-close]', { reason: 'open-walls-commit', walls: walls.length, success: true });
      pushToast(
        `${walls.length} wall${walls.length === 1 ? '' : 's'} added — close a shape next time for a room`,
        'success',
      );
      endDrawTransaction();
      if (onDrawComplete) onDrawComplete();
    },
    [pushToast, onDrawComplete, setDrawVertices, sitePolygon],
  );

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
   * Commit a retyped wall length (units brief D10).
   *
   * Deliberately NO `recordSnapshot`: historyStore documents that call as
   * "one user-perceived action - no coalescing", so calling it AND letting
   * the store subscription queue its own snapshot pushes TWO identical
   * frames and the user needs two Ctrl+Z for one edit. The per-room
   * setRoomPolygon calls below already land inside one coalesce window.
   */
  const commitMeasure = useCallback(() => {
    if (!measureSel) return;
    const typed = Number(measureText);
    const store = usePropertyStore.getState();
    const res = resizeRoomEdge({
      rooms: store.property.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        polygon: r.polygon,
      })),
      roomId: measureSel.roomId,
      edgeIndex: measureSel.edgeIndex,
      newLengthM: typed,
      anchor: measureSel.anchor,
      stepM: snapStep,
    });
    if (!res.ok) {
      const msg =
        res.reason === 'overlap'
          ? 'That length would overlap another room.'
          : res.reason === 'shared-conflict'
            ? `That wall is shared with ${res.conflictRoomName ?? 'another room'}; move the corner instead.`
            : res.reason === 'degenerate'
              ? 'That would collapse a wall.'
              : 'Length out of range.';
      haptic('invalid');
      pushToast(msg, 'warn');
      return;
    }
    // Pre-count the openings setRoomPolygon would silently prune, and say
    // so BEFORE committing - it deletes doors that no longer fit inside
    // the same set().
    let doomedOpenings = 0;
    for (const id of res.affectedRoomIds) {
      const before = store.property.rooms.find((r) => r.id === id);
      doomedOpenings += before?.openings?.length ?? 0;
    }
    for (const id of res.affectedRoomIds) {
      const next = res.rooms.find((r) => r.id === id);
      if (next) store.setRoomPolygon(id, next.polygon);
    }
    if (doomedOpenings > 0) {
      pushToast('Wall resized — check any doors on the moved walls.', 'info');
    }
    setMeasureSel(null);
    setMeasureText('');
  }, [measureSel, measureText, snapStep, pushToast]);

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
  const measureTool = tool === 'measure';
  const floorTool = tool === 'floor';
  const floorDraft = useDesignerUIStore((st) => st.floorDraft);
  /** Anchor of an in-progress paint drag, in world metres. */
  const floorAnchorRef = useRef<{ x: number; y: number; roomId: string } | null>(null);
  const [floorPreview, setFloorPreview] = useState<{
    zone: FloorZone;
    keys: string[];
    erase: boolean;
  } | null>(null);

  /**
   * Above this a single stroke is refused rather than attempted.
   *
   * The count is computed O(1) from the index range BEFORE any tile list
   * is built, so a wild drag across an open plan cannot lock the tab up
   * while it enumerates a million tiles it was never going to paint.
   */
  const MAX_TILES_PER_STROKE = 20000;

  /** The zone descriptor the brush is currently painting with. */
  const floorZoneFor = useCallback(
    (room: { id: string; polygon: Polygon }): FloorZone | null => {
      const mat = findFloorMaterialById(floorDraft.materialId);
      if (!mat || mat.tile_w_m === null || mat.tile_h_m === null) return null;
      const existing = usePropertyStore
        .getState()
        .property.rooms.find((r) => r.id === room.id)
        ?.floorTiles?.find((z) => z.materialId === mat.id);
      // Reuse the zone lattice already in the room so repeated strokes
      // land on the same grid instead of each starting a new one.
      return existing ?? zoneForMaterial(mat.id, mat.tile_w_m, mat.tile_h_m, room.polygon);
    },
    [floorDraft.materialId],
  );

  /** World point -> the room under it, via the same routing placement uses. */
  const floorRoomAt = useCallback((xM: number, yM: number) => {
    const rooms2 = usePropertyStore.getState().property.rooms;
    return findRoomAt({ x: xM, y: yM }, rooms2, activeRoomId);
  }, [activeRoomId]);

  const floorWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return screenToRoom(clientX, clientY, { left: rect.left, top: rect.top }, viewport, pxPerMetre);
    },
    [viewport, pxPerMetre],
  );

  /** Commit one stroke. Whole strokes, so one undo frame. */
  const commitFloorStroke = useCallback(
    (roomId: string, zone: FloorZone, keys: string[], erase: boolean) => {
      if (keys.length === 0) return;
      usePropertyStore.getState().paintFloorTiles(roomId, zone, keys, erase);
      console.log('[floor-paint]', {
        reason: erase ? 'erase' : 'paint',
        tiles: keys.length,
        materialId: zone.materialId,
        roomId,
      });
    },
    [],
  );

  /**
   * Sims drag-drop, effect (a) - a live drag ARMS the existing FSM.
   *
   * Arming is what turns on, in lockstep and for free: the canvas ring and
   * data-armed, ghost-Layer eligibility, placed items going non-listening so
   * the drop cannot be swallowed, Stage pan-drag disabling, and the
   * rotate/Escape key handler. Rotate-in-hand comes free from this.
   */
  const dragProductId = useDragPointerStore((s) => s.drag?.productId ?? null);
  useEffect(() => {
    if (!setPendingProductId) return;
    if (dragProductId) setPendingProductId(dragProductId);
  }, [dragProductId, setPendingProductId]);

  /**
   * Effect (b) - drive the on-canvas ghost IMPERATIVELY.
   *
   * A render-driven effect would cost TWO RoomCanvas renders per pointer
   * move (store set -> render -> effect -> setDragGhost -> render), and this
   * component re-maps every room and every placed item on each pass. The
   * subscription reads computeGhost off a ref so the effect can mount once.
   */
  const computeGhostRef = useRef(computeGhost);
  computeGhostRef.current = computeGhost;
  useEffect(() => {
    const unsub = useDragPointerStore.subscribe((st, prev) => {
      if (st.drag === prev.drag) return;
      const d = st.drag;
      if (!d) return;
      const container = containerRef.current;
      if (container) {
        const r = container.getBoundingClientRect();
        useDragPointerStore.getState().setOverCanvas(
          d.clientX >= r.left && d.clientX <= r.right && d.clientY >= r.top && d.clientY <= r.bottom,
        );
      }
      const g = computeGhostRef.current(d.clientX, d.clientY, d.productId);
      setDragGhost(g ? { xM: g.xM, yM: g.yM, rotation: g.rotation, valid: g.valid } : null);
    });
    return unsub;
  }, []);

  /**
   * Effect (c) - commit the drop.
   *
   * Keyed on the nonce so two identical consecutive drops both fire.
   */
  const dropNonce = useDragPointerStore((s) => s.drop?.nonce ?? 0);
  useEffect(() => {
    if (!dropNonce) return;
    const st = useDragPointerStore.getState();
    const d = st.drop;
    if (!d) return;
    st.consumeDrop();

    // Released outside the canvas: silently put the gesture back rather
    // than committing or disarming - the user aborted, they did not aim.
    if (!st.overCanvas) {
      console.log('[drag-place]', { reason: 'drop-cancelled', cause: 'off-canvas' });
      return;
    }
    if (drawMode || wallDrawEnabled || doorTool || measureTool) {
      pushToast('Finish the current tool first.', 'warn');
      console.log('[drag-place]', { reason: 'drop-rejected', cause: 'tool-busy' });
      return;
    }

    // rotationOverride left undefined so the armed ghost rotation applies -
    // that is what makes rotate-in-hand actually reach the committed item.
    const ok = placeProductAt(d.clientX, d.clientY, d.productId, undefined, false);
    console.log('[drag-place]', { reason: ok ? 'drop-commit' : 'drop-rejected' });
    // Vic Q2: the hand empties after a successful drop; Shift at release
    // keeps it to stamp again.
    if (ok && !d.shiftKey && setPendingProductId) setPendingProductId(null);
    setDragGhost(null);
  }, [dropNonce, drawMode, wallDrawEnabled, doorTool, measureTool, placeProductAt, setPendingProductId, pushToast]);


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
      // Paper ground (2026-08-29): warm cream, the land outside the plot.
      style={{
        background: CANVAS_GROUND,
        ...(pendingProductId && !drawMode
          ? { '--tw-ring-color': `${SELECT_STROKE}66` } as React.CSSProperties
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
            {levels.length > 1 && (
              <span data-testid="level-readout">{activeLevel?.name ?? 'Ground floor'} · </span>
            )}
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
        {/* Land capacity (Sims world 2026-08-29): how much of the locked
            plot is built on this level. Only while a plot is locked. */}
        {site && (
          <span
            className="pointer-events-none rounded-md bg-white/85 px-2.5 py-1 text-[11px] font-medium text-ppw-ink shadow-sm ring-1 ring-ppw-stone"
            data-testid="plot-capacity"
          >
            Plot {capacity.plot.toFixed(0)} m² · built {capacity.built.toFixed(1)} m² ({capacity.pct}%)
          </span>
        )}
        {/* D21 — live cost total of placed items. Kept as its own prominent
            badge: it is the running shopping total, not chrome. */}
        <div
          className="pointer-events-none rounded-md px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          style={{ background: WALL_INK, color: '#F8F5EE' }}
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
              background: precision !== 'full' ? SELECT_STROKE : 'rgba(255,255,255,0.9)',
              color: precision !== 'full' ? '#F8F5EE' : '#2A2926',
            }}
          >
            {SNAP_UNIT_LABEL[precision]}
          </button>
        </div>
      )}

      {/* Sims world (2026-08-29): the unit stepper is reachable MID-DRAW on
          a phone. Bottom-left, above the sticky clear row, only while the
          wall pen is live (the HUD shows it too at sm+, but the HUD's row
          wraps on a 390 px screen and the stepper must never be off-screen). */}
      {drawMode && (
        <div
          className="sm:hidden pointer-events-none absolute left-3 z-30"
          style={{
            bottom:
              'calc(max(1.25rem, env(safe-area-inset-bottom)) + var(--sims-toolbar-h, 0px) + 150px)',
          }}
          data-testid="mobile-draw-unit-stepper"
        >
          <SnapUnitStepper compact />
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
        // The floor tool is in this guard for the same reason wall mode is:
        // its headline gesture is a press-and-drag rectangle, and a
        // draggable Stage would swallow it as a canvas pan. Single clicks
        // would still work, so the failure would look like "mostly fine".
        draggable={!drawMode && !pendingProductId && !wallDrawEnabled && !floorTool}
        onDragMove={(e) => {
          if (e.target === e.target.getStage()) {
            userMovedViewportRef.current = true;
            setViewport((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }
        }}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (drawMode) return;
          if (floorTool) {
            const evt = e.evt as MouseEvent;
            const w = floorWorldPoint(evt.clientX, evt.clientY);
            if (!w) return;
            const room = floorRoomAt(w.xM, w.yM);
            if (!room) return;
            floorAnchorRef.current = { x: w.xM, y: w.yM, roomId: room.id };
            return;
          }
          if (e.target === e.target.getStage() && e.evt.button === PAN_BTN) {
            selectItem(null);
          }
        }}
        onMouseUp={(e) => {
          if (!floorTool) return;
          const anchor = floorAnchorRef.current;
          floorAnchorRef.current = null;
          setFloorPreview(null);
          if (!anchor) return;
          const evt = e.evt as MouseEvent;
          const w = floorWorldPoint(evt.clientX, evt.clientY);
          if (!w) return;
          const rooms2 = usePropertyStore.getState().property.rooms;
          const room = rooms2.find((r) => r.id === anchor.roomId);
          if (!room) return;
          const zone = floorZoneFor(room);
          if (!zone) return;
          const erase = evt.ctrlKey || evt.metaKey || floorDraft.erase;

          // Shift, or the 'room' scope, fills the whole polygon - the Sims
          // room-fill, which is what Vic asked for by name.
          const fillRoom = evt.shiftKey || floorDraft.scope === 'room';
          const tiles = fillRoom
            ? tilesCoveringPolygon(zone, room.polygon)
            : (() => {
              const pending = dragRectTileCount(zone, { x: anchor.x, y: anchor.y }, { x: w.xM, y: w.yM });
              if (pending > MAX_TILES_PER_STROKE) {
                pushToast('That area is too large to paint in one go.', 'warn');
                console.log('[floor-paint]', { reason: 'refused', cause: 'too-many-tiles', pending });
                return [];
              }
              return tilesInDragRect(zone, { x: anchor.x, y: anchor.y }, { x: w.xM, y: w.yM }, room.polygon);
            })();
          commitFloorStroke(
            room.id,
            zone,
            tiles.map((t) => String(t.row) + ',' + String(t.col)),
            erase,
          );
        }}
        onPointerMove={(e) => {
          // M1.5 pointer-FSM: while armed, track snapped pointer position
          // and update the ghost preview every frame.
          if (drawMode) return;
          if (floorTool) {
            const evt = e.evt as PointerEvent;
            const w = floorWorldPoint(evt.clientX, evt.clientY);
            if (!w) return;
            const rooms2 = usePropertyStore.getState().property.rooms;
            const anchor = floorAnchorRef.current;
            const room = anchor
              ? rooms2.find((r) => r.id === anchor.roomId)
              : floorRoomAt(w.xM, w.yM);
            if (!room) {
              setFloorPreview(null);
              return;
            }
            const zone = floorZoneFor(room);
            if (!zone) {
              setFloorPreview(null);
              return;
            }
            const erase = evt.ctrlKey || evt.metaKey || floorDraft.erase;
            const fillRoom = evt.shiftKey || floorDraft.scope === 'room';
            // Preview exactly what a release would commit, so the number of
            // tiles the customer is about to buy is visible BEFORE the click.
            const tiles = fillRoom
              ? tilesCoveringPolygon(zone, room.polygon)
              : anchor
                ? (dragRectTileCount(zone, { x: anchor.x, y: anchor.y }, { x: w.xM, y: w.yM })
                  > MAX_TILES_PER_STROKE
                  ? []
                  : tilesInDragRect(zone, { x: anchor.x, y: anchor.y }, { x: w.xM, y: w.yM }, room.polygon))
                : (() => {
                  const t = tileAt(zone, { x: w.xM, y: w.yM });
                  return tileRect(zone, t.row, t.col) && [t];
                })();
            setFloorPreview({
              zone,
              keys: tiles.map((t) => String(t.row) + ',' + String(t.col)),
              erase,
            });
            return;
          }
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
          {/* LAND PLOT (Sims world 2026-08-29) — the locked site. Drawn first
              so everything else sits on it. A dashed boundary with the plot
              dimensions in the corner: this is the maximum the customer can
              build inside. */}
          {sitePolygon && site && (
            <Group name="site" listening={false}>
              <Line
                points={sitePolygon.flatMap((v) => [v.x * pxPerMetre, v.y * pxPerMetre])}
                closed
                fill={SITE_FILL}
                stroke={SITE_STROKE}
                strokeWidth={1.5}
                dash={[10, 6]}
              />
              <Text
                x={sitePolygon[0].x * pxPerMetre + 10 / viewport.scale}
                y={sitePolygon[0].y * pxPerMetre + 8 / viewport.scale}
                text={`PLOT ${site.widthM} × ${site.depthM} m · ${(site.widthM * site.depthM).toFixed(0)} m²`}
                fontSize={measureFontSize(viewport.scale, 11)}
                fontStyle="bold"
                fontFamily="Inter, sans-serif"
                letterSpacing={1.5 / viewport.scale}
                fill={DIM_LINE}
              />
            </Group>
          )}

          {/* STOREY BELOW (Sims world) — the floor underneath as a faint
              outline, so an upper floor can be drawn to line up with the
              walls that carry it. Outline only, never fill, never listening. */}
          {belowRooms.map((room) => (
            <Line
              key={`below-${room.id}`}
              name="room-below"
              points={room.polygon.flatMap((v) => [v.x * pxPerMetre, v.y * pxPerMetre])}
              closed
              stroke={WALL_INK_GHOST}
              strokeWidth={WALL_THICKNESS_M * pxPerMetre}
              dash={[6, 6]}
              listening={false}
            />
          ))}

          {/* Attached multi-room (Vic 2026-08-26): EVERY room on this level
              renders in one shared world-metre frame, so the plan reads like
              the reference — many rooms, one drawing, walls shared where they
              touch. `listening={false}` on the floors is deliberate: the
              Stage's onClick/onTap commit handlers guard `e.target !== stage`,
              so a listening floor would swallow every armed placement click.
              Activation lives on the RoomList dropdown + item selection. */}
          {drawnRooms.map((room) => {
            const pts = room.polygon.flatMap((v) => [v.x * pxPerMetre, v.y * pxPerMetre]);
            const isActive = room.id === activeRoomId;
            return (
              <Group key={room.id} name="room-poly" listening={false}>
                {/* Architectural paper (2026-08-29): the walls ARE the drawing.
                    Paper-white floor, charcoal poche walls with a soft cast
                    shadow so the plan reads as a model on a desk.

                    FLOOR — fill only, no stroke. Split from the wall so an
                    opening can cut the wall without cutting the floor away
                    underneath it. */}
                <Line
                  points={pts}
                  closed
                  fill={isActive ? ROOM_FILL_ACTIVE : ROOM_FILL}
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

                {/* PAINT PREVIEW — what a release would commit, drawn before
                    the click so the number of tiles the customer is about to
                    buy is visible while they are still aiming. */}
                {floorTool && floorPreview && floorPreview.keys.length > 0 && (
                  <Group name="floor-preview-clip" listening={false} clipFunc={polygonClipFunc(room.polygon, pxPerMetre)}>
                    {floorPreview.keys.map((k) => {
                      const [pr, pc] = k.split(',').map(Number);
                      const rr = tileRect(floorPreview.zone, pr, pc);
                      return (
                        <Rect
                          key={`fp-${room.id}-${k}`}
                          name="floor-preview"
                          x={rr.x * pxPerMetre}
                          y={rr.y * pxPerMetre}
                          width={rr.w * pxPerMetre}
                          height={rr.h * pxPerMetre}
                          fill={floorPreview.erase ? GHOST_INVALID_FILL : GHOST_VALID_FILL}
                          listening={false}
                        />
                      );
                    })}
                  </Group>
                )}

                {/* PAINTED FLOOR TILES (floor-painting brief, D8).

                    The clip lives on this GROUP, not on the Shapes inside
                    it: clipFunc is a Konva Container property and is
                    silently ignored on a Shape, which would let boundary
                    tiles render out over the walls with nothing failing. */}
                {(room.floorTiles?.length ?? 0) > 0 && (
                  <Group
                    name="room-floor-clip"
                    listening={false}
                    clipFunc={polygonClipFunc(room.polygon, pxPerMetre)}
                  >
                    {room.floorTiles!.map((zone, zi) => {
                      const zm = findFloorMaterialById(zone.materialId);
                      if (!zm) return null;
                      return (
                        <Shape
                          key={`floor-${room.id}-${zi}`}
                          name="room-floor-tiles"
                          listening={false}
                          opacity={0.92}
                          sceneFunc={floorZoneSceneFunc(
                            zone,
                            pxPerMetre,
                            viewport.scale,
                            zm.hex,
                          )}
                        />
                      );
                    })}
                  </Group>
                )}

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
                  // The wall is a REAL thickness in world metres (0.1 m), so
                  // it scales with pxPerMetre like everything else; at the
                  // default 100 px/m that is the historic 10 px stroke.
                  const wallPx = WALL_THICKNESS_M * pxPerMetre;
                  const halfStrokeM = WALL_HALF_M;
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
                          stroke={WALL_INK}
                          strokeWidth={wallPx}
                          lineCap="square"
                          shadowColor={WALL_SHADOW}
                          shadowBlur={WALL_SHADOW_BLUR_PX}
                          shadowOffsetX={WALL_SHADOW_OFFSET.x}
                          shadowOffsetY={WALL_SHADOW_OFFSET.y}
                          shadowOpacity={1}
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
                  const halfWallM = WALL_HALF_M;
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
                      stroke={WALL_INK}
                      strokeWidth={2}
                    />
                  ));

                  if (o.kind === 'window') {
                    // A window keeps the wall line but reads as a thin double
                    // line across the span (the drafting convention).
                    const s = openingSpan(o);
                    const a = pointAlongEdge(edge, s.t0);
                    const b = pointAlongEdge(edge, s.t1);
                    return (
                      <Fragment key={`op-${o.id}`}>
                        <Line
                          points={[...toPx(a), ...toPx(b)]}
                          stroke={ROOM_FILL}
                          strokeWidth={WALL_THICKNESS_M * pxPerMetre * 0.6}
                        />
                        <Line
                          points={[...toPx(a), ...toPx(b)]}
                          stroke={WALL_INK}
                          strokeWidth={1.5}
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

          {/* FREE-STANDING WALLS (Sims world 2026-08-29) — open runs the
              customer drew without closing a room. Same poche as room walls,
              same shadow, so the plan reads as ONE drawing. Listening only
              while the sledgehammer is armed, so a click can demolish one
              without ever swallowing an armed placement click. */}
          {freeWalls.map((w) => {
            const pts = [w.a.x * pxPerMetre, w.a.y * pxPerMetre, w.b.x * pxPerMetre, w.b.y * pxPerMetre];
            const wallPx = (w.thicknessM || WALL_THICKNESS_M) * pxPerMetre;
            const demolish = tool === 'sledgehammer' && !drawMode && !pendingProductId;
            return (
              <Group key={`fw-${w.id}`} name="free-wall">
                <Line
                  points={pts}
                  stroke={WALL_INK}
                  strokeWidth={wallPx}
                  lineCap="square"
                  shadowColor={WALL_SHADOW}
                  shadowBlur={WALL_SHADOW_BLUR_PX}
                  shadowOffsetX={WALL_SHADOW_OFFSET.x}
                  shadowOffsetY={WALL_SHADOW_OFFSET.y}
                  shadowOpacity={1}
                  listening={demolish}
                  hitStrokeWidth={Math.max(wallPx, 14)}
                  onClick={(e) => {
                    if (!demolish) return;
                    e.cancelBubble = true;
                    usePropertyStore.getState().removeFreeWall(w.id);
                    haptic('delete');
                  }}
                  onTap={(e) => {
                    if (!demolish) return;
                    e.cancelBubble = true;
                    usePropertyStore.getState().removeFreeWall(w.id);
                    haptic('delete');
                  }}
                />
                <Line
                  points={pts}
                  stroke={WALL_INNER_STROKE}
                  strokeWidth={WALL_INNER_STROKE_PX}
                  lineCap="square"
                  listening={false}
                />
              </Group>
            );
          })}

          {/* Room names, set the way the reference plans set their callouts:
              small caps, letter-spaced, quiet grey on the paper floor.
              Anchored just inside each room's top-left wall so they never
              fight the centred hints or a placed item's own label. The active
              room's label is darker — that plus the lifted floor is the whole
              active-room affordance. */}
          {drawnRooms.map((room) => {
            if (!room.name) return null;
            const b = polygonBounds(room.polygon);
            // Centred in the room, the way the reference plans set their
            // callouts. Screen-constant size so it reads at any zoom.
            const font = measureFontSize(viewport.scale, 11);
            const boxW = Math.max(40, (b.maxX - b.minX) * pxPerMetre - 8);
            return (
              <Text
                key={`label-${room.id}`}
                name="room-label"
                listening={false}
                x={b.minX * pxPerMetre + 4}
                y={(b.minY + b.maxY) / 2 * pxPerMetre - font / 2}
                width={boxW}
                align="center"
                text={room.name.toUpperCase()}
                fontSize={font}
                fontStyle="bold"
                fontFamily="Inter, sans-serif"
                letterSpacing={2.5 / viewport.scale}
                fill={LABEL_TEXT}
                opacity={
                  room.id === activeRoomId
                    ? ROOM_LABEL_ACTIVE_OPACITY
                    : ROOM_LABEL_INACTIVE_OPACITY
                }
              />
            );
          })}

          {/* OVERALL DIMENSIONS (reference plan 2) — one dimension line
              across the top and one down the left of the BUILDING extent
              (the plot has its own label), so the customer always sees the
              size of what they have drawn. Text sits inside the offset band
              so it can never fall off the top of the stage. */}
          {drawnRooms.length > 0 && !drawMode && (() => {
            const bu = unionBounds(drawnRooms);
            if (!bu) return null;
            const s = viewport.scale;
            const off = 0.5 * pxPerMetre;
            const tick = 0.1 * pxPerMetre;
            const x0 = bu.minX * pxPerMetre;
            const x1 = bu.maxX * pxPerMetre;
            const y0 = bu.minY * pxPerMetre;
            const y1 = bu.maxY * pxPerMetre;
            const font = measureFontSize(s, 11);
            const wM = bu.maxX - bu.minX;
            const hM = bu.maxY - bu.minY;
            const labelW = 140 / s;
            return (
              <Group name="plan-dimensions" listening={false}>
                <Line points={[x0, y0 - off, x1, y0 - off]} stroke={DIM_LINE} strokeWidth={1 / s} />
                <Line points={[x0, y0 - off - tick, x0, y0 - off + tick]} stroke={DIM_LINE} strokeWidth={1 / s} />
                <Line points={[x1, y0 - off - tick, x1, y0 - off + tick]} stroke={DIM_LINE} strokeWidth={1 / s} />
                <Text
                  x={(x0 + x1) / 2 - labelW / 2}
                  y={y0 - off + 3 / s}
                  width={labelW}
                  align="center"
                  text={formatLengthForUnit(wM, snapStep)}
                  fontSize={font}
                  fontFamily="Inter, sans-serif"
                  fill={DIM_LINE}
                />
                <Line points={[x0 - off, y0, x0 - off, y1]} stroke={DIM_LINE} strokeWidth={1 / s} />
                <Line points={[x0 - off - tick, y0, x0 - off + tick, y0]} stroke={DIM_LINE} strokeWidth={1 / s} />
                <Line points={[x0 - off - tick, y1, x0 - off + tick, y1]} stroke={DIM_LINE} strokeWidth={1 / s} />
                <Text
                  x={x0 - off + 3 / s}
                  y={(y0 + y1) / 2 + labelW / 2}
                  width={labelW}
                  align="center"
                  rotation={-90}
                  text={formatLengthForUnit(hM, snapStep)}
                  fontSize={font}
                  fontFamily="Inter, sans-serif"
                  fill={DIM_LINE}
                />
              </Group>
            );
          })()}

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
              It is ALSO what lets a surface item be dropped on top of its
              table without the table swallowing the commit click.
              Konva `opacity` does not disable listening; this prop is the
              only thing that does. */}
          {/* LIGHT POOLS (Sims world 2026-08-29, reference plan 3) — every
              lamp / pendant / sconce that is switched on casts a warm radial
              pool on the floor beneath the furniture. Drawn UNDER the items
              in this layer so the fixture itself stays crisp on top. */}
          <Group name="light-pools" listening={false}>
            {levelItems.map((item) => {
              const product = getProductById(item.productId);
              if (!product || !emitsLight(product) || item.lightOn === false) return null;
              const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
              const { w, h } = rotatedFootprint(fp, item.rotation);
              const r = lightRadiusM(product) * pxPerMetre;
              return (
                <Circle
                  key={`glow-${item.instanceId}`}
                  name="light-pool"
                  x={(item.x + w / 2) * pxPerMetre}
                  y={(item.y + h / 2) * pxPerMetre}
                  radius={r}
                  fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                  fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                  fillRadialGradientStartRadius={0}
                  fillRadialGradientEndRadius={r}
                  fillRadialGradientColorStops={[0, LIGHT_GLOW_CORE, 0.55, 'rgba(255,214,140,0.22)', 1, LIGHT_GLOW_EDGE]}
                  listening={false}
                />
              );
            })}
          </Group>
          <Group listening={!drawMode && !pendingProductId}>
            {rooms.map((room) => {
              const outdoorRoom = isOutdoorRoom(room);
              // Indoors: the room's edges + free walls. Outdoors: free walls
              // + every building outline, so a dragged item can snap to the
              // outside face of a wall.
              const snapWalls: FreeWallLike[] = outdoorRoom
                ? [...freeWalls, ...buildingWallsAsFree]
                : freeWalls;
              const wallRects = outdoorRoom
                ? [...freeWallRects, ...freeWallObstacleRects(buildingWallsAsFree)]
                : freeWallRects;
              // Sorted per room so surface/wall items draw above floor items
              // (a diffuser on top of its table) everywhere, not just active.
              return sortItemsForRender(room.placedItems).map((item) => {
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
                    outdoor={outdoorRoom}
                    fitsOutdoors={fitsOutdoors}
                    snapWalls={snapWalls}
                    wallRects={wallRects}
                    resolveContainer={resolveContainer}
                    selectItem={selectItemAcrossRooms}
                    updateItem={updateItem}
                    pushToast={pushToast}
                    itemDragRef={itemDragRef}
                    activatePlacedItem={activatePlacedItem}
                  />
                );
              });
            })}
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
        {/* Measure tool (units brief D10). Tool-gated because the Stage
            commit path bails on `e.target !== e.target.getStage()`, so a
            permanently-listening layer would swallow every armed
            placement click. */}
        {measureTool && (
          <Layer name="measure-edges">
            {drawnRooms.map((room) =>
              roomEdges({ id: room.id, polygon: room.polygon }).map((e, i) => {
                const sel =
                  measureSel?.roomId === room.id && measureSel?.edgeIndex === i;
                return (
                  <Line
                    key={`measure-${room.id}-${i}`}
                    points={[
                      e.a.x * pxPerMetre,
                      e.a.y * pxPerMetre,
                      e.b.x * pxPerMetre,
                      e.b.y * pxPerMetre,
                    ]}
                    stroke={sel ? SELECT_STROKE : 'rgba(61,143,121,0.35)'}
                    strokeWidth={sel ? 6 : 4}
                    hitStrokeWidth={18}
                    lineCap="round"
                    onClick={() => {
                      setMeasureSel({
                        roomId: room.id,
                        edgeIndex: i,
                        lengthM: e.lengthM,
                        anchor: 'start',
                      });
                      setMeasureText(e.lengthM.toFixed(2));
                    }}
                    onTap={() => {
                      setMeasureSel({
                        roomId: room.id,
                        edgeIndex: i,
                        lengthM: e.lengthM,
                        anchor: 'start',
                      });
                      setMeasureText(e.lengthM.toFixed(2));
                    }}
                  />
                );
              }),
            )}
          </Layer>
        )}

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
          onCommitWalls={handleDrawCommitWalls}
          onCancel={handleDrawCancel}
        />

        {/* Legacy interior walls (wallStore). Normally EMPTY — App migrates
            them onto the property on mount — but rendered if any remain so
            nothing a customer drew ever silently disappears. */}
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

      {/* Units brief (2026-08-28, D9) — the HUD is back, as the home for the
          typed segment-length field. It was removed in Batch 3 Fix 3.2 for
          covering the canvas, so it returns on stricter terms: the panel
          itself is pointer-events-none and only its controls are clickable,
          and it sits at bottom-3, out of the band where the first row of
          plan vertices renders. */}
      <RoomDrawHUD
        enabled={drawMode}
        vertices={drawVertices}
        setVertices={setDrawVertices}
        hover={drawHover}
        setHover={setDrawHover}
        name={drawName}
        setName={setDrawName}
        onCommit={handleDrawCommit}
        onCommitWalls={handleDrawCommitWalls}
        onCancel={handleDrawCancel}
      />

      {/* Measure popover (units brief D10). Says out loud what it does:
          in a polygon you cannot change one edge in isolation. */}
      {measureTool && measureSel && (
        <div
          className="pointer-events-auto absolute left-1/2 bottom-3 z-30 flex w-[min(94vw,420px)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-ppw-teal bg-white p-3 text-xs shadow-xl"
          data-testid="edge-length-popover"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-ppw-ink">Wall length</span>
            <span className="text-[10px] text-ppw-slate">
              now {formatLengthForUnit(measureSel.lengthM, snapStep)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={Math.max(snapStep, 0.01)}
              step={snapStep}
              value={measureText}
              data-testid="edge-length-input"
              autoFocus
              onChange={(ev) => setMeasureText(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  ev.preventDefault();
                  commitMeasure();
                } else if (ev.key === 'Escape') {
                  ev.preventDefault();
                  setMeasureSel(null);
                }
              }}
              className="w-24 rounded-md border border-ppw-stone px-2 py-1 text-right text-sm text-ppw-ink"
            />
            <span className="text-[10px] text-ppw-slate">m</span>
            <button
              type="button"
              data-testid="edge-length-anchor"
              onClick={() =>
                setMeasureSel((m) =>
                  m ? { ...m, anchor: m.anchor === 'start' ? 'end' : 'start' } : m,
                )
              }
              className="rounded-md border border-ppw-stone px-2 py-1 text-[10px] text-ppw-slate hover:text-ppw-teal"
              title="Which end of the wall stays put"
            >
              anchor: {measureSel.anchor === 'start' ? 'first' : 'second'}
            </button>
            <button
              type="button"
              data-testid="edge-length-apply"
              onClick={commitMeasure}
              className="ml-auto rounded-md border border-ppw-teal bg-ppw-teal px-3 py-1 text-[11px] font-medium text-white"
            >
              Apply
            </button>
          </div>
          <p className="text-[10px] leading-snug text-ppw-slate">
            Moves the corner; the adjoining wall changes length too. A wall
            shared with another room moves in both.
          </p>
        </div>
      )}

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
              background: 'rgba(253,251,246,0.94)',
              border: '1px solid rgba(42,41,38,0.18)',
              color: '#2A2926',
            }}
          >
            <span aria-hidden style={{ fontSize: 26, lineHeight: 1, color: '#3D8F79' }}>
              ▱
            </span>
            <p className="text-base font-semibold" style={{ color: '#2A2926' }}>
              Start by drawing your walls
            </p>
            <p className="text-xs leading-snug" style={{ color: '#5B5852' }}>
              Your land is blank. Sketch the walls of your space — close them
              for a room, or leave them open — then drag products in, inside or
              out in the garden. Lock the plot size with <b>Land</b> any time.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                data-testid="start-draw-room"
                onClick={() => onRequestDraw?.()}
                className="min-h-[40px] rounded-lg px-4 text-sm font-semibold text-white shadow-sm"
                style={{ background: '#2A2926' }}
              >
                Draw walls
              </button>
              <button
                type="button"
                data-testid="start-quick-rectangle"
                onClick={handleQuickRectangle}
                className="min-h-[40px] rounded-lg border px-4 text-sm font-semibold"
                style={{ background: '#fff', borderColor: '#2A292633', color: '#2A2926' }}
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
              background: 'rgba(253,251,246,0.82)',
              border: '1px solid rgba(42,41,38,0.16)',
              color: '#2A2926',
            }}
          >
            <span
              aria-hidden
              style={{ fontSize: 22, lineHeight: 1, color: '#3D8F79' }}
            >
              ✦
            </span>
            <p className="text-sm font-semibold" style={{ color: '#2A2926' }}>
              Your room is empty
            </p>
            <p className="text-[11px] leading-snug" style={{ color: '#5B5852' }}>
              Drag a product onto the floor — or tap a catalog item, then tap
              the room — to place your first piece. Items sit flush to walls,
              tuck into corners and snap to the {SNAP_UNIT_LABEL[precision]} grid.
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
          <span className="font-semibold text-ppw-ink">Wall pen:</span> click to drop wall points · click the first point or <kbd>Enter</kbd> to close a room · <kbd>Finish walls</kbd> / <kbd>Alt+Enter</kbd> keeps them open · <kbd>+</kbd> / <kbd>−</kbd> change the unit · <kbd>Ctrl+Z</kbd> undo · <kbd>Esc</kbd> cancel.
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
  /** Sims world (2026-08-29): true when the owning container is the level's outdoors. */
  outdoor: boolean;
  /** Bounds test for an outdoor rect (plot + not over a building). */
  fitsOutdoors: (rect: PlacedRect) => boolean;
  /** Walls this item may snap to (room edges are implicit via `polygon`). */
  snapWalls: readonly FreeWallLike[];
  /** Solid wall rectangles this item must not overlap. */
  wallRects: Array<PlacedRect & { instanceId: string }>;
  /** The same routing the placement path uses, so a drag lands where a drop would. */
  resolveContainer: (
    pM: { x: number; y: number },
    opts: { create: boolean },
  ) =>
    | { ok: true; room: { id: string; polygon: Polygon; placedItems: PlacedItem[] }; outdoor: boolean }
    | { ok: false; reason: 'off-plot' };
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
    outdoor,
    fitsOutdoors,
    snapWalls,
    wallRects,
    resolveContainer,
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
  // Sims world (2026-08-29): what to DRAW for this product in plan view.
  const symbol = planSymbolOf(product);
  const wallBar = !symbol && placementKind(product) === 'wall';
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
        /**
         * Sims drag-drop (2026-08-28, D-B15) — where did it actually land?
         *
         * PlacedItemGroup is handed its OWNING room polygon, so before this
         * a release over an attached neighbour failed isRectInsidePolygon
         * and bounced back with a toast, while a FRESH placement at the same
         * point routed correctly. That asymmetry was the bug.
         *
         * Rooms are read via getState() INSIDE the handler: this component
         * memoises and must not gain store subscriptions.
         */
        const allRoomsNow = usePropertyStore.getState().property.rooms;
        const ownerRoom = allRoomsNow.find((r) =>
          r.placedItems.some((i) => i.instanceId === item.instanceId),
        );
        // Sims world (2026-08-29): the SAME routing as a fresh drop — a room
        // on this level, else the outdoors (created on demand), else off
        // the plot. So dragging out of a room into the garden works, and
        // dragging from the garden into a room works.
        const routed = resolveContainer({ x: newXm + w / 2, y: newYm + h / 2 }, { create: true });
        if (!routed.ok) {
          e.target.position({ x: item.x * pxPerMetre, y: item.y * pxPerMetre });
          pushToast('That is off the plot.', 'warn');
          return;
        }
        const dropRoom = routed.room;
        const dropOutdoor = routed.outdoor;
        const crossRoom = !!(ownerRoom && dropRoom.id !== ownerRoom.id);
        // Resolve against whichever container it was dropped in.
        const targetPolygon = crossRoom ? dropRoom.polygon : polygon;
        const targetItems = crossRoom ? dropRoom.placedItems : placedItems;
        const targetOutdoor = crossRoom ? dropOutdoor : outdoor;
        const targetWallRects = crossRoom && dropOutdoor !== outdoor
          ? (dropOutdoor ? wallRects : wallRects.filter((r) => !r.instanceId.startsWith('wall:')))
          : wallRects;
        const inBounds = (rect: PlacedRect): boolean =>
          targetOutdoor ? fitsOutdoors(rect) : isRectInsidePolygon(rect, targetPolygon);

        // Band + placement-kind filter, matching the placement paths: a floor
        // item dragged ONTO a mat must land (band), and must ignore the
        // wall/surface items that live above it (kind). Wall + surface drags
        // return early below, so this only governs the floor drag path.
        const itemKind = placementKind(product);
        const sameKindItems = targetItems.filter((it) => {
          const p = getProductById(it.productId);
          return p ? placementKind(p) === itemKind : true;
        });
        const others: Array<PlacedRect & { instanceId: string }> = obstaclesFor(item.productId, sameKindItems)
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
        if (itemKind !== 'ceiling') others.push(...targetWallRects);
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
        const revert = (msg: string) => {
          e.target.position({ x: item.x * pxPerMetre, y: item.y * pxPerMetre });
          pushToast(msg, 'warn');
        };
        const kind = placementKind(product);

        // Wall item drag: re-snap to the nearest wall (it may be a
        // different wall — re-orient with it) or bounce back.
        if (kind === 'wall') {
          const cur = rotatedFootprint(fpUnrotated, item.rotation);
          // Live unit + the routed container (a shelf can cross into the
          // next room, or hang on a free wall) — no more hardcoded 0.5 m.
          const r = resolveWallItemPlacement({
            centreXm: newXm + cur.w / 2,
            centreYm: newYm + cur.h / 2,
            fp: fpUnrotated,
            polygon: targetPolygon,
            snapStep,
            frontEdge: product.front_edge,
            freeWalls: snapWalls,
          });
          const wfW = rotatedFootprint(fpUnrotated, r.rotationDeg);
          const rect = { x: r.x, y: r.y, w: wfW.w, h: wfW.h };
          const ok =
            r.ok &&
            inBounds(rect) &&
            !collidesWithAny(rect, layerRects(targetItems, 'wall', { ignoreId: item.instanceId }));
          if (ok) {
            if (crossRoom) {
              usePropertyStore
                .getState()
                .moveItemToRoom(item.instanceId, dropRoom.id, r.x, r.y, r.rotationDeg);
            } else {
              updateItem(item.instanceId, { x: r.x, y: r.y, rotation: r.rotationDeg });
            }
            e.target.position({ x: r.x * pxPerMetre, y: r.y * pxPerMetre });
          } else {
            revert('Wall items need a free bit of wall.');
          }
          return;
        }

        // Surface item drag: must land on a surface (same or another —
        // it reparents) with room for it, else bounce back.
        if (kind === 'surface') {
          const cur = rotatedFootprint(fpUnrotated, item.rotation);
          const centre = { x: newXm + cur.w / 2, y: newYm + cur.h / 2 };
          const under = findSurfaceUnder(centre, surfaceRects(placedItems));
          if (!under) {
            revert('This item sits on a surface — drop it onto a table.');
            return;
          }
          const res = resolveSurfaceItemPlacement({
            centreXm: centre.x,
            centreYm: centre.y,
            fp: fpUnrotated,
            rotationDeg: item.rotation,
            surface: under,
          });
          const sibs = layerRects(placedItems, 'surface', {
            parentId: under.instanceId,
            ignoreId: item.instanceId,
          });
          if (!res.ok || collidesWithAny({ x: res.x, y: res.y, w: cur.w, h: cur.h }, sibs)) {
            revert('No space on that surface.');
            return;
          }
          updateItem(item.instanceId, {
            x: res.x,
            y: res.y,
            parentInstanceId: res.parentInstanceId,
          });
          e.target.position({ x: res.x * pxPerMetre, y: res.y * pxPerMetre });
          return;
        }

        // Sims wall-aware drag (2026-08-23): released near a wall, the
        // item snaps flush and turns to face into the room. Hold Shift
        // to keep the current facing. Mid-room drags keep facing and
        // grid-snap exactly as before (wallAware falls through to the
        // plain grid path with userRotationDeg = current rotation).
        const ceilingItem = kind === 'ceiling';
        const wallAware = ceilingItem
          ? {
              x: Math.round(newXm / snapStep) * snapStep,
              y: Math.round(newYm / snapStep) * snapStep,
              rotationDeg: item.rotation,
              wallSnapped: false,
            }
          : resolveWallAwarePlacement({
              centreXm: newXm + w / 2,
              centreYm: newYm + h / 2,
              fp: fpUnrotated,
              polygon: targetOutdoor ? [] : targetPolygon,
              snapStep,
              userRotationDeg: shiftHeld || !isCardinalRotation(item.rotation) ? item.rotation : null,
              // Mid-room the item KEEPS its facing (the 2026-08-29 fix for the
              // rotation-reset-on-drag defect).
              currentRotationDeg: item.rotation,
              frontEdge: product.front_edge,
              wallInsetM: WALL_HALF_M,
              freeWalls: snapWalls,
            });
        const wf = rotatedFootprint(fpUnrotated, wallAware.rotationDeg);
        const ownOthers = others.filter((o) => o.instanceId !== item.instanceId);
        const wallRect = { x: wallAware.x, y: wallAware.y, w: wf.w, h: wf.h };
        const wallOk = inBounds(wallRect) && !collidesWithAny(wallRect, ownOthers);
        // Plain grid fallback at the CURRENT rotation, bounded by the container.
        const gridX = Math.round(newXm / snapStep) * snapStep;
        const gridY = Math.round(newYm / snapStep) * snapStep;
        const gridRect = { x: gridX, y: gridY, w, h };
        const resolved = wallOk
          ? { ok: true as const, x: wallAware.x, y: wallAware.y }
          : inBounds(gridRect)
            ? collidesWithAny(gridRect, ownOthers)
              ? { ok: false as const, reason: 'collision' as const }
              : { ok: true as const, x: gridX, y: gridY }
            : { ok: false as const, reason: 'out-of-bounds' as const };
        if (resolved.ok) {
          const rotation = wallOk ? wallAware.rotationDeg : item.rotation;
          if (crossRoom) {
            // One atomic action, preserving the instanceId. A remove+add
            // would mint a fresh id and orphan the selection, the history
            // reference and the cart line item.
            usePropertyStore
              .getState()
              .moveItemToRoom(item.instanceId, dropRoom.id, resolved.x, resolved.y, rotation);
            console.log('[drag-move]', {
              reason: 'cross-room',
              from: ownerRoom?.id,
              to: dropRoom.id,
              instanceId: item.instanceId,
            });
          } else {
            updateItem(item.instanceId, { x: resolved.x, y: resolved.y, rotation });
            console.log('[drag-move]', { reason: 'same-room' });
          }
          e.target.position({
            x: resolved.x * pxPerMetre,
            y: resolved.y * pxPerMetre,
          });
        } else {
          e.target.position({
            x: item.x * pxPerMetre,
            y: item.y * pxPerMetre,
          });
          console.log('[drag-move]', { reason: 'rejected', cause: resolved.reason });
          pushToast(
            resolved.reason === 'collision'
              ? "Item won't fit there."
              : targetOutdoor
                ? 'That would sit on a building or off the plot.'
                : 'Out of room bounds.',
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
        {symbol ? (
          // Sims world (2026-08-29): plan SYMBOLS for products that have no
          // top-down art by design — lights (the architectural circle-and-
          // cross), greenery (canopy blobs), garden furniture. Drawn in
          // world scale so a 2.5 m tree really is 2.5 m.
          <PlanSymbol
            symbol={symbol}
            width={unrotatedWPx}
            height={unrotatedHPx}
            lit={emitsLight(product) && item.lightOn !== false}
            selected={isSelected}
          />
        ) : wallBar ? (
          // Wall-mounted items read as a bar on the wall in plan view (a
          // mirror is 5 cm deep from above; a perspective photo of it is
          // meaningless there). The photo stays in the catalog + details.
          <Group>
            <Rect
              width={unrotatedWPx}
              height={unrotatedHPx}
              fill={WALL_INK}
              opacity={0.82}
              cornerRadius={1}
              shadowColor={ITEM_SHADOW}
              shadowBlur={4}
              shadowOffsetX={1}
              shadowOffsetY={2}
            />
            <Rect
              x={1}
              y={1}
              width={Math.max(unrotatedWPx - 2, 0)}
              height={Math.max(unrotatedHPx - 2, 0)}
              stroke={LABEL_HALO}
              strokeWidth={0.75}
              opacity={0.5}
            />
          </Group>
        ) : image ? (
          // Ratio fix (2026-08-29): the art is CROPPED to its content box
          // (transparent / white margins trimmed at load) and then either
          // stretched to the exact footprint when its shape is close, or
          // contained at true aspect anchored to the BACK edge — so the
          // product visibly touches the wall it is flush against. This is
          // what makes a 120 x 40 console table draw 120 x 40, not a 40 x 40
          // blob floating mid-footprint.
          (() => {
            const box = contentBoxForImage(image);
            const fit = planImageFit({
              contentW: box.w,
              contentH: box.h,
              footW: unrotatedWPx,
              footH: unrotatedHPx,
            });
            const boxW = fit.rotationDeg === 90 ? fit.drawH : fit.drawW;
            const boxH = fit.rotationDeg === 90 ? fit.drawW : fit.drawH;
            return (
              <KonvaImage
                image={image}
                crop={{ x: box.x, y: box.y, width: box.w, height: box.h }}
                x={fit.offsetX + boxW / 2}
                y={fit.offsetY + boxH / 2}
                width={fit.drawW}
                height={fit.drawH}
                offsetX={fit.drawW / 2}
                offsetY={fit.drawH / 2}
                rotation={fit.rotationDeg}
                opacity={0.97}
                shadowColor={ITEM_SHADOW}
                shadowBlur={6}
                shadowOffsetX={2}
                shadowOffsetY={3}
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
            stroke={isSelected ? SELECT_STROKE : GRID_LINE}
            strokeWidth={isSelected ? 2.5 : 1}
          />
        ) : (
          <Rect
            width={unrotatedWPx}
            height={unrotatedHPx}
            fill={colors.fill}
            opacity={0.55}
            stroke={isSelected ? SELECT_STROKE : colors.stroke}
            strokeWidth={isSelected ? 2.5 : 1}
            cornerRadius={3}
          />
        )}
        {(image || symbol || wallBar) && isSelected && (
          <Rect
            width={unrotatedWPx}
            height={unrotatedHPx}
            fill="transparent"
            stroke={SELECT_STROKE}
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
        // Paper halo so the name stays readable over product art as well
        // as over the paper floor.
        stroke={LABEL_HALO}
        strokeWidth={2.5}
        fillAfterStrokeEnabled
        listening={false}
        ellipsis
        wrap="word"
        visible={!symbol || wPx >= 40}
      />
      <Text
        x={4}
        y={hPx - 14}
        text={CATEGORY_LABELS[product.category]}
        fontSize={9}
        fontFamily="Inter, sans-serif"
        fill={LABEL_TEXT_MUTED}
        stroke={LABEL_HALO}
        strokeWidth={2}
        fillAfterStrokeEnabled
        listening={false}
        visible={hPx >= 40 && wPx >= 40}
      />
      {isSelected && (
        <>
          <Circle x={0} y={0} radius={4} fill={HANDLE_FILL} />
          <Circle x={wPx} y={0} radius={4} fill={HANDLE_FILL} />
          <Circle x={0} y={hPx} radius={4} fill={HANDLE_FILL} />
          <Circle x={wPx} y={hPx} radius={4} fill={HANDLE_FILL} />
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
            fill={HANDLE_FILL}
            stroke={LABEL_HALO}
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
              // Centre of the AABB in ABSOLUTE (stage-scaled) pixels. The
              // old code added unscaled layer px (wPx / 2) to a scaled
              // absolute position, so at any zoom other than 100 % the
              // pivot was off and the first drag tick gave a wrong angle.
              // Mapping the layer-space centre through the parent's own
              // absolute transform keeps every term in the same space.
              const parent = node.getParent();
              const centreAbs = parent
                ? parent.getAbsoluteTransform().point({ x: wPx / 2, y: hPx / 2 })
                : { x: wPx / 2, y: hPx / 2 };
              const centreX = centreAbs.x;
              const centreY = centreAbs.y;
              const handleAbs = node.getAbsolutePosition();
              const dx = handleAbs.x - centreX;
              const dy = handleAbs.y - centreY;
              // Angle in degrees, 0° pointing up (which is where the
              // handle sits at rest). Konva y-axis grows downward, so
              // negate before atan2 for natural CW=positive semantics.
              const rad = Math.atan2(dx, -dy);
              let deg = (rad * 180) / Math.PI;
              // "More angles" (Vic 2026-08-28): the drag handle snaps to 15°
              // detents by default — 24 orientations, and because 0/90/180/270
              // are all multiples of 15 the cardinal facings still snap cleanly
              // for square-to-wall alignment. Hold Shift or Alt for a fully
              // free angle. (90° quarter-turns stay available on the ⟳ cluster
              // button + the R key.)
              const HANDLE_DETENT_DEG = 15;
              const free = e.evt.shiftKey || e.evt.altKey;
              if (!free) {
                deg = Math.round(deg / HANDLE_DETENT_DEG) * HANDLE_DETENT_DEG;
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
 * Sims world (2026-08-29) — architectural plan symbols for products that
 * are drawn, not photographed, from above: lights (circle + cross, the
 * drafting convention), greenery (soft canopy), garden furniture. Sized in
 * world px so scale is honest, drawn inside the item's rotating art group.
 */
function PlanSymbol({
  symbol,
  width,
  height,
  lit,
  selected,
}: {
  symbol: NonNullable<ReturnType<typeof planSymbolOf>>;
  width: number;
  height: number;
  lit: boolean;
  selected: boolean;
}): JSX.Element {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2;
  const ink = selected ? SELECT_STROKE : WALL_INK;
  if (symbol === 'tree') {
    // Three overlapping canopy discs read as foliage from above.
    const lobes = [
      { x: cx, y: cy - r * 0.18, rr: r * 0.72 },
      { x: cx - r * 0.42, y: cy + r * 0.28, rr: r * 0.58 },
      { x: cx + r * 0.44, y: cy + r * 0.24, rr: r * 0.6 },
      { x: cx, y: cy + r * 0.46, rr: r * 0.5 },
    ];
    return (
      <Group listening={false}>
        {lobes.map((l, i) => (
          <Circle
            key={i}
            x={l.x}
            y={l.y}
            radius={l.rr}
            fill={GREENERY_FILL}
            opacity={0.92}
            shadowColor={ITEM_SHADOW}
            shadowBlur={10}
            shadowOffsetX={3}
            shadowOffsetY={5}
          />
        ))}
        {lobes.map((l, i) => (
          <Circle key={`s-${i}`} x={l.x} y={l.y} radius={l.rr} stroke={GREENERY_STROKE} strokeWidth={1} opacity={0.6} />
        ))}
        <Circle x={cx} y={cy} radius={Math.max(2, r * 0.08)} fill={GREENERY_STROKE} />
      </Group>
    );
  }
  if (symbol === 'hedge') {
    return (
      <Group listening={false}>
        <Rect
          width={width}
          height={height}
          cornerRadius={Math.min(width, height) / 2}
          fill={GREENERY_FILL}
          stroke={GREENERY_STROKE}
          strokeWidth={1}
          shadowColor={ITEM_SHADOW}
          shadowBlur={6}
          shadowOffsetX={2}
          shadowOffsetY={3}
        />
        {Array.from({ length: Math.max(1, Math.floor(width / Math.max(height, 1))) }, (_, i) => (
          <Circle
            key={i}
            x={(i + 0.5) * (width / Math.max(1, Math.floor(width / Math.max(height, 1))))}
            y={cy}
            radius={height * 0.32}
            stroke={GREENERY_STROKE}
            strokeWidth={0.8}
            opacity={0.45}
          />
        ))}
      </Group>
    );
  }
  if (symbol === 'bench' || symbol === 'bar') {
    const slats = Math.max(2, Math.round(width / Math.max(8, height * 0.35)));
    return (
      <Group listening={false}>
        <Rect
          width={width}
          height={height}
          fill={ROOM_FILL}
          stroke={ink}
          strokeWidth={1.2}
          cornerRadius={2}
          shadowColor={ITEM_SHADOW}
          shadowBlur={6}
          shadowOffsetX={2}
          shadowOffsetY={3}
        />
        {Array.from({ length: slats - 1 }, (_, i) => {
          const x = ((i + 1) * width) / slats;
          return <Line key={i} points={[x, 2, x, height - 2]} stroke={ink} strokeWidth={0.8} opacity={0.6} />;
        })}
      </Group>
    );
  }
  // 'light' and 'pendant': the drafting symbol — a circle with a cross
  // (pendant: an X inside), filled warm while switched on.
  const pendant = symbol === 'pendant';
  const arm = r * 1.35;
  return (
    <Group listening={false}>
      <Circle
        x={cx}
        y={cy}
        radius={r * 0.78}
        fill={lit ? 'rgba(255,214,140,0.95)' : ROOM_FILL}
        stroke={ink}
        strokeWidth={1.4}
        shadowColor={lit ? 'rgba(255,200,110,0.6)' : ITEM_SHADOW}
        shadowBlur={lit ? 10 : 4}
      />
      {pendant ? (
        <>
          <Line points={[cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5]} stroke={ink} strokeWidth={1.2} />
          <Line points={[cx + r * 0.5, cy - r * 0.5, cx - r * 0.5, cy + r * 0.5]} stroke={ink} strokeWidth={1.2} />
        </>
      ) : (
        <>
          <Line points={[cx - arm, cy, cx + arm, cy]} stroke={ink} strokeWidth={1.2} />
          <Line points={[cx, cy - arm, cx, cy + arm]} stroke={ink} strokeWidth={1.2} />
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
      {/* Paper base — the "loading" surface in the plan register. */}
      <Rect
        width={width}
        height={height}
        fill="#E7E2D8"
        opacity={0.9}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={3}
      />
      {/* Soft shimmer overlay. Animated opacity (or static for
          reduced-motion). Inset slightly so the frame stays visible. */}
      <Rect
        ref={shimmerRef}
        x={2}
        y={2}
        width={Math.max(width - 4, 0)}
        height={Math.max(height - 4, 0)}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: width, y: height }}
        fillLinearGradientColorStops={[0, '#F8F5EE', 0.5, '#CFC9BC', 1, '#F8F5EE']}
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

/**
 * Minimum on-screen tile edge before seams are worth drawing.
 *
 * Same reasoning as the grid tier: below this a seam is visual noise that
 * costs a path segment per tile.
 */
const MIN_SEAM_PX = 6;

/**
 * Draw one material zone as a SINGLE Konva node (floor-painting brief, D8).
 *
 * One node per tile would put thousands of nodes on the canvas for a normal
 * room - exactly the mistake the adaptive-grid work just fixed for grid
 * lines. Instead every run in the zone becomes one rect in one path, filled
 * once. A 400-tile room is ~20 rects in a single node.
 *
 * Seams are a second path in the SAME node, and are skipped entirely when a
 * tile is too small on screen to read.
 */
function floorZoneSceneFunc(
  zone: FloorZone,
  pxPerMetre: number,
  viewportScale: number,
  fill: string,
) {
  return (ctx: Konva.Context, shape: Konva.Shape): void => {
    const runs = zone.runs;
    ctx.beginPath();
    for (let i = 0; i + 2 < runs.length; i += 3) {
      const row = runs[i];
      const col = runs[i + 1];
      const len = runs[i + 2];
      const r = tileRect(zone, row, col);
      ctx.rect(r.x * pxPerMetre, r.y * pxPerMetre, r.w * len * pxPerMetre, r.h * pxPerMetre);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    const edgePx = Math.min(zone.tileWm, zone.tileHm) * pxPerMetre * viewportScale;
    if (edgePx >= MIN_SEAM_PX) {
      // Seams make a tiled floor read as tiles rather than a colour wash,
      // which is what tells the customer what they are buying. One fixed
      // cool grey, never derived from the material colour - a derived seam
      // disappears on a mid-grey material.
      ctx.beginPath();
      for (let i = 0; i + 2 < runs.length; i += 3) {
        const row = runs[i];
        const col = runs[i + 1];
        const len = runs[i + 2];
        for (let k = 0; k < len; k++) {
          const r = tileRect(zone, row, col + k);
          ctx.rect(r.x * pxPerMetre, r.y * pxPerMetre, r.w * pxPerMetre, r.h * pxPerMetre);
        }
      }
      ctx.strokeStyle = 'rgba(20,26,34,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Konva needs this to associate the path with the node for hit/caching.
    ctx.fillStrokeShape(shape);
  };
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
