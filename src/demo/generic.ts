import type { DemoDefinition } from './demoCatalog';
import { buildCourtsShowHome } from './courts';
import { TINTEX_DEMO } from './tintex';

/** Existing sourced catalogs and editable geometry, never substitute products/prices. */
export const HOME_DEMO: DemoDefinition = {
  slug: 'demo-home', merchant: 'Demo', pageName: 'Demo · Home', propertyId: 'generic-demo-home', products: [], includeDemoSlugs: ['courts'], currency: 'MUR',
  buildProperty: () => ({ ...buildCourtsShowHome(), id: 'generic-demo-home', name: 'Demo' }),
};
export const PAINT_DEMO: DemoDefinition = {
  slug: 'demo-paint', merchant: 'Demo', pageName: 'Demo · Paint', propertyId: 'generic-demo-paint', products: [], includeDemoSlugs: ['courts'], currency: 'MUR',
  buildProperty: () => ({ ...TINTEX_DEMO.buildProperty(), id: 'generic-demo-paint', name: 'Demo' }),
};
