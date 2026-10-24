import type { Product } from '../data/products.schema';
import bakedJson from '../data/catalogModelThumbnails.json';
import { productImageUrl } from '../data/products';

export type CatalogBrowseMode = 'category' | 'function' | 'room';
export interface CatalogBrowse { mode: CatalogBrowseMode; value: string }
export const CATALOG_FUNCTIONS = ['all', 'seating', 'tables', 'storage', 'fitness', 'kitchen', 'bath', 'lighting', 'decor', 'surfaces', 'energy'] as const;
export const CATALOG_ROOMS = ['all', 'living', 'bedroom', 'dining', 'office', 'kitchen', 'bath', 'gym', 'outdoors'] as const;
export const CATALOG_GROUP_LABELS: Record<string, string> = {
  all: 'All', seating: 'Seating', tables: 'Tables', storage: 'Storage', fitness: 'Fitness', kitchen: 'Kitchen', bath: 'Bathroom', lighting: 'Lighting', decor: 'Decor', surfaces: 'Surfaces', energy: 'Energy',
  living: 'Living room', bedroom: 'Bedroom', dining: 'Dining room', office: 'Office', gym: 'Gym', outdoors: 'Outdoors',
};

/** Browsing labels only: these never alter product dimensions, category or estimates. */
export function catalogFunction(product: Product): string {
  const name = product.name.toLowerCase();
  if (product.category === 'fitness') return 'fitness';
  if (product.category === 'solar') return 'energy';
  if (product.category === 'flooring' || product.category === 'walls') return 'surfaces';
  if (product.category === 'lighting') return 'lighting';
  if (/basin|toilet|bidet|shower|bath|sink|tap|water tank|pipe/.test(name)) return 'bath';
  if (/fridge|refrigerator|cooker|oven|hob|kitchen|microwave/.test(name)) return 'kitchen';
  if (/sofa|chair|armchair|recliner|stool|bench|ottoman/.test(name)) return 'seating';
  if (/table|desk|counter/.test(name)) return 'tables';
  if (/cabinet|wardrobe|sideboard|shelf|shelves|drawer|bookcase|storage/.test(name)) return 'storage';
  return 'decor';
}

export function catalogRooms(product: Product): string[] {
  const name = product.name.toLowerCase(), fn = catalogFunction(product);
  if (product.outdoor || product.category === 'solar') return ['outdoors'];
  if (fn === 'fitness') return ['gym'];
  if (fn === 'bath') return ['bath'];
  if (fn === 'kitchen') return ['kitchen'];
  if (/bed|mattress|wardrobe|nightstand/.test(name)) return ['bedroom'];
  if (/dining/.test(name)) return ['dining'];
  if (/desk|office|ergo/.test(name)) return ['office'];
  if (fn === 'lighting' || fn === 'surfaces' || product.category === 'plant') return ['living', 'bedroom', 'dining', 'office', 'kitchen', 'bath'];
  return ['living'];
}

export function matchesCatalogBrowse(product: Product, browse: CatalogBrowse): boolean {
  return browse.mode === 'category' || browse.value === 'all' || (browse.mode === 'function' ? catalogFunction(product) === browse.value : catalogRooms(product).includes(browse.value));
}

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function availabilityInfo(product: Pick<Product, 'availability' | 'lead_time_days' | 'stock_qty' | 'last_checked'>) {
  const date = product.last_checked && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(product.last_checked) && Number.isFinite(Date.parse(product.last_checked)) ? product.last_checked.slice(0, 10) : undefined;
  // A contradictory zero quantity must not create an "In stock" promise.
  const state = product.availability === 'in-stock' && product.stock_qty === 0 ? 'unknown' : product.availability;
  const days = whole(product.lead_time_days) ? product.lead_time_days : undefined;
  const label = state === 'in-stock' ? 'In stock' : state === 'on-order' ? `On order${days === undefined ? '' : ` (${days} days)`}` : state === 'made-to-order' ? `Made to order${days === undefined ? '' : ` (${days} days)`}` : 'Ask supplier';
  return { label, date, quantity: whole(product.stock_qty) ? product.stock_qty : undefined,
    note: date ? `Supplier last reported: ${date}. Confirm before ordering.` : 'Stock is what the supplier last told us. No checked date supplied; confirm availability.' };
}

interface BakedThumbnail { url: string; sku: string; hash: string; modelUrl: string }
const baked = bakedJson as Record<string, BakedThumbnail>;
const bakedBySku = new Map(Object.values(baked).map(entry => [entry.sku, entry]));
export function catalogThumbnailUrls(product: Product): string[] {
  const entry = baked[product.id] ?? bakedBySku.get(product.sku);
  const compatible = !product.mesh_url || product.mesh_url === entry?.modelUrl;
  return [...new Set([compatible ? entry?.url : undefined, productImageUrl(product)].filter((url): url is string => Boolean(url)))];
}

/** Only declared variants that resolve to an actual catalogue SKU are offered. */
export function catalogVariants(product: Product, products: readonly Product[]) {
  return (product.variants ?? []).flatMap(variant => {
    const target = products.find(candidate => candidate.sku === variant.sku);
    return target ? [{ ...variant, product: target }] : [];
  });
}
