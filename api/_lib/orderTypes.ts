/**
 * Shared types for serverless functions.
 *
 * These mirror the client's `src/store/ordersStore.ts` order shape, but
 * are duplicated here so the Vercel functions don't need to reach into
 * the React tree. Keep them in lockstep — when ordersStore changes,
 * update this too.
 */

export type Currency = 'MUR' | 'USD' | 'EUR' | 'GBP';

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
  notes?: string;
}

export interface CartLineItemPayload {
  productId: string;
  name: string;
  quantity: number;
  /** Smallest unit of currency for ALL currencies — cents for
   *  USD/EUR/GBP AND cents-of-MUR for MUR (Phase 0 money-path 2026-08-04
   *  standardisation; matches Neon `products.price_minor`). */
  unitAmount: number;
  currency: Currency;
  /** Public image URL (optional — Stripe will gracefully skip if missing). */
  imageUrl?: string;
  /** Catalog SKU — filled server-side by re-pricing so PayPal items /
   *  order_items carry the real SKU. Optional on the wire. */
  sku?: string;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  itemCount: number;
}

export interface PropertySnapshot {
  id: string;
  name: string;
  rooms: RoomSnapshot[];
}

/** Shape posted by the client to /api/create-checkout-session. */
export interface CreateCheckoutSessionRequest {
  cart: CartLineItemPayload[];
  customer: CustomerInfo;
  currency: Currency;
  successUrl: string;
  cancelUrl: string;
  orderId: string;
  property?: PropertySnapshot;
  notes?: string;
}

/** Lean order shape carried to the email template. */
export interface OrderSummary {
  id: string;
  total: number;
  currency: Currency;
  customer: CustomerInfo;
  lines: Array<{
    name: string;
    quantity: number;
    unitAmount: number;
    currency: Currency;
  }>;
  property?: PropertySnapshot;
}
