import { sheenOfFinish } from '../data/wallPaints';
import type { Vertex } from '../lib/geometry';

/** A broad soft satin highlight becomes a narrow, brighter gloss reflection. */
export function wallFinishHighlight(finish: string | null | undefined): Array<number | string> {
  const sheen = sheenOfFinish(finish);
  const spread = 0.36 - sheen * 0.26;
  const alpha = sheen * 0.56;
  return [
    0, 'rgba(255,255,255,0)',
    0.48 - spread, 'rgba(255,255,255,0)',
    0.48, `rgba(255,255,255,${alpha.toFixed(3)})`,
    0.48 + spread, 'rgba(255,255,255,0)',
    1, 'rgba(255,255,255,0)',
  ];
}

/** Polygon winding can change after editing/importing a room. */
export function interiorSide(polygon: Vertex[]): 1 | -1 {
  let area = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    area += a.x * b.y - b.x * a.y;
  });
  return area >= 0 ? 1 : -1;
}

/** A thin paint strip on the inside face, leaving the structural wall visible. */
export function wallPaintBand(a: Vertex, b: Vertex, width: number, offset = 0): number[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1e-6) return [];
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  return [
    a.x + nx * (offset - width / 2), a.y + ny * (offset - width / 2),
    b.x + nx * (offset - width / 2), b.y + ny * (offset - width / 2),
    b.x + nx * (offset + width / 2), b.y + ny * (offset + width / 2),
    a.x + nx * (offset + width / 2), a.y + ny * (offset + width / 2),
  ];
}
