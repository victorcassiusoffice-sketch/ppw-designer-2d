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
  rotatedFootprint,
  validatePlacement,
} from './geometry';
import type { PlacedRect } from './geometry';
import type { PlacedItem } from '../store/designStore';

/**
 * Tweak 01 (Phase B) — rotation step in degrees. R-key cycles at 90°
 * (matches Sims build-mode); Shift+R steps at 15° (per Tweak 01 §2
 * "snaps to 15° increments, with Shift held → free rotate"). The
 * brief's "free rotate" via Konva Transformer drag-handle is a
 * separate add on top of this discrete step.
 */
export const ROTATION_STEP_COARSE_DEG = 90;
export const ROTATION_STEP_FINE_DEG = 15;

function buildOthers(items: PlacedItem[], ignoreId?: string) {
  return items
    .map((it) => {
      const p = getProductById(it.productId);
      if (!p) return null;
      const fp = { lengthM: cmToM(p.dimensions_cm.length), widthM: cmToM(p.dimensions_cm.width) };
      const r = rotatedFootprint(fp, it.rotation);
      return { x: it.x, y: it.y, w: r.w, h: r.h, instanceId: it.instanceId };
    })
    .filter((r): r is PlacedRect & { instanceId: string } => r !== null && r.instanceId !== ignoreId);
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
  const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
  const newRotation = (((item.rotation + deltaDeg) % 360) + 360) % 360;
  const { w, h } = rotatedFootprint(fp, newRotation);
  const candidate: PlacedRect = { x: item.x, y: item.y, w, h };
  const others = buildOthers(state.placedItems, id);
  const result = validatePlacement(candidate, others, state.polygon);
  if (!result.ok) {
    useToastStore.getState().push("Item won't fit here.", 'warn');
    return;
  }
  // Snapshot the prior state explicitly so the upcoming updateItem
  // triggers a labelled history frame instead of the unlabelled default.
  useHistoryStore.getState().recordSnapshot('rotate');
  state.updateItem(id, { rotation: newRotation });
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
  const fp = { lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) };
  const { w, h } = rotatedFootprint(fp, item.rotation);
  const others = buildOthers(state.placedItems);

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
      state.addItem({
        productId: item.productId,
        x: candidate.x,
        y: candidate.y,
        rotation: item.rotation,
      });
      return;
    }
  }
  useToastStore.getState().push("No room to duplicate here.", 'warn');
}

/** Delete the currently-selected item (no confirm — caller wraps if needed). */
export function deleteSelected(): void {
  const state = useDesignStore.getState();
  const id = state.selectedInstanceId;
  if (!id) return;
  state.removeItem(id);
}

/** Clear selection. */
export function deselect(): void {
  useDesignStore.getState().selectItem(null);
}
