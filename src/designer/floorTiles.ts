/**
 * floorTiles — the per-tile floor painting model (brief 2026-08-28).
 *
 * The Sims paints floors a tile at a time: click one, drag a rectangle, or
 * fill a room. This is that model, adapted for a tool that produces a real
 * purchase quote rather than a game.
 *
 * THE DECISION THAT SHAPES EVERYTHING HERE: a painted tile is a tile the
 * customer BUYS. So the paint rule is **intersection**, not centre-inside.
 * A floor layer covers the whole room and cuts the boundary tiles to fit; a
 * centre-inside rule would leave a bare margin of up to half a tile against
 * every wall and quote the customer short of what the room needs. Tiles the
 * room boundary crosses are counted as CUT tiles, which is what carries the
 * offcut allowance in `floorTileOrder`.
 */

import { pointInPolygon, polygonBounds } from '../lib/geometry';
import type { Polygon, Vertex } from '../lib/geometry';

/**
 * A painted region of ONE material inside ONE room.
 *
 * `runs` is a flat array of [row, colStart, length] triples — horizontal runs
 * of tiles in this zone's lattice. Flat rather than objects because this is
 * persisted to localStorage and posted to the orders API on every save: a
 * 400-tile room is ~30 runs and a few hundred bytes, where an array of
 * `{row, col}` objects would be tens of kilobytes of JSON.
 */
export interface FloorZone {
  materialId: string;
  /** Tile size in metres for this zone's lattice. */
  tileWm: number;
  tileHm: number;
  /**
   * World-metre origin of the lattice. Stored, not re-derived, so that
   * editing the room polygon later cannot silently re-flow every tile.
   */
  originM: Vertex;
  /** Flat [row, colStart, length, ...] triples. */
  runs: number[];
}

export interface TileIndex {
  row: number;
  col: number;
}

const EPS = 1e-9;

/**
 * Shrink a rect to its strict INTERIOR.
 *
 * Load-bearing. A room wall runs exactly along a tile boundary all the
 * time - a 1 m tile in a 5 x 4 m room has its edge on the wall at x = 5.
 * Testing polygon edges against the raw rect makes "touching" read as
 * "crossing", which both counts a tile that sits entirely OUTSIDE the wall
 * and disqualifies an edge tile that is entirely INSIDE it. Both are wrong,
 * and both change the number on the quote.
 */
function insetOf(r: { x: number; y: number; w: number; h: number }): number {
  // MUST clear geometry.pointInPolygon's own boundary tolerance, which is
  // 1e-6 m and treats anything within it as ON the edge, i.e. inside. An
  // inset smaller than that makes a tile sitting entirely OUTSIDE a wall
  // report as overlapping it, which silently adds a column of tiles nobody
  // can walk on to the customer's order. 1/1000th of a tile is 0.9 mm for a
  // gym tile: far above the tolerance, far below anything a floor layer
  // would call an overlap.
  return Math.min(r.w, r.h) * 1e-3;
}

function interiorOf(r: { x: number; y: number; w: number; h: number }) {
  const d = insetOf(r);
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}

/** World rect covered by one tile of a zone. */
export function tileRect(
  zone: Pick<FloorZone, 'tileWm' | 'tileHm' | 'originM'>,
  row: number,
  col: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: zone.originM.x + col * zone.tileWm,
    y: zone.originM.y + row * zone.tileHm,
    w: zone.tileWm,
    h: zone.tileHm,
  };
}

/** The tile index containing a world point. */
export function tileAt(
  zone: Pick<FloorZone, 'tileWm' | 'tileHm' | 'originM'>,
  p: Vertex,
): TileIndex {
  return {
    col: Math.floor((p.x - zone.originM.x) / zone.tileWm + EPS),
    row: Math.floor((p.y - zone.originM.y) / zone.tileHm + EPS),
  };
}

