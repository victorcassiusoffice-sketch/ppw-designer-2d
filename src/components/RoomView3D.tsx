/**
 * RoomView3D — the Sims-style view of the storey (Vic 2026-09-14), now the
 * designer's 3D MODE (Vic 2026-09-17: "make it a super realistic 3D version
 * of the 2D … not exclusive to paint"). A dollhouse camera: walls up where
 * they face you, cut down to a stub where they would hide the room, doors
 * and windows cut through, the floor finish laid, furniture to size — and
 * every wall painted the colour the plan says.
 *
 * Drag to orbit, wheel / pinch to zoom; with the Wall-paint tool armed,
 * CLICK A WALL TO PAINT IT with the brush the panel holds.
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
import { activeLevelIdOf, isOutdoorRoom, isRoofRoom, roomsOnLevel } from '../designer/levels';
import { wallsOnLevel } from '../designer/freeWalls';
import { edgeKey, pointAlongEdge, projectOntoEdge, roomEdges, sharedEdgeMap } from '../designer/wallEdges';
import { openingSpan } from '../designer/openings';
import { isDrawnPolygon } from '../designer/roomLayout';
import { roomFloorMaterial } from '../designer/floorFinish';
import { findFloorMaterialById } from '../data/floorMaterials';
import { getProductById } from '../data/products';
import { DEFAULT_WALL_HEIGHT_M, findWallPaintById, resolveWallColourHex } from '../data/wallPaints';
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
import { buildSolids, type SceneSolids } from '../designer/roomSolids';
import type { ThreeStageHandle } from './three/ThreeStage';

// The GL renderer and three itself arrive in their own chunk, on first use.
const ThreeStage = lazy(() => import('./three/ThreeStage'));

export interface RoomView3DProps {
  variant: 'card' | 'overlay';
  /** Called with the wall under a click (or tap). Omit for a view-only render. */
  onPaintWall?: (hit: WallHit) => void;
  /** Overlay: close it. Card: open the overlay. */
  onClose?: () => void;
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

// Phone pass (2026-09-16): 40 px on the phone tier (the overlay is
// full-screen there and a thumb needs it), 32 px inside the desktop card.
const BTN =
  'inline-flex h-10 min-w-[40px] md:h-8 md:min-w-[32px] items-center justify-center rounded-md border border-ppw-rim bg-ppw-chrome px-2 text-[12px] font-semibold text-ppw-charcoal shadow-sm hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';

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
    const reg: RoomView3DBridgeRegistry = {
      instances: {},
      wallScreenPoint: (hit) => (reg.instances.overlay ?? reg.instances.card)?.wallScreenPoint(hit) ?? null,
      faceCount: () => (reg.instances.overlay ?? reg.instances.card)?.faceCount() ?? 0,
      faces: () => (reg.instances.overlay ?? reg.instances.card)?.faces() ?? [],
      camera: () => (reg.instances.overlay ?? reg.instances.card)?.camera() ?? null,
      backend: () => (reg.instances.overlay ?? reg.instances.card)?.backend() ?? 'painter',
      hitAt: (x, y) => (reg.instances.overlay ?? reg.instances.card)?.hitAt(x, y) ?? null,
      debug: () => (reg.instances.overlay ?? reg.instances.card)?.debug() ?? null,
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
    for (const e of room.wallPaint ?? []) {
      wallColourByEdge.set(e.edgeIndex, resolveWallColourHex(e.paintId, e.colourHex));
    }
    // Floor: the largest painted zone's material, else the whole-room finish.
    let floorHex: string | undefined;
    const zones = room.floorTiles ?? [];
    if (zones.length > 0) {
      const biggest = [...zones].sort((a, b) => b.runs.length - a.runs.length)[0];
      floorHex = findFloorMaterialById(biggest.materialId)?.hex;
    }
    if (!floorHex) floorHex = roomFloorMaterial(room)?.hex ?? undefined;
    const items: SceneItemInput[] = [];
    for (const it of room.placedItems) {
      const p = getProductById(it.productId);
      if (!p) continue;
      items.push({
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
      });
    }
    return {
      id: room.id,
      name: room.name,
      polygon: room.polygon,
      openings: openingsByRoom.get(room.id) ?? room.openings,
      wallColourByEdge,
      floorHex,
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
      colourHex: w.paintId ? resolveWallColourHex(w.paintId, w.paintColourHex) : undefined,
    })),
    wallHeightM: H,
    cameraPos: cameraPosition(cam),
    cameraTarget: cam.target,
    hover,
  };
}

/** The solids do not depend on the camera; this stand-in keeps the memo keyed on the plan alone. */
const SOLIDS_CAMERA: OrbitCamera = { target: { x: 0, y: 0, z: 0 }, azimuthRad: 0, elevationRad: 0.6, distanceM: 10, fovRad: 0.9 };

