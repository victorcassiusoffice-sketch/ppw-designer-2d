/**
 * placementActions — non-React helpers that wrap the geometry math
 * around store mutations. Used by DetailsPanel buttons and the
 * keyboard-shortcut handler.
 *
 * All functions are side-effecting (they mutate the design store and
 * push toasts); kept out of React land so they're easy to invoke from
 * anywhere (key handlers, event listeners).
 */
import { useDesignStore } from '../store/designStore';
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { useHistoryStore, isDrawTransactionActive, beginDrawTransaction, endDrawTransaction } from '../store/historyStore';
import { normaliseRotation, ROTATION_SNAP_DEG, ROTATION_FINE_DEG } from '../designer/rotationGesture';
import { getProductById } from '../data/products';
import {
  cmToM,
  collidesWithAny,
  rotatedFootprint,
  validatePlacement,
  isRectInsidePolygon,
  pointInPolygon,
} from './geometry';
import type { PlacedRect } from './geometry';
import type { PlacedItem } from '../store/designStore';
import { haptic } from './haptics';
import { currentSnapStepM } from '../store/designerUIStore';
import { objectOverlapAllowed } from '../store/objectPlacementStore';
import { emitsLight } from '../designer/lighting';
import { energyRoleOf, isRoofProduct } from '../designer/energy';
import { isOutdoorRoom, isRoofRoom } from '../designer/levels';
import { wallsOnLevel } from '../designer/freeWalls';
import {
  insideInnerFaces,
  freeWallObstacleRects,
} from '../designer/wallAwarePlacement';
import {
  adjacentTileSlots,
  fillLatticeInside,
  usesTileLattice,
  tileLatticeFor,
} from '../designer/flooringLattice';
// Surface slots + wall-mounted (2026-08-24) — rotation/duplication are
// layer-scoped: wall items follow their wall, surface items stay on
// their table, floor items ignore the other two layers.
import {
  placementKind,
  resolveSurfaceItemPlacement,
  resolveWallItemPlacement,
  type PlacementKind,
} from '../designer/attachmentPlacement';

/**
 * All object controls share eight 45° stops, with 1° precision when
 * Shift/Alt or the touch precision control is held.
 */
export const ROTATION_STEP_COARSE_DEG = ROTATION_SNAP_DEG;
export const ROTATION_STEP_FINE_DEG = ROTATION_FINE_DEG;

function buildOthers(
  items: PlacedItem[],
  ignoreId?: string,
  layer: PlacementKind = 'floor',
  parentId?: string,
) {
  return items
    .map((it) => {
      const p = getProductById(it.productId);
      if (!p) return null;
      if (placementKind(p) !== layer) return null;
      if (layer === 'surface' && parentId && it.parentInstanceId !== parentId) return null;
      const fp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
      const r = rotatedFootprint(fp, it.rotation);
      return { x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId };
    })
    .filter((r): r is PlacedRect & { instanceId: string } => r !== null && r.instanceId !== ignoreId);
}

/** The parent surface's footprint rect, or null. */
function parentSurfaceRect(items: PlacedItem[], parentInstanceId?: string) {
  if (!parentInstanceId) return null;
  const parent = items.find((i) => i.instanceId === parentInstanceId);
  if (!parent) return null;
  const p = getProductById(parent.productId);
  if (!p) return null;
  const fp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
  const r = rotatedFootprint(fp, parent.rotation);
  return { instanceId: parent.instanceId, x: parent.x, y: parent.y, w: r.w, h: r.h };
}

export interface ItemRotationSession {
  propertyId: string;
  roomId: string;
  original: PlacedItem;
  centre: { x: number; y: number };
  cancelled: boolean;
}
export interface ItemRotationPreview {
  ok: boolean;
  x: number;
  y: number;
  rotation: number;
  message?: string;
}

/** Capture once at pointer-down. No history or saved geometry changes until
 * release: Escape, pointercancel and a second tool can discard this freely. */
export function rotationRefusalReason(instanceId: string | null): string | null {
  if (!instanceId) return 'Select an object first.';
  const rooms = usePropertyStore.getState().property.rooms;
  const room = rooms.find(candidate => candidate.placedItems.some(item => item.instanceId === instanceId));
  const item = room?.placedItems.find(candidate => candidate.instanceId === instanceId);
  const product = item && getProductById(item.productId);
  if (!room || !product) return 'This object is no longer in the design.';
  if (placementKind(product) === 'wall') return 'Wall items follow their wall. Move them along the wall to change position.';
  if (room.placedItems.some(child => child.parentInstanceId === instanceId)) return 'Move the objects on this surface before turning it.';
  return null;
}

