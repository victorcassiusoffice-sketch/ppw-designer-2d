/**
 * RoomView3D — the Sims-style room view for the wall-paint tool
 * (Vic 2026-09-14). A dollhouse camera over the active storey: walls up
 * where they face you, cut down to a stub where they would hide the room,
 * doors and windows cut out, the floor finish laid, furniture as shaded
 * boxes — and every wall painted in the colour the plan says.
 *
 * Drag to orbit, wheel / pinch to zoom, CLICK A WALL TO PAINT IT with the
 * brush the panel holds. All geometry, shading and hit-testing live in
 * `designer/roomView3d.ts` (pure, unit-tested); this file is the <canvas>,
 * the gestures and the store reads. It is a separate React tree from the
 * Konva plan — nothing here touches the stable-locked canvas.
 *
 * Two variants: `card` (docked inside the paint panel) and `overlay` (a
 * large view for a meeting screen; Esc / Close returns to the panel).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePropertyStore, type Property, type Room } from '../store/propertyStore';
import { activeLevelIdOf, isOutdoorRoom, roomsOnLevel } from '../designer/levels';
import { wallsOnLevel } from '../designer/freeWalls';
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
  className?: string;
  style?: CSSProperties;
}

const BTN =
  'inline-flex h-8 min-w-[32px] items-center justify-center rounded-md border border-ppw-rim bg-ppw-chrome px-2 text-[12px] font-semibold text-ppw-charcoal shadow-sm hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';

/** Screen-space bridge for e2e: click a wall by its identity, not by pixels. */
interface RoomView3DBridge {
  wallScreenPoint: (hit: WallHit) => { x: number; y: number } | null;
  faceCount: () => number;
  camera: () => OrbitCamera | null;
}
declare global {
  interface Window {
    __ppwRoomView3d?: RoomView3DBridge;
  }
}

function sceneFromProperty(property: Property, hover: WallHit | null, cam: OrbitCamera): SceneInput {
  const level = activeLevelIdOf(property);
  const rooms = roomsOnLevel(property.rooms, level);
  const walls = wallsOnLevel(property.walls ?? [], level);
  const H = property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M;
  const sceneRooms: SceneRoomInput[] = rooms.map((room: Room) => {
    const outdoor = isOutdoorRoom(room) || !isDrawnPolygon(room.polygon);
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
      openings: room.openings,
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

export function RoomView3D({ variant, onPaintWall, onClose, onExpand, footer, caption, className = '', style }: RoomView3DProps): JSX.Element {
  const property = usePropertyStore((s) => s.property);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<OrbitCamera | null>(null);
  const [hover, setHover] = useState<WallHit | null>(null);
  const baseDistanceRef = useRef(10);
  const H = property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M;

  // Bounds of the storey in view — the camera re-frames when they change.
  const level = activeLevelIdOf(property);
  const bounds = useMemo(() => {
    const rooms = roomsOnLevel(property.rooms, level).filter((r) => !isOutdoorRoom(r) && isDrawnPolygon(r.polygon));
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

  // Size the canvas to its box, DPR-aware.
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

  const projected: ProjectedFace[] = useMemo(() => {
    if (!camera || size.width < 8 || size.height < 8) return [];
    const faces = buildScene(sceneFromProperty(property, hover, camera));
    return projectScene(faces, camera, size);
  }, [property, hover, camera, size]);

  // Paint.
  useEffect(() => {
    const canvas = canvasRef.current;
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
  }, [projected, size]);

  // e2e bridge (DEV builds only, like the plan's geometry bridge).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const canvas = canvasRef.current;
    window.__ppwRoomView3d = {
      wallScreenPoint: (hit) => {
        if (!canvas) return null;
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
        const r = canvas.getBoundingClientRect();
        const cx = face.pts.reduce((a, p) => a + p.x, 0) / face.pts.length;
        const cy = face.pts.reduce((a, p) => a + p.y, 0) / face.pts.length;
        return { x: r.left + cx, y: r.top + cy };
      },
      faceCount: () => projected.length,
      camera: () => camera,
    };
    return () => {
      delete window.__ppwRoomView3d;
    };
  }, [projected, camera]);

  // ---- gestures -----------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: boolean; pinchDist: number } | null>(null);

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const zoomBy = useCallback((factor: number) => {
    setCamera((c) => (c ? clampCamera({ ...c, distanceM: c.distanceM * factor }, baseDistanceRef.current * 0.35, baseDistanceRef.current * 3) : c));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!pointers.current.has(e.pointerId)) {
      // Hover (mouse only): tint the wall under the pointer.
      if (e.pointerType === 'mouse' && onPaintWall) {
        const p = localPoint(e);
        setHover(hitTestWall(projected, p.x, p.y));
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

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const had = pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size === 0) drag.current = null;
    else if (d) d.pinchDist = 0;
    if (!had || !d || cancelled || d.moved || !onPaintWall) return;
    const p = localPoint(e);
    const hit = hitTestWall(projected, p.x, p.y);
    if (hit) onPaintWall(hit);
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1);
  };

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
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [variant, onClose]);

  const hoverText = describeHit(property, hover);
  const empty = !bounds;

  const box = (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ background: '#E7E2D8', touchAction: 'none', ...(variant === 'card' ? { aspectRatio: '4 / 3' } : { flex: 1, minHeight: 0 }) }}
      data-testid="wallpaint-3d"
      data-variant={variant}
    >
      <canvas
        ref={canvasRef}
        data-testid="wallpaint-3d-canvas"
        role="img"
        aria-label={empty ? 'Room view — draw a room to see it in 3D' : `Room view in 3D — ${projected.length} faces. Drag to orbit; click a wall to paint it.`}
        style={{ display: 'block', width: '100%', height: '100%', cursor: hover ? 'pointer' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
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
          <button type="button" className={`${BTN} bg-ppw-inkDeep text-ppw-paper hover:bg-[#3a3835]`} onClick={onClose} title="Back to the plan (Esc)" aria-label="Close the room view" data-testid="wallpaint-3d-close">
            Close
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
        {hoverText ?? caption ?? (onPaintWall ? 'Drag to look around · click a wall to paint it' : 'Drag to look around')}
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
      className={`fixed inset-y-0 left-0 z-[60] flex items-center justify-center p-3 md:p-6 ${className}`}
      // Ends at the docked panel on md+ (the brush stays reachable); the
      // panel publishes 0px on the phone, so there it is full-screen.
      style={{ right: 'var(--floor-panel-w, 0px)', ...style }}
      data-testid="wallpaint-3d-overlay"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Room view in 3D"
        className="relative flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-ppw-rim bg-ppw-chrome shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-ppw-rim px-3 py-2">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#37362f]">Room view</p>
            <p className="truncate text-[11px] font-medium text-ppw-charcoal">Drag to look around · pinch or scroll to zoom · click a wall to paint it</p>
          </div>
          {footer && (
            <p className="shrink-0 text-[12px] font-semibold tabular-nums text-[#37362f]" data-testid="wallpaint-3d-footer">
              {footer}
            </p>
          )}
        </div>
        {box}
      </div>
    </div>
  );
}
