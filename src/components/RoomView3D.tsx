/**
 * RoomView3D — the Sims-style view of the storey (Vic 2026-09-14), now the
 * designer's 3D MODE (Vic 2026-09-17: "make it a super realistic 3D version
 * of the 2D … not exclusive to paint … functioning exactly like The Sims,
 * it should reflect what's done on the 2D and vice versa"). A dollhouse
 * camera: walls up where they face you, cut down to a stub where they would
 * hide the room, doors and windows cut through, the floor finish laid,
 * furniture as textured bodies fitted EXACTLY to the catalog's dimensions
 * (designer/fitToSize.ts) — and every wall painted the colour the plan says.
 *
 * Drag to orbit, wheel / pinch to zoom. With the Wall-paint tool armed,
 * CLICK A WALL TO PAINT IT. Otherwise, in the workspace: TAP an item to
 * select it (the plan selects it too), DRAG it across the floor to move it
 * — the drop lands through the plan's own rules (wall snap, tile lattice,
 * collision, room routing; designer/itemDrop.ts), so 2D and 3D are one plan
 * — and, with a catalog product armed, TAP the floor to place it there.
 *
 * Rendering: `components/three/ThreeStage.tsx` (WebGL, lazy — its own
 * chunk, fetched the first time a 3D view opens) draws the solids that
 * `designer/roomSolids.ts` derives from the SAME `SceneInput` the original
 * canvas painter (`designer/roomView3d.ts`) takes. The painter stays as the
 * fallback when WebGL cannot start. This file owns the camera state, the
 * gestures, the store reads and the e2e bridge; it is a separate React tree
 * from the Konva plan — nothing here touches the stable-locked canvas.
 *
 * Two variants: `card` (docked inside the paint panel) and `overlay` (the
 * workspace: takes the plan's place; Esc / Plan returns).
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { usePropertyStore, type Property, type Room } from '../store/propertyStore';
import { PRECISION_STEP_M, useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore, isScreenTarget } from '../store/placementIntentStore';
import { useToastStore } from '../store/toastStore';
import { useCatalogStore } from '../store/catalogStore';
import { rotateSelected, deleteSelected, duplicateSelected } from '../lib/placementActions';
import { haptic } from '../lib/haptics';
import { brushPaintId, type BrushModifiers } from '../designer/wallPaintBrush';
import { previewFloorDrag } from '../designer/floorPaintBrush';
import { activeLevelIdOf, isOutdoorRoom, isRoofLevel, isRoofRoom, roomsOnLevel } from '../designer/levels';
import { buildingLevels, levelElevationM, levelHeightM, type BuildingStair } from '../designer/building';
import { buildingSolids, type BuildingView } from '../designer/buildingScene';
import { validateStairPlacement } from '../designer/stairPlacement';
import { EnergySummary } from './EnergyPanel';
import { HouseWorkspace, type HouseMode } from './HouseWorkspace';
import { previewRectRoomBuild, type RoomBuildPreview } from '../designer/roomBuildGesture';
import { commitRectRoomBuild } from '../lib/roomBuildActions';
import { BuildingControls } from './BuildingControls';
import { useSmoothedCamera } from './useSmoothedCamera';
import { panOrbitCamera } from '../designer/cameraMotion';
import { GardenPanel } from './GardenPanel';
import { gardenPoints, moveGardenFence, type GardenPlacement } from '../designer/garden';
import { wallsOnLevel } from '../designer/freeWalls';
import { edgeKey, pointAlongEdge, projectOntoEdge, roomEdges, sharedEdgeMap } from '../designer/wallEdges';
import { openingSpan } from '../designer/openings';
import { isDrawnPolygon } from '../designer/roomLayout';
import { roomFloorMaterial } from '../designer/floorFinish';
import { floorKindOf } from '../designer/floorKind';
import { emitsLight } from '../designer/lighting';
import { findFloorMaterialById } from '../data/floorMaterials';
import { findCladdingProduct } from '../data/claddingCatalog';
import { getProductById, productImageUrl, productTopDownUrl } from '../data/products';
import { hasFurniturePreview, FURNITURE_PREVIEW_NOTE } from '../data/dimensionalPreview';
import { productModelFor } from '../data/productModels';
import { DEFAULT_WALL_HEIGHT_M, findWallPaintById, finishOfPaint, resolveWallColourHex } from '../data/wallPaints';
import { RoomViewControls, type CameraView } from './RoomViewControls';
import { useBelowMd } from '../lib/useBelowMd';
import {
  boundsOf,
  buildScene,
  cameraPosition,
  clampCamera,
  DEFAULT_AZIMUTH_RAD,
  DEFAULT_ELEVATION_RAD,
  drawScene,
  fitCamera,
  hitTestWall,
  itemFillForCategory,
  projectScene,
  type OrbitCamera,
  type ProjectedFace,
  type SceneInput,
  type SceneItemInput,
  type SceneRoomInput,
  type WallHit,
} from '../designer/roomView3d';
import type { SceneSolids } from '../designer/roomSolids';
import type { ThreeStageHandle } from './three/ThreeStage';

// The GL renderer and three itself arrive in their own chunk, on first use.
const ThreeStage = lazy(() => import('./three/ThreeStage'));

export interface RoomView3DProps {
  variant: 'card' | 'overlay';
  /**
   * Called with each wall the brush touches — a click, or every wall a
   * mouse drag runs along — with the Sims keys (Shift = room, Ctrl =
   * erase). Omit for a view-only render. Returns the one-line result to
   * flash as the caption, if any.
   */
  onPaintWall?: (hit: WallHit, mods?: BrushModifiers) => string | void;
  /**
   * Called when the Floor tool taps / clicks / drags the floor in 3D Mode —
   * same Sims keys as wall paint (Shift = whole room, Ctrl = erase). Points
   * are in plan metres. Pass `end` for a drag-rectangle stroke (commit on
   * release). Omit when Floor is not armed.
   */
  onPaintFloor?: (
    hit: { x: number; y: number },
    mods?: BrushModifiers,
    end?: { x: number; y: number },
  ) => string | void;
  /** The brush colour, previewed ON the hovered wall; null while Erase is on (previews bare plaster). */
  brushHex?: string | null;
  /** The price tag for the wall under the brush — "VIP Satin · Pastel green ≈ 12.7 m² · 2.7 L · Rs 774" (P3). */
  hoverTag?: (hit: WallHit) => string | null;
  /** Overlay: close it. Card: open the overlay. */
  onClose?: () => void;
  onSave?: () => void;
  onCart?: () => void;
  onExpand?: () => void;
  /** One line under the view — the live paint quote, typically. */
  footer?: string;
  /** Read-out of what the brush will do, shown as the caption. */
  caption?: string;
  /** Overlay only: a strip under the view (the phone's brush controls). */
  brushStrip?: ReactNode;
  /** Overlay title (the mode's name) — defaults to the paint-era title. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/** Selection card controls (overlay): 44 px on the phone, 36 px from md. */
const SEL_BTN =
  'inline-flex h-11 md:h-9 items-center justify-center rounded-lg border px-3 text-[12px] font-semibold transition-colors duration-[120ms] ease-out focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';

