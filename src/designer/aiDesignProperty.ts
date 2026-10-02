import type { Property, Room } from '../store/propertyStore';
import type { DesignDraft, DesignCatalogProduct } from './aiDesignContract';
import { syncRoofRooms } from './roof';

/** Convert a VALIDATED proposal to ordinary editor data. Caller preserves old page first. */
export function designDraftToProperty(draft: DesignDraft, catalog: readonly DesignCatalogProduct[] = []): Property {
  const stamp =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rooms: Room[] = draft.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    levelId: r.levelId,
    polygon: [
      { x: r.xM, y: r.yM },
      { x: r.xM + r.widthM, y: r.yM },
      { x: r.xM + r.widthM, y: r.yM + r.depthM },
      { x: r.xM, y: r.yM + r.depthM },
    ],
    openings: r.openings.map((o) => ({ ...o, flipFacing: false, flipHand: false })),
    placedItems: r.products.map((p, i) => {
      const product = catalog.find(entry => entry.id === p.productId);
      if (!product || !Number.isFinite(product.widthM) || !Number.isFinite(product.depthM) || product.widthM <= 0 || product.depthM <= 0) throw new Error(`Verified dimensions are required for ${p.productId}. Revalidate the proposal against the current catalogue.`);
      if (product.placement !== undefined && product.placement !== 'floor') throw new Error(`${product.name} needs a ${product.placement} host. Add it with the editor after applying the layout.`);
      const width = p.rotation % 180 ? product.depthM : product.widthM;
      const depth = p.rotation % 180 ? product.widthM : product.depthM;
      // Drafts use centres. Plan/3D items use the rotated footprint's top-left.
      return { instanceId: `ai-${stamp}-${r.id}-${i}`, productId: p.productId, x: p.xM-width/2, y: p.yM-depth/2, rotation:p.rotation };
    }),
  }));
  const entry = draft.rooms.find(
    (r) => r.levelId === 'ground' && r.openings.some((o) => o.kind === 'door' && o.edgeIndex === 0),
  );
  const entryOpening = entry?.openings.find((o) => o.kind === 'door' && o.edgeIndex === 0);
  const surfaces: NonNullable<Property['garden']>['surfaces'] = draft.garden.lawn
    ? [
        {
          id: 'concept-lawn',
          kind: 'lawn',
          x: 0,
          y: 0,
          widthM: draft.plot.widthM,
          depthM: draft.plot.depthM,
          elevationM: 0,
        },
      ]
    : [];
  if (draft.garden.entrancePath && entry && entryOpening && entry.yM > 0.2)
    surfaces.push({
      id: 'concept-entrance',
      kind: 'path',
      x: entry.xM + entryOpening.offsetM - 0.6,
      y: 0,
      widthM: 1.2,
      depthM: entry.yM,
      elevationM: 0,
    });
  return syncRoofRooms({
    id: `concept-${stamp}`,
    name: draft.title,
    activeRoomId: rooms[0].id,
    activeLevelId: 'ground',
    rooms,
    levels: [
      ...draft.levels.map((l, index) => ({ ...l, index })),
      { id: 'roof', name: 'Roof', index: draft.levels.length, kind: 'roof' },
    ],
    wallHeightM: draft.levels[0].heightM,
    site: { widthM: draft.plot.widthM, depthM: draft.plot.depthM, originM: { x: 0, y: 0 } },
    stairs: draft.stairs.map((s) => ({
      id: s.id,
      fromLevelId: s.fromLevelId,
      toLevelId: s.toLevelId,
      x: s.xM,
      y: s.yM,
      widthM: s.widthM,
      runM: s.runM,
      rotation: s.rotation,
    })),
    roof: { ...draft.roof },
    garden: { surfaces, fences: [] },
  });
}
