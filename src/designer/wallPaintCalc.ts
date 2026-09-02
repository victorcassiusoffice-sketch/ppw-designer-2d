/**
 * Wall-paint measurement algorithm (Vic 2026-09-02).
 *
 * The chain, mirroring the floor tool's whole-unit commerce:
 *
 *   painted wall length × wall height        = gross face area (m²)
 *   − door/doorway area (width × 2.04 m)     — an opening is not painted
 *   − window area (width × 1.20 m)
 *   = paintable area
 *   × recommended coats ÷ coverage (m²/L)    = litres
 *   → whole purchasable TINS (cheapest fill) = what the customer buys
 *
 * One face per wall: a room edge is painted on its INNER face; a
 * free-standing wall is one face too (paint the other side by painting it
 * again — kept deliberately simple and honest for the quote).
 */

import type { Polygon } from '../lib/geometry';
import type { Opening } from './openings';
import {
  OPENING_DOOR_HEIGHT_M,
  OPENING_WINDOW_HEIGHT_M,
  WALL_PAINTS,
  findWallPaintById,
  type WallPaint,
  type WallPaintTin,
} from '../data/wallPaints';

export interface WallPaintedEdge {
  edgeIndex: number;
  paintId: string;
}

interface PaintableRoomShape {
  polygon: Polygon;
  openings?: Opening[];
  wallPaint?: WallPaintedEdge[];
}

interface PaintableFreeWall {
  a: { x: number; y: number };
  b: { x: number; y: number };
  paintId?: string;
}

