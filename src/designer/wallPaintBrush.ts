/**
 * wallPaintBrush — ONE place that turns "the brush touched this wall" into a
 * store change (2026-09-14). The plan's click path (RoomCanvas) and the 3D
 * room view (RoomView3D) both land here, so Wall/Room scope, Erase and the
 * tint behave identically whichever surface the customer painted on.
 */
import { useDesignerUIStore, type WallPaintDraft } from '../store/designerUIStore';
import { usePropertyStore, type PaintColourChoice } from '../store/propertyStore';
import { WALL_PAINTS, findWallPaintById, isPaintTintable, normalisePaintColourHex } from '../data/wallPaints';
import type { WallHit } from './roomView3d';

export interface BrushResult {
  /** What happened, for a toast. `null` when nothing changed. */
  message: string | null;
  kind: 'success' | 'info' | 'warn';
}

/**
 * The paint id the brush really holds: a persisted draft can name a retired
 * product, and a tap must never paint an unpriceable paint.
 */
export function brushPaintId(draft: Pick<WallPaintDraft, 'paintId'>): string {
  return findWallPaintById(draft.paintId) ? draft.paintId : WALL_PAINTS[0].id;
}

/** The tint on the brush, or null for the product's base (or a white-only line). */
export function brushColour(draft: Pick<WallPaintDraft, 'paintId' | 'colourHex' | 'colourName'>): PaintColourChoice | null {
  const paint = findWallPaintById(brushPaintId(draft));
  if (!paint || !isPaintTintable(paint)) return null;
  const hex = normalisePaintColourHex(draft.colourHex);
  if (!hex) return null;
  return { hex, name: draft.colourName };
}

/** Apply the current brush (scope, erase, paint, tint) to a wall hit. */
export function applyWallPaintBrush(hit: WallHit | null): BrushResult {
  const draft = useDesignerUIStore.getState().wallPaintDraft;
  const ps = usePropertyStore.getState();
  if (!hit) return { message: 'Tap a wall to paint it.', kind: 'warn' };
  const erase = draft.erase;
  const paintId = erase ? null : brushPaintId(draft);
  const colour = erase ? null : brushColour(draft);

  if (hit.kind === 'edge' && draft.scope === 'room' && hit.roomId) {
    ps.paintRoomWalls(hit.roomId, paintId, colour);
    return erase
      ? { message: 'Wall paint removed from the room.', kind: 'info' }
      : { message: 'Every wall of the room painted.', kind: 'success' };
  }
  if (hit.kind === 'edge' && hit.roomId && typeof hit.edgeIndex === 'number') {
    ps.paintWallEdge(hit.roomId, hit.edgeIndex, paintId, colour);
    return erase ? { message: 'Wall paint removed.', kind: 'info' } : { message: null, kind: 'success' };
  }
  if (hit.kind === 'free' && hit.wallId) {
    ps.paintFreeWall(hit.wallId, paintId, colour);
    return erase ? { message: 'Wall paint removed.', kind: 'info' } : { message: null, kind: 'success' };
  }
  return { message: null, kind: 'info' };
}
