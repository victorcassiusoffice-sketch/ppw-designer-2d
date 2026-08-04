/**
 * IMPL-2 — single source of truth for the PPW referral-commission rate
 * shown to users.
 *
 * Locked business decision (merchant_commission_model, 2026-06-11):
 * PPW earns a 5% referral commission. Every user-facing surface
 * (cart drawer, marketplace cart, checkout, supplier pitch copy) must
 * quote THIS constant — the codebase previously showed 7% and 10% in
 * different places.
 *
 * The authoritative server-side rate lives in
 * `api/_lib/payouts/recordPayoutsForOrder.ts` (default 0.05) and is
 * recorded per-order at fulfilment time; this constant is the display
 * mirror of that default.
 */
export const PPW_COMMISSION_RATE = 0.05;

/** Integer percent for display copy, e.g. "5". */
export const PPW_COMMISSION_PCT_LABEL = `${Math.round(PPW_COMMISSION_RATE * 100)}%`;
