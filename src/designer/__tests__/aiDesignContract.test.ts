import { describe, expect, it } from 'vitest';
import {
  createGuidedDesign,
  validateDesignDraft,
  DesignBriefSchema,
  type DesignCatalogProduct,
} from '../aiDesignContract';
import { designDraftToProperty } from '../aiDesignProperty';
import { buildingLevels } from '../building';
import { roofSourceRooms } from '../roof';
import { openingsOnPhysicalWall } from '../openingPlacement';
import { roomEdges } from '../wallEdges';

describe('measured house proposals', () => {
  for (const storeys of [1, 2, 3])
    for (const bedrooms of [1, 3, 8])
      it(`connects ${bedrooms} bedrooms over ${storeys} storeys`, () => {
        const d = createGuidedDesign({ bedrooms, storeys, plotDepthM: 30 });
        expect(d.rooms.filter((r) => r.name.startsWith('Bedroom'))).toHaveLength(bedrooms);
        expect(d.levels).toHaveLength(storeys);
        expect(d.stairs).toHaveLength(storeys - 1);
        expect(validateDesignDraft(d).ok).toBe(true);
      });
  it('reports that guided notes are not interpreted', () => {
    expect(createGuidedDesign({ brief: 'Make a secret basement' }).warnings.join(' ')).toContain(
      'free-text notes are not interpreted',
    );
  });
  it('rejects an impossible brief rather than shrinking room dimensions silently', () => {
    expect(() => createGuidedDesign({ bedrooms: 8, storeys: 1, plotDepthM: 14 })).toThrow(
      /plot depth/,
    );
    expect(DesignBriefSchema.safeParse({ plotWidthM: Infinity }).success).toBe(false);
  });
  it('rejects overlaid rooms and dimensions outside the plot', () => {
    const d = createGuidedDesign({});
    d.rooms[1].xM = d.rooms[0].xM;
    expect(validateDesignDraft(d)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('overlaps')]),
    });
    d.rooms[1].xM = 99;
    expect(validateDesignDraft(d)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('beyond the plot')]),
    });
  });
  it('does not accept hidden windows as an entrance or disconnected bedrooms', () => {
    const d = createGuidedDesign({});
    d.rooms[0].openings[0].kind = 'window';
    expect(validateDesignDraft(d)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('entrance')]),
    });
    const e = createGuidedDesign({});
    e.rooms[1].openings = e.rooms[1].openings.filter((o) => o.kind === 'window');
    expect(validateDesignDraft(e)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('no connected')]),
    });
  });
  it('rejects duplicate identities, overlapping openings and doors off the wall', () => {
    const d = createGuidedDesign({});
    d.rooms[1].openings.push({ ...d.rooms[1].openings[0] });
    expect(validateDesignDraft(d)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.stringContaining('Duplicate'),
        expect.stringContaining('openings overlap'),
      ]),
    });
    const e = createGuidedDesign({});
    e.rooms[1].openings[0].offsetM = 0;
    expect(validateDesignDraft(e)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('does not fit')]),
    });
  });
  it('rejects missing stairs, misaligned elevations and floating stair footprints', () => {
    const d = createGuidedDesign({ storeys: 2 });
    d.stairs = [];
    expect(validateDesignDraft(d)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('Add stairs')]),
    });
    const e = createGuidedDesign({ storeys: 2 });
    e.levels[1].elevationM = 10;
    e.stairs[0].xM = 80;
    expect(validateDesignDraft(e)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.stringContaining('Storeys must stack'),
        expect.stringContaining('fit inside rooms'),
      ]),
    });
  });
  it('validates real rotated product footprints and unknown IDs', () => {
    const d = createGuidedDesign({});
    const r = d.rooms[1];
    const catalog: DesignCatalogProduct[] = [
      {
        id: 'table',
        name: 'Table',
        supplier: 'Supplier',
        category: 'furniture',
        widthM: 4,
        depthM: 1,
        heightM: 0.7,
      },
    ];
    r.products = [{ productId: 'fake', xM: r.xM + 1, yM: r.yM + 1, rotation: 0 }];
    expect(validateDesignDraft(d, catalog)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('Unknown catalogue')]),
    });
    r.products = [
      { productId: 'table', xM: r.xM + r.widthM / 2, yM: r.yM + r.depthM / 2, rotation: 0 },
    ];
    expect(validateDesignDraft(d, catalog).ok).toBe(true);
    r.products[0].rotation = 90;
    expect(validateDesignDraft(d, catalog)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('does not fit')]),
    });
  });
  it('rejects executable or arbitrary extra fields', () => {
    const d = { ...createGuidedDesign({}), userId: 'somebody-else', order: true };
    expect(validateDesignDraft(d).ok).toBe(false);
  });
  for (const placement of ['roof', 'wall', 'surface', 'ceiling'] as const)
    it(`rejects a ${placement} product without a supported host`, () => {
      const draft = createGuidedDesign({});
      const room = draft.rooms[1];
      room.products = [{ productId: 'hosted-item', xM: room.xM + 1, yM: room.yM + 1, rotation: 0 }];
      const catalog: DesignCatalogProduct[] = [
        {
          id: 'hosted-item',
          name: 'Hosted product',
          supplier: 'Verified source',
          category: 'decor',
          widthM: 0.5,
          depthM: 0.5,
          heightM: 0.5,
          placement,
        },
      ];
      expect(validateDesignDraft(draft, catalog)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining(`needs a ${placement} host`)]),
      });
      expect(validateDesignDraft(draft, [{ ...catalog[0], placement: 'floor' }]).ok).toBe(true);
    });
  it('reserves roof identities and keeps clear circulation beside guided stairs', () => {
    const d = createGuidedDesign({ storeys: 2 });
    const stair = d.stairs[0],
      hall = d.rooms[0];
    expect(stair.xM - stair.widthM / 2 - hall.xM).toBeGreaterThanOrEqual(1.09);
    expect(hall.xM + hall.widthM - stair.xM - stair.widthM / 2).toBeGreaterThanOrEqual(1.09);
    d.levels[1].id = 'roof';
    expect(validateDesignDraft(d).ok).toBe(false);
    const e = createGuidedDesign({});
    e.rooms[0].id = 'roof-room';
    expect(validateDesignDraft(e).ok).toBe(false);
  });
  it('converts to the existing shared Plan/3D property with roof, stairs and openings intact', () => {
    const d = createGuidedDesign({ storeys: 2 });
    const p = designDraftToProperty(d);
    expect(p.rooms.filter((r) => r.kind !== 'roof')).toHaveLength(d.rooms.length);
    expect(p.rooms.filter((r) => r.kind === 'roof')).toHaveLength(roofSourceRooms(p).length);
    expect(p.stairs).toHaveLength(1);
    expect(p.garden?.surfaces.map((s) => s.kind)).toEqual(['lawn', 'path']);
    expect(p.rooms[0].openings?.[0]).toMatchObject({ kind: 'door', widthM: 1 });
    expect(buildingLevels(p)[1].elevationM).toBeCloseTo(d.levels[1].elevationM);
    expect(designDraftToProperty(d).id).not.toBe(p.id);
    // Corridor stores no duplicate door records. Its rendered wall receives
    // neighbouring room openings through the existing physical-wall resolver.
    const hall = p.rooms[0];
    expect(openingsOnPhysicalWall(p.rooms, hall, roomEdges(hall)[3]).length).toBeGreaterThan(0);
  });
});
