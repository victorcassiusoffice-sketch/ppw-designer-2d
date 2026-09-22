/**
 * claddingBrush — the wall-paint brush for sample cladding. Plan clicks and
 * the 3D room view both land here (Shift = room, Ctrl = erase).
 */
import { useDesignerUIStore, type CladdingDraft } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import { CLADDING_PRODUCTS, findCladdingProduct } from '../data/claddingCatalog';
import type { BrushModifiers, BrushResult } from './wallPaintBrush';
import type { WallHit } from './roomView3d';

export function claddingBrushId(draft: Pick<CladdingDraft, 'productId'>): string {
  return findCladdingProduct(draft.productId) ? draft.productId : CLADDING_PRODUCTS[0].id;
}

export function claddingBrushLabel(draft: Pick<CladdingDraft, 'productId' | 'erase'>): string {
  if (draft.erase) return 'Erase';
  return findCladdingProduct(claddingBrushId(draft))?.name ?? 'Sample cladding';
}

export function applyCladdingBrush(hit: WallHit | null, mods: BrushModifiers = {}): BrushResult {
  const draft = useDesignerUIStore.getState().claddingDraft;
  const ps = usePropertyStore.getState();
  if (!hit) return { message: 'Tap a wall to clad it.', kind: 'warn' };
  const erase = draft.erase || !!mods.ctrl;
  const roomScope = draft.scope === 'room' || !!mods.shift;
  const productId = erase ? null : claddingBrushId(draft);
  const label = claddingBrushLabel({ ...draft, erase });

  if (hit.kind === 'edge' && roomScope && hit.roomId) {
    ps.setRoomCladding(hit.roomId, productId);
    return erase
      ? { message: 'Cladding removed from the room.', kind: 'info', detail: 'Whole room · cladding removed' }
      : { message: 'Every wall of the room clad.', kind: 'success', detail: `Whole room · ${label}` };
  }
  if (hit.kind === 'edge' && hit.roomId && typeof hit.edgeIndex === 'number') {
    ps.setWallCladding(hit.roomId, hit.edgeIndex, productId);
    const wall = `Wall ${hit.edgeIndex + 1}`;
    return erase
      ? { message: 'Cladding removed.', kind: 'info', detail: `${wall} · cladding removed` }
      : { message: null, kind: 'success', detail: `${wall} · ${label}` };
  }
  if (hit.kind === 'free' && hit.wallId) {
    ps.setFreeWallCladding(hit.wallId, productId);
    return erase
      ? { message: 'Cladding removed.', kind: 'info', detail: 'Free wall · cladding removed' }
      : { message: null, kind: 'success', detail: `Free wall · ${label}` };
  }
  return { message: null, kind: 'info' };
}
