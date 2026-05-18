/**
 * Sims-Parity DT-15 — pure room stats.
 *
 * Sums room value (Rs), counts placed items, computes floor area (m²)
 * from room dimensions. Exposed as a pure helper so React state
 * subscribers can wrap it however they like (useMemo, useSyncExternalStore).
 */

export interface PlacedRoomItem {
  productId: string;
  priceMur: number;
}

export interface RoomStatsInput {
  items: PlacedRoomItem[];
  roomWidthMm: number;
  roomDepthMm: number;
}

export interface RoomStats {
  totalValueMur: number;
  itemCount: number;
  floorAreaM2: number;
}

export function computeRoomStats(input: RoomStatsInput): RoomStats {
  let total = 0;
  for (const it of input.items) total += it.priceMur;
  return {
    totalValueMur: total,
    itemCount: input.items.length,
    floorAreaM2: (input.roomWidthMm * input.roomDepthMm) / 1_000_000,
  };
}
