/**
 * orderSnapshot — Week 4a.
 *
 * Why: after a successful Stripe payment Stripe redirects the browser
 * to `/order/success`. That redirect is a hard navigation — React state
 * is gone, Konva stages are torn down. To generate the plan PDF on the
 * success page we need:
 *   1. The order (lines + customer + property)            ← already in `ordersStore`
 *   2. Per-room floor plan dataURLs                       ← captured at checkout-submit time, stashed here
 *
 * This module wraps localStorage with a typed shape so the success
 * page can rehydrate cleanly.
 */

import type { Currency } from '../data/products.schema';

const KEY = 'ppw_last_order_snapshot_v1';

export interface RoomSnapshot {
  id: string;
  name: string;
  /** PNG data URL — captured from the Konva stage at checkout time. */
  floorPlanDataUrl?: string;
  products: Array<{
    sku: string;
    name: string;
    quantity: number;
    dimensions: string;
    unitPriceDisplay: number;
    lineTotalDisplay: number;
  }>;
}

export interface LastOrderSnapshot {
  orderId: string;
  date: number;
  customerName: string;
  customerEmail: string;
  currency: Currency;
  total: number;
  propertyName: string;
  rooms: RoomSnapshot[];
}

export function saveLastOrderSnapshot(snap: LastOrderSnapshot): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // QuotaExceeded — the floor-plan dataURLs are large. Drop them and retry.
    try {
      const stripped: LastOrderSnapshot = {
        ...snap,
        rooms: snap.rooms.map((r) => ({ ...r, floorPlanDataUrl: undefined })),
      };
      localStorage.setItem(KEY, JSON.stringify(stripped));
    } catch {
      /* give up — success page will show the order without floor plans */
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
