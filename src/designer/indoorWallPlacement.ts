/** Supplier-declared outdoor blinds are allowed outside. Untagged blinds
 * and curtains are interior products; moving across a facade cannot turn
 * an indoor product into an exterior installation. */
export function requiresInteriorWall(product: { id: string; name: string; placement?: string; outdoor?: boolean }): boolean {
  return product.placement === 'wall' && product.outdoor !== true && /\b(blind|blinds|curtain|curtains)\b/i.test(`${product.id.replace(/[-_]/g, ' ')} ${product.name}`);
}
export const INTERIOR_WALL_MESSAGE = 'This indoor blind or curtain needs the inside face of a room wall.';
