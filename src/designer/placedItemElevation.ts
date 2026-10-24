import type { PlacedItem } from '../store/propertyStore';
import type { Product } from '../data/products.schema';
/** Height is an instance pose, never a rescaled product or an estimated quantity. */
export function placedItemElevationCm(item: PlacedItem, product: Product, items: PlacedItem[], lookup: (id: string) => Product | undefined, roomHeightM: number): number {
  const max = Math.max(0, roomHeightM * 100 - product.dimensions_cm.height);
  if (product.placement === 'wall') return Math.min(max, Math.max(0, Number.isFinite(item.mountHeightCm) ? item.mountHeightCm! : product.mount_height_cm ?? 120));
  if (product.placement === 'surface' && item.parentInstanceId) {
    const parent = items.find(i => i.instanceId === item.parentInstanceId);
    const parentProduct = parent ? lookup(parent.productId) : undefined;
    if (parentProduct) return Math.min(max, Math.max(0, parentProduct.dimensions_cm.height));
  }
  return 0;
}
