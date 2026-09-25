/** One roof profile for rendering, picking and catalog-item mounting. Plan metres, z up. */
import type { Polygon, Vertex } from '../lib/geometry';
import { normaliseRoofConfig, type RoofConfig } from './building';

export const ROOF_COVERING_THICKNESS_M = 0.08;
export const ROOF_MOUNT_CLEARANCE_M = 0.06;
export interface RoofSurface {
  polygon: Polygon;
  elevationM: number;
  config: RoofConfig;
  axis: 'x' | 'y';
  low: number;
  high: number;
  ridge: number;
  slope: number;
}
export interface RoofItemMount {
  elevationM: number;
  slopeX: number;
  slopeY: number;
  /** A rigid panel cannot bend over two faces. Render a raised, level preview. */
  bridgesRidge: boolean;
}

export function roofOutline(polygon: Polygon, overhangM: number): Polygon {
  if (overhangM === 0) return polygon.map((point) => ({ ...point }));
  const area = polygon.reduce((sum, point, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  const sign = area >= 0 ? 1 : -1;
  return polygon.map((point, i) => {
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const next = polygon[(i + 1) % polygon.length];
    const normal = (a: Vertex, b: Vertex) => {
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: sign * (b.y - a.y) / length, y: -sign * (b.x - a.x) / length };
    };
    const a = normal(previous, point), b = normal(point, next);
    const divisor = 1 + a.x * b.x + a.y * b.y;
    if (Math.abs(divisor) < 1e-5) return { x: point.x + b.x * overhangM, y: point.y + b.y * overhangM };
    const dx = (a.x + b.x) * overhangM / divisor, dy = (a.y + b.y) * overhangM / divisor;
    const cap = Math.min(1, 4 * overhangM / (Math.hypot(dx, dy) || 1));
    return { x: point.x + dx * cap, y: point.y + dy * cap };
  });
}

export function createRoofSurface(polygon: Polygon, elevationM: number, config: RoofConfig): RoofSurface | null {
  const clean = normaliseRoofConfig(config);
  if (!clean || !Number.isFinite(elevationM) || polygon.length < 3
    || polygon.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  const points = roofOutline(polygon, clean.overhangM);
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  const axis = maxX - minX <= maxY - minY ? 'x' : 'y';
  const low = axis === 'x' ? minX : minY, high = axis === 'x' ? maxX : maxY;
  return { polygon: points, elevationM, config: clean, axis, low, high, ridge: (low + high) / 2,
    slope: clean.style === 'flat' ? 0 : Math.tan(clean.pitchDeg * Math.PI / 180) };
}

export function roofHeightAt(surface: RoofSurface, point: Vertex): number {
  const rise = surface.config.style === 'flat' ? 0 : surface.config.style === 'shed'
    ? (point[surface.axis] - surface.low) * surface.slope
    : Math.max(0, (surface.high - surface.low) / 2 - Math.abs(point[surface.axis] - surface.ridge)) * surface.slope;
  return surface.elevationM + ROOF_COVERING_THICKNESS_M + rise;
}

export function roofMaximumHeight(surface: RoofSurface): number {
  return surface.elevationM + ROOF_COVERING_THICKNESS_M
    + (surface.high - surface.low) * surface.slope * (surface.config.style === 'gable' ? 0.5 : 1);
}

/** The saved AABB remains a conservative plan footprint when a true-size body tilts. */
export function roofItemMount(surface: RoofSurface, item: { x0: number; y0: number; x1: number; y1: number }): RoofItemMount {
  const centre = { x: (item.x0 + item.x1) / 2, y: (item.y0 + item.y1) / 2 };
  const low = surface.axis === 'x' ? item.x0 : item.y0, high = surface.axis === 'x' ? item.x1 : item.y1;
  const bridgesRidge = surface.config.style === 'gable' && low < surface.ridge - 1e-6 && high > surface.ridge + 1e-6;
  const slope = bridgesRidge ? 0 : surface.config.style === 'gable'
    ? surface.slope * (centre[surface.axis] < surface.ridge ? 1 : -1) : surface.slope;
  return {
    elevationM: (bridgesRidge ? roofMaximumHeight(surface) : roofHeightAt(surface, centre)) + ROOF_MOUNT_CLEARANCE_M,
    slopeX: surface.axis === 'x' ? slope : 0,
    slopeY: surface.axis === 'y' ? slope : 0,
    bridgesRidge,
  };
}