/** Does a segment intersect an axis-aligned rect? Cohen–Sutherland style. */
function segmentIntersectsRect(
  a: Vertex,
  b: Vertex,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  const minX = r.x;
  const maxX = r.x + r.w;
  const minY = r.y;
  const maxY = r.y + r.h;

  // Trivially outside on one side.
  if ((a.x < minX && b.x < minX) || (a.x > maxX && b.x > maxX)) return false;
  if ((a.y < minY && b.y < minY) || (a.y > maxY && b.y > maxY)) return false;
  // Either endpoint inside.
  if (a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY) return true;
  if (b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY) return true;

  // Otherwise test the segment against each rect edge.
  const cross = (p: Vertex, q: Vertex, u: Vertex, v: Vertex): boolean => {
    const d = (q.x - p.x) * (v.y - u.y) - (q.y - p.y) * (v.x - u.x);
    if (Math.abs(d) < EPS) return false;
    const t = ((u.x - p.x) * (v.y - u.y) - (u.y - p.y) * (v.x - u.x)) / d;
    const s = ((u.x - p.x) * (q.y - p.y) - (u.y - p.y) * (q.x - p.x)) / d;
    return t >= 0 && t <= 1 && s >= 0 && s <= 1;
  };
  const corners: Vertex[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  for (let i = 0; i < 4; i++) {
    if (cross(a, b, corners[i], corners[(i + 1) % 4])) return true;
  }
  return false;
}

/**
 * Does this tile overlap the room at all?
 *
 * True when any tile corner is inside the polygon, OR the tile centre is
 * (covers a tile larger than the room), OR any polygon edge crosses the tile
 * (covers a boundary tile whose corners all sit outside).
 */
export function tileIntersectsPolygon(
  rect: { x: number; y: number; w: number; h: number },
  polygon: Polygon,
): boolean {
  if (polygon.length < 3) return false;
  const d = insetOf(rect);
  const pts: Vertex[] = [
    { x: rect.x + d, y: rect.y + d },
    { x: rect.x + rect.w - d, y: rect.y + d },
    { x: rect.x + rect.w - d, y: rect.y + rect.h - d },
    { x: rect.x + d, y: rect.y + rect.h - d },
    { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
  ];
  for (const p of pts) if (pointInPolygon(p, polygon)) return true;
  // Only an edge through the tile's INTERIOR counts. A wall lying along the
  // tile's own boundary means the tile sits beside the room, not in it.
  const inner = interiorOf(rect);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (segmentIntersectsRect(a, b, inner)) return true;
  }
  return false;
}

/** Is this tile ENTIRELY inside the room? (whole tile vs cut tile) */
export function tileFullyInsidePolygon(
  rect: { x: number; y: number; w: number; h: number },
  polygon: Polygon,
): boolean {
  if (polygon.length < 3) return false;
  const d = insetOf(rect);
  const corners: Vertex[] = [
    { x: rect.x + d, y: rect.y + d },
    { x: rect.x + rect.w - d, y: rect.y + d },
    { x: rect.x + rect.w - d, y: rect.y + rect.h - d },
    { x: rect.x + d, y: rect.y + rect.h - d },
  ];
  for (const c of corners) if (!pointInPolygon(c, polygon)) return false;
  // A concave room can have all four corners inside while an edge still cuts
  // across the tile, so reject any edge through the INTERIOR. A wall running
  // flush along the tile's boundary is not a cut - that tile is whole.
  const inner = interiorOf(rect);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (segmentIntersectsRect(a, b, inner)) return false;
  }
  return true;
}

/** Build a zone descriptor for a material, anchored to the room's bbox corner. */
export function zoneForMaterial(
  materialId: string,
  tileWm: number,
  tileHm: number,
  polygon: Polygon,
): FloorZone {
  const b = polygonBounds(polygon);
  return {
    materialId,
    tileWm,
    tileHm,
    // Anchored to the room, not world zero: a room drawn at an arbitrary
    // snapped coordinate would otherwise start with a ragged part-tile against
    // its own wall for no reason the user can see.
    originM: { x: b.minX, y: b.minY },
    runs: [],
  };
}

// ---------------------------------------------------------------------------
// Run-length codec. Internally we work with a Set of "row,col" keys; runs are
// the persisted form.
// ---------------------------------------------------------------------------

export function runsToSet(runs: number[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + 2 < runs.length; i += 3) {
    const row = runs[i];
    const start = runs[i + 1];
    const len = runs[i + 2];
    for (let c = 0; c < len; c++) out.add(`${row},${start + c}`);
  }
  return out;
}

export function setToRuns(set: ReadonlySet<string>): number[] {
  const byRow = new Map<number, number[]>();
  for (const k of set) {
    const [r, c] = k.split(',').map(Number);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    const arr = byRow.get(r);
    if (arr) arr.push(c);
    else byRow.set(r, [c]);
  }
  const runs: number[] = [];
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const cols = byRow.get(row)!.sort((a, b) => a - b);
    let start = cols[0];
    let len = 1;
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] === start + len) {
        len++;
      } else {
        runs.push(row, start, len);
        start = cols[i];
        len = 1;
      }
    }
    runs.push(row, start, len);
  }
  return runs;
}

