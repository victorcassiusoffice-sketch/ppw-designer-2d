/** Planning previews of existing products, not exact manufacturer models. */
export const FURNITURE_PREVIEW_NOTE = 'Dimensional preview — see product details for exact appearance.';

export type FurniturePreviewKind = 'sofa' | 'corner' | 'bed' | 'coffee' | 'dining' | 'desk' | 'chair' | 'cabinet' | 'wardrobe' | 'shelf' | 'fridge' | 'tv' | 'air-conditioner' | 'table-lamp' | 'pendant';
const previews: Record<string, FurniturePreviewKind> = {
  'courts-marco-sofa-corner': 'sofa',
  'courts-tamarin-corner': 'corner',
  'courts-mika-bed-160': 'bed',
  'courts-perera-coffee-table': 'coffee',
  'courts-gessica-dining-6': 'dining',
  'courts-touran-desk': 'desk',
  'courts-stellar-celosia-chair': 'chair',
  'courts-aurum-tv-cabinet': 'cabinet',
  'courts-campus-sideboard': 'cabinet',
  'courts-lavis-sideboard': 'cabinet',
  'courts-arte-bedside': 'cabinet',
  'courts-beluga-wardrobe-4': 'wardrobe',
  'courts-malden-bookshelf': 'shelf',
  'courts-nexus-shelving-white': 'shelf',
  'courts-samsung-rb33-fridge': 'fridge',
  'courts-hisense-65a6h-tv': 'tv',
  'courts-hisense-40a4n-tv': 'tv',
  'courts-samsung-ar18-ac': 'air-conditioner',
  'courts-samsung-ar09-ac': 'air-conditioner',
  'courts-hisense-as12-ac': 'air-conditioner',
  'courts-marble-table-lamp': 'table-lamp',
  'courts-ceramic-table-lamp': 'table-lamp',
  'courts-table-lamp-wood-d25': 'table-lamp',
  'courts-bamboo-desk-lamp': 'table-lamp',
  'courts-pendant-lamp-7254': 'pendant',
  'courts-pendant-black-canopy': 'pendant',
};

export function furniturePreviewKind(productId: string | undefined): FurniturePreviewKind | null {
  return productId && Object.prototype.hasOwnProperty.call(previews, productId) ? previews[productId] : null;
}

/** Lightweight: safe to import in the 2D UI without pulling in Three. */
export function hasFurniturePreview(productId: string | undefined): boolean {
  return furniturePreviewKind(productId) !== null;
}