/** Screen-space bridge for e2e: click a wall by its identity, not by pixels. */
interface RoomView3DBridge {
  wallScreenPoint: (hit: WallHit) => { x: number; y: number } | null;
  faceCount: () => number;
  /** Every drawn face by key with its hole count — lets a spec assert a doorway exists. */
  faces: () => Array<{ key: string; holes: number }>;
  camera: () => OrbitCamera | null;
  /** 'gl' when three draws, 'painter' on the canvas fallback. */
  backend: () => 'gl' | 'painter';
  /** The wall a click at these CLIENT coordinates would paint — lets a spec check its aim before it fires. */
  hitAt: (clientX: number, clientY: number) => WallHit | null;
  /** The GL stage's own account of itself (frames drawn, parts, camera). */
  debug: () => ReturnType<ThreeStageHandle['debug']> | null;
  /** CLIENT point over an item's body (its plan centre projected), for a spec to tap or drag. */
  itemScreenPoint: (instanceId: string) => { x: number; y: number } | null;
  /** CLIENT point over a plan point on the floor. */
  floorScreenPoint: (roomX: number, roomY: number) => { x: number; y: number } | null;
  /** The plan point on the floor under a CLIENT point (GL only), so a spec can aim a drag in metres. */
  floorAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** What a wall's material shows (GL only): the brush preview while hovered, else its own paint. */
  wallMaterial: (hit: WallHit) => { hex: string; baseHex: string; finish: string | null; roughness: number; sheen: number; hasMap: boolean; show: string } | null;
  /** The rendered colour at a CLIENT point (GL only) — the proof that a paint is visible. */
  samplePixel: (clientX: number, clientY: number) => { r: number; g: number; b: number } | null;
  /** Bisect the rig live (GL only). */
  tune: (opts: { hemi?: number; sun?: number; fill?: number; env?: boolean; normals?: number; maps?: boolean }) => void;
  /** What the stage has dressed (P3): joinery pieces, corner shades, lamps, contact shadows, floor kinds (GL only). */
  dressing: () => { joinery: number; shades: number; lamps: number; contactShadows: number; floors: Array<{ key: string; kind: string }>; bodies: number; artBoxes: number } | null;
}
/**
 * The card and the overlay can be mounted together (md+), so each registers
 * under its own key and the top-level functions read the overlay when it is
 * open, else the card. Closing the overlay never blanks the card's bridge.
 */
interface RoomView3DBridgeRegistry extends RoomView3DBridge {
  instances: Partial<Record<'card' | 'overlay', RoomView3DBridge>>;
}
declare global {
  interface Window {
    __ppwRoomView3d?: RoomView3DBridgeRegistry;
  }
}
function bridgeRegistry(): RoomView3DBridgeRegistry {
  if (!window.__ppwRoomView3d) {
    const pick = () => reg.instances.overlay ?? reg.instances.card;
    const reg: RoomView3DBridgeRegistry = {
      instances: {},
      wallScreenPoint: (hit) => pick()?.wallScreenPoint(hit) ?? null,
      faceCount: () => pick()?.faceCount() ?? 0,
      faces: () => pick()?.faces() ?? [],
      camera: () => pick()?.camera() ?? null,
      backend: () => pick()?.backend() ?? 'painter',
      hitAt: (x, y) => pick()?.hitAt(x, y) ?? null,
      debug: () => pick()?.debug() ?? null,
      itemScreenPoint: (id) => pick()?.itemScreenPoint(id) ?? null,
      floorScreenPoint: (x, y) => pick()?.floorScreenPoint(x, y) ?? null,
      floorAt: (x, y) => pick()?.floorAt(x, y) ?? null,
      wallMaterial: (hit) => pick()?.wallMaterial(hit) ?? null,
      samplePixel: (x, y) => pick()?.samplePixel(x, y) ?? null,
      tune: (o) => pick()?.tune(o),
      dressing: () => pick()?.dressing() ?? null,
    };
    window.__ppwRoomView3d = reg;
  }
  return window.__ppwRoomView3d;
}

/**
 * Every opening that cuts a room's wall, including the neighbour's: a door
 * hosted by room A on a wall shared with room B must also be a hole in B's
 * wall, or it vanishes the moment the camera looks at that wall from B's
 * side (review 2026-09-14). Same world-point projection the plan uses.
 */
function openingsIncludingNeighbours(rooms: Room[]): Map<string, NonNullable<SceneRoomInput['openings']>> {
  const drawn = rooms.filter((r) => !isOutdoorRoom(r) && !isRoofRoom(r) && isDrawnPolygon(r.polygon));
  const shared = sharedEdgeMap(drawn.map((r) => ({ id: r.id, polygon: r.polygon })));
  const edgesByRoom = new Map(drawn.map((r) => [r.id, roomEdges(r)]));
  const byId = new Map(drawn.map((r) => [r.id, r]));
  const out = new Map<string, NonNullable<SceneRoomInput['openings']>>();
  for (const room of drawn) {
    const list: NonNullable<SceneRoomInput['openings']> = [...(room.openings ?? [])];
    for (const edge of edgesByRoom.get(room.id) ?? []) {
      for (const ref of shared.get(edgeKey(room.id, edge.index)) ?? []) {
        const nRoom = byId.get(ref.roomId);
        const nEdge = edgesByRoom.get(ref.roomId)?.[ref.edgeIndex];
        if (!nRoom || !nEdge) continue;
        for (const o of nRoom.openings ?? []) {
          if (o.edgeIndex !== ref.edgeIndex) continue;
          const span = openingSpan(o);
          const t0 = projectOntoEdge(edge, pointAlongEdge(nEdge, span.t0));
          const t1 = projectOntoEdge(edge, pointAlongEdge(nEdge, span.t1));
          list.push({ edgeIndex: edge.index, offsetM: (t0 + t1) / 2, widthM: Math.abs(t1 - t0), kind: o.kind, sillM: o.sillM });
        }
      }
    }
    out.set(room.id, list);
  }
  return out;
}

function sceneFromProperty(property: Property, hover: WallHit | null, cam: OrbitCamera): SceneInput {
  const level = activeLevelIdOf(property);
  const rooms = roomsOnLevel(property.rooms, level);
  const walls = wallsOnLevel(property.walls ?? [], level);
  const H = property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M;
  const openingsByRoom = openingsIncludingNeighbours(rooms);
  const sceneRooms: SceneRoomInput[] = rooms.map((room: Room) => {
    // A roof slab has no walls to paint — items only, like outdoors.
    const outdoor = isOutdoorRoom(room) || isRoofRoom(room) || !isDrawnPolygon(room.polygon);
    const wallColourByEdge = new Map<number, string>();
    const wallFinishByEdge = new Map<number, string>();
    for (const e of room.wallPaint ?? []) {
      wallColourByEdge.set(e.edgeIndex, resolveWallColourHex(e.paintId, e.colourHex));
      const finish = finishOfPaint(e.paintId);
      if (finish) wallFinishByEdge.set(e.edgeIndex, finish);
    }
    // Sample cladding covers the painted face when both are present.
    for (const e of room.wallCladding ?? []) {
      const clad = findCladdingProduct(e.productId);
      if (!clad) continue;
      wallColourByEdge.set(e.edgeIndex, clad.hex);
      wallFinishByEdge.set(e.edgeIndex, 'textured');
    }
    // Floor: the largest painted zone's material, else the whole-room finish —
    // its hex, and (P3) what it reads as and its tile size for the surface.
    let floorMaterial = roomFloorMaterial(room);
    const zones = room.floorTiles ?? [];
    if (zones.length > 0) {
      const biggest = [...zones].sort((a, b) => b.runs.length - a.runs.length)[0];
      floorMaterial = findFloorMaterialById(biggest.materialId) ?? floorMaterial;
    }
    const floorHex = floorMaterial?.hex ?? undefined;
    const floorKind = floorKindOf(floorMaterial);
    const floorTileM = floorMaterial?.tile_w_m ?? undefined;
    const items: SceneItemInput[] = [];
    for (const it of room.placedItems) {
      const p = getProductById(it.productId);
      if (!p) continue;
      const body = productModelFor(p);
      const lamp = emitsLight(p);
      const hM = p.dimensions_cm.height / 100;
      // Where a lamp's light comes from: a pendant hangs from the ceiling, a
      // sconce sits at its mount height, a floor or table lamp near its top.
      const lightMountM = !lamp ? undefined : p.placement === 'ceiling' ? Math.max(0.5, H - 0.35) : p.placement === 'wall' ? (p.mount_height_cm ?? 170) / 100 + hM * 0.5 : Math.max(0.3, hM * 0.85);
      // No body → the box wears the product's own art (a data: SVG thumbnail
      // is the catalog's "no image" — the box stays a shaded box then).
      const artTop = body ? undefined : productTopDownUrl(p);
      const artSide = body ? undefined : productImageUrl(p);
      items.push({
        emitsLight: lamp,
        lightMountM,
        artTopUrl: artTop && !artTop.startsWith('data:') ? artTop : undefined,
        artSideUrl: artSide && !artSide.startsWith('data:') ? artSide : undefined,
        instanceId: it.instanceId,
        x: it.x,
        y: it.y,
        rotation: it.rotation,
        lengthCm: p.dimensions_cm.length,
        widthCm: p.dimensions_cm.width,
        heightCm: p.dimensions_cm.height,
        placement: p.placement,
        mountHeightCm: p.mount_height_cm,
        fill: itemFillForCategory(p.category),
        productId: p.id,
        frontEdge: p.front_edge,
        meshUrl: body?.url,
        modelFront: body?.modelFront,
        lengthAxis: body?.lengthAxis,
        modelUp: body?.modelUp,
      });
    }
    return {
      id: room.id,
      name: room.name,
      polygon: room.polygon,
      openings: openingsByRoom.get(room.id) ?? room.openings,
      wallColourByEdge,
      wallFinishByEdge,
      floorHex,
      floorKind,
      floorTileM,
      kind: outdoor ? 'outdoor' : 'room',
      items,
    };
  });
  return {
    rooms: sceneRooms,
    walls: walls.map((w) => ({
      id: w.id,
      a: w.a,
      b: w.b,
      thicknessM: w.thicknessM,
      colourHex: findCladdingProduct(w.claddingId)?.hex ?? (w.paintId ? resolveWallColourHex(w.paintId, w.paintColourHex) : undefined),
      finish: finishOfPaint(w.paintId),
    })),
    wallHeightM: H,
    cameraPos: cameraPosition(cam),
    cameraTarget: cam.target,
    hover,
  };
}

