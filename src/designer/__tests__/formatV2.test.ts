/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, type Property } from '../../store/propertyStore';
import { getAllProducts } from '../../data/products';
import { exportedDesign } from '../../lib/designExport';
import { DESIGN_FORMAT_VERSION } from '../designFormat';
import {
  COST_LINE_LIMIT,
  MEMBER_LIMIT,
  MEMBER_ROLES,
  cleanCostLines,
  cleanDesignProducts,
  cleanMembers,
  countCurvedWalls,
  designForExport,
  designFormatVersion,
  designProductsFor,
  isNewerFormat,
  keptNotShown,
  productIdsInUse,
  roleOf,
  versionNeeded,
  versionToWrite,
  type CatalogueProduct,
} from '../formatV2';

type Loose = Record<string, unknown>;
const open = (value: unknown) => normaliseLoadedProperty(value as Property) as unknown as Loose;
const square = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];
const item = (instanceId: string, productId: string) => ({
  instanceId,
  productId,
  x: 1,
  y: 1,
  rotation: 0,
});
/** A plain house of version 1: one room, three placed things of two products. */
const house = (more: Loose = {}) => ({
  id: 'v2',
  name: 'House',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Room',
      polygon: square,
      placedItems: [item('a', 'chair-1'), item('b', 'table-9'), item('c', 'chair-1')],
    },
  ],
  ...more,
});
// A made-up catalogue: no real company or product is named in this repository's tests.
const CATALOGUE: CatalogueProduct[] = [
  {
    id: 'chair-1',
    sku: 'CH-0001',
    name: 'Test chair',
    category: 'seating',
    supplier: 'Example Maker',
    dimensions_cm: { length: 55.5, width: 60, height: 82 },
  },
  { id: 'table-9', sku: '', name: 'Test table', supplier: '', dimensions_cm: { length: 0 } },
  { id: 'lamp-3', sku: 'L-3', name: 'Test lamp', supplier: 'Example Maker' },
];

describe('the products in use', () => {
  it('are found in the design, each once, in the order they are first met', () => {
    expect(productIdsInUse(house())).toEqual(['chair-1', 'table-9']);
    expect(productIdsInUse({})).toEqual([]);
    expect(productIdsInUse(null)).toEqual([]);
    expect(productIdsInUse({ rooms: [{ placedItems: [{ productId: 7 }, null, 'x'] }] })).toEqual(
      [],
    );
  });

  it('are written from the catalogue: company, model number, name, kind and true size in millimetres', () => {
    expect(designProductsFor(house(), CATALOGUE)).toEqual([
      {
        id: 'chair-1',
        company: 'Example Maker',
        modelNumber: 'CH-0001',
        name: 'Test chair',
        category: 'seating',
        sizeMm: { x: 555, y: 600, z: 820 },
      },
      // What the catalogue does not know is left out, never written as empty or as nought.
      { id: 'table-9', name: 'Test table' },
    ]);
  });

  it('a product the catalogue does not have keeps the entry the design came with; one that says nothing is not written', () => {
    const design = house({
      products: [
        {
          id: 'table-9',
          company: 'Other Maker',
          modelNumber: 'T-9',
          sizeMm: { x: 1200, y: 800, z: 740 },
        },
        { id: 'gone-4', name: 'No longer placed' },
      ],
    });
    expect(designProductsFor(design, [])).toEqual([
      {
        id: 'table-9',
        company: 'Other Maker',
        modelNumber: 'T-9',
        sizeMm: { x: 1200, y: 800, z: 740 },
      },
    ]);
    // With the catalogue: what it knows wins, what it does not know stays as the design had it.
    expect(designProductsFor(design, CATALOGUE)![1]).toEqual({
      id: 'table-9',
      company: 'Other Maker',
      modelNumber: 'T-9',
      name: 'Test table',
      sizeMm: { x: 1200, y: 800, z: 740 },
    });
    expect(designProductsFor({ ...house(), rooms: [] }, CATALOGUE)).toBeUndefined();
  });

  it('are checked entry by entry when a design is opened', () => {
    expect(
      cleanDesignProducts([
        {
          id: 'p1',
          company: '  Example Maker  ',
          modelNumber: 'M-1',
          sizeMm: { x: 600.4, y: 400, z: 800 },
        },
        { id: 'p1', company: 'A second entry for the same id' },
        { id: 'p2', sizeMm: { x: 0, y: 400, z: 800 }, name: 'A size that is no size' },
        { id: 'p3', company: 'x'.repeat(121), madeUp: { kept: true } },
        { id: 'has space', company: 'No' },
        { company: 'No id' },
        null,
        'text',
      ]),
    ).toEqual([
      {
        id: 'p1',
        company: 'Example Maker',
        modelNumber: 'M-1',
        sizeMm: { x: 600, y: 400, z: 800 },
      },
      { id: 'p2', name: 'A size that is no size' },
      { id: 'p3', madeUp: { kept: true } },
    ]);
    expect(cleanDesignProducts([])).toBeUndefined();
    expect(cleanDesignProducts('x')).toBeUndefined();
    expect(cleanDesignProducts({ id: 'p1' })).toBeUndefined();
  });
});

