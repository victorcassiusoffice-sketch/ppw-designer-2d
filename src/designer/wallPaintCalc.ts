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
  DEFAULT_PAINT_WASTE_PCT,
  MAX_PAINT_COATS,
  MAX_PAINT_WASTE_PCT,
  MIN_DEDUCTIBLE_OPENING_M2,
  MIN_PAINT_COATS,
  OPENING_DOOR_HEIGHT_M,
  OPENING_WINDOW_HEIGHT_M,
  TINTED_PAINT_WASTE_PCT,
  WALL_PAINTS,
  findWallPaintById,
  normalisePaintColourHex,
  normalisePaintColourName,
  resolveWallColourHex,
  tinsForPaintColour,
  type WallPaint,
  type WallPaintTin,
} from '../data/wallPaints';

export interface WallPaintedEdge {
  edgeIndex: number;
  paintId: string;
  /** Chosen tint (2026-09-14), `#RRGGBB`. Absent = the product's base colour. */
  colourHex?: string;
  colourName?: string;
}

interface PaintableRoomShape {
  polygon: Polygon;
  openings?: Opening[];
  wallPaint?: WallPaintedEdge[];
}

interface PaintableFreeWall {
  id?: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  paintId?: string;
  paintColourHex?: string;
  paintColourName?: string;
  /** 2 = both faces painted; absent/1 = one face. */
  paintFaces?: number;
}

/** Property-level estimate settings the calculator honours. */
export interface PaintEstimateSettings {
  /** Coats override for every product (1–3); absent = the product's own figure. */
  wallPaintCoats?: number;
  /** Touch-up contingency in percent; absent = 10 % (15 % for a tint). */
  wallPaintWastePct?: number;
}

/** The coats a paint is quoted at: the override if set, else its datasheet figure. */
export function coatsFor(paint: Pick<WallPaint, 'recommended_coats'>, settings?: PaintEstimateSettings): number {
  const o = settings?.wallPaintCoats;
  if (typeof o === 'number' && Number.isFinite(o)) return Math.min(MAX_PAINT_COATS, Math.max(MIN_PAINT_COATS, Math.round(o)));
  return paint.recommended_coats;
}

/** The contingency percent for a job: the setting if set, else 10 % (15 % tinted). */
export function wastePctFor(tinted: boolean, settings?: PaintEstimateSettings): number {
  const o = settings?.wallPaintWastePct;
  if (typeof o === 'number' && Number.isFinite(o)) return Math.min(MAX_PAINT_WASTE_PCT, Math.max(0, Math.round(o)));
  return tinted ? TINTED_PAINT_WASTE_PCT : DEFAULT_PAINT_WASTE_PCT;
}

/**
 * One tin serves ONE colour. Two walls in the same product but different
 * tints are two separate tin fills, so every aggregate keys on both.
 */
