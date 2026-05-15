/**
 * OMS Phase 5 — order status aggregator.
 *
 * Pure logic: given the latest event for each order_item, derive the
 * order's overall status as the worst-case across items.
 *
 * Worst-case ordering (lowest=worst):
 *   failed < returned < confirmed < shipped < in_transit < delivered
 *
 * If any item is `failed`, the order is `failed`. If all items are
 * `delivered`, the order is `delivered`. Otherwise the lowest non-failed
 * status wins.
 */

export type OrderEventType =
  | 'confirmed'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'failed';

export type OrderStatus = OrderEventType | 'pending';

const RANK: Record<OrderEventType, number> = {
  failed: 0,
  returned: 1,
  confirmed: 2,
  shipped: 3,
  in_transit: 4,
  delivered: 5,
};

/**
 * Aggregate per-item statuses into a single order status.
 *
 * - empty → 'pending' (no events yet)
 * - any 'failed' → 'failed'
 * - else lowest-rank wins
 */
export function aggregateOrderStatus(itemStatuses: OrderEventType[]): OrderStatus {
  if (itemStatuses.length === 0) return 'pending';
  if (itemStatuses.includes('failed')) return 'failed';
  let worst: OrderEventType = itemStatuses[0]!;
  let worstRank = RANK[worst];
  for (const s of itemStatuses.slice(1)) {
    if (RANK[s] < worstRank) {
      worst = s;
      worstRank = RANK[s];
    }
  }
  return worst;
}

/**
 * Returns true if a transition from `from` → `to` is valid.
 * Allows forward progression and explicit failure/return at any point.
 */
export function isValidTransition(from: OrderEventType | null, to: OrderEventType): boolean {
  if (to === 'failed' || to === 'returned') return true;
  if (from === null) return to === 'confirmed';
  if (from === 'confirmed') return to === 'shipped' || to === 'in_transit' || to === 'delivered';
  if (from === 'shipped') return to === 'in_transit' || to === 'delivered';
  if (from === 'in_transit') return to === 'delivered';
  return false;
}
