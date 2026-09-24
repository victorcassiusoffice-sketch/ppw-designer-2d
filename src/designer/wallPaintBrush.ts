/**
 * wallPaintBrush — ONE place that turns "the brush touched this wall" into a
 * store change (2026-09-14). The plan's click path (RoomCanvas) and the 3D
 * room view (RoomView3D) both land here, so Wall/Room scope, Erase and the
 * tint behave identically whichever surface the customer painted on.
 *
 * Sims modifiers (2026-09-17, Vic: "front end like The Sims 1"): Shift on
 * the click paints the whole room, Ctrl / ⌘ strips instead of painting —
 * for THIS click only; the panel's chips are untouched. The Floor tool
 * already reads the same keys.
 */
import { useDesignerUIStore, type WallPaintDraft } from '../store/designerUIStore';
import { usePropertyStore, type PaintColourChoice } from '../store/propertyStore';
import { WALL_PAINTS, findWallPaintById, isPaintTintable, normalisePaintColourHex } from '../data/wallPaints';
import type { WallHit } from './roomView3d';
import { exteriorWallSpans, WALL_CONSTRUCTIONS } from './wallConstruction';

export interface BrushResult {
  /** What happened, for a toast. `null` when nothing changed. */
  message: string | null;
  kind: 'success' | 'info' | 'warn';
  /** One line for the view's caption after a single-wall stroke ("Wall 2 · Matt Emulsion · Bronze"). */
  detail?: string;
}

export interface BrushModifiers {
  /** Shift held: the whole room, this click only. */
  shift?: boolean;
  /** Ctrl / ⌘ held: erase, this click only. */
  ctrl?: boolean;
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

/** "Permoglaze Matt Emulsion · Bronze" — what the brush would lay down. */
export function brushLabel(draft: Pick<WallPaintDraft, 'paintId' | 'colourHex' | 'colourName' | 'erase' | 'operation' | 'construction'>): string {
  if (draft.operation === 'construction') return WALL_CONSTRUCTIONS.find((entry) => entry.id === (draft.construction ?? 'plastered-brick'))?.name ?? 'Wall material';
  if (draft.erase) return 'Erase';
  const paint = findWallPaintById(brushPaintId(draft));
  const tint = brushColour(draft);
  return `${paint?.name ?? 'Paint'}${tint ? ` · ${tint.name ?? tint.hex}` : ''}`;
}

/** Apply the current brush (scope, erase, paint, tint) to a wall hit. */
export function applyWallPaintBrush(hit: WallHit | null, mods: BrushModifiers = {}): BrushResult {
  const draft = useDesignerUIStore.getState().wallPaintDraft;
  const ps = usePropertyStore.getState();
  if (!hit) return { message: 'Tap a wall to paint it.', kind: 'warn' };
  if (draft.operation === 'construction') {
    const kind = draft.construction ?? 'plastered-brick';
    if (hit.kind === 'edge' && hit.roomId && typeof hit.edgeIndex === 'number') ps.setWallConstruction(hit.roomId, draft.scope === 'room' || mods.shift ? null : hit.edgeIndex, kind);
    else if (hit.kind === 'free' && hit.wallId) ps.setFreeWallConstruction(hit.wallId, kind);
    return { message: 'Wall surface updated.', kind: 'success', detail: WALL_CONSTRUCTIONS.find((entry) => entry.id === kind)?.name };
  }
  const side = draft.side ?? 'interior';
  if (side === 'exterior' && !draft.erase && !mods.ctrl && findWallPaintById(brushPaintId(draft))?.use === 'interior') return { message: 'Choose an exterior paint line for the outside face.', kind: 'warn' };
  if (side === 'exterior' && !draft.erase && hit.kind === 'edge' && hit.roomId && typeof hit.edgeIndex === 'number' && draft.scope !== 'room' && !mods.shift) {
    const room = ps.property.rooms.find((candidate) => candidate.id === hit.roomId);
    if (room && !exteriorWallSpans(room, hit.edgeIndex, ps.property.rooms).length) return { message: 'This is a shared inside wall. Choose Inside or an exterior wall.', kind: 'info' };
  }
  const erase = draft.erase || !!mods.ctrl;
  const roomScope = draft.scope === 'room' || !!mods.shift;
  const paintId = erase ? null : brushPaintId(draft);
  const colour = erase ? null : brushColour(draft);
  const label = brushLabel({ ...draft, erase });

  if (hit.kind === 'edge' && roomScope && hit.roomId) {
    ps.paintRoomWalls(hit.roomId, paintId, colour, side);
    return erase
      ? { message: 'Wall paint removed from the room.', kind: 'info', detail: 'Whole room · paint removed' }
      : { message: 'Every wall of the room painted.', kind: 'success', detail: `Whole room · ${label}` };
  }
  if (hit.kind === 'edge' && hit.roomId && typeof hit.edgeIndex === 'number') {
    ps.paintWallEdge(hit.roomId, hit.edgeIndex, paintId, colour, side);
    const wall = `Wall ${hit.edgeIndex + 1}`;
    return erase
      ? { message: 'Wall paint removed.', kind: 'info', detail: `${wall} · paint removed` }
      : { message: null, kind: 'success', detail: `${wall} · ${label}` };
  }
  if (hit.kind === 'free' && hit.wallId) {
    ps.paintFreeWall(hit.wallId, paintId, colour, side);
    return erase
      ? { message: 'Wall paint removed.', kind: 'info', detail: 'Free wall · paint removed' }
      : { message: null, kind: 'success', detail: `Free wall · ${label}` };
  }
  return { message: null, kind: 'info' };
}