/** The solids do not depend on the camera; this stand-in keeps the memo keyed on the plan alone. */
const SOLIDS_CAMERA: OrbitCamera = { target: { x: 0, y: 0, z: 0 }, azimuthRad: 0, elevationRad: 0.6, distanceM: 10, fovRad: 0.9 };

/**
 * "Living room · Wall 2 · Soft Feel · Coral" for the hover caption — or,
 * with the brush armed and a price tag from the panel, what the click would
 * buy: "Living room · Wall 2 → VIP Satin · Pastel green ≈ 12.7 m² · 2.7 L ·
 * Rs 774 — click to paint" (The Sims shows the price before the click; P3).
 */
function describeHit(property: Property, hit: WallHit | null, tag?: string | null): string | null {
  if (!hit) return null;
  if (hit.kind === 'edge') {
    const room = property.rooms.find((r) => r.id === hit.roomId);
    if (!room) return null;
    const painted = room.wallPaint?.find((e) => e.edgeIndex === hit.edgeIndex);
    const paint = painted ? findWallPaintById(painted.paintId) : undefined;
    const colour = painted?.colourName ?? painted?.colourHex;
    const current = `${paint ? ` · ${paint.name}` : ' · unpainted'}${colour ? ` · ${colour}` : ''}`;
    return `${room.name} · Wall ${(hit.edgeIndex ?? 0) + 1}${tag ? ` → ${tag}` : current} — click to paint`;
  }
  const w = property.walls?.find((x) => x.id === hit.wallId);
  if (!w) return null;
  const paint = w.paintId ? findWallPaintById(w.paintId) : undefined;
  const colour = w.paintColourName ?? w.paintColourHex;
  const current = `${paint ? ` · ${paint.name}` : ' · unpainted'}${colour ? ` · ${colour}` : ''}`;
  return `Free wall${tag ? ` → ${tag}` : current}${tag ? ' — click to paint' : ''}`;
}

/** The plan's record of an item, wherever it lives. */
function findPlacedItem(property: Property, instanceId: string) {
  for (const room of property.rooms) {
    const it = room.placedItems.find((i) => i.instanceId === instanceId);
    if (it) return it;
  }
  return null;
}

/** A wall hit as a set key, for a paint stroke's "already painted" list. */
function hitKey(h: WallHit): string {
  return h.kind === 'edge' ? `e:${h.roomId}:${h.edgeIndex}` : `f:${h.wallId}`;
}

