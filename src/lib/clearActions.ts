/**
 * clearActions — full-room Clear (Vic 2026-05-25).
 *
 * Vic reported the "Clear" button "doesn't work on desktop". Reproduction
 * (desktop + mobile, local + production) showed it DID clear placed
 * products — but only the single layer matching the current mode
 * (move → items, wall → walls), leaving walls / floor zones / wall paint
 * behind so the room looked unchanged. Vic chose a full reset
 * (AskUserQuestion 2026-05-25): "Clear" now wipes EVERYTHING in the active
 * room — products, walls, floor zones and wall paint — while preserving the
 * room's size/shape and any other rooms in the property.
 *
 * The wipe is wrapped in the same atomic history transaction `setDrawMode`
 * uses (`beginDrawTransaction` … `endDrawTransaction`), so the whole reset
 * is ONE undo frame: a single Ctrl+Z restores products, walls, floors and
 * paint together.
 */
import { usePropertyStore } from '../store/propertyStore';
import { useWallStore } from '../store/wallStore';
import { useFloorZoneStore } from '../store/floorZoneStore';
import { useWallTreatmentStore } from '../store/wallTreatmentStore';
import { beginDrawTransaction, endDrawTransaction } from '../store/historyStore';
import { activeLevelIdOf } from '../designer/levels';

/**
 * Clear all content the user has placed in the active room — products,
 * walls, floor zones and wall treatments — as a single undoable action.
 * Room polygon/dimensions and every other room are preserved.
 */
export function clearActiveRoomContents(): void {
  beginDrawTransaction('clear room');
  try {
    // Placed products live per-room on the active room.
    const ps = usePropertyStore.getState();
    ps.clearActiveRoomItems();
    // Free walls (Sims world 2026-08-29) live on the property per level;
    // clear the level in focus, not the whole building.
    ps.clearFreeWalls(activeLevelIdOf(ps.property));
    // Legacy walls / floor zones / wall treatments are global stores —
    // clear them all, mirroring setDrawMode's reset.
    useWallStore.getState().clearWalls();
    useFloorZoneStore.getState().clearZones();
    useWallTreatmentStore.getState().clearTreatments();
  } finally {
    endDrawTransaction();
  }
}

/**
 * "Clear products" (2026-06-09, Vic) — remove ONLY the placed products
 * from the active room. The drawn room is KEPT: polygon/dimensions, walls,
 * floor zones and wall paint all stay. One undoable frame (Ctrl+Z restores
 * the products).
 */
export function clearActiveRoomProducts(): void {
  beginDrawTransaction('clear products');
  try {
    usePropertyStore.getState().clearActiveRoomItems();
  } finally {
    endDrawTransaction();
  }
}

/**
 * "Clear all" (2026-06-09, Vic) — wipe the ENTIRE design back to the
 * fresh blank-on-open state: the room itself (polygon), all placed
 * products, and the global walls / floor zones / wall treatments. After
 * this the canvas is blank and the start-state "draw your room" prompt
 * shows again. One undoable frame (Ctrl+Z restores everything).
 *
 * `resetToDefault()` re-seeds a single EMPTY room (no polygon) — see
 * `makeBlankRoom` in propertyStore — which is exactly the on-open state.
 */
export function clearEntireDesign(): void {
  beginDrawTransaction('clear all');
  try {
    useWallStore.getState().clearWalls();
    useFloorZoneStore.getState().clearZones();
    useWallTreatmentStore.getState().clearTreatments();
    usePropertyStore.getState().resetToDefault();
  } finally {
    endDrawTransaction();
  }
}
