import type { Product } from '../data/products.schema';
import bakedJson from '../data/catalogModelThumbnails.json';
import planJson from '../data/catalogPlanDrawings.json';
import { usableProductImage, isVectorProductImage, planSymbolDataUrl } from '../data/productImageSafety';
import { catalogImageSources } from '../data/catalogImageSources';
import { productPlanSymbolUrl } from '../data/products';

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

/** Default room relevance only; an explicit user sort still takes precedence. */
export function catalogRoomRelevance(product: Product, room: string): number {
  if (room !== 'bath') return 0;
  if (/\b(washbasin|basin|toilet|bidet|shower|bathtub|bath|sink|tap|faucet|urinal)\b/i.test(product.name)) return 0;
  if (catalogFunction(product) === 'bath') return 1;
  return 2;
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
interface PlanDrawing { url: string; sku: string; dimensions: Product['dimensions_cm'] }
const plans = planJson as Record<string, PlanDrawing>;
const plansBySku = new Map(Object.values(plans).map(entry => [entry.sku, entry]));
export interface CatalogThumbnailImage { url: string; kind: 'photo' | 'model' | 'plan' | 'illustration'; label: string }
const vectorImage = isVectorProductImage;
export function catalogThumbnailImages(product: Product): CatalogThumbnailImage[] {
  const entry = baked[product.id] ?? bakedBySku.get(product.sku);
  const compatible = !product.mesh_url || product.mesh_url === entry?.modelUrl;
  const candidates: CatalogThumbnailImage[] = [];
  const add = (url: string | undefined, kind: CatalogThumbnailImage['kind'], label: string) => {
    const safe = usableProductImage(url);
    if (safe && !candidates.some(image => image.url === safe)) candidates.push({ url: safe, kind, label });
  };
  // Explicit merchant photography is authoritative. Old schematic SVGs are not photos.
  if (product.photo_image_url && !vectorImage(product.photo_image_url)) add(product.photo_image_url, 'photo', '');
  if (product.image_url && !vectorImage(product.image_url) && product.image_url !== product.topdown_image_url) add(product.image_url, 'photo', '');
  add(product.topdown_image_url, 'plan', 'Drawing');
  const plan = plans[product.id] ?? plansBySku.get(product.sku);
  if (plan && !product.mesh_url && ['length', 'width', 'height'].every(key => plan.dimensions[key as keyof Product['dimensions_cm']] === product.dimensions_cm[key as keyof Product['dimensions_cm']])) add(plan.url, 'plan', 'Drawing');
  if (product.thumbnail_svg) add(planSymbolDataUrl(product.thumbnail_svg), 'plan', 'Drawing');
  if (compatible) add(entry?.url, 'model', 'Drawing');
  add(product.photo_image_url, 'illustration', 'Drawing');
  add(product.image_url, 'illustration', 'Drawing');
  return candidates;
}
export function catalogThumbnailUrls(product: Product): string[] {
  return catalogThumbnailImages(product).map(image => image.url);
}

/** The drag ghost uses the same small picture as its originating catalogue card. */
export function catalogDragImageUrl(product: Product): string {
  return catalogImageSources(catalogDetailImageUrl(product)).src;
}

/** Explicit details use the same picture as the card, at its original resolution. */
export function catalogDetailImageUrl(product: Product): string {
  return catalogThumbnailImages(product)[0]?.url ?? productPlanSymbolUrl(product);
}

/** Only declared variants that resolve to an actual catalogue SKU are offered. */
export function catalogVariants(product: Product, products: readonly Product[]) {
  return (product.variants ?? []).flatMap(variant => {
    const target = products.find(candidate => candidate.sku === variant.sku);
    return target ? [{ ...variant, product: target }] : [];
  });
}
