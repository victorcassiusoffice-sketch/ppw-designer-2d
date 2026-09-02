/**
 * cartStore - Week 3.
 *
 * Derives the cart shape from the active Property and exposes:
 *   - per-line totals in the line item's native currency AND in USD
 *   - subtotals in MUR, USD, EUR, GBP (using the live FX snapshot)
 *   - a per-room breakdown so the cart page can group items by room
 *
 * Quantity edits live on a separate "qtyOverride" map kept inside this
 * store. When you bump the quantity from 2 -> 3 we don't conjure a third
 * placed instance on the canvas - we just remember that the cart wants
 * 3 of that product. Removing a line wipes ALL placed instances of that
 * product across all rooms (and zeros the override).
 *
 * Week 4 will tie shipping + tax to the buyer's region. Until then both
 * are surfaced as disclaimers on the cart page.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { usePropertyStore } from './propertyStore';
import type { Property } from './propertyStore';
import { useCurrencyStore } from './currencyStore';
import { getProductById } from '../data/products';
import type { Product, Currency } from '../data/products.schema';
import { type FxSnapshot, FALLBACK_RATES_USD, convert } from '../lib/fx';
// Painted floors (floor-painting brief 2026-08-28) become real cart lines:
// tiles are sold as whole units, so the customer is billed per tile/roll/
// pack/mat and told how many surplus units the offcuts force them to buy.
import { roomFloorOrders } from '../designer/floorTiles';
import { deriveWallPaintOrders } from '../designer/wallPaintCalc';
import { DEFAULT_WALL_HEIGHT_M } from '../data/wallPaints';
import { findFloorMaterialById } from '../data/floorMaterials';

/** Static fallback retained for tests that don't want to load the FX module. */
export const MUR_PER_USD = FALLBACK_RATES_USD.MUR;

export interface CartLine {
  productId: string;
  product: Product;
  /** Number of units the cart will order. Defaults to the placed count. */
  quantity: number;
  /** Number actually placed on the canvas - informational. */
  placedCount: number;
  unitPrice: number;
  unitCurrency: Currency;
  /** Unit price converted into the active display currency. */
  unitPriceDisplay: number;
  /** Line total (quantity * unit) in the active display currency. */
  lineTotalDisplay: number;
  /** Per-room breakdown: roomId -> instance count. */
  perRoom: Array<{ roomId: string; roomName: string; count: number }>;
}

/**
 * A painted-floor line. Floors are NOT products: they are sold by the
 * whole unit (tile / roll / pack / mat), so a floor line carries the unit
 * count to ORDER (whole tiles + cut tiles + offcut allowance) and, crucially,
 * the `surplusUnits` the customer is buying purely to cover the cut edges —
 * the "how much extra you'll need" the brief asks us to surface.
 */
export interface FloorCartLine {
  /** Stable synthetic id, aggregated across rooms: `floor:${materialId}`. */
  lineId: string;
  materialId: string;
  materialName: string;
  /** Sold-by unit label: 'tile' | 'roll' | 'pack' | 'mat'. */
  unit: string;
  /** Units the customer must BUY (whole + cut + offcut allowance). Billed. */
  unitsToOrder: number;
  /** Tiles wholly inside the room. */
  wholeTiles: number;
  /** Boundary tiles that must be cut to fit. */
  cutTiles: number;
  /** Extra units bought purely as offcut/breakage allowance (10% of cuts). */
  surplusUnits: number;
  /** Approximate m² actually covered — context, never the price basis. */
  coveredM2: number;
  unitPriceMur: number;
  unitCurrency: Currency;
  /** Unit price in the active display currency. */
  unitPriceDisplay: number;
  /** Line total (unitsToOrder * unit) in the active display currency. */
  lineTotalDisplay: number;
  /** Per-room breakdown: roomId -> units to order in that room. */
  perRoom: Array<{ roomId: string; roomName: string; unitsToOrder: number }>;
}

/**
 * A wall-paint line (2026-09-02). Paint is sold by the TIN: the line carries
 * the tins to buy (cheapest whole-tin fill of the litres the painted area
 * needs), with the area/litres alongside as context — never the price basis.
 */
export interface WallPaintLine {
  lineId: string;
  paintId: string;
  paintName: string;
  finish: string;
  areaM2: number;
  coats: number;
  litres: number;
  /** Tin rows, largest first: size, unit price, count. */
  tins: Array<{ sizeL: number; priceMur: number; count: number }>;
  boughtLitres: number;
  totalMur: number;
  totalDisplay: number;
  perRoom: Array<{ roomId: string; roomName: string; areaM2: number }>;
}

