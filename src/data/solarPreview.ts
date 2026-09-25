import type { Product } from './products.schema';

export const SOLAR_PANEL_PREVIEW_NOTE = 'Dimensional solar preview — see the product photo for exact appearance.';

/** The bundled photo-generated Jinko mesh washes out its cells in daylight. */
export function hasSolarPanelPreview(product: Pick<Product, 'id' | 'sku'> | undefined): boolean {
  return product?.id === 'emcar-jinko-475' || product?.sku === 'EMCAR-SOLAR-JINKO-475';
}
