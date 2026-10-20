import { polygonArea, type Polygon } from '../lib/geometry';
import { findOutdoorPavingProduct } from '../data/outdoorPaving';
import { gardenSurfacePolygon, normaliseGardenSurface, type GardenSurface } from './garden';

/** Exact for the saved polygon and uniform layer depths. No assumed density or mix yield. */
export function outdoorSurfaceTakeoff(surface: GardenSurface) {
  const clean = normaliseGardenSurface(surface);
  if (!clean || clean.kind === 'pool') return null;
  const polygon = gardenSurfacePolygon(clean);
  const areaM2 = polygonArea(polygon);
  const perimeterM = polygon.reduce((total, p, i) => total + Math.hypot(p.x - polygon[(i + 1) % polygon.length].x, p.y - polygon[(i + 1) % polygon.length].y), 0);
  const thicknessM = clean.thicknessM ?? (clean.kind === 'path' ? findOutdoorPavingProduct(clean.pavingProductId)?.thicknessM : undefined);
  return { areaM2, perimeterM, thicknessM: thicknessM ?? null,
    materialVolumeM3: thicknessM === undefined ? null : areaM2 * thicknessM,
    subBaseVolumeM3: clean.subBaseDepthM === undefined ? null : areaM2 * clean.subBaseDepthM };
}

/** Inner rectangular dimensions. Base and wall shell volumes have no overlapping corners. */
export function poolTakeoff(surface: GardenSurface) {
  const clean = normaliseGardenSurface(surface);
  if (!clean || clean.kind !== 'pool' || !clean.pool) return null;
  const p = clean.pool, width = clean.widthM, length = clean.depthM;
  const areaM2 = width * length, perimeterM = 2 * (width + length);
  const outerWidth = width + 2 * p.wallThicknessM, outerLength = length + 2 * p.wallThicknessM;
  const excavationWidthM = outerWidth + 2 * p.excavationMarginM;
  const excavationLengthM = outerLength + 2 * p.excavationMarginM;
  const excavationDepthM = p.shellDepthM + p.baseThicknessM;
  return {
    areaM2, perimeterM, waterVolumeM3: areaM2 * p.waterDepthM, waterLitres: areaM2 * p.waterDepthM * 1000,
    excavationWidthM, excavationLengthM, excavationDepthM,
    excavationVolumeM3: excavationWidthM * excavationLengthM * excavationDepthM,
    shellVolumeM3: outerWidth * outerLength * p.baseThicknessM + (outerWidth * outerLength - areaM2) * p.shellDepthM,
    liningAreaM2: areaM2 + perimeterM * p.shellDepthM,
    freeboardM: p.shellDepthM - p.waterDepthM,
  };
}

/** Terrain cutout includes working clearance only in excavation view; finished pools keep their outer shell. */
export function gardenGroundCutout(surface: GardenSurface): Polygon {
  if (surface.kind !== 'pool' || !surface.pool) return gardenSurfacePolygon(surface);
  const margin = surface.pool.wallThicknessM + (surface.pool.stage === 'excavation' ? surface.pool.excavationMarginM : 0);
  return [{ x: surface.x - margin, y: surface.y - margin }, { x: surface.x + surface.widthM + margin, y: surface.y - margin },
    { x: surface.x + surface.widthM + margin, y: surface.y + surface.depthM + margin }, { x: surface.x - margin, y: surface.y + surface.depthM + margin }];
}