describe('cost lines', () => {
  it('are kept field by field', () => {
    expect(
      cleanCostLines([
        { id: 'c1', kind: 'product', productId: 'chair-1', quantity: 4, vat: true, payer: 'm1' },
        {
          id: 'c2',
          kind: 'labour',
          trade: 'painter',
          people: 2,
          hours: 6.5,
          rateSetId: 'set-7',
          note: ' Two coats ',
        },
        { id: 'c2', kind: 'labour', trade: 'a second entry for the same id' },
        { id: 'c3', kind: 'labour', people: -1, hours: 'six', vat: 'yes' },
        { id: 'c4' },
        { kind: 'labour' },
      ]),
    ).toEqual([
      { id: 'c1', kind: 'product', productId: 'chair-1', quantity: 4, vat: true, payer: 'm1' },
      {
        id: 'c2',
        kind: 'labour',
        trade: 'painter',
        people: 2,
        hours: 6.5,
        rateSetId: 'set-7',
        note: 'Two coats',
      },
      { id: 'c3', kind: 'labour' },
    ]);
  });

  it('never hold money, whoever wrote it into the design', () => {
    const [line] = cleanCostLines([
      {
        id: 'c1',
        kind: 'labour',
        hours: 3,
        rate: 450,
        price: 12,
        priceMinor: 1200,
        amount: 1350,
        total: 1350,
        unitPrice: 9,
        cost: 5,
        currency: 'XXX',
        madeUp: 'kept',
      },
    ])!;
    expect(line).toEqual({ id: 'c1', kind: 'labour', hours: 3, madeUp: 'kept' });
  });

  it('a kind this build does not know is kept as it is, with what it holds', () => {
    expect(cleanCostLines([{ id: 'c1', kind: 'transport', quantity: 2, kilometres: 40 }])).toEqual([
      { id: 'c1', kind: 'transport', quantity: 2, kilometres: 40 },
    ]);
  });

  it('keep no more than their limit', () => {
    const many = Array.from({ length: COST_LINE_LIMIT + 20 }, (_, i) => ({
      id: `c${i}`,
      kind: 'labour',
    }));
    expect(cleanCostLines(many)).toHaveLength(COST_LINE_LIMIT);
  });
});

describe('members and roles', () => {
  it('are kept with an id, a role and a name to show', () => {
    expect(
      cleanMembers([
        { id: 'm1', role: 'owner', name: ' First Person ' },
        { id: 'm2', role: 'plumber' },
        { id: 'm2', role: 'painter' },
        { id: 'm3' },
        { role: 'viewer' },
        { id: 'someone@example.org', role: 'builder' },
      ]),
    ).toEqual([
      { id: 'm1', role: 'owner', name: 'First Person' },
      { id: 'm2', role: 'plumber' },
    ]);
  });

  it('a role this build does not know is kept, and is the least here', () => {
    const [member] = cleanMembers([{ id: 'm1', role: 'gardener', badge: 4 }])!;
    expect(member).toEqual({ id: 'm1', role: 'gardener', badge: 4 });
    expect(roleOf(member)).toBe('viewer');
    for (const role of MEMBER_ROLES) expect(roleOf({ role })).toBe(role);
    expect(MEMBER_ROLES[0]).toBe('owner');
    expect(MEMBER_ROLES[MEMBER_ROLES.length - 1]).toBe('viewer');
  });

  it('keep no more than their limit', () => {
    const many = Array.from({ length: MEMBER_LIMIT + 5 }, (_, i) => ({
      id: `m${i}`,
      role: 'viewer',
    }));
    expect(cleanMembers(many)).toHaveLength(MEMBER_LIMIT);
  });
});