/** Length of polygon edge i (vi → v(i+1) wrapped). */
export function edgeLengthM(polygon: Polygon, edgeIndex: number): number {
  const n = polygon.length;
  if (n < 2 || edgeIndex < 0 || edgeIndex >= n) return 0;
  const a = polygon[edgeIndex];
  const b = polygon[(edgeIndex + 1) % n];
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Area an opening removes from a wall face at the given wall height. */
export function openingFaceAreaM2(opening: Opening, wallHeightM: number): number {
  const h =
    opening.kind === 'window'
      ? Math.min(OPENING_WINDOW_HEIGHT_M, wallHeightM)
      : Math.min(OPENING_DOOR_HEIGHT_M, wallHeightM);
  return Math.max(0, opening.widthM * h);
}

/**
 * Paintable area of ONE room edge: inner face minus its openings.
 * Never negative — a wall of doors quotes zero, not a refund.
 */
export function paintableEdgeAreaM2(
  room: PaintableRoomShape,
  edgeIndex: number,
  wallHeightM: number,
): number {
  const gross = edgeLengthM(room.polygon, edgeIndex) * wallHeightM;
  if (gross <= 0) return 0;
  const cut = (room.openings ?? [])
    .filter((o) => o.edgeIndex === edgeIndex)
    .reduce((acc, o) => acc + openingFaceAreaM2(o, wallHeightM), 0);
  return Math.max(0, gross - cut);
}

export interface TinFill {
  tins: Array<WallPaintTin & { count: number }>;
  totalMur: number;
  boughtLitres: number;
}

/**
 * Cheapest whole-tin combination that covers `litres`.
 *
 * Tin counts are small (a room is a handful of tins), so this is an exact
 * search over the largest tin's count with a greedy tail — not a heuristic
 * that buys an 18 L drum for a 1.2 L touch-up.
 */
export function tinsForLitres(litres: number, tins: WallPaintTin[]): TinFill {
  const sorted = [...tins].sort((a, b) => a.sizeL - b.sizeL);
  if (litres <= 0 || sorted.length === 0) return { tins: [], totalMur: 0, boughtLitres: 0 };

  let best: TinFill | null = null;
  const consider = (counts: number[]) => {
    let mur = 0;
    let bought = 0;
    const rows: TinFill['tins'] = [];
    counts.forEach((c, i) => {
      if (c <= 0) return;
      mur += c * sorted[i].priceMur;
      bought += c * sorted[i].sizeL;
      rows.push({ ...sorted[i], count: c });
    });
    if (bought + 1e-9 < litres) return;
    if (!best || mur < best.totalMur - 1e-9 || (Math.abs(mur - best.totalMur) <= 1e-9 && bought < best.boughtLitres)) {
      best = { tins: rows.reverse(), totalMur: mur, boughtLitres: bought };
    }
  };

  // Enumerate counts of every tin size except the smallest (bounded by what
  // covers the whole job), then top up with the smallest size.
  const maxCounts = sorted.map((t) => Math.ceil(litres / t.sizeL));
  const counts = new Array(sorted.length).fill(0);
  const walk = (i: number, remaining: number) => {
    if (i === 0) {
      counts[0] = Math.max(0, Math.ceil((remaining - 1e-9) / sorted[0].sizeL));
      consider([...counts]);
      counts[0] = 0;
      return;
    }
    for (let c = 0; c <= maxCounts[i]; c++) {
      counts[i] = c;
      walk(i - 1, remaining - c * sorted[i].sizeL);
    }
    counts[i] = 0;
  };
  walk(sorted.length - 1, litres);
  return best ?? { tins: [], totalMur: 0, boughtLitres: 0 };
}

export interface WallPaintOrder {
  paintId: string;
  paint: WallPaint;
  areaM2: number;
  coats: number;
  litres: number;
  fill: TinFill;
  perRoom: Array<{ roomId: string; roomName: string; areaM2: number }>;
}

/**
 * Aggregate every painted wall on the property into per-paint orders.
 * `litres` is rounded UP to 0.1 L before the tin fill so display and
 * purchase agree.
 */
export function deriveWallPaintOrders(
  property: {
    rooms: Array<PaintableRoomShape & { id: string; name: string }>;
    walls?: PaintableFreeWall[];
    wallHeightM?: number;
  },
  wallHeightM?: number,
): WallPaintOrder[] {
  const h = wallHeightM ?? property.wallHeightM ?? 0;
  if (h <= 0) return [];
  const areaByPaint = new Map<string, { areaM2: number; perRoom: Map<string, { roomId: string; roomName: string; areaM2: number }> }>();

  const add = (paintId: string, areaM2: number, roomId: string, roomName: string) => {
    if (areaM2 <= 0) return;
    const cur = areaByPaint.get(paintId) ?? { areaM2: 0, perRoom: new Map() };
    cur.areaM2 += areaM2;
    const pr = cur.perRoom.get(roomId) ?? { roomId, roomName, areaM2: 0 };
    pr.areaM2 += areaM2;
    cur.perRoom.set(roomId, pr);
    areaByPaint.set(paintId, cur);
  };

  for (const room of property.rooms) {
    for (const e of room.wallPaint ?? []) {
      add(e.paintId, paintableEdgeAreaM2(room, e.edgeIndex, h), room.id, room.name);
    }
  }
  for (const w of property.walls ?? []) {
    if (!w.paintId) continue;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    add(w.paintId, len * h, 'walls', 'Free walls');
  }

  const out: WallPaintOrder[] = [];
  for (const [paintId, agg] of areaByPaint.entries()) {
    const paint = findWallPaintById(paintId);
    if (!paint) continue;
    const coats = paint.recommended_coats;
    const litres = Math.ceil((agg.areaM2 * coats) / paint.coverage_m2_per_l * 10) / 10;
    out.push({
      paintId,
      paint,
      areaM2: agg.areaM2,
      coats,
      litres,
      fill: tinsForLitres(litres, paint.tins),
      perRoom: [...agg.perRoom.values()],
    });
  }
  out.sort((a, b) => b.fill.totalMur - a.fill.totalMur);
  return out;
}

/** The default paint for a fresh brush. */
export function defaultWallPaintId(): string {
  return WALL_PAINTS[0].id;
}
