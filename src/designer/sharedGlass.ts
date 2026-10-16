import type { SceneRoomInput } from './roomView3d';
import { edgeKey, roomEdges } from './wallEdges';
import { openingHeightM, openingSillM } from './openingGeometry';

type SceneOpening = NonNullable<SceneRoomInput['openings']>[number];
export interface SharedGlassEdge {
  ownerKey: string;
  peer: SceneRoomInput;
  peerEdgeIndex: number;
  reversed: boolean;
  lengthM: number;
}

/** Two room records describe one physical pane. Partial overlaps deliberately
 * stay independent until their wall edges have been split at the same joins. */
export function sharedGlassEdges(rooms: readonly SceneRoomInput[]): Map<string, SharedGlassEdge> {
  const edges = rooms.filter(r => r.kind !== 'outdoor').flatMap(room => roomEdges(room)
    .filter(e => room.wallConstructionByEdge?.get(e.index) === 'glass')
    .map(edge => ({ room, edge, key: edgeKey(room.id, edge.index) })));
  const result = new Map<string, SharedGlassEdge>();
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    if (result.has(a.key)) continue;
    for (const b of edges.slice(i + 1)) {
      if (a.room.id === b.room.id || result.has(b.key)) continue;
      if (Math.abs((a.room.wallThicknessByEdge?.get(a.edge.index) ?? .01) - (b.room.wallThicknessByEdge?.get(b.edge.index) ?? .01)) > 1e-6) continue;
      const reversed = near(a.edge.a, b.edge.b) && near(a.edge.b, b.edge.a);
      if (!reversed) continue;
      const ownerKey = [a.key, b.key].sort()[0];
      result.set(a.key, { ownerKey, peer: b.room, peerEdgeIndex: b.edge.index, reversed, lengthM: a.edge.lengthM });
      result.set(b.key, { ownerKey, peer: a.room, peerEdgeIndex: a.edge.index, reversed, lengthM: b.edge.lengthM });
      break;
    }
  }
  return result;
}

/** Merge a neighbour's cutouts before hiding its duplicate pane. This also
 * handles older imported plans with an opening saved on only one room. */
export function sharedGlassOpenings(room: SceneRoomInput, edgeIndex: number, shared?: SharedGlassEdge): SceneOpening[] {
  const openings = (room.openings ?? []).filter(o => o.edgeIndex === edgeIndex);
  if (!shared) return openings;
  const merged = [...openings];
  for (const o of shared.peer.openings ?? []) {
    if (o.edgeIndex !== shared.peerEdgeIndex) continue;
    const mapped = { ...o, edgeIndex, offsetM: shared.reversed ? shared.lengthM - o.offsetM : o.offsetM };
    // Geometry, not IDs: neighbour copies can have their own persisted ID.
    const same = merged.some(x => x.kind === mapped.kind && (x.shape ?? 'rectangle') === (mapped.shape ?? 'rectangle') &&
      Math.abs(x.offsetM - mapped.offsetM) < 1e-6 && Math.abs(x.widthM - mapped.widthM) < 1e-6 &&
      Math.abs(openingHeightM(x) - openingHeightM(mapped)) < 1e-6 && Math.abs(openingSillM(x) - openingSillM(mapped)) < 1e-6);
    if (!same) merged.push(mapped);
  }
  return merged;
}