describe('the version number of a design', () => {
  it('this build reads version 2', () => {
    expect(DESIGN_FORMAT_VERSION).toBe(2);
    expect(isNewerFormat(house())).toBe(false);
    expect(isNewerFormat(house({ formatVersion: 2 }))).toBe(false);
    expect(isNewerFormat(house({ formatVersion: 3 }))).toBe(true);
  });

  it('is what the design says; without a number, or with one that is no number, it is 1', () => {
    expect(designFormatVersion(house())).toBe(1);
    expect(designFormatVersion(house({ formatVersion: 3 }))).toBe(3);
    for (const said of [0, -2, 1.5, '2', null, Number.NaN, {}])
      expect(designFormatVersion(house({ formatVersion: said })), String(said)).toBe(1);
    expect(designFormatVersion(null)).toBe(1);
  });

  it('a design needs version 2 as soon as it holds one version 2 part', () => {
    expect(versionNeeded(house())).toBe(1);
    expect(versionNeeded(house({ products: [{ id: 'p1' }] }))).toBe(2);
    expect(versionNeeded(house({ costLines: [{ id: 'c1', kind: 'labour' }] }))).toBe(2);
    expect(versionNeeded(house({ members: [{ id: 'm1', role: 'owner' }] }))).toBe(2);
    expect(
      versionNeeded(house({ walls: [{ id: 'w', a: square[0], b: square[1], bulge: 0.5 }] })),
    ).toBe(2);
    expect(
      versionNeeded(house({ walls: [{ id: 'w', a: square[0], b: square[1], bulge: 0 }] })),
    ).toBe(1);
    const curved = house();
    (curved.rooms[0] as Loose).wallArcs = [{ edgeIndex: 0, bulge: 0.3 }];
    expect(versionNeeded(curved)).toBe(2);
    expect(countCurvedWalls(curved)).toBe(1);
    expect(versionNeeded(house({ products: [], costLines: [], members: [] }))).toBe(1);
  });

  it('is written only when it is 2 or more, and never lowered', () => {
    expect(versionToWrite(house())).toBeUndefined();
    expect(versionToWrite(house({ formatVersion: 1 }))).toBeUndefined();
    expect(versionToWrite(house({ members: [{ id: 'm1', role: 'owner' }] }))).toBe(2);
    expect(versionToWrite(house({ formatVersion: 5 }))).toBe(5);
    expect(
      versionToWrite(house({ formatVersion: 5, members: [{ id: 'm1', role: 'owner' }] })),
    ).toBe(5);
  });
});