/** "Living room · Wall 2 · Soft Feel · Coral" for the hover caption. */
function describeHit(property: Property, hit: WallHit | null): string | null {
  if (!hit) return null;
  if (hit.kind === 'edge') {
    const room = property.rooms.find((r) => r.id === hit.roomId);
    if (!room) return null;
    const painted = room.wallPaint?.find((e) => e.edgeIndex === hit.edgeIndex);
    const paint = painted ? findWallPaintById(painted.paintId) : undefined;
    const colour = painted?.colourName ?? painted?.colourHex;
    return `${room.name} · Wall ${(hit.edgeIndex ?? 0) + 1}${paint ? ` · ${paint.name}` : ' · unpainted'}${colour ? ` · ${colour}` : ''}`;
  }
  const w = property.walls?.find((x) => x.id === hit.wallId);
  if (!w) return null;
  const paint = w.paintId ? findWallPaintById(w.paintId) : undefined;
  const colour = w.paintColourName ?? w.paintColourHex;
  return `Free wall${paint ? ` · ${paint.name}` : ' · unpainted'}${colour ? ` · ${colour}` : ''}`;
}

export function RoomView3D({ variant, onPaintWall, onClose, onExpand, footer, caption, brushStrip, title, className = '', style }: RoomView3DProps): JSX.Element {
  const property = usePropertyStore((s) => s.property);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<ThreeStageHandle | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<OrbitCamera | null>(null);
  const [hover, setHover] = useState<WallHit | null>(null);
  // 'gl' until WebGL refuses to start; then the canvas painter takes over.
  const [backend, setBackend] = useState<'gl' | 'painter'>('gl');
  const baseDistanceRef = useRef(10);
  const H = property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M;

  // Bounds of the storey in view — the camera re-frames when they change.
  const level = activeLevelIdOf(property);
  const bounds = useMemo(() => {
    const rooms = roomsOnLevel(property.rooms, level).filter((r) => !isOutdoorRoom(r) && !isRoofRoom(r) && isDrawnPolygon(r.polygon));
    const walls = wallsOnLevel(property.walls ?? [], level);
    return boundsOf(rooms, walls);
  }, [property, level]);
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
    baseDistanceRef.current = fitted.distanceM;
    setCamera((prev) =>
      prev
        ? { ...fitted, azimuthRad: prev.azimuthRad, elevationRad: prev.elevationRad, distanceM: fitted.distanceM }
        : fitted,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, H, size.width > 0 ? Math.round((size.width / Math.max(1, size.height)) * 10) : 0]);

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
  const solids: SceneSolids = useMemo(() => buildSolids(sceneFromProperty(property, null, SOLIDS_CAMERA)), [property]);

  // Painter fallback: only computed while it is the one drawing.
  const projected: ProjectedFace[] = useMemo(() => {
    if (backend !== 'painter' || !camera || size.width < 8 || size.height < 8) return [];
    const faces = buildScene(sceneFromProperty(property, hover, camera));
    return projectScene(faces, camera, size);
  }, [backend, property, hover, camera, size]);

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

  // e2e bridge (DEV builds only, like the plan's geometry bridge).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const reg = bridgeRegistry();
    reg.instances[variant] = {
      wallScreenPoint: (hit) => {
        const box = containerRef.current?.getBoundingClientRect();
        if (!box) return null;
        if (backend === 'gl') {
          const p = stageRef.current?.screenPoint(hit);
          return p ? { x: box.left + p.x, y: box.top + p.y } : null;
        }
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
    };
    return () => {
      const r = window.__ppwRoomView3d;
      if (r) delete r.instances[variant];
    };
  }, [projected, camera, variant, backend, hitAt]);

  // ---- gestures -----------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: boolean; pinchDist: number } | null>(null);

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = containerRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const zoomBy = useCallback((factor: number) => {
    setCamera((c) => (c ? clampCamera({ ...c, distanceM: c.distanceM * factor }, baseDistanceRef.current * 0.35, baseDistanceRef.current * 3) : c));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, moved: false, pinchDist: 0 };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { x: e.clientX, y: e.clientY, moved: true, pinchDist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!pointers.current.has(e.pointerId)) {
      // Hover (mouse only): tint the wall under the pointer.
      if (e.pointerType === 'mouse' && onPaintWall) {
        const p = localPoint(e);
        setHover(hitAt(p.x, p.y));
      }
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!d) return;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
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
    setCamera((c) =>
      c
        ? clampCamera(
            { ...c, azimuthRad: c.azimuthRad - dx * 0.008, elevationRad: c.elevationRad + dy * 0.006 },
            baseDistanceRef.current * 0.35,
            baseDistanceRef.current * 3,
          )
        : c,
    );
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const had = pointers.current.delete(e.pointerId);
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
    if (!had || !d || cancelled || d.moved || !onPaintWall) return;
    const p = localPoint(e);
    const hit = hitAt(p.x, p.y);
    if (hit) onPaintWall(hit);
  };

  // Wheel zoom must be a NON-passive native listener: React's onWheel is
  // passive, so preventDefault is a no-op and the docked panel scrolls the
  // card out from under the pointer.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1);
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [zoomBy]);

  const rotate = (deltaRad: number) => setCamera((c) => (c ? { ...c, azimuthRad: c.azimuthRad + deltaRad } : c));
  const refit = () => {
    if (!bounds) return;
    const fitted = fitCamera(bounds, H, size.height > 0 ? size.width / size.height : 1.4);
    baseDistanceRef.current = fitted.distanceM;
    setCamera({ ...fitted, azimuthRad: DEFAULT_AZIMUTH_RAD, elevationRad: DEFAULT_ELEVATION_RAD });
  };

  // Overlay: Esc closes.
  useEffect(() => {
    if (variant !== 'overlay' || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // An input in the still-usable docked panel keeps its own Esc.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [variant, onClose]);

  const hoverText = describeHit(property, hover);
  const empty = !bounds;
  const drawn = solids.walls.length + solids.floors.length + solids.items.length;
  const viewLabel = empty
    ? 'Room view — draw a room to see it in 3D'
    : `Room view in 3D — ${drawn} parts. Drag to orbit${onPaintWall ? '; click a wall to paint it' : ''}.`;

  const box = (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ background: '#E7E2D8', touchAction: 'none', ...(variant === 'card' ? { aspectRatio: '16 / 10' } : { flex: 1, minHeight: 0 }) }}
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
              camera={camera}
              width={size.width}
              height={size.height}
              hover={hover}
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
        style={{ cursor: hover ? 'pointer' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      {empty && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] font-medium text-ppw-charcoal">
          Draw a room to see it in 3D
        </p>
      )}
      {/* Orbit controls. */}
      <div className="absolute right-2 top-2 flex gap-1">
        <button type="button" className={BTN} onClick={() => rotate(Math.PI / 4)} title="Rotate left" aria-label="Rotate left" data-testid="wallpaint-3d-rotate-left">
          ↺
        </button>
        <button type="button" className={BTN} onClick={() => rotate(-Math.PI / 4)} title="Rotate right" aria-label="Rotate right" data-testid="wallpaint-3d-rotate-right">
          ↻
        </button>
        <button type="button" className={BTN} onClick={refit} title="Fit the whole plan" aria-label="Fit" data-testid="wallpaint-3d-fit">
          Fit
        </button>
        {variant === 'card' && onExpand && (
          <button type="button" className={BTN} onClick={onExpand} title="Open the big room view" aria-label="Expand the room view" data-testid="wallpaint-3d-expand">
            ⤢
          </button>
        )}
        {variant === 'overlay' && onClose && (
          <button type="button" className={`${BTN} bg-ppw-inkDeep text-ppw-paper hover:bg-[#3a3835]`} onClick={onClose} title="Back to the plan (Esc)" aria-label="Back to the plan" data-testid="wallpaint-3d-close">
            Plan
          </button>
        )}
      </div>
      {/* Hover read-out / caption. */}
      <p
        className="pointer-events-none absolute bottom-1.5 left-2 right-2 truncate text-[11px] font-medium text-ppw-charcoal"
        style={{ textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}
        data-testid="wallpaint-3d-caption"
        aria-live="polite"
      >
        {hoverText ?? caption ?? (onPaintWall ? 'Drag to look around · click a wall to paint it' : 'Drag to look around · pinch or scroll to zoom')}
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
    <div
      className={`fixed bottom-0 left-0 z-[34] flex flex-col ${className}`}
      // A WORKSPACE, not a dialog: it takes the plan's place under the top
      // bar (3D Mode, 2026-09-17: the bar stays usable so tools can be
      // switched while the room is on screen) and ends at the docked panel
      // on md+ (the brush stays reachable); the panel publishes 0px on the
      // phone, so there it is edge to edge.
      style={{ top: 'var(--ppw-topbar-h, 0px)', right: 'var(--floor-panel-w, 0px)', background: '#E7E2D8', ...style }}
      data-testid="wallpaint-3d-overlay"
      role="region"
      aria-label="Room view in 3D"
    >
      <div className="flex items-center justify-between gap-2 border-b border-ppw-rim bg-ppw-chrome px-3 py-1.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-[#37362f]">{title ?? '3D room view'}</p>
          <p className="truncate text-[11px] font-medium leading-tight text-ppw-charcoal">
            {onPaintWall ? 'Drag to look around · pinch or scroll to zoom · click a wall to paint it' : 'Drag to look around · pinch or scroll to zoom'}
          </p>
        </div>
        {footer && (
          <p className="shrink-0 text-[12px] font-semibold tabular-nums text-[#37362f]" data-testid="wallpaint-3d-footer">
            {footer}
          </p>
        )}
      </div>
      {box}
      {brushStrip}
    </div>
  );
}
