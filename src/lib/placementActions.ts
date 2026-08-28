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
import { useToastStore } from '../store/toastStore';
import { useHistoryStore } from '../store/historyStore';
import { getProductById } from '../data/products';
import {
  cmToM,
  collidesWithAny,
  rotatedFootprint,
  validatePlacement,
} from './geometry';
import type { PlacedRect } from './geometry';
import type { PlacedItem } from '../store/designStore';
import { haptic } from './haptics';
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
 * Tweak 01 (Phase B) — rotation step in degrees. R-key cycles at 90°
 * (matches Sims build-mode); Shift+R steps at 15° (per Tweak 01 §2
 * "snaps to 15° increments, with Shift held → free rotate"). The
 * brief's "free rotate" via Konva Transformer drag-handle is a
 * separate add on top of this discrete step.
 */
export const ROTATION_STEP_COARSE_DEG = 90;
export const ROTATION_STEP_FINE_DEG = 15;

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

/**
 * Rotate the currently-selected item by `deltaDeg` if validation passes.
 *
 * Tweak 01 (Phase B): accepts any signed delta (was `90 | -90`). The
 * R-key handler uses 90 / -90; Shift+R uses 15 / -15; future Konva
 * Transformer free-drag will call with arbitrary values pre-snapped to
 * the 15° grid.
 *
 * Tweak 07 hook: labels the resulting history frame "rotate" so the
 * undo toast reads "Undid: rotate" instead of the generic default.
 */
export function rotateSelected(deltaDeg: number): void {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return;
  const item = state.placedItems.find((i) => i.instanceId === id);
  if (!item) return;
  const product = getProductById(item.productId);
  if (!product) return;
  const kind = placementKind(product);
  if (kind === 'wall') {
    // Wall items' facing is dictated by their wall.
    useToastStore.getState().push('Wall items follow their wall.', 'info');
    return;
  }
  const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
  const newRotation = (((item.rotation + deltaDeg) % 360) + 360) % 360;
  const { w, h } = rotatedFootprint(fp, newRotation);

  if (kind === 'surface') {
    // Rotate in place on the table: keep the centre, re-clamp inside the
    // parent surface, and refuse if it no longer fits / hits a sibling.
    const surface = parentSurfaceRect(state.placedItems, item.parentInstanceId);
    if (!surface) return;
    const cur = rotatedFootprint(fp, item.rotation);
    const res = resolveSurfaceItemPlacement({
      centreXm: item.x + cur.w / 2,
      centreYm: item.y + cur.h / 2,
      fp,
      rotationDeg: newRotation,
      surface,
    });
    const sibs = buildOthers(state.placedItems, id, 'surface', surface.instanceId);
    if (!res.ok || collidesWithAny({ x: res.x, y: res.y, w, h }, sibs)) {
      haptic('invalid');
      useToastStore.getState().push("Won't fit on the surface that way.", 'warn');
      return;
    }
    useHistoryStore.getState().recordSnapshot('rotate');
    state.updateItem(id, { rotation: newRotation, x: res.x, y: res.y });
    haptic('rotate');
    return;
  }

  // A table with items on it can't rotate in place — the tabletop would
  // spin out from under them (Sims blocks this the same way).
  if (state.placedItems.some((i) => i.parentInstanceId === id)) {
    haptic('invalid');
    useToastStore.getState().push('Clear the surface before rotating it.', 'warn');
    return;
  }
  const candidate: PlacedRect = { x: item.x, y: item.y, w, h };
  const others = buildOthers(state.placedItems, id, 'floor');
  const result = validatePlacement(candidate, others, state.polygon);
  if (!result.ok) {
    haptic('invalid');
    useToastStore.getState().push("Item won't fit here.", 'warn');
    return;
  }
  // Snapshot the prior state explicitly so the upcoming updateItem
  // triggers a labelled history frame instead of the unlabelled default.
  useHistoryStore.getState().recordSnapshot('rotate');
  state.updateItem(id, { rotation: newRotation });
  haptic('rotate');
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
    for (const d of [step, -step, 2 * step, -2 * step]) {
      const r = resolveWallItemPlacement({
        centreXm: item.x + w / 2 + (w >= h ? d : 0),
        centreYm: item.y + h / 2 + (w >= h ? 0 : d),
        fp,
        polygon: state.polygon,
        snapStep: 0.5,
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
    const candidate: PlacedRect = { x: item.x + dx, y: item.y + dy, w, h };
    const result = validatePlacement(candidate, others, state.polygon);
    if (result.ok) {
      commit(candidate.x, candidate.y, item.rotation);
      return;
    }
  }
  haptic('invalid');
  useToastStore.getState().push("No room to duplicate here.", 'warn');
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