describe('a design that is opened', () => {
  it('a version 1 design is as it was: no number and none of the new keys', () => {
    const opened = open({
      id: 'v1',
      name: 'Old house',
      activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Room', polygon: square, placedItems: [] }],
    });
    for (const key of ['formatVersion', 'products', 'costLines', 'members'])
      expect(key in opened, key).toBe(false);
    expect('wallArcs' in (opened.rooms as Loose[])[0]).toBe(false);
  });

  it('a version 2 design keeps its new parts, checked, and its number', () => {
    const stored = house({
      formatVersion: 2,
      products: [{ id: 'chair-1', company: 'Example Maker', modelNumber: 'CH-0001' }],
      costLines: [{ id: 'c1', kind: 'labour', trade: 'painter', hours: 6, rate: 99 }],
      members: [{ id: 'm1', role: 'owner', name: 'First Person' }],
      walls: [{ id: 'w1', a: { x: 1, y: 1 }, b: { x: 4, y: 1 }, thicknessM: 0.1, bulge: 0.5 }],
    });
    const opened = open(stored);
    expect(opened.formatVersion).toBe(2);
    expect(opened.products).toEqual([
      { id: 'chair-1', company: 'Example Maker', modelNumber: 'CH-0001' },
    ]);
    expect(opened.costLines).toEqual([{ id: 'c1', kind: 'labour', trade: 'painter', hours: 6 }]);
    expect(opened.members).toEqual([{ id: 'm1', role: 'owner', name: 'First Person' }]);
    expect((opened.walls as Loose[])[0].bulge).toBe(0.5);
    expect(open(opened)).toEqual(opened);
  });

  it('a design that holds a version 2 part and no number gets the number 2', () => {
    expect(open(house({ members: [{ id: 'm1', role: 'owner' }] })).formatVersion).toBe(2);
  });

  it('a design from a newer build keeps its number', () => {
    expect(open(house({ formatVersion: 4 })).formatVersion).toBe(4);
  });

  it('new parts that are no lists leave nothing behind', () => {
    const opened = open(house({ products: 'x', costLines: { id: 'c' }, members: 7 }));
    for (const key of ['formatVersion', 'products', 'costLines', 'members'])
      expect(key in opened, key).toBe(false);
  });
});

describe('a design that leaves the app', () => {
  it('carries its products in use and the number 2; the design in the app is not changed', () => {
    const design = house();
    const before = JSON.stringify(design);
    const out = designForExport(design, CATALOGUE) as Loose;
    expect(JSON.stringify(design)).toBe(before);
    expect(out).not.toBe(design);
    expect(out.formatVersion).toBe(2);
    expect((out.products as Loose[]).map((p) => p.id)).toEqual(['chair-1', 'table-9']);
    // Again: nothing more to change, and the same object comes back.
    expect(designForExport(out, CATALOGUE)).toBe(out);
    // And it opens as it was written.
    expect(open(out).products).toEqual(out.products);
  });

  it('a house with nothing in it stays a version 1 design, and an old table goes', () => {
    const empty = {
      ...house(),
      rooms: [{ id: 'r1', name: 'Room', polygon: square, placedItems: [] }],
    };
    expect(designForExport(empty, CATALOGUE)).toBe(empty);
    const stale = {
      ...empty,
      formatVersion: 1,
      products: [{ id: 'gone-4', name: 'No longer placed' }],
    };
    const out = designForExport(stale, CATALOGUE) as Loose;
    expect('products' in out).toBe(false);
    expect('formatVersion' in out).toBe(false);
  });

  it('with the app own catalogue: a product that comes with the app is named as its catalogue names it', () => {
    const product = getAllProducts().find(
      (p) => p.sku && p.supplier && p.dimensions_cm.length > 0,
    )!;
    expect(product).toBeDefined();
    const design = {
      ...house(),
      rooms: [{ id: 'r1', name: 'Room', polygon: square, placedItems: [item('a', product.id)] }],
    };
    const out = exportedDesign(design) as Loose;
    const [entry] = out.products as Loose[];
    expect(entry.id).toBe(product.id);
    expect(entry.company).toBe(product.supplier.trim());
    expect(entry.modelNumber).toBe(product.sku.trim());
    expect((entry.sizeMm as Loose).x).toBe(Math.round(product.dimensions_cm.length * 10));
    expect(out.formatVersion).toBe(2);
    // No money goes with it.
    expect(JSON.stringify(out.products)).not.toMatch(/price|amount|currency/i);
  });
});

describe('what a design holds that this app keeps and does not show yet', () => {
  it('is said in words, with the count', () => {
    expect(keptNotShown(house())).toEqual([]);
    const design = house({
      walls: [{ id: 'w', a: square[0], b: square[1], bulge: 0.5 }],
      costLines: [
        { id: 'c1', kind: 'labour' },
        { id: 'c2', kind: 'labour' },
      ],
      members: [{ id: 'm1', role: 'owner' }],
    });
    const words = keptNotShown(design);
    expect(words).toHaveLength(3);
    expect(words[0]).toContain('1 curved wall is kept');
    expect(words[1]).toContain('2 cost lines are kept');
    expect(words[2]).toContain('1 member is named');
  });
});
