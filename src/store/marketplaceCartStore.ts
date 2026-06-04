/**
 * OMS Wave 1 — marketplace cart store.
 *
 * Distinct from the Designer cart in `cartStore.ts` (which derives lines
 * from rooms+placedItems against the static `products.json` catalog).
 *
 * This store holds numeric productIds from the Neon `products` table,
 * so the marketplace flow can POST cart → `/api/cart-quote` and get back
 * a per-merchant split.
 *
 * After Wave 2 (Designer→/api/products wiring) the two stores may merge.
 * The intended split + future-merge plan is documented in
 * `docs/CART-ARCHITECTURE.md` (P1-2). Both stores back LIVE checkout routes;
 * a merge is a payment-touching, Vic-gated change — do not delete either.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface MarketplaceCartItem {
  productId: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  imageUrl: string | null;
}

interface MarketplaceCartState {
  items: MarketplaceCartItem[];
  addItem: (item: Omit<MarketplaceCartItem, 'quantity'> & { quantity?: number }) => void;
  setQuantity: (productId: number, qty: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
}

export const useMarketplaceCart = create<MarketplaceCartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((s) => {
          const qty = item.quantity ?? 1;
          const existing = s.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          return {
            items: [
              ...s.items,
              {
                productId: item.productId,
                sku: item.sku,
                name: item.name,
                category: item.category,
                quantity: qty,
                unitPriceMinor: item.unitPriceMinor,
                currency: item.currency,
                imageUrl: item.imageUrl,
              },
            ],
          };
        }),
      setQuantity: (productId, qty) =>
        set((s) => {
          const safe = Math.max(0, Math.floor(qty));
          if (safe === 0) {
            return { items: s.items.filter((i) => i.productId !== productId) };
          }
          return {
            items: s.items.map((i) =>
              i.productId === productId ? { ...i, quantity: safe } : i,
            ),
          };
        }),
      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'ppw_marketplace_cart_v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * Total in minor units (caller guarantees single currency upstream).
 */
export function totalMinor(items: MarketplaceCartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPriceMinor * i.quantity, 0);
}
