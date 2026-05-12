/**
 * orderSnapshot — Week 4a, extended Week 4b Hotfix 5.
 *
 * Why: after a successful Stripe payment Stripe redirects the browser
 * to `/order/success`. That redirect is a hard navigation — React state
 * is gone, Konva stages are torn down. To generate the plan PDF on the
 * success page we need:
 *   1. The order (lines + customer + property)            ← already in `ordersStore`
 *   2. Per-room polygon + placed-item geometry            ← captured at checkout-submit time, stashed here
 *
 * Hotfix 5: rooms now carry polygon + placedItems[] geometry instead
 * of (or as well as) a rasterised PNG. The PDF generator is fully
 * vector-based now and only needs the geometry to redraw each room.
 *
 * This module wraps localStorage with a typed shape so the success
 * page can rehydrate cleanly.
 */

import type { Currency } from '../data/products.schema';

const KEY = 'ppw_last_order_snapshot_v1';

/** Per-placed-item geometry needed to redraw a room as vectors. */
export interface SnapshotPlacedItem {
  productId: string;
  productName: string;
  category?: string;
  sku: string;
  dimensionsLabel: string;
  /** Top-left corner in room-local metres. */
  xM: number;
  yM: number;
  lengthM: number;
  widthM: number;
  rotation: number;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  /** Closed polygon in metres (no repeated last vertex). */
  polygon?: Array<{ x: number; y: number }>;
  /** Placed items with geometry, for the vector floor plan. */
  placedItems?: SnapshotPlacedItem[];
  /**
   * @deprecated Hotfix 5 - we no longer rasterise the floor plan.
   * Field kept on the type so old snapshots in localStorage parse
   * cleanly; the new generator ignores it.
   */
  floorPlanDataUrl?: string;
  products: Array<{
    sku: string;
    name: string;
    quantity: number;
    dimensions: string;
    supplier?: string;
    unitPriceDisplay: number;
    lineTotalDisplay: number;
  }>;
}

export interface LastOrderSnapshot {
  orderId: string;
  date: number;
  customerName: string;
  customerEmail: string;
  /** Optional one-line address for the cover page. */
  customerAddress?: string;
  currency: Currency;
  total: number;
  shipping?: number;
  propertyName: string;
  rooms: RoomSnapshot[];
}

export function saveLastOrderSnapshot(snap: LastOrderSnapshot): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // QuotaExceeded - try again without the deprecated raster field.
    try {
      const stripped: LastOrderSnapshot = {
        ...snap,
        rooms: snap.rooms.map((r) => ({ ...r, floorPlanDataUrl: undefined })),
      };
      localStorage.setItem(KEY, JSON.stringify(stripped));
    } catch {
      /* give up - success page will show the order without floor plans */
    }
  }
}

export function readLastOrderSnapshot(): LastOrderSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastOrderSnapshot;
  } catch {
    return null;
  }
}

export function clearLastOrderSnapshot(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
