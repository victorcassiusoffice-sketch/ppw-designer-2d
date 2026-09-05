/**
 * `/designer?demo=<slug>` — the loader's pure parts (Courts Mammouth push,
 * 2026-09-05). The React hook is a thin wrapper around these.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore, DRAFT_ID } from '../../store/designsStore';
import { useWallStore } from '../../store/wallStore';
import { useHistoryStore } from '../../store/historyStore';
import { currentPageId } from '../../lib/pages';
import { __resetDemosForTests, activeDemoSlug, registerDemo, type DemoDefinition } from '../demoCatalog';
import { activateDemoFromUrl, ensureDemoPage, readDemoParam } from '../useDemoMode';
import type { Product } from '../../data/products.schema';

function product(id: string): Product {
  return {
    id,
    sku: id.toUpperCase(),
    name: id,
    category: 'decor',
    supplier: 'Acme',
    dimensions_cm: { length: 200, width: 90, height: 80 },
    weight_kg: 40,
    price: { value: 25000, currency: 'MUR' },
    commission_pct: 0,
    shopify_ready: false,
    image_url: '',
    designer_status: 'Done',
    delivery_regions: ['MU'],
    notes: '',
  };
}

const ACME: DemoDefinition = {
  slug: 'acme',
  merchant: 'Acme Home',
  pageName: 'Acme Home · Show home',
  products: [product('acme-sofa')],
  buildProperty: () => ({
    id: 'acme-show-home',
    name: 'Acme Home · Show home',
    activeRoomId: 'living',
    rooms: [
      {
        id: 'living',
        name: 'Living room',
        polygon: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 4 },
          { x: 0, y: 4 },
        ],
        placedItems: [{ instanceId: 'i1', productId: 'acme-sofa', x: 2, y: 1, rotation: 0 }],
      },
    ],
  }),
};

beforeEach(() => {
  __resetDemosForTests();
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().replace([]);
  useHistoryStore.getState().reset();
  useDesignsStore.setState({ designs: {}, currentId: null });
});
afterEach(() => __resetDemosForTests());

describe('readDemoParam', () => {
  it('reads, trims and lower-cases the demo slug; off is meaningful; absent is null', () => {
    expect(readDemoParam('?demo=Courts')).toBe('courts');
    expect(readDemoParam('?x=1&demo=%20acme%20')).toBe('acme');
    expect(readDemoParam('?demo=off')).toBe('off');
    expect(readDemoParam('?demo=')).toBeNull();
    expect(readDemoParam('')).toBeNull();
    expect(readDemoParam('?other=1')).toBeNull();
  });
});

describe('activateDemoFromUrl', () => {
  it('activates a registered slug, ignores an unknown one, and off deactivates', () => {
    registerDemo(ACME);
    expect(activateDemoFromUrl('?demo=acme')?.slug).toBe('acme');
    expect(activeDemoSlug()).toBe('acme');
    // A typo must not throw the visitor out of the demo they are already in.
    expect(activateDemoFromUrl('?demo=nope')?.slug).toBe('acme');
    expect(activateDemoFromUrl('?demo=off')).toBeNull();
    expect(activeDemoSlug()).toBeNull();
  });
});

describe('ensureDemoPage', () => {
  it('loads the show home as its own page and puts it on the canvas', () => {
    registerDemo(ACME);
    expect(ensureDemoPage(ACME)).toBe('loaded');
    const prop = usePropertyStore.getState().property;
    expect(prop.name).toBe(ACME.pageName);
    expect(prop.rooms[0].placedItems[0].productId).toBe('acme-sofa');
    const id = currentPageId();
    expect(id).not.toBe(DRAFT_ID);
    expect(useDesignsStore.getState().designs[id]?.name).toBe(ACME.pageName);
    // Undo history starts clean — a Ctrl+Z must not resurrect the previous plan.
    expect(useHistoryStore.getState().canUndo?.() ?? false).toBe(false);
  });

  it('keeps the customer’s unsaved work as a tab before replacing the canvas', () => {
    registerDemo(ACME);
    // Draw something in the draft first.
    usePropertyStore.getState().loadProperty({
      id: 'mine',
      name: 'My gym',
      activeRoomId: 'g',
      rooms: [
        {
          id: 'g',
          name: 'Gym',
          polygon: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
          ],
          placedItems: [],
        },
      ],
    });
    expect(currentPageId()).toBe(DRAFT_ID);
    ensureDemoPage(ACME);
    const names = Object.values(useDesignsStore.getState().designs)
      .filter((d) => d.id !== DRAFT_ID)
      .map((d) => d.name)
      .sort();
    expect(names).toEqual(['Acme Home · Show home', 'My gym']);
  });

  it('is idempotent: a second open switches to the existing page instead of stamping a copy', () => {
    registerDemo(ACME);
    expect(ensureDemoPage(ACME)).toBe('loaded');
    expect(ensureDemoPage(ACME)).toBe('current');
    // Move away, then come back.
    const other = useDesignsStore.getState().savePropertyAs('Other', usePropertyStore.getState().property);
    useDesignsStore.getState().setCurrent(other);
    expect(ensureDemoPage(ACME)).toBe('switched');
    const copies = Object.values(useDesignsStore.getState().designs).filter((d) => d.name === ACME.pageName);
    expect(copies).toHaveLength(1);
  });
});
