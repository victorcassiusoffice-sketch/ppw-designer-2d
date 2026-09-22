import { isClosingPolygon, type Polygon, type Vertex } from './geometry';

const samePoint = (a: Vertex | undefined, b: Vertex) =>
  !!a && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

/** Preview an anchored wall without adding the same junction twice. */
export function anchorWallStroke(vertices: Polygon, start: Vertex): Polygon {
  return samePoint(vertices[vertices.length - 1], start) ? [...vertices] : [...vertices, start];
}

/** A finger drag adds one wall; returning to the first corner closes the room. */
export function completeWallStroke(
  vertices: Polygon,
  start: Vertex,
  end: Vertex,
  closeThresholdM: number,
): { vertices: Polygon; closed: boolean } {
  const anchored = anchorWallStroke(vertices, start);
  if (anchored.length >= 3 && isClosingPolygon(anchored, end, closeThresholdM)) {
    return { vertices: anchored, closed: true };
  }
  return {
    vertices: samePoint(anchored[anchored.length - 1], end) ? anchored : [...anchored, end],
    closed: false,
  };
}