export function wallPaintOrderKey(paintId: string, colourHex?: string): string {
  return `${paintId}|${normalisePaintColourHex(colourHex) ?? ''}`;
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
 * The area an opening takes OFF the face: its face area when that is at
 * least MIN_DEDUCTIBLE_OPENING_M2 (NRM2 net-measurement rule), else 0 —
 * a small window's reveals and cutting-in use the paint it "saves".
 */
export function openingDeductionM2(opening: Opening, wallHeightM: number): number {
  const a = openingFaceAreaM2(opening, wallHeightM);
  return a >= MIN_DEDUCTIBLE_OPENING_M2 - 1e-9 ? a : 0;
}

/**
 * Paintable area of ONE room edge: inner face minus its deductible openings.
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
    .reduce((acc, o) => acc + openingDeductionM2(o, wallHeightM), 0);
  return Math.max(0, gross - cut);
}

export interface TinFill {
  tins: Array<WallPaintTin & { count: number }>;
  totalMur: number;
  boughtLitres: number;
}

/**
 * Cheapest whole-tin combination that covers `litres` — an EXACT answer.
 *
 * A bounded dynamic programme over volume in 0.1 L steps (unbounded
 * min-cost cover): O(sizes × litres/0.1) whatever the number of pack sizes,
 * where the old count enumeration blew up past three sizes (audit R4-07:
 * 2000 m² with five sizes took 1.6 s inside a render memo). Ties break on
 * FEWER tins (handling), then MORE litres — the same money should never buy
 * the customer less paint (audit R4-13). Non-finite or zero litres buy
 * nothing.
 */
export function tinsForLitres(litres: number, tins: WallPaintTin[]): TinFill {
  const sorted = [...tins]
    .filter((t) => Number.isFinite(t.sizeL) && t.sizeL > 0 && Number.isFinite(t.priceMur) && t.priceMur >= 0)
    .sort((a, b) => a.sizeL - b.sizeL);
  if (!Number.isFinite(litres) || litres <= 0 || sorted.length === 0) return { tins: [], totalMur: 0, boughtLitres: 0 };

  // Work in whole deci-litres so the table is integer-indexed.
  const STEP = 10;
  const need = Math.max(1, Math.ceil(litres * STEP - 1e-6));
  const sizes = sorted.map((t) => Math.max(1, Math.round(t.sizeL * STEP)));
  const biggest = sizes[sizes.length - 1];
  // Covering `need` never needs more than need + biggest − 1 deci-litres.
  const limit = need + biggest;
  interface Cell {
    cost: number;
    count: number;
    from: number;
    tin: number;
  }
  const NONE: Cell = { cost: Infinity, count: Infinity, from: -1, tin: -1 };
  const table: Cell[] = new Array(limit + 1).fill(NONE);
  table[0] = { cost: 0, count: 0, from: -1, tin: -1 };
  const better = (a: { cost: number; count: number }, b: Cell): boolean =>
    a.cost < b.cost - 1e-9 || (Math.abs(a.cost - b.cost) <= 1e-9 && a.count < b.count);
  for (let v = 0; v < limit; v++) {
    const cur = table[v];
    if (cur.cost === Infinity) continue;
    for (let i = 0; i < sizes.length; i++) {
      const nv = Math.min(limit, v + sizes[i]);
      const cand = { cost: cur.cost + sorted[i].priceMur, count: cur.count + 1 };
      if (better(cand, table[nv])) table[nv] = { ...cand, from: v, tin: i };
    }
  }
  // Best reachable volume at or above the need; ties → more litres.
  let bestV = -1;
  for (let v = need; v <= limit; v++) {
    const c = table[v];
    if (c.cost === Infinity) continue;
    if (bestV < 0) {
      bestV = v;
      continue;
    }
    const b = table[bestV];
    if (c.cost < b.cost - 1e-9 || (Math.abs(c.cost - b.cost) <= 1e-9 && (c.count < b.count || (c.count === b.count && v > bestV)))) bestV = v;
  }
  if (bestV < 0) return { tins: [], totalMur: 0, boughtLitres: 0 };
  const counts = new Array(sorted.length).fill(0);
  for (let v = bestV; v > 0; ) {
    const c = table[v];
    counts[c.tin] += 1;
    v = c.from;
  }
  const rows: TinFill['tins'] = [];
  let mur = 0;
  let bought = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (counts[i] <= 0) continue;
    rows.push({ ...sorted[i], count: counts[i] });
    mur += counts[i] * sorted[i].priceMur;
    bought += counts[i] * sorted[i].sizeL;
  }
  return { tins: rows, totalMur: Math.round(mur * 100) / 100, boughtLitres: Math.round(bought * 10) / 10 };
}

export interface WallPaintOrder {
  /** `paintId|colourHex` — the tin-fill identity (one tin, one colour). */
  key: string;
  /** Litres the area needs before the contingency. */
  netLitres: number;
  /** Contingency applied, percent. */
  wastePct: number;
  paintId: string;
  paint: WallPaint;
  /** Chosen tint, `#RRGGBB`, when the walls were tinted; absent = base. */
  colourHex?: string;
  colourName?: string;
  /** The colour to draw these walls in (tint, else the product swatch). */
  renderHex: string;
  areaM2: number;
  coats: number;
  litres: number;
  fill: TinFill;
  /** Litres bought beyond the need — whole tins always leave some over. */
  surplusLitres: number;
  /** The tint base the tins were priced on (brands that price by base). */
  baseName?: string;
  /** True when that base was inferred from the colour's depth, not named by the brand. */
  baseEstimated?: boolean;
  perRoom: Array<{ roomId: string; roomName: string; areaM2: number }>;
}