export function RoomView3D({ variant, onPaintWall, onPaintFloor, brushHex, hoverTag, onClose, onSave, onCart, onExpand, footer, caption, brushStrip, title, className = '', style }: RoomView3DProps): JSX.Element {
  const property = usePropertyStore((s) => s.property);
  const selectedInstanceId = usePropertyStore((s) => s.selectedInstanceId);
  const selectItem = usePropertyStore((s) => s.selectItem);
  const tool = useDesignerUIStore((s) => s.tool);
  const wallPaintDraft = useDesignerUIStore((s) => s.wallPaintDraft);
  const viewMode = useDesignerUIStore((s) => s.viewMode);
  const wallView = useDesignerUIStore((s) => s.wallView);
  const setWallView = useDesignerUIStore((s) => s.setWallView);
  const sunHour = useDesignerUIStore((s) => s.sunHour);
  const setSunHour = useDesignerUIStore((s) => s.setSunHour);
  const energyOpen = useDesignerUIStore((s) => s.energyPanelOpen);
  const belowMd = useBelowMd();
  const [panMode, setPanMode] = useState(false);
  // The merchant catalog arriving makes `m-` items resolvable — re-derive.
  const catalogVersion = useCatalogStore((s) => s.version);
  /** One-line result of the last stroke, shown as the caption for a moment. */
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFlash = useCallback((text: string) => {
    setFlash(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2600);
  }, []);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);
  const armedProductId = usePlacementIntentStore((s) => s.armedProductId);
  const placeAtPoint = usePlacementIntentStore((s) => s.placeAtPoint);
  const moveTo = usePlacementIntentStore((s) => s.moveTo);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<ThreeStageHandle | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<OrbitCamera | null>(null);
  const displayedCamera = useSmoothedCamera(camera);
  const [moveFeedback, setMoveFeedback] = useState<string | null>(null);
  const [buildingView, setBuildingView] = useState<BuildingView>('building');
  const [showRoof, setShowRoof] = useState(false);
  const [constructionTool, setConstructionTool] = useState<'select' | 'room' | 'stair' | 'window' | 'door'>('select');
  const [houseMode, setHouseMode] = useState<HouseMode>('build');
  const [roomPreview, setRoomPreview] = useState<RoomBuildPreview | null>(null);
  const roomDrag = useRef<RoomBuildPreview | null>(null);
  const [gardenOpen, setGardenOpen] = useState(false);
  const [gardenPlacement, setGardenPlacement] = useState<GardenPlacement | null>(null);
  const [hover, setHover] = useState<WallHit | null>(null);
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  // 'gl' until WebGL refuses to start; then the canvas painter takes over.
  const [backend, setBackend] = useState<'gl' | 'painter'>('gl');
  const baseDistanceRef = useRef(10);
  const level = activeLevelIdOf(property);
  const levelEntries = buildingLevels(property);
  const onRoofLevel = isRoofLevel(levelEntries.find((entry) => entry.level.id === level)?.level);
  // Solar products and the existing energy panel select the roof. Make that
  // working surface visible, including when roof display was previously off.
  useEffect(() => {
    if (onRoofLevel) { setShowRoof(true); setBuildingView('floor'); }
  }, [level, onRoofLevel]);
  useEffect(() => {
    if (tool !== 'hand' || armedProductId) {
      setPanMode(false);
      setConstructionTool('select');
      setGardenPlacement(null);
      setGardenOpen(false);
    }
  }, [tool, armedProductId]);
  useEffect(() => {
    if (energyOpen) { setConstructionTool('select'); setGardenPlacement(null); setGardenOpen(false); }
  }, [energyOpen]);
  useEffect(() => { roomDrag.current = null; setRoomPreview(null); }, [level, constructionTool]);
  const activeHeight = levelHeightM(property, level) || DEFAULT_WALL_HEIGHT_M;
  const baseElevation = buildingView === 'floor' ? levelElevationM(property, level) : 0;
  const H = buildingView === 'building'
    ? Math.max(activeHeight, ...levelEntries.filter((e) => !isRoofLevel(e.level)).map((e) => e.elevationM + e.heightM))
    : activeHeight;

  // Items are live in the workspace when no wall tool holds the click.
  const itemsInteractive = variant === 'overlay' && !panMode && !gardenPlacement && constructionTool === 'select' && !onPaintWall && !onPaintFloor && tool === 'hand' && backend === 'gl';
  /**
   * Floor tool stroke (Sims tile paint): press anchors, drag grows a rect,
   * release commits once (one undo). Room/Shift fill still fire immediately.
   */
  const floorStroke = useRef<{
    from: { x: number; y: number };
    mods: BrushModifiers;
    fillNow: boolean;
  } | null>(null);
  const [floorPreview, setFloorPreview] = useState<{ count: number; erase: boolean } | null>(null);
  useEffect(() => {
    if (!onPaintFloor) {
      floorStroke.current = null;
      setFloorPreview(null);
    }
  }, [onPaintFloor]);

  // Bounds of the storey in view — the camera re-frames when they change.
  const sceneBounds = useMemo(() => {
    const rooms = (buildingView === 'building' ? property.rooms : roomsOnLevel(property.rooms, level)).filter((r) => !isOutdoorRoom(r) && isDrawnPolygon(r.polygon));
    const walls = buildingView === 'building' ? property.walls ?? [] : wallsOnLevel(property.walls ?? [], level);
    const landscape = (buildingView === 'building' || level === 'ground') && property.garden ? gardenPoints(property.garden) : [];
    return boundsOf(landscape.length ? [...rooms, { polygon: landscape }] : rooms, walls);
  }, [property, level, buildingView]);
  // A blank project still has a buildable 3D ground plane.
  const bounds = sceneBounds ?? (variant === 'overlay' ? { minX: -2, minY: -2, maxX: 10, maxY: 10 } : null);
  const boundsKey = bounds
    ? [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].map((v) => Math.round(v * 10) / 10).join(',')
    : '';

  useEffect(() => {
    if (!bounds) {
      setCamera(null);
      return;
    }
    const aspect = size.height > 0 ? size.width / size.height : 1.4;
    const fitted = fitCamera(bounds, H, aspect);
    fitted.target.z += baseElevation;
    baseDistanceRef.current = fitted.distanceM;
    setCamera((prev) =>
      prev
        ? { ...fitted, azimuthRad: prev.azimuthRad, elevationRad: prev.elevationRad, distanceM: fitted.distanceM }
        : fitted,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, H, baseElevation, level, size.width > 0 ? Math.round((size.width / Math.max(1, size.height)) * 10) : 0]);

  // Size the view to its box.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.max(0, Math.round(r.width)), height: Math.max(0, Math.round(r.height)) });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // The solids follow the plan only; the camera just decides the cutaway.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const solids: SceneSolids = useMemo(() => buildingSolids(property, (p) => sceneFromProperty(p, null, SOLIDS_CAMERA), buildingView, showRoof), [property, catalogVersion, buildingView, showRoof]);

  // Painter fallback: only computed while it is the one drawing.
  const projected: ProjectedFace[] = useMemo(() => {
    if (backend !== 'painter' || !camera || size.width < 8 || size.height < 8) return [];
    const faces = buildingLevels(property)
      .filter((entry) => !isRoofLevel(entry.level) && (buildingView === 'building' || entry.level.id === level))
      .flatMap((entry) => buildScene(sceneFromProperty({ ...property, activeLevelId: entry.level.id, wallHeightM: entry.heightM }, hover, camera))
        .map((face) => ({ ...face, pts: face.pts.map((p) => ({ ...p, z: p.z + entry.elevationM })), holes: face.holes?.map((hole) => hole.map((p) => ({ ...p, z: p.z + entry.elevationM }))) })));
    return projectScene(faces, camera, size);
  }, [backend, property, hover, camera, size, buildingView, level]);

  useEffect(() => {
    if (backend !== 'painter') return;
    const canvas = painterRef.current;
    if (!canvas || size.width < 8 || size.height < 8) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size.width * dpr || canvas.height !== size.height * dpr) {
      canvas.width = size.width * dpr;
      canvas.height = size.height * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, projected, size);
  }, [backend, projected, size]);

  const hitAt = useCallback(
    (x: number, y: number): WallHit | null => (backend === 'gl' ? stageRef.current?.hitTest(x, y) ?? null : hitTestWall(projected, x, y)),
    [backend, projected],
  );

  // 3D Mode: a screen-based placement (a strip drop, "+ Add to room") is
  // meant for THIS floor while the room is on screen. Resolve it on the
  // floor plane and republish as a plan point for RoomCanvas to validate.
  const intent = usePlacementIntentStore((s) => s.intent);
  const consumeIntent = usePlacementIntentStore((s) => s.consume);
  useEffect(() => {
    if (variant !== 'overlay' || viewMode !== '3d' || !intent || !isScreenTarget(intent.target)) return;
    const stage = stageRef.current;
    const box = containerRef.current?.getBoundingClientRect();
    if (!stage || !box) return;
    const local =
      intent.target === 'center'
        ? { x: size.width / 2, y: size.height / 2 }
        : { x: intent.target.clientX - box.left, y: intent.target.clientY - box.top };
    const p = stage.floorPoint(local.x, local.y);
    if (p) placeAtPoint(intent.productId, p.x, p.y);
    else consumeIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.nonce, variant, viewMode]);

  // e2e bridge (DEV builds only, like the plan's geometry bridge).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const reg = bridgeRegistry();
    const clientOf = (p: { x: number; y: number } | null) => {
      const box = containerRef.current?.getBoundingClientRect();
      return p && box ? { x: box.left + p.x, y: box.top + p.y } : null;
    };
    reg.instances[variant] = {
      wallScreenPoint: (hit) => {
        const box = containerRef.current?.getBoundingClientRect();
        if (!box) return null;
        if (backend === 'gl') return clientOf(stageRef.current?.screenPoint(hit) ?? null);
        const face = projected.find(
          (f) =>
            f.face.hit &&
            f.face.hit.kind === hit.kind &&
            (hit.kind === 'edge'
              ? f.face.hit.roomId === hit.roomId && f.face.hit.edgeIndex === hit.edgeIndex
              : f.face.hit.wallId === hit.wallId) &&
            (f.face.kind === 'wall' || f.face.kind === 'wall-stub'),
        );
        if (!face) return null;
        const cx = face.pts.reduce((a, p) => a + p.x, 0) / face.pts.length;
        const cy = face.pts.reduce((a, p) => a + p.y, 0) / face.pts.length;
        return { x: box.left + cx, y: box.top + cy };
      },
      faceCount: () => (backend === 'gl' ? stageRef.current?.faceCount() ?? 0 : projected.length),
      faces: () => (backend === 'gl' ? stageRef.current?.faces() ?? [] : projected.map((f) => ({ key: f.face.key, holes: f.holes.length }))),
      camera: () => camera,
      backend: () => backend,
      hitAt: (clientX, clientY) => {
        const box = containerRef.current?.getBoundingClientRect();
        return box ? hitAt(clientX - box.left, clientY - box.top) : null;
      },
      debug: () => stageRef.current?.debug() ?? null,
      itemScreenPoint: (instanceId) => {
        const s = solids.items.find((i) => i.instanceId === instanceId);
        if (!s || !camera) return null;
        // The body's centre at half height, through the renderer that is drawing.
        const p = { x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2, z: (s.z0 + s.z1) / 2 };
        if (backend === 'gl') return clientOf(stageRef.current?.projectPoint(p.x, p.y, p.z) ?? null);
        const faces = projectScene([{ key: 'probe', kind: 'item', pts: [p], fill: '#000' }], camera, size);
        return faces[0] ? clientOf(faces[0].pts[0]) : null;
      },
      floorScreenPoint: (roomX, roomY) => {
        if (!camera) return null;
        const elevation = solids.activeElevationM ?? 0;
        if (backend === 'gl') return clientOf(stageRef.current?.projectPoint(roomX, roomY, elevation) ?? null);
        const faces = projectScene([{ key: 'probe', kind: 'floor', pts: [{ x: roomX, y: roomY, z: elevation }], fill: '#000' }], camera, size);
        return faces[0] ? clientOf(faces[0].pts[0]) : null;
      },
      floorAt: (clientX, clientY) => {
        const box = containerRef.current?.getBoundingClientRect();
        return box && backend === 'gl' ? stageRef.current?.floorPoint(clientX - box.left, clientY - box.top) ?? null : null;
      },
      wallMaterial: (hit) => (backend === 'gl' ? stageRef.current?.wallMaterial(hit) ?? null : null),
      tune: (o) => stageRef.current?.tune(o),
      dressing: () => (backend === 'gl' ? stageRef.current?.dressing() ?? null : null),
      samplePixel: (clientX, clientY) => {
        const box = containerRef.current?.getBoundingClientRect();
        return box && backend === 'gl' ? stageRef.current?.samplePixel(clientX - box.left, clientY - box.top) ?? null : null;
      },
    };
    return () => {
      const r = window.__ppwRoomView3d;
      if (r) delete r.instances[variant];
    };
  }, [projected, camera, variant, backend, hitAt, solids, size]);

  // ---- gestures -----------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: boolean; pinchDist: number } | null>(null);
  /** An item being carried across the floor. */
  const itemDrag = useRef<{ instanceId: string; start: { x: number; y: number }; dx: number; dy: number; moved: boolean } | null>(null);
  /**
   * A mouse stroke with the brush (The Sims' wallpaper tool): the press
   * paints the wall under it and the drag paints every wall it runs
   * along, once each. Touch keeps tap-to-paint and one-finger orbit.
   */
  const stroke = useRef<{ painted: Set<string>; mods: BrushModifiers } | null>(null);

  const paintHit = (hit: WallHit, mods: BrushModifiers) => {
    if (!onPaintWall) return;
    const detail = onPaintWall(hit, mods);
    haptic('place');
    if (detail) showFlash(detail);
  };

  const paintFloorHit = (
    point: { x: number; y: number },
    mods: BrushModifiers,
    end?: { x: number; y: number },
  ) => {
    if (!onPaintFloor) return;
    const detail = onPaintFloor(point, mods, end);
    haptic('place');
    if (detail) showFlash(detail);
  };

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = containerRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const zoomBy = useCallback((factor: number) => {
    setCamera((c) => (c ? clampCamera({ ...c, distanceM: c.distanceM * factor }, baseDistanceRef.current * 0.18, baseDistanceRef.current * 3) : c));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    // The right button always orbits (The Sims' camera drag), whatever tool
    // is armed — so a look-around never paints a wall or carries a product.
    const orbitOnly = e.pointerType === 'mouse' && e.button === 2;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      if (orbitOnly || panMode) {
        drag.current = { x: e.clientX, y: e.clientY, moved: false, pinchDist: 0 };
        return;
      }
      if (constructionTool === 'room' && stageRef.current) {
        const p = localPoint(e);
        const point = stageRef.current.floorPoint(p.x, p.y);
        if (point) {
          const preview = previewRectRoomBuild(property, point, point, { levelId: level, stepM: PRECISION_STEP_M[useDesignerUIStore.getState().precision] });
          roomDrag.current = preview;
          setRoomPreview(preview);
          drag.current = null;
          return;
        }
      }
      // The brush, with a mouse: a press on a wall starts a stroke.
      if (onPaintWall && e.pointerType === 'mouse') {
        const p = localPoint(e);
        const hit = hitAt(p.x, p.y);
        if (hit) {
          const mods: BrushModifiers = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
          stroke.current = { painted: new Set([hitKey(hit)]), mods };
          drag.current = null;
          paintHit(hit, mods);
          return;
        }
      }
      // Floor tool (Sims): press anchors a stroke. Room / Shift / Ctrl-room
      // fill commits immediately; Tile scope waits for release so a drag
      // lays a rectangle in one undo (docs/floor-paint-2026-08-28).
      if (onPaintFloor && stageRef.current) {
        const p = localPoint(e);
        const floor = stageRef.current.floorPoint(p.x, p.y);
        if (floor) {
          const mods: BrushModifiers = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
          const draft = useDesignerUIStore.getState().floorDraft;
          const mat = findFloorMaterialById(draft.materialId);
          // Room chip / Shift / roll → fill or clear the room now. Ctrl alone
          // with Tile scope still waits for release (erase the drag rect).
          const fillNow =
            draft.scope === 'room' || !!mods.shift || (mat ? mat.tile_w_m === null : false);
          drag.current = null;
          if (fillNow) {
            paintFloorHit(floor, mods);
            floorStroke.current = null;
            setFloorPreview(null);
            // Swallow the release so it does not orbit or re-fire.
            stroke.current = { painted: new Set(['floor']), mods };
            return;
          }
          floorStroke.current = { from: floor, mods, fillNow: false };
          setFloorPreview({ count: 1, erase: draft.erase || !!mods.ctrl });
          return;
        }
      }
      // A press on an item picks it up; anywhere else orbits.
      if (itemsInteractive && stageRef.current) {
        const p = localPoint(e);
        const hit = stageRef.current.hitItem(p.x, p.y);
        const floor = hit ? stageRef.current.floorPoint(p.x, p.y) : null;
        if (hit && floor) {
          itemDrag.current = { instanceId: hit.instanceId, start: floor, dx: 0, dy: 0, moved: false };
          drag.current = null;
          return;
        }
      }
      drag.current = { x: e.clientX, y: e.clientY, moved: false, pinchDist: 0 };
    } else if (pointers.current.size === 2) {
      // A second finger cancels a room draft without changing the plan.
      roomDrag.current = null;
      setRoomPreview(null);
      // A second finger ends any carry or stroke and starts a pinch.
      stroke.current = null;
      floorStroke.current = null;
      setFloorPreview(null);
      if (itemDrag.current) {
        stageRef.current?.resetItemPreview(itemDrag.current.instanceId);
        itemDrag.current = null;
        setMoveFeedback(null);
      }
      const [a, b] = [...pointers.current.values()];
      drag.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, moved: true, pinchDist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!pointers.current.has(e.pointerId)) {
      // Hover (mouse only): tint the wall under the pointer, or show a hand over an item.
      if (e.pointerType === 'mouse') {
        const p = localPoint(e);
        if (onPaintWall) setHover(hitAt(p.x, p.y));
        else if (itemsInteractive) setHoverItem(stageRef.current?.hitItem(p.x, p.y)?.instanceId ?? null);
      }
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (roomDrag.current && pointers.current.size === 1 && stageRef.current) {
      const p = localPoint(e);
      const point = stageRef.current.floorPoint(p.x, p.y);
      if (point) {
        const { from, stepM, levelId } = roomDrag.current;
        const preview = previewRectRoomBuild(usePropertyStore.getState().property, from, point, { stepM, levelId });
        roomDrag.current = preview;
        setRoomPreview(preview);
      }
      return;
    }
    const floorRun = floorStroke.current;
    if (floorRun && pointers.current.size === 1 && stageRef.current) {
      const p = localPoint(e);
      const floor = stageRef.current.floorPoint(p.x, p.y);
      if (floor) {
        const prev = previewFloorDrag(floorRun.from, floor, floorRun.mods);
        if (prev) setFloorPreview({ count: Math.max(1, prev.count), erase: prev.erase });
      }
      return;
    }
    const run = stroke.current;
    if (run && pointers.current.size === 1) {
      const p = localPoint(e);
      const hit = hitAt(p.x, p.y);
      setHover(hit);
      if (hit && !run.painted.has(hitKey(hit))) {
        run.painted.add(hitKey(hit));
        paintHit(hit, run.mods);
      }
      return;
    }
    const carry = itemDrag.current;
    if (carry && pointers.current.size === 1 && stageRef.current) {
      const p = localPoint(e);
      const floor = stageRef.current.floorPoint(p.x, p.y);
      if (!floor) return;
      carry.dx = floor.x - carry.start.x;
      carry.dy = floor.y - carry.start.y;
      if (!carry.moved && Math.hypot(carry.dx, carry.dy) < 0.03) return;
      carry.moved = true;
      const item = findPlacedItem(usePropertyStore.getState().property, carry.instanceId);
      const preview = item && usePlacementIntentStore.getState().previewMove(carry.instanceId, item.x + carry.dx, item.y + carry.dy, e.shiftKey);
      if (item && preview?.ok) {
        stageRef.current.moveItemPreview(carry.instanceId, preview.x - item.x, preview.y - item.y, preview.rotation);
        setMoveFeedback('Release to place · Shift holds the current rotation');
      } else {
        stageRef.current.moveItemPreview(carry.instanceId, carry.dx, carry.dy);
        setMoveFeedback(preview && !preview.ok ? preview.message : 'Release to place');
      }
      return;
    }
    if (!d) return;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      const dx = midX - d.x, dy = midY - d.y;
      setCamera((c) => c ? panOrbitCamera(c, dx, dy, size.height) : c);
      d.x = midX;
      d.y = midY;
      if (d.pinchDist > 0 && dist > 0) zoomBy(d.pinchDist / dist);
      d.pinchDist = dist;
      d.moved = true;
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    if ((panMode && e.buttons !== 2) || e.shiftKey) {
      setCamera((c) => c ? panOrbitCamera(c, dx, dy, size.height) : c);
      return;
    }
    setCamera((c) =>
      c
        ? clampCamera(
            { ...c, azimuthRad: c.azimuthRad - dx * 0.008, elevationRad: c.elevationRad + dy * 0.006 },
            baseDistanceRef.current * 0.18,
            baseDistanceRef.current * 3,
          )
        : c,
    );
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const had = pointers.current.delete(e.pointerId);
    if (e.pointerType === 'mouse' && e.button === 2) {
      // A right-button release ends an orbit and nothing else — never a tap.
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    if (roomDrag.current && had) {
      const draft = roomDrag.current;
      roomDrag.current = null;
      setRoomPreview(null);
      drag.current = null;
      if (!cancelled && stageRef.current) {
        const p = localPoint(e);
        const point = stageRef.current.floorPoint(p.x, p.y) ?? draft.to;
        const result = commitRectRoomBuild(previewRectRoomBuild(usePropertyStore.getState().property, draft.from, point, { stepM: draft.stepM, levelId: draft.levelId }));
        showFlash(result.ok ? `Room built · ${result.preview.areaM2.toFixed(1)} m²` : result.message);
      }
      return;
    }
    if (stroke.current && had) {
      // The stroke painted as it went; the release only ends it.
      stroke.current = null;
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    if (floorStroke.current && had) {
      const run = floorStroke.current;
      floorStroke.current = null;
      setFloorPreview(null);
      if (pointers.current.size === 0) drag.current = null;
      if (!cancelled && stageRef.current) {
        const p = localPoint(e);
        const end = stageRef.current.floorPoint(p.x, p.y) ?? run.from;
        paintFloorHit(run.from, run.mods, end);
      }
      return;
    }
    const carry = itemDrag.current;
    if (carry && had) {
      itemDrag.current = null;
      setMoveFeedback(null);
      const stage = stageRef.current;
      if (cancelled || !carry.moved) {
        stage?.resetItemPreview(carry.instanceId);
        if (!cancelled) selectItem(carry.instanceId);
        return;
      }
      // The drop lands through the plan's own law — RoomCanvas resolves it
      // and the plan changes (the stage rebuilds the body where it landed)
      // or refuses it with the plan's own words. The preview is put back a
      // frame later: after a rebuild there is nothing to put back, after a
      // refusal the body returns to where the plan has it.
      const it = findPlacedItem(usePropertyStore.getState().property, carry.instanceId);
      if (it) moveTo(carry.instanceId, it.x + carry.dx, it.y + carry.dy, e.shiftKey);
      requestAnimationFrame(() => stage?.resetItemPreview(carry.instanceId));
      return;
    }
    const d = drag.current;
    if (pointers.current.size === 0) drag.current = null;
    else if (d) {
      // One finger left after a pinch: the drag origin is re-seeded on the
      // finger that stayed, so its next move orbits from where it is, not
      // by the distance to the finger that lifted.
      const [rest] = [...pointers.current.values()];
      d.x = rest.x;
      d.y = rest.y;
      d.pinchDist = 0;
      d.moved = true;
    }
    if (!had || !d || cancelled || d.moved || panMode) return;
    const p = localPoint(e);
    if (gardenPlacement && stageRef.current) {
      const point = stageRef.current.floorPoint(p.x, p.y);
      if (!point) return;
      const store = usePropertyStore.getState();
      let placed = false;
      if (gardenPlacement.kind === 'surface') {
        const surface = property.garden?.surfaces.find((s) => s.id === gardenPlacement.id);
        if (surface) placed = store.updateGardenSurface(surface.id, { x: point.x - surface.widthM / 2, y: point.y - surface.depthM / 2 });
      } else {
        const fence = property.garden?.fences.find((f) => f.id === gardenPlacement.id);
        if (fence) placed = store.updateGardenFence(fence.id, moveGardenFence(fence, point));
      }
      if (!placed) { showFlash('Place this garden element within the plot and clear of the house.'); return; }
      setGardenPlacement(null);
      showFlash('Garden element placed');
      return;
    }
    if (constructionTool !== 'select' && constructionTool !== 'room' && stageRef.current && !onPaintWall && !onPaintFloor) {
      const store = usePropertyStore.getState();
      if (constructionTool === 'stair') {
        const storeys = buildingLevels(property).filter((entry) => !isRoofLevel(entry.level));
        const index = storeys.findIndex((entry) => entry.level.id === level);
        const lower = index < storeys.length - 1 ? storeys[index] : storeys[index - 1];
        const upper = index < storeys.length - 1 ? storeys[index + 1] : storeys[index];
        const point = stageRef.current.floorPoint(p.x, p.y);
        if (!lower || !upper || !point) { showFlash('Add another floor, then tap a clear space for the stairs.'); return; }
        const stair: BuildingStair = {
          id: 'preview', fromLevelId: lower.level.id, toLevelId: upper.level.id,
          x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10,
          widthM: 1, runM: Math.max(3, (upper.elevationM - lower.elevationM) * 1.2), rotation: 0,
        };
        const valid = validateStairPlacement(property, stair);
        if (!valid.ok) { showFlash(valid.message); return; }
        store.addStair(stair);
        showFlash(`Stairs connect ${lower.level.name} to ${upper.level.name}`);
      } else {
        const hit = hitAt(p.x, p.y);
        const point = stageRef.current.wallPoint(p.x, p.y);
        const room = property.rooms.find((r) => r.id === hit?.roomId);
        const edge = room && roomEdges(room).find((edge) => edge.index === hit?.edgeIndex);
        if (!room || !edge || !point) { showFlash('Tap a wall on the selected floor.'); return; }
        const widthM = constructionTool === 'window' ? 1.2 : 0.838;
        const id = store.addOpening(room.id, { edgeIndex: edge.index, offsetM: projectOntoEdge(edge, point), widthM, kind: constructionTool, sillM: constructionTool === 'window' ? 0.9 : 0, flipFacing: false, flipHand: false });
        if (!id) { showFlash('Leave enough wall space and keep this opening clear of other openings.'); return; }
        showFlash(`${constructionTool === 'window' ? 'Window' : 'Door'} added`);
      }
      setConstructionTool('select');
      haptic('place');
      return;
    }
    if (onPaintWall) {
      // A tap (touch / pen, or a mouse press that started off a wall).
      const hit = hitAt(p.x, p.y);
      if (hit) paintHit(hit, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
      else showFlash('Tap a wall to paint it');
      return;
    }
    if (onPaintFloor && stageRef.current) {
      const floor = stageRef.current.floorPoint(p.x, p.y);
      if (floor) paintFloorHit(floor, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
      else showFlash('Tap the floor to lay it');
      return;
    }
    if (!itemsInteractive || !stageRef.current) return;
    // A tap on the floor: place the armed product there, else clear the selection.
    const floor = stageRef.current.floorPoint(p.x, p.y);
    if (armedProductId && floor) placeAtPoint(armedProductId, floor.x, floor.y);
    else if (selectedInstanceId) selectItem(null);
  };

  // Wheel zoom must be a NON-passive native listener: React's onWheel is
  // passive, so preventDefault is a no-op and the docked panel scrolls the
  // card out from under the pointer.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
      zoomBy(Math.exp(Math.max(-120, Math.min(120, pixels)) * 0.0017));
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [zoomBy]);

  const rotate = (deltaRad: number) => setCamera((c) => (c ? { ...c, azimuthRad: c.azimuthRad + deltaRad } : c));
  const refit = () => {
    if (!bounds) return;
    const fitted = fitCamera(bounds, H, size.height > 0 ? size.width / size.height : 1.4);
    fitted.target.z += baseElevation;
    baseDistanceRef.current = fitted.distanceM;
    setCamera({ ...fitted, azimuthRad: DEFAULT_AZIMUTH_RAD, elevationRad: DEFAULT_ELEVATION_RAD });
  };

  function clearLocalTools() {
    selectItem(null);
    setConstructionTool('select');
    roomDrag.current = null;
    setRoomPreview(null);
    setGardenPlacement(null);
    setGardenOpen(false);
    setHover(null);
    setHoverItem(null);
  }

  function chooseCameraView(view: CameraView) {
    if (!bounds) return;
    const fitted = fitCamera(bounds, H, size.height > 0 ? size.width / size.height : 1.4);
    fitted.target.z += baseElevation;
    baseDistanceRef.current = fitted.distanceM;
    setCamera({ ...fitted, elevationRad: view === 'above' ? 78 * Math.PI / 180 : view === 'front' ? 12 * Math.PI / 180 : 35 * Math.PI / 180,
      azimuthRad: view === 'dollhouse' ? DEFAULT_AZIMUTH_RAD : 0 });
  }

  function togglePan() {
    clearLocalTools();
    usePlacementIntentStore.getState().setArmed(null);
    useDesignerUIStore.getState().setTool('hand');
    useDesignerUIStore.getState().setEnergyPanelOpen(false);
    setPanMode(!panMode);
  }

  function quickTool(next: 'wallpaint' | 'floor' | 'energy') {
    clearLocalTools();
    setPanMode(false);
    usePlacementIntentStore.getState().setArmed(null);
    const ui = useDesignerUIStore.getState();
    if (next === 'energy') {
      ui.setTool('hand');
      ui.setEnergyPanelOpen(!energyOpen);
    } else ui.setTool(tool === next ? 'hand' : next);
  }

  // Overlay: Esc closes.
  useEffect(() => {
    if (variant !== 'overlay' || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // An input in the still-usable docked panel keeps its own Esc.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      // The open inspector owns Escape before the workspace does.
      if (document.getElementById('building-details')) return;
      if (gardenOpen || gardenPlacement) {
        e.stopImmediatePropagation();
        setGardenOpen(false);
        setGardenPlacement(null);
        return;
      }
      if (panMode || constructionTool !== 'select') {
        e.stopImmediatePropagation();
        setPanMode(false);
        setConstructionTool('select');
        roomDrag.current = null;
        setRoomPreview(null);
        return;
      }
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [variant, onClose, gardenOpen, gardenPlacement, panMode, constructionTool]);

  const hoverText = describeHit(property, hover, onPaintWall && hoverTag && hover ? hoverTag(hover) : null);
  const empty = !sceneBounds;
  const drawn = solids.walls.length + solids.floors.length + solids.items.length;
  const viewLabel = empty
    ? 'Room view — draw a room to see it in 3D'
    : `Room view in 3D — ${drawn} parts. Drag to orbit${onPaintWall ? '; click a wall to paint it' : onPaintFloor ? '; click the floor to lay it' : itemsInteractive ? '; tap an item to select it, drag it to move it' : ''}.`;
  const selectedItem = selectedInstanceId ? findPlacedItem(property, selectedInstanceId) : null;
  const selectedProduct = selectedItem ? getProductById(selectedItem.productId) : undefined;
  const armedProduct = armedProductId ? getProductById(armedProductId) : undefined;
  const defaultCaption = panMode ? 'Drag anywhere to move the view · tap Move view again to select furniture'
    : constructionTool === 'room' ? 'Drag corner to corner · release to build · two fingers to pan · Esc to cancel'
    : onPaintWall
    ? 'Click a wall to paint it · drag along walls to paint a run · Shift = whole room · Ctrl = erase'
    : onPaintFloor
      ? 'Click a tile · drag a rectangle · Shift = whole room · Ctrl = erase'
      : armedProduct
        ? `Tap the floor to place ${armedProduct.name}`
        : itemsInteractive
          ? 'Drag to orbit · two fingers or Shift-drag to pan · pinch to zoom · drag items to move'
          : 'Drag to orbit · two fingers or Shift-drag to pan · pinch or scroll to zoom';

  const liveFloorCaption =
    floorPreview && onPaintFloor
      ? `${floorPreview.erase ? 'Erase' : 'Lay'} ${floorPreview.count} tile${floorPreview.count === 1 ? '' : 's'} · release to commit`
      : null;

  function chooseBuildTool(next: typeof constructionTool) {
    if (next === 'room' && backend === 'painter') {
      useToastStore.getState().push('3D room drawing needs WebGL. Use Draw walls in 2D Plan on this device.', 'info');
      onClose?.();
      return;
    }
    const ui = useDesignerUIStore.getState();
    ui.setTool('hand');
    ui.setEnergyPanelOpen(false);
    usePlacementIntentStore.getState().setArmed(null);
    selectItem(null);
    roomDrag.current = null;
    setRoomPreview(null);
    setConstructionTool(next);
    setGardenPlacement(null);
    setGardenOpen(false);
    setPanMode(false);
    setHouseMode('build');
    if (next !== 'select') window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
    if (next === 'room') {
      if (onRoofLevel) {
        const storeys = levelEntries.filter((entry) => !isRoofLevel(entry.level));
        const top = storeys[storeys.length - 1];
        if (top) usePropertyStore.getState().setActiveLevel(top.level.id);
      }
      setBuildingView('floor');
      setShowRoof(false);
    }
  }

  function changeHouseMode(mode: HouseMode) {
    clearLocalTools();
    setHouseMode(mode);
    setPanMode(false);
    const ui = useDesignerUIStore.getState();
    ui.setEnergyPanelOpen(false);
    ui.setTool('hand');
    usePlacementIntentStore.getState().setArmed(null);
    if (mode === 'paint' || mode === 'floor' || mode === 'energy') quickTool(mode === 'paint' ? 'wallpaint' : mode);
    if (mode === 'furnish') window.dispatchEvent(new CustomEvent('ppw:open-catalog'));
    if (mode === 'garden') {
      usePropertyStore.getState().setActiveLevel('ground');
      setGardenOpen(true);
    }
  }
  const activeHouseMode: HouseMode = onPaintWall ? 'paint' : onPaintFloor ? 'floor' : energyOpen ? 'energy' : gardenOpen ? 'garden' : houseMode;

  const box = (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ background: variant === 'overlay' ? '#263853' : '#E7E2D8', touchAction: 'none', ...(variant === 'card' ? { aspectRatio: '16 / 10' } : { flex: 1, minHeight: 0 }) }}
      data-testid="wallpaint-3d"
      data-variant={variant}
      data-backend={backend}
    >
      {/* The picture: three when it can, the painter when it cannot. */}
      <div className="absolute inset-0">
        {backend === 'gl' && camera && size.width >= 8 && size.height >= 8 ? (
          <Suspense fallback={null}>
            <ThreeStage
              ref={stageRef}
              solids={solids}
              presentation={variant === 'overlay' && !onPaintWall ? 'architectural' : 'studio'}
              camera={displayedCamera ?? camera}
              width={size.width}
              height={size.height}
              hover={hover}
              selectedInstanceId={variant === 'overlay' ? selectedInstanceId : null}
              brushHex={onPaintWall ? (brushHex ?? null) : undefined}
              brushFinish={onPaintWall && brushHex ? (tool === 'cladding' ? 'textured' : wallPaintDraft.erase ? null : finishOfPaint(brushPaintId(wallPaintDraft))) : null}
              wallView={wallView}
              hour={sunHour}
              onFailed={() => setBackend('painter')}
            />
          </Suspense>
        ) : backend === 'painter' ? (
          <canvas ref={painterRef} style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden="true" />
        ) : null}
      </div>
      {/* The gesture surface. */}
      <div
        data-testid="wallpaint-3d-canvas"
        role="img"
        aria-label={viewLabel}
        className="absolute inset-0"
        style={{ cursor: constructionTool === 'room' ? 'crosshair' : panMode ? 'move' : hover ? 'pointer' : hoverItem ? 'move' : onPaintFloor ? 'pointer' : armedProduct && itemsInteractive ? 'copy' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onPointerLeave={() => {
          setHover(null);
          setHoverItem(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {roomPreview && <svg className="house-room-preview" data-valid={roomPreview.ok} aria-hidden="true">
        <polygon points={roomPreview.polygon.map((point) => stageRef.current?.projectPoint(point.x, point.y, roomPreview.elevationM + 0.03)).filter((point) => !!point).map((point) => `${point.x},${point.y}`).join(' ')} />
        {(() => { const center = roomPreview.polygon.reduce((p, q) => ({ x: p.x + q.x / 4, y: p.y + q.y / 4 }), { x: 0, y: 0 }); const screen = stageRef.current?.projectPoint(center.x, center.y, roomPreview.elevationM + 0.04); return screen ? <text x={screen.x} y={screen.y} textAnchor="middle">{roomPreview.widthM.toFixed(1)} × {roomPreview.depthM.toFixed(1)} m</text> : null; })()}
      </svg>}
      {constructionTool === 'room' && <p className="house-drawing-help" role="status">{roomPreview ? roomPreview.ok ? `${roomPreview.areaM2.toFixed(1)} m² · release to build` : roomPreview.message : 'Drag from one corner to the opposite corner to build a room'}</p>}
      {empty && constructionTool !== 'room' && variant === 'overlay' && <div className="house-empty"><strong>Your home starts here</strong><p>Draw your first room, add another floor, then shape the spaces around it.</p><button onClick={() => chooseBuildTool('room')}>Draw a room</button></div>}
      {empty && variant === 'card' && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs">Draw a room to see it in 3D</p>}
      <RoomViewControls workspace={variant === 'overlay'} pan={panMode} onPan={togglePan}
        onRotate={rotate} onZoom={zoomBy} onFit={refit} onView={chooseCameraView}
        wallView={wallView} onWallView={setWallView} hasWalls={solids.walls.length > 0 && !onRoofLevel}
        sunAvailable={backend === 'gl'} sunHour={sunHour} onSunHour={setSunHour}
        onClose={onClose} onExpand={onExpand} />
      {/* The selection's card (overlay, item tools): what it is, turn it, remove it —
          the same actions the plan's keyboard runs, so 2D follows. */}
      {variant === 'overlay' && itemsInteractive && selectedItem && selectedProduct && (
        <div
          className="absolute bottom-[145px] left-2 right-2 flex flex-wrap items-center gap-2 md:left-auto md:max-w-sm rounded-xl border border-ppw-rim bg-ppw-chrome px-3 py-2 shadow-[0_12px_32px_rgba(42,41,38,0.18)]"
          data-testid="view3d-selection"
        >
          <span className="min-w-0 truncate text-[12px] font-semibold text-[#37362f]">{selectedProduct.name}</span>
          <span
            className="shrink-0 text-[11px] font-medium tabular-nums"
            style={{ color: '#5c5a54' }}
            data-testid="view3d-rotation"
            title="Plan rotation — same angle as 2D"
          >
            {Math.round(((selectedItem.rotation % 360) + 360) % 360)}°
          </span>
          <button
            type="button"
            className={`${SEL_BTN} border-ppw-rim bg-ppw-chrome text-ppw-charcoal hover:bg-[#f3f1ec]`}
            onClick={() => rotateSelected(-90)}
            title="Turn 90° counter-clockwise (,)"
            data-testid="view3d-rotate-ccw"
          >
            ↺
          </button>
          <button
            type="button"
            className={`${SEL_BTN} border-ppw-inkDeep bg-ppw-inkDeep text-ppw-paper hover:brightness-110`}
            onClick={() => rotateSelected(90)}
            title="Turn 90° clockwise (R)"
            data-testid="view3d-rotate"
          >
            Turn ↻
          </button>
          <button type="button" className={`${SEL_BTN} border-[#49607d] bg-[#243a55] text-[#d8e8fa]`} onClick={() => duplicateSelected()} title="Duplicate selected product">Duplicate</button>
          <button type="button" className={`${SEL_BTN} border-[#49607d] bg-[#243a55] text-[#d8e8fa]`} onClick={() => { useDesignerUIStore.getState().setInfoOpen(true); onClose?.(); }}>Details in plan</button>
          <button
            type="button"
            className={`${SEL_BTN} border-ppw-clay bg-ppw-chrome text-ppw-charcoal hover:bg-ppw-clay hover:text-white`}
            onClick={() => deleteSelected()}
            title="Remove from the room (Delete)"
            data-testid="view3d-delete"
          >
            Remove
          </button>
          {hasFurniturePreview(selectedProduct.id) && !productModelFor(selectedProduct) && <p className="w-full text-[10px] text-[#a9bfdc]">{FURNITURE_PREVIEW_NOTE}</p>}
        </div>
      )}
      {/* Hover read-out / caption. */}
      <p
        className="pointer-events-none absolute bottom-1.5 left-2 right-2 truncate text-[11px] font-medium text-ppw-charcoal"
        style={{ textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}
        data-testid="wallpaint-3d-caption"
        aria-live="polite"
      >
        {moveFeedback ?? flash ?? liveFloorCaption ?? hoverText ?? caption ?? defaultCaption}
      </p>
    </div>
  );

  if (variant === 'card') {
    return (
      <div className={className} style={style}>
        {box}
        {footer && (
          <p className="mt-1 px-1 text-[11px] font-semibold tabular-nums text-[#37362f]" data-testid="wallpaint-3d-footer">
            {footer}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`fixed left-0 top-0 z-[34] flex flex-col ${className}`}
      style={{ right: 'var(--floor-panel-w, 0px)', bottom: onPaintWall || onPaintFloor ? 0 : 'calc(var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px))', ...style }}
      data-testid="wallpaint-3d-overlay" role="region" aria-label={title ?? 'Room view in 3D'}>
      <HouseWorkspace mode={activeHouseMode} onMode={changeHouseMode} onPlan={onClose} onSave={onSave} onCart={onCart}
        externalPanel={!!onPaintWall || !!onPaintFloor || (energyOpen && !belowMd)}
        drawing={constructionTool === 'room'} onDraw={() => chooseBuildTool(constructionTool === 'room' ? 'select' : 'room')} onSelect={() => chooseBuildTool('select')}
        inspector={energyOpen && belowMd ? <div className="house-tool-panel-host p-4" data-presentation="3d"><EnergySummary compact onJumpToRoof={() => window.dispatchEvent(new CustomEvent('ppw:close-house-details'))} /></div> : gardenOpen ? <div className="house-garden-panel"><GardenPanel architectural onClose={() => { setGardenOpen(false); setGardenPlacement(null); setHouseMode('build'); }} onRequestPlacement={(intent) => { usePropertyStore.getState().setActiveLevel('ground'); setGardenPlacement(intent); window.dispatchEvent(new CustomEvent('ppw:close-house-details')); }} /></div>
          : <BuildingControls layout="sidebar" view={buildingView} onViewChange={setBuildingView} showRoof={showRoof} onShowRoofChange={setShowRoof} tool={constructionTool} onToolChange={chooseBuildTool}
            gardenOpen={gardenOpen} onGardenToggle={() => changeHouseMode('garden')} />}>
        {gardenPlacement && <p role="status" className="bg-[#29405c] px-3 py-2 text-xs text-[#c4e8f2]">Tap the ground to place this garden element. <button className="underline" onClick={() => setGardenPlacement(null)}>Cancel</button></p>}
        {box}
      </HouseWorkspace>
      {footer && <p className="shrink-0 border-t border-[#34415b] bg-[#172139] px-3 py-1 text-xs font-semibold text-[#c9d8ef]" data-testid="wallpaint-3d-footer">{footer}</p>}
      {brushStrip}
    </div>
  );
}
