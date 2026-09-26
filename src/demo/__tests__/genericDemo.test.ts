import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { demoRoute } from '../demoRoute';
import { CAPTAMARIN_SCENE_DEMO, HOME_DEMO, PAINT_DEMO } from '../generic';
import { TINTEX_DEMO } from '../tintex';
import { COURTS_DEMO } from '../courts';
import { CAPTAMARIN_DEMO, CAPTAMARIN_PAGE_NAME } from '../captamarin';
import { activateDemoFromUrl, ensureDemoPage } from '../useDemoMode';
import { __resetDemosForTests, activeDemo, demoProducts } from '../demoCatalog';
import { usePropertyStore } from '../../store/propertyStore';
import { DRAFT_ID, useDesignsStore } from '../../store/designsStore';
import { useWallStore } from '../../store/wallStore';
import { flushCurrentPage } from '../../lib/pages';
import { getAllProducts, getProductById } from '../../data/products';

beforeEach(() => {
  __resetDemosForTests();
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().replace([]);
  useDesignsStore.setState({ designs: {}, currentId: null });
});
afterEach(() => __resetDemosForTests());

describe('generic designer demos', () => {
  it('parses designer-only routes with home/3D defaults and bounded scene/view values', () => {
    expect(demoRoute('/demo', '')).toEqual({ scene: 'home', view: '3d', embedded: false });
    expect(demoRoute('/embed/designer/', '?scene=paint&view=2d')).toEqual({ scene: 'paint', view: '2d', embedded: true });
    expect(demoRoute('/demo', '?scene=other&view=other')).toMatchObject({ scene: 'home', view: '3d' });
    expect(demoRoute('/designer', '?demo=tintex')).toBeNull();
  });

  it('opens the combined real catalog and ignores supplier overrides on generic routes', () => {
    activateDemoFromUrl('?demo=tintex', '/demo');
    expect(activeDemo()?.slug).toBe(HOME_DEMO.slug);
    expect(activeDemo()?.paintBrandIds).toBeUndefined();
    expect(demoProducts()).toEqual(COURTS_DEMO.products);
    expect(getAllProducts().some(product => product.category === 'solar')).toBe(true);
    const placedIds = HOME_DEMO.buildProperty().rooms.flatMap(room => room.placedItems.map(item => item.productId));
    expect(placedIds.length).toBeGreaterThan(0);
    for (const id of placedIds) expect(getProductById(id)?.price.value).toBeGreaterThan(0);
    activateDemoFromUrl('?scene=paint&demo=off', '/embed/designer');
    expect(activeDemo()?.slug).toBe(PAINT_DEMO.slug);
    expect(activeDemo()?.paintBrandIds).toBeUndefined();
    expect(demoProducts()).toEqual(COURTS_DEMO.products);
  });

  it('serves the Cap Tamarin two-bedroom on the read-only demo route under its own page id', () => {
    expect(demoRoute('/embed/designer', '?scene=captamarin&view=3d')).toEqual({ scene: 'captamarin', view: '3d', embedded: true });
    expect(demoRoute('/demo', '?scene=CapTamarin')).toMatchObject({ scene: 'home' });
    activateDemoFromUrl('?scene=captamarin&demo=tintex', '/demo');
    expect(activeDemo()?.slug).toBe(CAPTAMARIN_SCENE_DEMO.slug);
    expect(activeDemo()?.paintBrandIds).toBeUndefined();
    expect(demoProducts()).toEqual(COURTS_DEMO.products);
    const property = CAPTAMARIN_SCENE_DEMO.buildProperty();
    expect(property.id).toBe('generic-demo-captamarin');
    expect(property.name).toBe(CAPTAMARIN_PAGE_NAME);
    expect(property.rooms.map((room) => room.name)).toEqual(CAPTAMARIN_DEMO.buildProperty().rooms.map((room) => room.name));
    for (const id of property.rooms.flatMap((room) => room.placedItems.map((item) => item.productId))) expect(getProductById(id)?.price.value).toBeGreaterThan(0);
    expect(ensureDemoPage(CAPTAMARIN_SCENE_DEMO)).toBe('loaded');
    expect(usePropertyStore.getState().property.id).toBe('generic-demo-captamarin');
    expect(ensureDemoPage(CAPTAMARIN_SCENE_DEMO)).toBe('current');
  });

  it('keeps legacy supplier filtering and attribution while naming the TintEX preset Demo', () => {
    activateDemoFromUrl('?demo=tintex');
    expect(activeDemo()?.paintBrandIds).toEqual(['tintex']);
    expect(activeDemo()?.merchant).toBe('TintEX');
    expect(TINTEX_DEMO.buildProperty().name).toBe('Demo');
    expect(TINTEX_DEMO.pageName).toBe('Demo');
  });

  it('creates independent scene objects and preserves a similarly named user draft', () => {
    const original = HOME_DEMO.buildProperty();
    original.id = 'my-original-draft'; original.name = HOME_DEMO.pageName;
    original.rooms[0].name = 'My edited room';
    usePropertyStore.getState().loadProperty(original);
    ensureDemoPage(HOME_DEMO);
    const pages = Object.values(useDesignsStore.getState().designs).filter(page => page.id !== DRAFT_ID);
    expect(pages.some(page => page.property.id === original.id && page.property.rooms[0].name === 'My edited room')).toBe(true);
    expect(usePropertyStore.getState().property.id).toBe(HOME_DEMO.propertyId);
    expect(HOME_DEMO.buildProperty().rooms[0].name).not.toBe('My edited room');
    expect(ensureDemoPage(HOME_DEMO)).toBe('current');
  });

  it('retains edited demo pages when switching scenes and reopening a renamed page', () => {
    ensureDemoPage(HOME_DEMO);
    const homeId = useDesignsStore.getState().currentId!;
    usePropertyStore.getState().renameProperty('My demo edits');
    flushCurrentPage();
    useDesignsStore.getState().rename(homeId, 'My demo edits');
    ensureDemoPage(PAINT_DEMO);
    expect(usePropertyStore.getState().property.id).toBe(PAINT_DEMO.propertyId);
    expect(ensureDemoPage(HOME_DEMO)).toBe('switched');
    expect(usePropertyStore.getState().property.name).toBe('My demo edits');
    expect(useDesignsStore.getState().currentId).toBe(homeId);
  });

  it('keeps a new unsaved user plan as a named page when reopening an existing demo', () => {
    ensureDemoPage(HOME_DEMO);
    const homeId = useDesignsStore.getState().currentId;
    const draft = PAINT_DEMO.buildProperty();
    draft.id = 'my-new-draft'; draft.name = 'My new plan';
    useDesignsStore.getState().setCurrent(null);
    usePropertyStore.getState().loadProperty(draft);
    expect(ensureDemoPage(HOME_DEMO)).toBe('switched');
    expect(useDesignsStore.getState().currentId).toBe(homeId);
    expect(Object.values(useDesignsStore.getState().designs).some(page => page.id !== DRAFT_ID && page.property.id === draft.id && page.name === draft.name)).toBe(true);
  });

  it('renames the legacy TintEX default page without replacing its edited geometry', () => {
    const edited = TINTEX_DEMO.buildProperty();
    edited.name = 'TintEX · Painted show flat'; edited.rooms[0].name = 'Keep my painted room';
    const id = useDesignsStore.getState().savePropertyAs(edited.name, edited);
    useDesignsStore.getState().setCurrent(null);
    ensureDemoPage(TINTEX_DEMO);
    expect(useDesignsStore.getState().currentId).toBe(id);
    expect(usePropertyStore.getState().property.name).toBe('Demo');
    expect(usePropertyStore.getState().property.rooms[0].name).toBe('Keep my painted room');
    expect(Object.values(useDesignsStore.getState().designs).filter(page => page.property.id === edited.id)).toHaveLength(1);
  });
});
