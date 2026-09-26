import type { Product } from './products.schema';

export const SOLAR_PANEL_PREVIEW_NOTE = 'Dimensional solar preview — see the product photo for exact appearance.';

/**
 * THE solar panel the Energy panel adds (Jinko 475 W, Emcar) — one id for
 * the 2D and the 3D placement paths and for the button that names it.
 */
export const SOLAR_PANEL_PRODUCT_ID = 'emcar-jinko-475';

/** The bundled photo-generated Jinko mesh washes out its cells in daylight. */
export function hasSolarPanelPreview(product: Pick<Product, 'id' | 'sku'> | undefined): boolean {
  return product?.id === SOLAR_PANEL_PRODUCT_ID || product?.sku === 'EMCAR-SOLAR-JINKO-475';
}
