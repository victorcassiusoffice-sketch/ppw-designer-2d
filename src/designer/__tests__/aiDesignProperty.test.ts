import { describe, expect, it } from 'vitest';
import {
  createGuidedDesign,
  validateDesignDraft,
  type DesignCatalogProduct,
} from '../aiDesignContract';
import { designDraftToProperty } from '../aiDesignProperty';

const catalog: DesignCatalogProduct[] = [
  {
    id: 'measured-table',
    name: 'Measured table',
    supplier: 'Source',
    category: 'furniture',
    widthM: 2,
    depthM: 1,
    heightM: 0.7,
  },
];
describe('AI proposal products in the shared editor', () => {
  for (const rotation of [0, 90, 180, 270] as const)
    it(`keeps a validated ${rotation} degree product at the exact proposed centre`, () => {
      const draft = createGuidedDesign({});
      const room = draft.rooms[1];
      const width = rotation % 180 ? 1 : 2,
        depth = rotation % 180 ? 2 : 1;
      // Deliberately flush with the far edges: using centre as top-left would
      // place half of the product outside the validated room.
      const centre = {
        xM: room.xM + room.widthM - width / 2,
        yM: room.yM + room.depthM - depth / 2,
      };
      room.products = [{ productId: catalog[0].id, ...centre, rotation }];
      expect(validateDesignDraft(draft, catalog).ok).toBe(true);
      const placed = designDraftToProperty(draft, catalog).rooms.find((r) => r.id === room.id)!
        .placedItems[0];
      expect(placed.x + width / 2).toBeCloseTo(centre.xM, 10);
      expect(placed.y + depth / 2).toBeCloseTo(centre.yM, 10);
      expect(placed.x + width).toBeCloseTo(room.xM + room.widthM, 10);
      expect(placed.y + depth).toBeCloseTo(room.yM + room.depthM, 10);
    });
  it('refuses conversion if the verified dimensions disappeared', () => {
    const draft = createGuidedDesign({});
    draft.rooms[1].products = [{ productId: catalog[0].id, xM: 3, yM: 3, rotation: 0 }];
    expect(() => designDraftToProperty(draft)).toThrow('Verified dimensions are required');
  });
  it('refuses direct conversion of a hosted product even when its dimensions fit', () => {
    const draft = createGuidedDesign({});
    const room = draft.rooms[1];
    room.products = [{ productId: catalog[0].id, xM: room.xM + 1, yM: room.yM + 1, rotation: 0 }];
    expect(() => designDraftToProperty(draft, [{ ...catalog[0], placement: 'roof' }])).toThrow(
      'needs a roof host',
    );
  });
});