export function countTiles(runs: number[]): number {
  let n = 0;
  for (let i = 2; i < runs.length; i += 3) n += runs[i];
  return n;
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

/** Every tile index of a zone lattice that intersects the polygon. */
export function tilesCoveringPolygon(zone: FloorZone, polygon: Polygon): TileIndex[] {
  if (polygon.length < 3) return [];
  const b = polygonBounds(polygon);
  const first = tileAt(zone, { x: b.minX, y: b.minY });
  const last = tileAt(zone, { x: b.maxX, y: b.maxY });
  const out: TileIndex[] = [];
  for (let row = first.row; row <= last.row; row++) {
    for (let col = first.col; col <= last.col; col++) {
      if (tileIntersectsPolygon(tileRect(zone, row, col), polygon)) out.push({ row, col });
    }
  }
  return out;
}

/**
 * Tile indices covered by a drag rectangle between two world points, clipped
 * to the room. Handles a drag in any of the four directions.
 */
export function tilesInDragRect(
  zone: FloorZone,
  a: Vertex,
  b: Vertex,
  polygon: Polygon,
): TileIndex[] {
  const ta = tileAt(zone, a);
  const tb = tileAt(zone, b);
  const rowFrom = Math.min(ta.row, tb.row);
  const rowTo = Math.max(ta.row, tb.row);
  const colFrom = Math.min(ta.col, tb.col);
  const colTo = Math.max(ta.col, tb.col);
  const out: TileIndex[] = [];
  for (let row = rowFrom; row <= rowTo; row++) {
    for (let col = colFrom; col <= colTo; col++) {
      if (tileIntersectsPolygon(tileRect(zone, row, col), polygon)) out.push({ row, col });
    }
  }
  return out;
}

/** How many tiles a pending drag would touch, WITHOUT building the list. */
export function dragRectTileCount(zone: FloorZone, a: Vertex, b: Vertex): number {
  const ta = tileAt(zone, a);
  const tb = tileAt(zone, b);
  return (Math.abs(ta.row - tb.row) + 1) * (Math.abs(ta.col - tb.col) + 1);
}

/**
 * Drop every tile whose rect no longer intersects the room.
 *
 * Floor tiles are polygon-coupled state, exactly like door openings: reshape
 * the room and the tiles outside it are no longer real. Without this they
 * persist invisibly and are still counted in the quote.
 */
export function pruneZone(zone: FloorZone, polygon: Polygon): FloorZone {
  const kept = new Set<string>();
  for (const k of runsToSet(zone.runs)) {
    const [row, col] = k.split(',').map(Number);
    if (tileIntersectsPolygon(tileRect(zone, row, col), polygon)) kept.add(k);
  }
  return { ...zone, runs: setToRuns(kept) };
}

// ---------------------------------------------------------------------------
// Pricing — the half that makes this a product rather than a toy
// ---------------------------------------------------------------------------

/** Extra tiles allowed for breakage when cutting to fit, as a fraction. */
export const CUT_WASTE_FRACTION = 0.1;

export interface FloorTileOrder {
  /** Tiles that sit entirely inside the room. */
  wholeTiles: number;
  /** Tiles the room boundary crosses — these get cut on site. */
  cutTiles: number;
  /** What to actually order, including the offcut allowance. */
  unitsToOrder: number;
  /** Area the painted tiles cover, clipped to the room. Context, not the price. */
  coveredM2: number;
}

/**
 * Turn a painted zone into a purchase quantity.
 *
 * Vic 2026-08-28: the quote is built on TILES TO ORDER — whole purchasable
 * units, what K1 ships in boxes — with covered m2 shown alongside as context.
 * A customer billed for 23.4 m2 who receives 29 tiles cannot reconcile the
 * invoice; billing for 29 tiles and showing 23.4 m2 covered is honest in both
 * directions.
 */
export function floorTileOrder(zone: FloorZone, polygon: Polygon): FloorTileOrder {
  let wholeTiles = 0;
  let cutTiles = 0;
  for (const k of runsToSet(zone.runs)) {
    const [row, col] = k.split(',').map(Number);
    const rect = tileRect(zone, row, col);
    if (tileFullyInsidePolygon(rect, polygon)) wholeTiles++;
    else if (tileIntersectsPolygon(rect, polygon)) cutTiles++;
  }
  const tileArea = zone.tileWm * zone.tileHm;
  return {
    wholeTiles,
    cutTiles,
    // The allowance is on the CUT tiles only. Ten percent of the whole floor
    // would overcharge a room whose tiles happen to fit exactly.
    unitsToOrder: wholeTiles + cutTiles + Math.ceil(cutTiles * CUT_WASTE_FRACTION),
    coveredM2: Number((wholeTiles * tileArea + cutTiles * tileArea * 0.5).toFixed(2)),
  };
}
