/**
 * itemDrop — where a MOVED item lands, as a pure function (2026-09-17).
 *
 * 3D Mode needs to move furniture the way the plan does: the same wall
 * snap + auto-orientation, the same tile lattice, the same layer-scoped
 * collision, the same room routing (into the neighbour, out to the garden),
 * the same refusals with the same words. The Konva drag handler in
 * `RoomCanvas` (`PlacedItemGroup.onDragEnd`) is that logic; this module is
 * its faithful, testable twin fed by an explicit context, so a drop made on
 * the 3D floor resolves exactly as a drop made on the 2D plan. Keep the two
 * in step — a rule added there is added here.
 *
 * Coordinates: `newXm/newYm` is the wanted TOP-LEFT of the item's
 * axis-aligned footprint at its CURRENT rotation (the plan's own convention).
 */
import { cmToM, rotatedFootprint, collidesWithAny, isRectInsidePolygon, type PlacedRect, type Polygon } from '../lib/geometry';
import { placementKind, resolveWallItemPlacement, resolveSurfaceItemPlacement, findSurfaceUnder, type PlacementKind, type SurfaceRect } from './attachmentPlacement';
import { resolveWallAwarePlacement, isCardinalRotation, WALL_HALF_M, type FreeWallLike } from './wallAwarePlacement';
import { snapToTileLattice, tileLatticeFor, usesTileLattice } from './flooringLattice';
import { obstaclesFor } from './layerBands';
import { getProductById } from '../data/products';
import type { Product } from '../data/products.schema';
import type { PlacedItem } from '../store/propertyStore';

export interface DropRoom {
  id: string;
  polygon: Polygon;
  placedItems: PlacedItem[];
  kind?: string;
}

export interface DropContext {
  /** Live snap step, metres. */
  snapStep: number;
  /** The OWNER room of the item (its polygon and items). */
  polygon: Polygon;
  placedItems: PlacedItem[];
  outdoor: boolean;
  /** Bounds test for an outdoor rect (plot + not over a building). */
  fitsOutdoors: (rect: PlacedRect) => boolean;
  /** Walls this item may snap to (room edges are implicit via `polygon`). */
  snapWalls: readonly FreeWallLike[];
  /** Solid wall rectangles this item must not overlap. */
  wallRects: Array<PlacedRect & { instanceId: string }>;
  /** The same routing the placement path uses. */
  resolveContainer: (
    pM: { x: number; y: number },
    opts: { create: boolean },
  ) => { ok: true; room: DropRoom; outdoor: boolean } | { ok: false; reason: 'off-plot' | 'off-roof' };
  /** RoomCanvas's layer-scoped footprint helpers. */
  layerRects: (placedItems: PlacedItem[], layer: PlacementKind, opts?: { parentId?: string; ignoreId?: string }) => Array<PlacedRect & { instanceId: string }>;
  surfaceRects: (placedItems: PlacedItem[]) => SurfaceRect[];
  /** Every room on the plan (for the owner lookup). */
  allRooms: DropRoom[];
}

export type DropResult =
  | {
      ok: true;
      x: number;
      y: number;
      rotation: number;
      /** The room it lands in (may differ from the owner — a cross-room move). */
      roomId: string;
      crossRoom: boolean;
      /** Surface items: the table they now sit on. */
      parentInstanceId?: string;
      reason: 'wall' | 'surface' | 'wall-aware' | 'grid' | 'lattice' | 'ceiling';
    }
  | { ok: false; message: string; reason: 'off-plot' | 'off-roof' | 'wall' | 'surface' | 'collision' | 'out-of-bounds' };