export function beginItemRotation(instanceId = useDesignStore.getState().selectedInstanceId): ItemRotationSession | null {
  if (!instanceId || isDrawTransactionActive()) return null;
  const property = usePropertyStore.getState().property;
  const room = property.rooms.find(candidate => candidate.placedItems.some(item => item.instanceId === instanceId));
  const original = room?.placedItems.find(item => item.instanceId === instanceId);
  const product = original && getProductById(original.productId);
  if (!room || !original || !product || placementKind(product) === 'wall'
    || room.placedItems.some(item => item.parentInstanceId === instanceId)) return null;
  const fp = rotatedFootprint({ lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) }, original.rotation);
  return { propertyId: property.id, roomId: room.id, original: { ...original },
    centre: { x: original.x + fp.w / 2, y: original.y + fp.h / 2 }, cancelled: false };
}

/** Read-only strict-centre preview. The ring never pushes an object elsewhere
 * to make room: an invalid angle stays red and releasing leaves the old pose. */
export function previewItemRotation(session: ItemRotationSession, angle: number): ItemRotationPreview {
  const rotation = normaliseRotation(angle);
  const fallback = { x: session.original.x, y: session.original.y, rotation };
  const fail = (message: string): ItemRotationPreview => ({ ...fallback, ok: false, message });
  const property = usePropertyStore.getState().property;
  const room = property.rooms.find(candidate => candidate.id === session.roomId);
  const current = room?.placedItems.find(item => item.instanceId === session.original.instanceId);
  const product = current && getProductById(current.productId);
  if (session.cancelled || !Number.isFinite(angle) || isDrawTransactionActive() || property.id !== session.propertyId || !room || !current || !product
    || current.productId !== session.original.productId || current.x !== session.original.x || current.y !== session.original.y
    || current.rotation !== session.original.rotation || current.parentInstanceId !== session.original.parentInstanceId) return fail('Selection changed. Start the turn again.');
  const kind = placementKind(product);
  if (kind === 'wall') return fail('Wall items follow their wall.');
  if (room.placedItems.some(item => item.parentInstanceId === current.instanceId)) return fail('Clear the surface before rotating it.');
  const size = rotatedFootprint({ lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) }, rotation);
  const x = session.centre.x - size.w / 2, y = session.centre.y - size.h / 2;
  const rect = { x, y, w: size.w, h: size.h };
  const others = objectOverlapAllowed() ? [] : buildOthers(room.placedItems, current.instanceId, kind, current.parentInstanceId);
  if (kind === 'floor') others.push(...freeWallObstacleRects(wallsOnLevel(property.walls ?? [], room.levelId ?? 'ground')));
  let fits = !collidesWithAny(rect, others);
  if (kind === 'surface') {
    const surface = parentSurfaceRect(room.placedItems, current.parentInstanceId);
    fits = fits && !!surface && x >= surface.x - 1e-8 && y >= surface.y - 1e-8
      && x + size.w <= surface.x + surface.w + 1e-8 && y + size.h <= surface.y + surface.h + 1e-8;
  } else if (isOutdoorRoom(room)) {
    const site = property.site;
    if (site) {
      const ox = site.originM?.x ?? 0, oy = site.originM?.y ?? 0;
      fits = fits && x >= ox && y >= oy && x + size.w <= ox + site.widthM && y + size.h <= oy + site.depthM;
    }
    if (room.polygon.length >= 3) fits = fits && isRectInsidePolygon(rect, room.polygon);
    const probes = [{ x: x + 0.01, y: y + 0.01 }, { x: x + size.w - 0.01, y: y + 0.01 },
      { x: x + size.w - 0.01, y: y + size.h - 0.01 }, { x: x + 0.01, y: y + size.h - 0.01 },
      { x: x + size.w / 2, y: y + size.h / 2 }];
    fits = fits && !property.rooms.some(building => !isOutdoorRoom(building) && !isRoofRoom(building)
      && (building.levelId ?? 'ground') === (room.levelId ?? 'ground')
      && building.polygon.length >= 3 && probes.some(point => pointInPolygon(point, building.polygon)));
  } else {
    fits = fits && validatePlacement(rect, [], room.polygon).ok
      && ((isRoofRoom(room) && isRoofProduct(product)) || insideInnerFaces(rect, room.polygon));
  }
  return { ok: fits, x, y, rotation, ...(!fits && { message: 'Not enough space to turn here.' }) };
}

export function commitItemRotation(session: ItemRotationSession, angle: number): boolean {
  const preview = previewItemRotation(session, angle);
  if (!preview.ok) { cancelItemRotation(session); return false; }
  session.cancelled = true;
  if (Math.abs(preview.rotation - normaliseRotation(session.original.rotation)) < 1e-8) return true;
  beginDrawTransaction('rotate');
  try { usePropertyStore.getState().updateItem(session.original.instanceId, { x: preview.x, y: preview.y, rotation: preview.rotation }); }
  finally { endDrawTransaction(); }
  haptic('rotate');
  return true;
}
export function cancelItemRotation(session: ItemRotationSession): void { session.cancelled = true; }