/**
 * Litres for an area: area × coats ÷ coverage, rounded UP to 0.1 L so the
 * panel, the cart and the checkout all show the same figure.
 */
export function litresForArea(areaM2: number, coats: number, coverageM2PerL: number): number {
  if (areaM2 <= 0 || coats <= 0 || coverageM2PerL <= 0) return 0;
  return Math.ceil(((areaM2 * coats) / coverageM2PerL) * 10 - 1e-9) / 10;
}

/**
 * Aggregate every painted wall on the property into orders, one per
 * paint + tint. `litres` is rounded UP to 0.1 L before the tin fill so
 * display and purchase agree.
 */
export function deriveWallPaintOrders(
  property: {
    rooms: Array<PaintableRoomShape & { id: string; name: string }>;
    walls?: PaintableFreeWall[];
    wallHeightM?: number;
  } & PaintEstimateSettings,
  wallHeightM?: number,
): WallPaintOrder[] {
  const h = wallHeightM ?? property.wallHeightM ?? 0;
  if (h <= 0) return [];
  interface Agg {
    paintId: string;
    colourHex?: string;
    colourName?: string;
    areaM2: number;
    perRoom: Map<string, { roomId: string; roomName: string; areaM2: number }>;
  }
  const areaByKey = new Map<string, Agg>();

  const add = (
    paintId: string,
    colourHex: string | undefined,
    colourName: string | undefined,
    areaM2: number,
    roomId: string,
    roomName: string,
  ) => {
    if (areaM2 <= 0) return;
    const hex = normalisePaintColourHex(colourHex);
    const key = wallPaintOrderKey(paintId, hex);
    const cur =
      areaByKey.get(key) ??
      { paintId, colourHex: hex, colourName: hex ? normalisePaintColourName(colourName) : undefined, areaM2: 0, perRoom: new Map() };
    cur.areaM2 += areaM2;
    if (!cur.colourName && hex) cur.colourName = normalisePaintColourName(colourName);
    const pr = cur.perRoom.get(roomId) ?? { roomId, roomName, areaM2: 0 };
    pr.areaM2 += areaM2;
    cur.perRoom.set(roomId, pr);
    areaByKey.set(key, cur);
  };

  for (const room of property.rooms) {
    for (const e of room.wallPaint ?? []) {
      add(e.paintId, e.colourHex, e.colourName, paintableEdgeAreaM2(room, e.edgeIndex, h), room.id, room.name);
    }
  }
  for (const w of property.walls ?? []) {
    if (!w.paintId) continue;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const faces = w.paintFaces === 2 ? 2 : 1;
    add(w.paintId, w.paintColourHex, w.paintColourName, len * h * faces, 'walls', 'Free walls');
  }

  const out: WallPaintOrder[] = [];
  for (const [key, agg] of areaByKey.entries()) {
    const paint = findWallPaintById(agg.paintId);
    if (!paint) continue;
    const coats = coatsFor(paint, property);
    const netLitres = litresForArea(agg.areaM2, coats, paint.coverage_m2_per_l);
    const wastePct = wastePctFor(!!agg.colourHex, property);
    const litres = Math.ceil(netLitres * (1 + wastePct / 100) * 10 - 1e-9) / 10;
    // A tinted tin is priced on its BASE where the brand prices that way.
    const choice = tinsForPaintColour(paint, agg.colourHex);
    const fill = tinsForLitres(litres, choice.tins);
    out.push({
      key,
      paintId: agg.paintId,
      paint,
      ...(agg.colourHex ? { colourHex: agg.colourHex } : {}),
      ...(agg.colourName ? { colourName: agg.colourName } : {}),
      renderHex: resolveWallColourHex(agg.paintId, agg.colourHex),
      areaM2: agg.areaM2,
      coats,
      netLitres,
      wastePct,
      litres,
      fill,
      surplusLitres: Math.max(0, Math.round((fill.boughtLitres - litres) * 10) / 10),
      ...(choice.base ? { baseName: choice.base.name, baseEstimated: choice.baseEstimated } : {}),
      perRoom: [...agg.perRoom.values()],
    });
  }
  out.sort((a, b) => b.fill.totalMur - a.fill.totalMur || a.key.localeCompare(b.key));
  return out;
}