export function resolveItemDrop(ctx: DropContext, item: PlacedItem, product: Product, newXm: number, newYm: number, shiftHeld: boolean): DropResult {
  const fpUnrotated = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
  const { w, h } = rotatedFootprint(fpUnrotated, item.rotation);
  const ownerRoom = ctx.allRooms.find((r) => r.placedItems.some((i) => i.instanceId === item.instanceId));

  const routed = ctx.resolveContainer({ x: newXm + w / 2, y: newYm + h / 2 }, { create: true });
  if (!routed.ok) {
    return { ok: false, reason: routed.reason, message: routed.reason === 'off-roof' ? 'Nothing floats off the roof.' : 'That is off the plot.' };
  }
  const dropRoom = routed.room;
  const dropOutdoor = routed.outdoor;
  const crossRoom = !!(ownerRoom && dropRoom.id !== ownerRoom.id);
  const targetPolygon = crossRoom ? dropRoom.polygon : ctx.polygon;
  const targetItems = crossRoom ? dropRoom.placedItems : ctx.placedItems;
  const targetOutdoor = crossRoom ? dropOutdoor : ctx.outdoor;
  const targetWallRects =
    crossRoom && dropOutdoor !== ctx.outdoor
      ? dropOutdoor
        ? ctx.wallRects
        : ctx.wallRects.filter((r) => !r.instanceId.startsWith('wall:'))
      : ctx.wallRects;
  const inBounds = (rect: PlacedRect): boolean => (targetOutdoor ? ctx.fitsOutdoors(rect) : isRectInsidePolygon(rect, targetPolygon));

  const itemKind = placementKind(product);
  const sameKindItems = targetItems.filter((it) => {
    const p = getProductById(it.productId);
    return p ? placementKind(p) === itemKind : true;
  });
  const others: Array<PlacedRect & { instanceId: string }> = obstaclesFor(item.productId, sameKindItems)
    .map((it) => {
      const p = getProductById(it.productId);
      if (!p) return null;
      const r = rotatedFootprint({ lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) }, it.rotation);
      return { x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId };
    })
    .filter((r): r is PlacedRect & { instanceId: string } => r !== null);
  if (itemKind !== 'ceiling') others.push(...targetWallRects);

  const kind = itemKind;

  // Wall item: re-snap to the nearest wall (it may be a different wall —
  // re-orient with it) or bounce back.
  if (kind === 'wall') {
    const cur = rotatedFootprint(fpUnrotated, item.rotation);
    const r = resolveWallItemPlacement({
      centreXm: newXm + cur.w / 2,
      centreYm: newYm + cur.h / 2,
      fp: fpUnrotated,
      polygon: targetPolygon,
      snapStep: ctx.snapStep,
      frontEdge: product.front_edge,
      freeWalls: ctx.snapWalls,
    });
    const wfW = rotatedFootprint(fpUnrotated, r.rotationDeg);
    const rect = { x: r.x, y: r.y, w: wfW.w, h: wfW.h };
    const ok = r.ok && inBounds(rect) && !collidesWithAny(rect, ctx.layerRects(targetItems, 'wall', { ignoreId: item.instanceId }));
    if (!ok) return { ok: false, reason: 'wall', message: 'Wall items need a free bit of wall.' };
    return { ok: true, x: r.x, y: r.y, rotation: r.rotationDeg, roomId: dropRoom.id, crossRoom, reason: 'wall' };
  }

  // Surface item: must land on a surface (same or another — it reparents)
  // with room for it, else bounce back.
  if (kind === 'surface') {
    const cur = rotatedFootprint(fpUnrotated, item.rotation);
    const centre = { x: newXm + cur.w / 2, y: newYm + cur.h / 2 };
    const under = findSurfaceUnder(centre, ctx.surfaceRects(ctx.placedItems));
    if (!under) return { ok: false, reason: 'surface', message: 'This item sits on a surface — drop it onto a table.' };
    const res = resolveSurfaceItemPlacement({ centreXm: centre.x, centreYm: centre.y, fp: fpUnrotated, rotationDeg: item.rotation, surface: under });
    const sibs = ctx.layerRects(ctx.placedItems, 'surface', { parentId: under.instanceId, ignoreId: item.instanceId });
    if (!res.ok || collidesWithAny({ x: res.x, y: res.y, w: cur.w, h: cur.h }, sibs)) {
      return { ok: false, reason: 'surface', message: 'No space on that surface.' };
    }
    return { ok: true, x: res.x, y: res.y, rotation: item.rotation, roomId: ownerRoom?.id ?? dropRoom.id, crossRoom: false, parentInstanceId: res.parentInstanceId, reason: 'surface' };
  }

  // Floor / ceiling: wall-aware snap (released near a wall: flush + facing
  // in; Shift keeps the facing), the tile lattice for flooring, else the grid.
  const ceilingItem = kind === 'ceiling';
  const flooringItem = usesTileLattice(product);
  const wallAware = ceilingItem
    ? { x: Math.round(newXm / ctx.snapStep) * ctx.snapStep, y: Math.round(newYm / ctx.snapStep) * ctx.snapStep, rotationDeg: item.rotation, wallSnapped: false }
    : flooringItem
      ? (() => {
          const lat = tileLatticeFor({
            productId: item.productId,
            fp: fpUnrotated,
            rotationDeg: item.rotation,
            polygon: targetOutdoor ? [] : targetPolygon,
            items: targetItems.filter((it) => it.instanceId !== item.instanceId),
          });
          const s = snapToTileLattice(newXm, newYm, lat);
          return { x: s.x, y: s.y, rotationDeg: item.rotation, wallSnapped: false };
        })()
      : resolveWallAwarePlacement({
          centreXm: newXm + w / 2,
          centreYm: newYm + h / 2,
          fp: fpUnrotated,
          polygon: targetOutdoor ? [] : targetPolygon,
          snapStep: ctx.snapStep,
          userRotationDeg: shiftHeld || !isCardinalRotation(item.rotation) ? item.rotation : null,
          currentRotationDeg: item.rotation,
          frontEdge: product.front_edge,
          wallInsetM: WALL_HALF_M,
          freeWalls: ctx.snapWalls,
        });
  const wf = rotatedFootprint(fpUnrotated, wallAware.rotationDeg);
  const ownOthers = others.filter((o) => o.instanceId !== item.instanceId);
  const wallRect = { x: wallAware.x, y: wallAware.y, w: wf.w, h: wf.h };
  const wallOk = inBounds(wallRect) && !collidesWithAny(wallRect, ownOthers);
  const gridX = Math.round(newXm / ctx.snapStep) * ctx.snapStep;
  const gridY = Math.round(newYm / ctx.snapStep) * ctx.snapStep;
  const gridRect = { x: gridX, y: gridY, w, h };
  if (wallOk) {
    return { ok: true, x: wallAware.x, y: wallAware.y, rotation: wallAware.rotationDeg, roomId: dropRoom.id, crossRoom, reason: ceilingItem ? 'ceiling' : flooringItem ? 'lattice' : 'wall-aware' };
  }
  if (!inBounds(gridRect)) {
    return { ok: false, reason: 'out-of-bounds', message: targetOutdoor ? 'That would sit on a building or off the plot.' : 'Out of room bounds.' };
  }
  if (collidesWithAny(gridRect, ownOthers)) return { ok: false, reason: 'collision', message: "Item won't fit there." };
  return { ok: true, x: gridX, y: gridY, rotation: item.rotation, roomId: dropRoom.id, crossRoom, reason: 'grid' };
}
