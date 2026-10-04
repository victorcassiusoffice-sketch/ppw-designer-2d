import type { DemoDefinition } from './demoCatalog';
import { buildHomeInterior } from './homeInterior';
import { TINTEX_DEMO } from './tintex';
import { CAPTAMARIN_DEMO, CAPTAMARIN_PAGE_NAME } from './captamarin';

/** Existing sourced catalogs and editable geometry, never substitute products/prices. */
export const HOME_DEMO: DemoDefinition = {
  slug: 'demo-home', merchant: 'Demo', pageName: 'Demo · Home', propertyId: 'generic-demo-home', products: [], includeDemoSlugs: ['courts'], currency: 'MUR',
  buildProperty: buildHomeInterior,
};
export const PAINT_DEMO: DemoDefinition = {
  slug: 'demo-paint', merchant: 'Demo', pageName: 'Demo · Paint', propertyId: 'generic-demo-paint', products: [], includeDemoSlugs: ['courts'], currency: 'MUR',
  buildProperty: () => ({ ...TINTEX_DEMO.buildProperty(), id: 'generic-demo-paint', name: 'Demo' }),
};
/**
 * `/demo?scene=captamarin` — the Cap Tamarin two-bedroom scene on the read-only
 * demo route (developer pitch, `?client=cap-tamarin`). Same plan and Courts
 * range as `/designer?demo=captamarin`; its own page id so the designer-only
 * route never adopts, renames or overwrites a supplier-pitch page.
 */
export const CAPTAMARIN_SCENE_DEMO: DemoDefinition = {
  slug: 'demo-captamarin', merchant: 'Demo', pageName: 'Demo · Cap Tamarin', propertyId: 'generic-demo-captamarin', products: [], includeDemoSlugs: ['courts'], currency: 'MUR',
  buildProperty: () => ({ ...CAPTAMARIN_DEMO.buildProperty(), id: 'generic-demo-captamarin', name: CAPTAMARIN_PAGE_NAME }),
};
