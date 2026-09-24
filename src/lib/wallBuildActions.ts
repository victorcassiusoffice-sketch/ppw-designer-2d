/** Commit one wall segment, or replace only this run with a newly closed room. */
import { previewWallBuild, type WallBuildChain, type WallBuildFailure, type WallBuildPreview } from '../designer/wallBuildGesture';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from '../designer/levels';
import { isDrawnPolygon } from '../designer/roomLayout';
import { nextRoomName } from '../designer/roomNaming';
import { runToFreeWalls } from '../designer/freeWalls';
import { beginDrawTransaction, endDrawTransaction, isDrawTransactionActive } from '../store/historyStore';
import { usePropertyStore } from '../store/propertyStore';

export type WallBuildCommitResult = { ok: true; chain: WallBuildChain | null; roomId?: string; preview: WallBuildPreview }
  | WallBuildFailure | { ok: false; reason: 'drawing-in-progress'; message: string };

/** No store writes before validation; a released segment is exactly one undo. */
export function commitWallBuild(draft: WallBuildPreview, chain: WallBuildChain | null): WallBuildCommitResult {
  const store = usePropertyStore.getState();
  const preview = previewWallBuild(store.property, draft.from, draft.to, {
    levelId: draft.levelId, stepM: draft.stepM, freeAngle: draft.freeAngle, chain,
  });
  if (!preview.ok) return preview;
  if (isDrawTransactionActive()) return { ok: false, reason: 'drawing-in-progress', message: 'Finish the plan wall pen before drawing in 3D.' };
  beginDrawTransaction(preview.closesRoom ? 'close walls into room' : 'build wall');
  try {
    if (preview.closesRoom && preview.roomPolygon && chain) {
      const active = store.property.rooms.find((room) => room.id === store.property.activeRoomId
        && roomLevelId(room) === preview.levelId && !isOutdoorRoom(room) && !isRoofRoom(room) && !isDrawnPolygon(room.polygon));
      for (const id of chain.wallIds) store.removeFreeWall(id);
      const roomId = active ? active.id : store.addRoom({
        name: nextRoomName(store.property.rooms.filter((room) => isDrawnPolygon(room.polygon))), polygon: preview.roomPolygon,
      });
      if (active) store.setRoomPolygon(active.id, preview.roomPolygon);
      store.selectItem(null);
      store.syncRoof();
      return { ok: true, roomId, preview, chain: null };
    }
    const ids = store.addFreeWalls(runToFreeWalls([preview.a, preview.b], preview.levelId));
    store.selectItem(null);
    return { ok: true, preview, chain: {
      propertyId: store.property.id, levelId: preview.levelId,
      vertices: [...(chain?.vertices ?? [preview.a]), preview.b], wallIds: [...(chain?.wallIds ?? []), ...ids],
    } };
  } finally {
    endDrawTransaction();
  }
}
