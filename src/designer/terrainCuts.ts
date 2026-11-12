import type { Polygon, Vertex } from '../lib/geometry';
/** Axis-aligned one metre excavation cells. Heights are surveyed metres above the project datum. */
export interface TerrainCut {
  id: string;
  x: number;
  y: number;
  topM: number;
  depthM: number;
}
export const CUT_LIMIT = 512;
export const cutId = (x: number, y: number) => x + ',' + y;
export const cutPolygon = (c: Pick<TerrainCut, 'x' | 'y'>): Polygon => [
  { x: c.x, y: c.y },
  { x: c.x + 1, y: c.y },
  { x: c.x + 1, y: c.y + 1 },
  { x: c.x, y: c.y + 1 },
];
export function validCuts(raw: unknown): raw is TerrainCut[] {
  if (!Array.isArray(raw) || raw.length > CUT_LIMIT) return false;
  const ids = new Set<string>();
  return raw.every((c) => {
    if (
      !c ||
      !Number.isSafeInteger(c.x) ||
      !Number.isSafeInteger(c.y) ||
      Math.abs(c.x) > 100000 ||
      Math.abs(c.y) > 100000 ||
      c.id !== cutId(c.x, c.y) ||
      ids.has(c.id) ||
      !Number.isFinite(c.topM) ||
      Math.abs(c.topM) > 10000 ||
      !Number.isFinite(c.depthM) ||
      c.depthM <= 0 ||
      c.depthM > 20
    )
      return false;
    ids.add(c.id);
    return true;
  });
}
export function editSoil(
  cuts: TerrainCut[],
  point: Vertex,
  topM: number,
  deltaM: number,
): TerrainCut[] {
  if (!Number.isFinite(deltaM) || Math.abs(deltaM) > 5 || deltaM === 0)
    throw Error('Choose a depth of up to five metres per edit.');
  const x = Math.floor(point.x),
    y = Math.floor(point.y),
    id = cutId(x, y),
    old = cuts.find((c) => c.id === id);
  if (!old && deltaM < 0) return cuts;
  const depthM = Math.round(Math.max(0, (old?.depthM ?? 0) + deltaM) * 1000) / 1000;
  const cell = { id, x, y, topM: old?.topM ?? topM, depthM };
  if (depthM > 20) throw Error('The maximum excavation depth is 20 m.');
  const rest = cuts.filter((c) => c.id !== id);
  const result = depthM ? [...rest, cell] : rest;
  if (!validCuts(result)) throw Error('Excavation limit reached.');
  return result;
}
export function exposedSoil(cuts: TerrainCut[]): { floor: number[]; walls: number[] } {
  const lookup = new Map(cuts.map((c) => [c.id, c])),
    floor: number[] = [],
    walls: number[] = [];
  function quad(out: number[], a: number[], b: number[], c: number[], d: number[]) {
    out.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  for (const cut of cuts) {
    const { x, y, topM, depthM } = cut,
      bottom = topM - depthM,
      poly = cutPolygon(cut);
    const floorPoints = poly.map((p) => [p.x, bottom, p.y]);
    quad(floor, floorPoints[0], floorPoints[3], floorPoints[2], floorPoints[1]);
    const neighbours = [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % 4],
        n = lookup.get(cutId(neighbours[i][0], neighbours[i][1]));
      const top = n ? Math.min(topM, n.topM - n.depthM) : topM;
      if (top > bottom + 0.00001)
        quad(walls, [a.x, bottom, a.y], [b.x, bottom, b.y], [b.x, top, b.y], [a.x, top, a.y]);
    });
  }
  return { floor, walls };
}