/** Buttons and keyboard use the same strict-centre validation as a pointer
 * gesture. A failed turn leaves the saved pose and history untouched. */
export function rotateSelected(deltaDeg: number, _opts: { snapshot?: boolean } = {}): void {
  const session = beginItemRotation();
  if (!session) {
    const reason = rotationRefusalReason(useDesignStore.getState().selectedInstanceId);
    if (reason) useToastStore.getState().push(reason, 'warn');
    return;
  }
  const angle = session.original.rotation + deltaDeg;
  const preview = previewItemRotation(session, angle);
  if (!commitItemRotation(session, angle)) {
    haptic('invalid');
    useToastStore.getState().push(preview.message ?? 'Not enough space to turn here.', 'warn');
  }
}

/**
 * Sims world (2026-08-29): a placed lamp / pendant / sconce casts a warm
 * pool of light on the plan. This flips it on or off for the selected item
 * (default ON when absent). No-op for products that do not emit light.
 */
export function toggleSelectedLight(): boolean {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return false;
  const item = state.placedItems.find((i) => i.instanceId === id);
  if (!item) return false;
  const product = getProductById(item.productId);
  if (!product || !emitsLight(product)) return false;
  const next = !(item.lightOn ?? true);
  usePropertyStore.getState().setItemLight(id, next);
  haptic('select');
  useToastStore.getState().push(next ? 'Light on' : 'Light off', 'info', 1200);
  return true;
}

/**
 * Energy (eco / solar 2026-09-04): leave the selected electrical item out of
 * the estimate (or put it back). Default ON when absent. No-op for products
 * that draw nothing.
 */
export function toggleSelectedPower(): boolean {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return false;
  const item = state.placedItems.find((i) => i.instanceId === id);
  if (!item) return false;
  const product = getProductById(item.productId);
  if (!product || energyRoleOf(product) !== 'consumer') return false;
  const next = item.powerOn === false;
  usePropertyStore.getState().setItemPower(id, next);
  haptic('select');
  useToastStore.getState().push(next ? 'Counted in the energy estimate' : 'Left out of the energy estimate', 'info', 1200);
  return true;
}

/** Energy: hours per day the selected item runs (null / 0 clears the override). */
export function setSelectedHours(hoursPerDay: number | null): boolean {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return false;
  const item = state.placedItems.find((i) => i.instanceId === id);
  if (!item) return false;
  usePropertyStore.getState().setItemHours(id, hoursPerDay);
  return true;
}

