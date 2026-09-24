import type { PaintedEdge, Room } from '../store/propertyStore';
import { finishOfPaint, resolveWallColourHex, BARE_PLASTER_HEX } from '../data/wallPaints';
import { findCladdingProduct } from '../data/claddingCatalog';
import { roomEdges, collinearOverlap, splitEdgeSpans, type Span } from './wallEdges';
import { roomLevelId } from './levels';

export type WallSide = 'interior' | 'exterior';
export type WallConstruction = 'plastered-brick' | 'brick' | 'concrete';
export interface ConstructedEdge { edgeIndex: number; kind: WallConstruction }
export const WALL_CONSTRUCTIONS: Array<{ id: WallConstruction; name: string; hex: string; detail: string }> = [
  { id: 'plastered-brick', name: 'Plastered brick', hex: BARE_PLASTER_HEX, detail: 'Smooth rendered face · fine trowel grain' },
  { id: 'brick', name: 'Exposed brick', hex: '#A36B50', detail: '220 × 65 mm brick · recessed mortar joints' },
  { id: 'concrete', name: 'Concrete', hex: '#A7A49C', detail: 'Bare concrete · subtle pores and tonal variation' },
];
export function isWallConstruction(value: unknown): value is WallConstruction {
  return WALL_CONSTRUCTIONS.some((entry) => entry.id === value);
}
export function constructionHex(kind?: WallConstruction): string {
  return WALL_CONSTRUCTIONS.find((entry) => entry.id === kind)?.hex ?? BARE_PLASTER_HEX;
}
export function paintSide(paint: { side?: WallSide }): WallSide { return paint.side === 'exterior' ? 'exterior' : 'interior'; }
export function remapConstruction(edges: ConstructedEdge[] | undefined, edgeMap: number[], polygon: unknown[]): ConstructedEdge[] | undefined {
  if (!Array.isArray(edges)) return undefined;
  const seen = new Set<number>();
  const result = edges.flatMap((edge) => {
    if (!edge || typeof edge !== 'object') return [];
    const index = edgeMap[edge.edgeIndex];
    if (!isWallConstruction(edge.kind) || !Number.isInteger(index) || index < 0 || index >= polygon.length || seen.has(index)) return [];
    seen.add(index);
    return [{ edgeIndex: index, kind: edge.kind }];
  });
  return result.length ? result : undefined;
}

/** The façade excludes co-located neighbour walls on the same storey. */
export function exteriorWallSpans(room: Pick<Room, 'id' | 'polygon' | 'levelId'>, edgeIndex: number, rooms: Array<Pick<Room, 'id' | 'polygon' | 'levelId' | 'kind'>>): Span[] {
  const edge = roomEdges(room).find((candidate) => candidate.index === edgeIndex);
  if (!edge) return [];
  const covered = rooms.filter((other) => other.id !== room.id && other.kind !== 'outdoor' && roomLevelId(other) === roomLevelId(room))
    .flatMap((other) => roomEdges(other).flatMap((neighbour) => { const overlap = collinearOverlap(edge, neighbour); return overlap ? [overlap] : []; }));
  return splitEdgeSpans(edge.lengthM, covered);
}
export function resolvedWallSurfaces(room: Pick<Room, 'polygon' | 'wallPaint' | 'wallCladding' | 'wallConstruction'>) {
  const wallColourByEdge = new Map<number, string>();
  const wallFinishByEdge = new Map<number, string>();
  const exteriorColourByEdge = new Map<number, string>();
  const exteriorFinishByEdge = new Map<number, string>();
  const wallConstructionByEdge = new Map<number, WallConstruction>();
  for (const edge of room.wallConstruction ?? []) {
    wallConstructionByEdge.set(edge.edgeIndex, edge.kind);
    wallColourByEdge.set(edge.edgeIndex, constructionHex(edge.kind));
    exteriorColourByEdge.set(edge.edgeIndex, constructionHex(edge.kind));
  }
  for (const edge of room.wallPaint ?? []) {
    const outside = paintSide(edge) === 'exterior';
    (outside ? exteriorColourByEdge : wallColourByEdge).set(edge.edgeIndex, resolveWallColourHex(edge.paintId, edge.colourHex));
    const finish = finishOfPaint(edge.paintId);
    if (finish) (outside ? exteriorFinishByEdge : wallFinishByEdge).set(edge.edgeIndex, finish);
  }
  for (const edge of room.wallCladding ?? []) {
    const clad = findCladdingProduct(edge.productId);
    if (!clad) continue;
    wallColourByEdge.set(edge.edgeIndex, clad.hex);
    wallFinishByEdge.set(edge.edgeIndex, 'textured');
  }
  return { wallColourByEdge, wallFinishByEdge, exteriorColourByEdge, exteriorFinishByEdge, wallConstructionByEdge };
}
export function sidePaint(paint: PaintedEdge, side: WallSide): PaintedEdge {
  return side === 'exterior' ? { ...paint, side } : paint;
}