export interface CartTotals {
  lines: CartLine[];
  /** Painted-floor lines, kept separate from product lines (different unit). */
  floorLines: FloorCartLine[];
  /** Wall-paint lines (sold by the tin), separate again. */
  wallPaintLines: WallPaintLine[];
  uniqueProductCount: number;
  totalItemCount: number;
  /** Combined product + floor subtotal in the active display currency. */
  subtotal: number;
  /** Floor-only subtotal in the active display currency. */
  floorSubtotal: number;
  /** Wall-paint-only subtotal in the active display currency. */
  wallPaintSubtotal: number;
  /** Same (combined) subtotal expressed in each supported currency. */
  subtotalByCurrency: Record<Currency, number>;
  /** Active display currency at the time of derivation. */
  currency: Currency;
}

interface CartMutationsState {
  /** productId -> user-chosen quantity (overrides placedCount when set). */
  qtyOverrides: Record<string, number>;
  /** Products the user explicitly removed from the cart on the CartPage. */
  removedProductIds: string[];

  setQuantity: (productId: string, qty: number) => void;
  removeProduct: (productId: string) => void;
  /** Wipe ALL overrides + removals - fresh cart. */
  resetCart: () => void;
}

export const useCartMutations = create<CartMutationsState>()(
  persist(
    (set) => ({
      qtyOverrides: {},
      removedProductIds: [],

      setQuantity: (productId, qty) =>
        set((s) => {
          const safe = Math.max(0, Math.floor(qty));
          if (safe === 0) {
            const next = { ...s.qtyOverrides };
            delete next[productId];
            return {
              qtyOverrides: next,
              removedProductIds: s.removedProductIds.includes(productId)
                ? s.removedProductIds
                : [...s.removedProductIds, productId],
            };
          }
          return {
            qtyOverrides: { ...s.qtyOverrides, [productId]: safe },
            removedProductIds: s.removedProductIds.filter((id) => id !== productId),
          };
        }),

      removeProduct: (productId) =>
        set((s) => {
          const next = { ...s.qtyOverrides };
          delete next[productId];
          return {
            qtyOverrides: next,
            removedProductIds: s.removedProductIds.includes(productId)
              ? s.removedProductIds
              : [...s.removedProductIds, productId],
          };
        }),

      resetCart: () => set(() => ({ qtyOverrides: {}, removedProductIds: [] })),
    }),
    {
      name: 'ppw_cart_mutations_v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * Pure derivation of painted-floor cart lines. Aggregates every room's
 * `roomFloorOrders` by material (a material painted across two rooms is one
 * line with a per-room breakdown), resolves price + unit from the floor
 * catalog, and computes the surplus (offcut) units the customer must buy.
 * Returns [] when nothing is painted, so it is purely additive to the cart.
 */
export function deriveFloorLines(
  property: Property,
  fx: FxSnapshot,
  displayCurrency: Currency,
): FloorCartLine[] {
  interface Agg {
    wholeTiles: number;
    cutTiles: number;
    unitsToOrder: number;
    coveredM2: number;
    perRoom: Array<{ roomId: string; roomName: string; unitsToOrder: number }>;
  }
  const byMaterial = new Map<string, Agg>();

  for (const room of property.rooms) {
    for (const { materialId, order } of roomFloorOrders(room)) {
      const cur =
        byMaterial.get(materialId) ??
        { wholeTiles: 0, cutTiles: 0, unitsToOrder: 0, coveredM2: 0, perRoom: [] };
      cur.wholeTiles += order.wholeTiles;
      cur.cutTiles += order.cutTiles;
      cur.unitsToOrder += order.unitsToOrder;
      cur.coveredM2 += order.coveredM2;
      cur.perRoom.push({ roomId: room.id, roomName: room.name, unitsToOrder: order.unitsToOrder });
      byMaterial.set(materialId, cur);
    }
  }

  const out: FloorCartLine[] = [];
  for (const [materialId, a] of byMaterial.entries()) {
    const m = findFloorMaterialById(materialId);
    if (!m) continue;
    const unitPriceDisplay = convert(m.price_per_unit_mur, 'MUR', displayCurrency, fx);
    out.push({
      lineId: `floor:${materialId}`,
      materialId,
      materialName: m.name,
      unit: m.unit,
      unitsToOrder: a.unitsToOrder,
      wholeTiles: a.wholeTiles,
      cutTiles: a.cutTiles,
      // unitsToOrder = whole + cut + ceil(cut*0.1) per zone, so the remainder
      // after removing whole+cut is exactly the offcut allowance summed.
      surplusUnits: Math.max(0, a.unitsToOrder - a.wholeTiles - a.cutTiles),
      coveredM2: a.coveredM2,
      unitPriceMur: m.price_per_unit_mur,
      unitCurrency: 'MUR',
      unitPriceDisplay,
      lineTotalDisplay: unitPriceDisplay * a.unitsToOrder,
      perRoom: a.perRoom,
    });
  }
  out.sort((x, y) => y.lineTotalDisplay - x.lineTotalDisplay);
  return out;
}

/**
 * Wall paint → cart lines (2026-09-02). Pure derivation from the property:
 * painted wall area (minus door/window openings) → litres → cheapest
 * whole-tin fill per paint. See src/designer/wallPaintCalc.ts.
 */
export function deriveWallPaintLines(
  property: Property,
  fx: FxSnapshot,
  displayCurrency: Currency,
): WallPaintLine[] {
  const orders = deriveWallPaintOrders(
    property,
    property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M,
  );
  return orders.map((o) => ({
    lineId: `wallpaint:${o.paintId}`,
    paintId: o.paintId,
    paintName: o.paint.name,
    finish: o.paint.finish,
    areaM2: o.areaM2,
    coats: o.coats,
    litres: o.litres,
    tins: o.fill.tins.map((t) => ({ sizeL: t.sizeL, priceMur: t.priceMur, count: t.count })),
    boughtLitres: o.fill.boughtLitres,
    totalMur: o.fill.totalMur,
    totalDisplay: convert(o.fill.totalMur, 'MUR', displayCurrency, fx),
    perRoom: o.perRoom,
  }));
}

/**
 * Pure derivation - used by tests.
 */
export function deriveCart(
  property: Property,
  mutations: Pick<CartMutationsState, 'qtyOverrides' | 'removedProductIds'>,
  fx: FxSnapshot,
  displayCurrency: Currency,
): CartTotals {
  const placedCounts = new Map<string, number>();
  const perRoom = new Map<string, Array<{ roomId: string; roomName: string; count: number }>>();

  for (const room of property.rooms) {
    const counts = new Map<string, number>();
    for (const item of room.placedItems) {
      counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
    }
    for (const [productId, count] of counts.entries()) {
      placedCounts.set(productId, (placedCounts.get(productId) ?? 0) + count);
      const list = perRoom.get(productId) ?? [];
      list.push({ roomId: room.id, roomName: room.name, count });
      perRoom.set(productId, list);
    }
  }

  const removed = new Set(mutations.removedProductIds);
  const lines: CartLine[] = [];

  for (const [productId, placedCount] of placedCounts.entries()) {
    if (removed.has(productId)) continue;
    const product = getProductById(productId);
    if (!product) continue;
    const quantity = mutations.qtyOverrides[productId] ?? placedCount;
    if (quantity === 0) continue;

    const unitPriceDisplay = convert(
      product.price.value,
      product.price.currency,
      displayCurrency,
      fx,
    );
    lines.push({
      productId,
      product,
      quantity,
      placedCount,
      unitPrice: product.price.value,
      unitCurrency: product.price.currency,
      unitPriceDisplay,
      lineTotalDisplay: unitPriceDisplay * quantity,
      perRoom: perRoom.get(productId) ?? [],
    });
  }

  lines.sort((a, b) => b.lineTotalDisplay - a.lineTotalDisplay);

  const floorLines = deriveFloorLines(property, fx, displayCurrency);
  const floorSubtotal = floorLines.reduce((acc, l) => acc + l.lineTotalDisplay, 0);

  const wallPaintLines = deriveWallPaintLines(property, fx, displayCurrency);
  const wallPaintSubtotal = wallPaintLines.reduce((acc, l) => acc + l.totalDisplay, 0);

  const productSubtotal = lines.reduce((acc, l) => acc + l.lineTotalDisplay, 0);
  const subtotal = productSubtotal + floorSubtotal + wallPaintSubtotal;
  const totalItemCount = lines.reduce((acc, l) => acc + l.quantity, 0);

  const subtotalByCurrency: Record<Currency, number> = {
    MUR: convert(subtotal, displayCurrency, 'MUR', fx),
    USD: convert(subtotal, displayCurrency, 'USD', fx),
    EUR: convert(subtotal, displayCurrency, 'EUR', fx),
    GBP: convert(subtotal, displayCurrency, 'GBP', fx),
  };

  return {
    lines,
    floorLines,
    wallPaintLines,
    uniqueProductCount: lines.length,
    totalItemCount,
    subtotal,
    floorSubtotal,
    wallPaintSubtotal,
    subtotalByCurrency,
    currency: displayCurrency,
  };
}

export function useCart(): CartTotals {
  const property = usePropertyStore((s) => s.property);
  const fx = useCurrencyStore((s) => s.fx);
  const currency = useCurrencyStore((s) => s.currency);
  const qtyOverrides = useCartMutations((s) => s.qtyOverrides);
  const removedProductIds = useCartMutations((s) => s.removedProductIds);
  return useMemo(
    () => deriveCart(property, { qtyOverrides, removedProductIds }, fx, currency),
    [property, qtyOverrides, removedProductIds, fx, currency],
  );
}
