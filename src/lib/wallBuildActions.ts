/** Commit a wall segment and any rooms it closes against the floor's wall graph. */
import { previewWallBuild, type WallBuildChain, type WallBuildFailure, type WallBuildPreview } from '../designer/wallBuildGesture';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from '../designer/levels';
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
    const ids = store.addFreeWalls(runToFreeWalls([preview.a, preview.b], preview.levelId));
    store.selectItem(null);
    const next = usePropertyStore.getState().property;
    const formed = next.rooms.find(room => roomLevelId(room) === preview.levelId && !isOutdoorRoom(room) && !isRoofRoom(room)
      && room.polygon.length >= 3 && store.property.rooms.find(old => old.id === room.id)?.polygon !== room.polygon);
    if (formed) return { ok: true, roomId: formed.id, preview: { ...preview, closesRoom: true, roomPolygon: formed.polygon }, chain: null };
    return { ok: true, preview, chain: {
      propertyId: store.property.id, levelId: preview.levelId,
      vertices: [...(chain?.vertices ?? [preview.a]), preview.b], wallIds: [...(chain?.wallIds ?? []), ...ids],
    } };
  } finally {
    endDrawTransaction();
  }
}
