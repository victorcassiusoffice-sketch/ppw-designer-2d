import type { Property, Room } from '../store/propertyStore';
import { activeLevelIdOf, isOutdoorRoom, isRoofRoom, roomsOnLevel } from './levels';
import { placedItemElevationCm } from './placedItemElevation';
import { isRoofProduct } from './energy';
import { wallsOnLevel } from './freeWalls';
import { edgeKey, pointAlongEdge, projectOntoEdge, roomEdges, sharedEdgeMap } from './wallEdges';
import { openingSpan } from './openings';
import { isDrawnPolygon } from './roomLayout';
import { roomFloorMaterial } from './floorFinish';
import { floorKindOf } from './floorKind';
import { emitsLight } from './lighting';
import { resolvedWallSurfaces, constructionHex } from './wallConstruction';
import { findFloorMaterialById } from '../data/floorMaterials';
import { findCladdingProduct } from '../data/claddingCatalog';
import { getProductById, productImageUrl, productTopDownUrl } from '../data/products';
import { bodyUrlFor, productModelFor } from '../data/productModels';
import { DEFAULT_WALL_HEIGHT_M, finishOfPaint, resolveWallColourHex } from '../data/wallPaints';
import {
  cameraPosition,
  itemFillForCategory,
  type OrbitCamera,
  type SceneInput,
  type SceneItemInput,
  type SceneRoomInput,
  type WallHit,
} from './roomView3d';

/**
 * Every opening that cuts a room's wall, including the neighbour's: a door
 * hosted by room A on a wall shared with room B must also be a hole in B's
 * wall, or it vanishes the moment the camera looks at that wall from B's
 * side (review 2026-09-14). Same world-point projection the plan uses.
 */
function openingsIncludingNeighbours(
  rooms: Room[],
): Map<string, NonNullable<SceneRoomInput['openings']>> {
  const drawn = rooms.filter(
    (r) => !isOutdoorRoom(r) && !isRoofRoom(r) && isDrawnPolygon(r.polygon),
  );
  const shared = sharedEdgeMap(
    drawn.map((r) => ({ id: r.id, polygon: r.polygon, removedWallEdges: r.removedWallEdges })),
  );
  const edgesByRoom = new Map(drawn.map((r) => [r.id, roomEdges(r)]));
  const byId = new Map(drawn.map((r) => [r.id, r]));
  const out = new Map<string, NonNullable<SceneRoomInput['openings']>>();
  for (const room of drawn) {
    const list: NonNullable<SceneRoomInput['openings']> = [...(room.openings ?? [])];
    for (const edge of edgesByRoom.get(room.id) ?? []) {
      for (const ref of shared.get(edgeKey(room.id, edge.index)) ?? []) {
        const nRoom = byId.get(ref.roomId);
        const nEdge = edgesByRoom.get(ref.roomId)?.[ref.edgeIndex];
        if (!nRoom || !nEdge) continue;
        for (const o of nRoom.openings ?? []) {
          if (o.edgeIndex !== ref.edgeIndex) continue;
          const span = openingSpan(o);
          const t0 = projectOntoEdge(edge, pointAlongEdge(nEdge, span.t0));
          const t1 = projectOntoEdge(edge, pointAlongEdge(nEdge, span.t1));
          list.push({
            ...o,
            edgeIndex: edge.index,
            offsetM: (t0 + t1) / 2,
            widthM: Math.abs(t1 - t0),
          });
        }
      }
    }
    out.set(room.id, list);
  }
  return out;
}

