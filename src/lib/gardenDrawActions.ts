import { gardenRectFromPoints, type GardenPlacement } from '../designer/garden';
import type { Vertex } from './geometry';
import { usePropertyStore } from '../store/propertyStore';
import { useGardenEditorStore } from '../store/gardenEditorStore';

/** Keep a new area transient until release; one property change means one undo. */
export function commitGardenRectangle(intent: GardenPlacement, from: Vertex, to: Vertex) {
  const patch = gardenRectFromPoints(from, to);
  if (!patch) return null;
  const store = usePropertyStore.getState();
  const id = intent.mode === 'draw'
    ? store.addGardenSurface({ ...patch, kind: intent.surfaceKind, elevationM: 0, ...(intent.pavingProductId ? { pavingProductId: intent.pavingProductId } : {}) })
    : intent.kind === 'surface' && intent.mode === 'resize' && store.updateGardenSurface(intent.id, patch) ? intent.id : null;
  if (!id) return null;
  useGardenEditorStore.getState().select(id);
  return { id, patch };
}
