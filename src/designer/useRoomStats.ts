/**
 * Sims-Parity DT-15 — pure room stats.
 *
 * Sums room value (Rs), counts placed items, computes floor area (m²)
 * from room dimensions. Exposed as a pure helper so React state
 * subscribers can wrap it however they like (useMemo, useSyncExternalStore).
 *
 * Fix 2.6 (Vic 2026-05-22): ROOM VALUE was always Rs 0 because callers
 * hardcoded `priceMur: 0`. The shape now accepts the real price plus an
 * optional `flooringMur` contribution (Σ zone_area_m2 × price_per_m2)
 * so the value chip reflects items + floor zones together.
 */

export interface PlacedRoomItem {
  productId: string;
  priceMur: number;
}

export interface RoomStatsInput {
  items: PlacedRoomItem[];
  roomWidthMm: number;
  roomDepthMm: number;
  /** Optional MUR contribution from painted floor zones (Phase C). */
  flooringMur?: number;
}

export interface RoomStats {
  totalValueMur: number;
  itemCount: number;
  floorAreaM2: number;
}

export function computeRoomStats(input: RoomStatsInput): RoomStats {
  let total = 0;
  for (const it of input.items) total += it.priceMur;
  total += input.flooringMur ?? 0;
  return {
    totalValueMur: total,
    itemCount: input.items.length,
    floorAreaM2: (input.roomWidthMm * input.roomDepthMm) / 1_000_000,
  };
}
