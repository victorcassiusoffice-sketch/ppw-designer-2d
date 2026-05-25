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

/**
 * Clear all content the user has placed in the active room — products,
 * walls, floor zones and wall treatments — as a single undoable action.
 * Room polygon/dimensions and every other room are preserved.
 */
export function clearActiveRoomContents(): void {
  beginDrawTransaction('clear room');
  try {
    // Placed products live per-room on the active room.
    usePropertyStore.getState().clearActiveRoomItems();
    // Walls / floor zones / wall treatments are global stores in the
    // current model — clear them all, mirroring setDrawMode's reset.
    useWallStore.getState().clearWalls();
    useFloorZoneStore.getState().clearZones();
    useWallTreatmentStore.getState().clearTreatments();
  } finally {
    endDrawTransaction();
  }
}
