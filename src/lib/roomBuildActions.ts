/** Release-only mutation for the 3D rectangular room gesture. */
import { previewRectRoomBuild, type RoomBuildFailure, type RoomBuildPreview } from '../designer/roomBuildGesture';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from '../designer/levels';
import { isDrawnPolygon } from '../designer/roomLayout';
import { nextRoomName } from '../designer/roomNaming';
import { beginDrawTransaction, endDrawTransaction, isDrawTransactionActive } from '../store/historyStore';
import { usePropertyStore } from '../store/propertyStore';

export type RoomBuildCommitResult = { ok: true; roomId: string; preview: RoomBuildPreview }
  | RoomBuildFailure
  | { ok: false; reason: 'drawing-in-progress'; message: string };

/**
 * Revalidate against current rooms/plot, then commit one undo frame. Never
 * open a transaction while dragging: cancellation needs no rollback at all.
 */
export function commitRectRoomBuild(draft: RoomBuildPreview, name?: string): RoomBuildCommitResult {
  const store = usePropertyStore.getState();
  const preview = previewRectRoomBuild(store.property, draft.from, draft.to, { stepM: draft.stepM, levelId: draft.levelId });
  if (!preview.ok) return preview;
  // The 2D wall pen owns its own transaction. Never end it from this gesture.
  if (isDrawTransactionActive()) return { ok: false, reason: 'drawing-in-progress', message: 'Finish the current wall drawing before building a room in 3D.' };
  const active = store.property.rooms.find((room) => room.id === store.property.activeRoomId
    && roomLevelId(room) === preview.levelId && !isOutdoorRoom(room) && !isRoofRoom(room));
  const blank = active && !isDrawnPolygon(active.polygon) ? active : null;
  const requestedName = name?.trim();
  const roomName = requestedName || blank?.name || nextRoomName(store.property.rooms.filter((room) => isDrawnPolygon(room.polygon)));
  let roomId: string;
  beginDrawTransaction('build room');
  try {
    if (blank) {
      roomId = blank.id;
      store.setRoomPolygon(roomId, preview.polygon);
      if (roomName !== blank.name) store.renameRoom(roomId, roomName);
      store.selectItem(null);
    } else {
      roomId = store.addRoom({ name: roomName, polygon: preview.polygon });
    }
    // Include any derived roof-slab change in this same undo frame, even
    // when the App's roof subscription is not mounted (for example tests).
    store.syncRoof();
  } finally {
    endDrawTransaction();
  }
  return { ok: true, roomId, preview };
}