export function sceneFromProperty(
  property: Property,
  hover: WallHit | null,
  cam: OrbitCamera,
): SceneInput {
  const level = activeLevelIdOf(property);

  const rooms = roomsOnLevel(property.rooms, level);
  const walls = wallsOnLevel(property.walls ?? [], level);
  const H = property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M;
  const openingsByRoom = openingsIncludingNeighbours(rooms);
  const sceneRooms: SceneRoomInput[] = rooms.map((room: Room) => {
    // A roof slab has no walls to paint — items only, like outdoors.
    const outdoor = isOutdoorRoom(room) || isRoofRoom(room) || !isDrawnPolygon(room.polygon);
    const wallSurfaces = resolvedWallSurfaces(room);
    const pilot = property.eco?.waterStudy;
    if (pilot?.mossRoom === room.id || pilot?.blockRoom === room.id) {
      room.polygon.forEach((_, i) => {
        const kind = wallSurfaces.wallConstructionByEdge.get(i);
        if (kind === 'glass' || room.removedWallEdges?.includes(i)) return;
        if (
          pilot.blockRoom === room.id &&
          kind !== 'concrete' &&
          !wallSurfaces.wallFinishByEdge.has(i)
        )
          wallSurfaces.wallColourByEdge.set(i, '#ab9777');
        if (pilot.mossRoom === room.id) {
          wallSurfaces.wallColourByEdge.set(i, '#648153');
          wallSurfaces.wallFinishByEdge.set(i, 'textured');
        }
      });
    }
    // Floor: the largest painted zone's material, else the whole-room finish —
    // its hex, and (P3) what it reads as and its tile size for the surface.
    let floorMaterial = roomFloorMaterial(room);
    const zones = room.floorTiles ?? [];
    if (zones.length > 0) {
      const biggest = [...zones].sort((a, b) => b.runs.length - a.runs.length)[0];
      floorMaterial = findFloorMaterialById(biggest.materialId) ?? floorMaterial;
    }
    const floorHex = floorMaterial?.hex ?? undefined;
    const floorKind = floorKindOf(floorMaterial);
    const floorTileM = floorMaterial?.tile_w_m ?? undefined;
    const items: SceneItemInput[] = [];
    for (const it of room.placedItems) {
      const p = getProductById(it.productId);
      if (!p) continue;
      const body = productModelFor(p);
      const lamp = emitsLight(p);
      const hM = p.dimensions_cm.height / 100;
      const placementElevationCm = placedItemElevationCm(
        it,
        p,
        room.placedItems,
        getProductById,
        H,
      );
      // Where a lamp's light comes from: a pendant hangs from the ceiling, a
      // sconce sits at its mount height, a floor or table lamp near its top.
      const lightMountM = !lamp
        ? undefined
        : p.placement === 'ceiling'
          ? Math.max(0.5, H - 0.35)
          : p.placement === 'wall'
            ? placementElevationCm / 100 + hM * 0.5
            : placementElevationCm / 100 + Math.max(0.3, hM * 0.85);
      // No body → the box wears the product's own art (a data: SVG thumbnail
      // is the catalog's "no image" — the box stays a shaded box then).
      const artTop = body ? undefined : productTopDownUrl(p);
      const artSide = body ? undefined : productImageUrl(p);
      items.push({
        emitsLight: lamp && it.lightOn !== false,
        lightMountM,
        artTopUrl: artTop && !artTop.startsWith('data:') ? artTop : undefined,
        artSideUrl: artSide && !artSide.startsWith('data:') ? artSide : undefined,
        instanceId: it.instanceId,
        parentInstanceId: it.parentInstanceId,
        x: it.x,
        y: it.y,
        rotation: it.rotation,
        lengthCm: p.dimensions_cm.length,
        widthCm: p.dimensions_cm.width,
        heightCm: p.dimensions_cm.height,
        placement: isRoofProduct(p) ? 'roof' : p.placement,
        mountHeightCm: p.placement === 'wall' ? placementElevationCm : p.mount_height_cm,
        baseHeightCm: p.placement === 'surface' ? placementElevationCm : undefined,
        fill: itemFillForCategory(p.category),
        productId: p.id,
        frontEdge: p.front_edge,
        meshUrl: body ? bodyUrlFor(body) : undefined,
        preferMesh: body?.preferMesh,
        modelFront: body?.modelFront,
        lengthAxis: body?.lengthAxis,
        modelUp: body?.modelUp,
      });
    }
    return {
      id: room.id,
      name: room.name,
      polygon: room.polygon,
      removedWallEdges: room.removedWallEdges,
      openings: openingsByRoom.get(room.id) ?? room.openings,
      ...wallSurfaces,
      pilotWallRoom: pilot?.mossRoom === room.id,
      floorHex,
      floorKind,
      floorTileM,
      kind: outdoor ? 'outdoor' : 'room',
      items,
    };
  });
  return {
    rooms: sceneRooms,
    walls: walls.map((w) => ({
      id: w.id,
      a: w.a,
      b: w.b,
      thicknessM: w.thicknessM,
      colourHex:
        findCladdingProduct(w.claddingId)?.hex ??
        (w.paintId
          ? resolveWallColourHex(w.paintId, w.paintColourHex)
          : constructionHex(w.construction)),
      construction: w.construction,
      exteriorHex: w.exteriorPaint
        ? resolveWallColourHex(w.exteriorPaint.paintId, w.exteriorPaint.colourHex)
        : w.paintFaces === 2 && w.paintId
          ? resolveWallColourHex(w.paintId, w.paintColourHex)
          : constructionHex(w.construction),
      exteriorFinish: finishOfPaint(
        w.exteriorPaint?.paintId ?? (w.paintFaces === 2 ? w.paintId : undefined),
      ),
      finish: finishOfPaint(w.paintId),
    })),
    wallHeightM: H,
    cameraPos: cameraPosition(cam),
    cameraTarget: cam.target,
    hover,
  };
}