/** One painted face, worked out — the row a paint company can check by hand. */
export interface WallPaintBreakdownRow {
  key: string;
  roomId: string;
  roomName: string;
  /** "Wall 1" … for room edges; "Free wall n" for free walls. */
  wallLabel: string;
  kind: 'edge' | 'free';
  edgeIndex?: number;
  wallId?: string;
  paintId: string;
  paintName: string;
  colourHex?: string;
  colourName?: string;
  renderHex: string;
  lengthM: number;
  heightM: number;
  grossM2: number;
  /** Door / doorway / window area taken off, m² (openings under 1 m² are not deducted). */
  openingsM2: number;
  openingCount: number;
  /** Faces counted: 1 for a room wall, 1 or 2 for a free-standing wall. */
  faces: number;
  areaM2: number;
}

/**
 * Every painted face as a checkable row: length × height − openings = m².
 * The orders above are the SUM of these rows per paint + tint; the panel
 * shows both so the arithmetic is visible, not asserted.
 */
export function wallPaintBreakdown(
  property: {
    rooms: Array<PaintableRoomShape & { id: string; name: string }>;
    walls?: PaintableFreeWall[];
    wallHeightM?: number;
  } & PaintEstimateSettings,
  wallHeightM?: number,
): WallPaintBreakdownRow[] {
  const h = wallHeightM ?? property.wallHeightM ?? 0;
  if (h <= 0) return [];
  const rows: WallPaintBreakdownRow[] = [];
  for (const room of property.rooms) {
    const painted = [...(room.wallPaint ?? [])].sort((a, b) => a.edgeIndex - b.edgeIndex);
    for (const e of painted) {
      const paint = findWallPaintById(e.paintId);
      if (!paint) continue;
      const lengthM = edgeLengthM(room.polygon, e.edgeIndex);
      if (lengthM <= 0) continue;
      const openings = (room.openings ?? []).filter((o) => o.edgeIndex === e.edgeIndex);
      const openingsM2 = openings.reduce((acc, o) => acc + openingDeductionM2(o, h), 0);
      const gross = lengthM * h;
      const hex = normalisePaintColourHex(e.colourHex);
      const name = hex ? normalisePaintColourName(e.colourName) : undefined;
      rows.push({
        key: wallPaintOrderKey(e.paintId, hex),
        roomId: room.id,
        roomName: room.name,
        wallLabel: `Wall ${e.edgeIndex + 1}`,
        kind: 'edge',
        edgeIndex: e.edgeIndex,
        paintId: e.paintId,
        paintName: paint.name,
        ...(hex ? { colourHex: hex } : {}),
        ...(name ? { colourName: name } : {}),
        renderHex: resolveWallColourHex(e.paintId, hex),
        lengthM,
        heightM: h,
        grossM2: gross,
        openingsM2: Math.min(gross, openingsM2),
        openingCount: openings.length,
        faces: 1,
        areaM2: Math.max(0, gross - openingsM2),
      });
    }
  }
  let n = 0;
  for (const w of property.walls ?? []) {
    if (!w.paintId) continue;
    const paint = findWallPaintById(w.paintId);
    if (!paint) continue;
    const lengthM = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    if (lengthM <= 0) continue;
    n += 1;
    const hex = normalisePaintColourHex(w.paintColourHex);
    const name = hex ? normalisePaintColourName(w.paintColourName) : undefined;
    rows.push({
      key: wallPaintOrderKey(w.paintId, hex),
      roomId: 'walls',
      roomName: 'Free walls',
      wallLabel: `Free wall ${n}`,
      kind: 'free',
      ...(w.id ? { wallId: w.id } : {}),
      paintId: w.paintId,
      paintName: paint.name,
      ...(hex ? { colourHex: hex } : {}),
      ...(name ? { colourName: name } : {}),
      renderHex: resolveWallColourHex(w.paintId, hex),
      lengthM,
      heightM: h,
      grossM2: lengthM * h * (w.paintFaces === 2 ? 2 : 1),
      openingsM2: 0,
      openingCount: 0,
      faces: w.paintFaces === 2 ? 2 : 1,
      areaM2: lengthM * h * (w.paintFaces === 2 ? 2 : 1),
    });
  }
  return rows;
}

/** The default paint for a fresh brush. */
export function defaultWallPaintId(): string {
  return WALL_PAINTS[0].id;
}