/** Duplicate the selected item with a 0.5 m offset; tries a few offsets. */
export function duplicateSelected(): void {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return;
  const item = state.placedItems.find((i) => i.instanceId === id);
  if (!item) return;
  const product = getProductById(item.productId);
  if (!product) return;
  const kind = placementKind(product);
  const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
  const { w, h } = rotatedFootprint(fp, item.rotation);

  const commit = (x: number, y: number, rotation: number, parentInstanceId?: string) => {
    const newId = state.addItem({ productId: item.productId, x, y, rotation, parentInstanceId });
    // M4 — select the new copy so the cluster/outline follows it (the
    // touch equivalent of Shift-click rapid placement landing selected).
    state.selectItem(newId);
    haptic('duplicate');
  };

  if (kind === 'wall') {
    // Slide the copy along the same wall until a free stretch is found.
    const others = buildOthers(state.placedItems, undefined, 'wall');
    const step = Math.max(w, h) + 0.1;
    // The wall runs along the item's rotated LONG axis for a shelf, but a
    // square sconce has no long axis: read the wall direction off the
    // rotation instead (0/180 = horizontal wall, 90/270 = vertical).
    const alongX = Math.abs(w - h) > 1e-6 ? w >= h : item.rotation % 180 === 0;
    for (const d of [step, -step, 2 * step, -2 * step]) {
      const r = resolveWallItemPlacement({
        centreXm: item.x + w / 2 + (alongX ? d : 0),
        centreYm: item.y + h / 2 + (alongX ? 0 : d),
        fp,
        polygon: state.polygon,
        // Live unit, not a hardcoded 0.5 (Sims world 2026-08-29).
        snapStep: currentSnapStepM(),
        frontEdge: product.front_edge,
      });
      if (!r.ok) continue;
      const rf = rotatedFootprint(fp, r.rotationDeg);
      if (validatePlacement({ x: r.x, y: r.y, w: rf.w, h: rf.h }, others, state.polygon).ok) {
        commit(r.x, r.y, r.rotationDeg);
        return;
      }
    }
    haptic('invalid');
    useToastStore.getState().push('No free wall space for a copy.', 'warn');
    return;
  }

  if (kind === 'surface') {
    // Copy lands next to the original on the same surface.
    const surface = parentSurfaceRect(state.placedItems, item.parentInstanceId);
    if (!surface) return;
    const sibs = buildOthers(state.placedItems, undefined, 'surface', surface.instanceId);
    for (const [dx, dy] of [
      [w + 0.05, 0],
      [-(w + 0.05), 0],
      [0, h + 0.05],
      [0, -(h + 0.05)],
    ] as Array<[number, number]>) {
      const res = resolveSurfaceItemPlacement({
        centreXm: item.x + w / 2 + dx,
        centreYm: item.y + h / 2 + dy,
        fp,
        rotationDeg: item.rotation,
        surface,
      });
      if (res.ok && !collidesWithAny({ x: res.x, y: res.y, w, h }, sibs)) {
        commit(res.x, res.y, item.rotation, res.parentInstanceId);
        return;
      }
    }
    haptic('invalid');
    useToastStore.getState().push('No space on the surface for a copy.', 'warn');
    return;
  }

  const others = buildOthers(state.placedItems, undefined, 'floor');
  const activeRoomNow = usePropertyStore
    .getState()
    .property.rooms.find((r) => r.id === usePropertyStore.getState().property.activeRoomId);
  const unboundedNow = !!activeRoomNow && isOutdoorRoom(activeRoomNow) && state.polygon.length < 3;
  const fitsHere = (x: number, y: number): boolean =>
    unboundedNow
      ? !collidesWithAny({ x, y, w, h }, others)
      : validatePlacement({ x, y, w, h }, others, state.polygon).ok;

  // Sims flooring (2026-08-29): a tile duplicates EDGE TO EDGE — right,
  // below, left, above, one tile away — so a floor is laid by tapping
  // Duplicate along a row, never by nudging copies into place.
  if (usesTileLattice(product)) {
    for (const slot of adjacentTileSlots({ x: item.x, y: item.y, w, h })) {
      if (fitsHere(slot.x, slot.y)) {
        commit(slot.x, slot.y, item.rotation);
        return;
      }
    }
    haptic('invalid');
    useToastStore.getState().push('No free space next to this tile — try Fill floor.', 'warn');
    return;
  }

  // Try +0.5 right, then +0.5 down, then +0.5 both, then -0.5 right.
  const offsets: Array<[number, number]> = [
    [0.5, 0],
    [0, 0.5],
    [0.5, 0.5],
    [-0.5, 0],
    [0, -0.5],
    [1, 0],
  ];
  for (const [dx, dy] of offsets) {
    if (fitsHere(item.x + dx, item.y + dy)) {
      commit(item.x + dx, item.y + dy, item.rotation);
      return;
    }
  }
  haptic('invalid');
  useToastStore.getState().push("No room to duplicate here.", 'warn');
}

/**
 * Sims flooring (2026-08-29): lay copies of the selected floor tile over
 * every free lattice cell that fits WHOLLY inside the room — the "drag to
 * fill" gesture, as one action and one undo frame. Returns the number laid.
 * No-op for anything that is not a flooring product.
 */
export function fillFloorWithSelected(): number {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return 0;
  const item = state.placedItems.find((i) => i.instanceId === id);
  if (!item) return 0;
  const product = getProductById(item.productId);
  if (!product || !usesTileLattice(product)) return 0;
  if (state.polygon.length < 3) {
    useToastStore.getState().push('Fill floor works inside a room.', 'warn');
    return 0;
  }
  const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
  const lat = tileLatticeFor({
    productId: product.id,
    fp,
    rotationDeg: item.rotation,
    polygon: state.polygon,
    items: state.placedItems,
  });
  // Only same-band items block a tile (a bench standing on the floor does
  // not — tiles go under it, exactly as the paint tool paints under it).
  const others = buildOthers(state.placedItems, undefined, 'floor');
  const cells = fillLatticeInside({ lat, polygon: state.polygon, others });
  if (cells.length === 0) {
    useToastStore.getState().push('The floor is already covered.', 'info');
    return 0;
  }
  const ps = usePropertyStore.getState();
  useHistoryStore.getState().recordSnapshot('fill floor');
  const roomId = ps.property.activeRoomId;
  for (const c of cells) {
    ps.addItem({ productId: product.id, x: c.x, y: c.y, rotation: item.rotation }, roomId);
  }
  // Keep the ORIGINAL selected so the cluster stays put.
  state.selectItem(id);
  haptic('place');
  useToastStore.getState().push(`Laid ${cells.length} more tile${cells.length === 1 ? '' : 's'}`, 'success');
  return cells.length;
}

/** Delete the currently-selected item (no confirm — caller wraps if needed). */
export function deleteSelected(): void {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return;
  state.removeItem(id);
  haptic('delete');
}

/** Clear selection. */
export function deselect(): void {
  useDesignStore.getState().selectItem(null);
}
