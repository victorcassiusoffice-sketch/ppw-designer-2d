/** Ground-level landscaping; optional sourced paving remains part of its surface. */
import { pointInPolygon, type Polygon, type Vertex } from '../lib/geometry';

export const GARDEN_SURFACES = {
  lawn: { label: 'Lawn', hex: '#70934f' },
  soil: { label: 'Planting bed', hex: '#795841' },
  gravel: { label: 'Gravel', hex: '#b5afa0' },
  path: { label: 'Paved path', hex: '#c5bca9' },
  concrete: { label: 'Concrete', hex: '#a7aaa8' },
} as const;
export type GardenSurfaceKind = keyof typeof GARDEN_SURFACES;
export const FENCE_MATERIALS = {
  timber: { label: 'Timber fence', hex: '#a37b50' },
  metal: { label: 'Metal railing', hex: '#505b59' },
  hedge: { label: 'Hedge', hex: '#476c3e' },
} as const;
export type FenceMaterial = keyof typeof FENCE_MATERIALS;

export interface GardenSurface {
  id: string;
  kind: GardenSurfaceKind;
  /** Top-left corner in plan metres. */
  x: number;
  y: number;
  widthM: number;
  depthM: number;
  /** Raised planting / terrace level above the ground, 0–2 m. */
  elevationM: number;
  /** Dated outdoor paving reference; absent means a generic, unpriced surface. */
  pavingProductId?: string;
}
export interface GardenFence {
  id: string;
  a: Vertex;
  b: Vertex;
  heightM: number;
  material: FenceMaterial;
}
export interface Garden {
  surfaces: GardenSurface[];
  fences: GardenFence[];
}
export type GardenPlacement = { kind: 'surface' | 'fence'; id: string };

const finite = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const idValid = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100;
const pointValid = (p: unknown): p is Vertex => !!p && typeof p === 'object'
  && finite((p as Vertex).x, -10000, 10000) && finite((p as Vertex).y, -10000, 10000);

export function normaliseGardenSurface(value: unknown): GardenSurface | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as GardenSurface;
  if (!idValid(v.id) || !Object.hasOwnProperty.call(GARDEN_SURFACES, v.kind)
    || !finite(v.x, -10000, 10000) || !finite(v.y, -10000, 10000)
    || !finite(v.widthM, 0.2, 500) || !finite(v.depthM, 0.2, 500)
    || !finite(v.elevationM, 0, 2)) return null;
  return {
    id: v.id, kind: v.kind, x: v.x, y: v.y, widthM: v.widthM, depthM: v.depthM, elevationM: v.elevationM,
    ...(typeof v.pavingProductId === 'string' && idValid(v.pavingProductId.trim()) ? { pavingProductId: v.pavingProductId.trim() } : {}),
  };
}

export const fenceLengthM = (fence: Pick<GardenFence, 'a' | 'b'>): number =>
  Math.hypot(fence.b.x - fence.a.x, fence.b.y - fence.a.y);

export function normaliseGardenFence(value: unknown): GardenFence | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as GardenFence;
  if (!idValid(v.id) || !Object.hasOwnProperty.call(FENCE_MATERIALS, v.material)
    || !pointValid(v.a) || !pointValid(v.b) || !finite(v.heightM, 0.3, 3)
    || !finite(fenceLengthM(v), 0.2, 1000)) return null;
  return { id: v.id, a: { x: v.a.x, y: v.a.y }, b: { x: v.b.x, y: v.b.y }, heightM: v.heightM, material: v.material };
}

export function normaliseGarden(value: unknown): Garden | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as { surfaces?: unknown; fences?: unknown };
  const seen = new Set<string>();
  function validUnique<T extends { id: string }>(entries: unknown, normalise: (v: unknown) => T | null): T[] {
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      const clean = normalise(entry);
      if (!clean || seen.has(clean.id)) return [];
      seen.add(clean.id);
      return [clean];
    });
  }
  const surfaces = validUnique(raw.surfaces, normaliseGardenSurface);
  const fences = validUnique(raw.fences, normaliseGardenFence);
  return surfaces.length || fences.length ? { surfaces, fences } : undefined;
}

export function normaliseGardenMetadata<T extends { garden?: Garden }>(property: T): T {
  const garden = normaliseGarden(property.garden);
  if (!property.garden && !garden) return property;
  const out = { ...property };
  if (garden) out.garden = garden;
  else delete out.garden;
  return out;
}

export function gardenSurfacePolygon(surface: GardenSurface): Polygon {
  return [
    { x: surface.x, y: surface.y },
    { x: surface.x + surface.widthM, y: surface.y },
    { x: surface.x + surface.widthM, y: surface.y + surface.depthM },
    { x: surface.x, y: surface.y + surface.depthM },
  ];
}

export function gardenPoints(garden?: Garden): Vertex[] {
  return [
    ...(garden?.surfaces.flatMap(gardenSurfacePolygon) ?? []),
    ...(garden?.fences.flatMap((fence) => [fence.a, fence.b]) ?? []),
  ];
}

export function gardenElevationAt(garden: Garden, point: Vertex): number {
  return garden.surfaces.reduce((height, surface) => pointInPolygon(point, gardenSurfacePolygon(surface))
    ? Math.max(height, surface.elevationM) : height, 0);
}

/** Reposition an existing run without changing its length, direction or material. */
export function moveGardenFence(fence: GardenFence, centre: Vertex): Pick<GardenFence, 'a' | 'b'> {
  const dx = centre.x - (fence.a.x + fence.b.x) / 2;
  const dy = centre.y - (fence.a.y + fence.b.y) / 2;
  return { a: { x: fence.a.x + dx, y: fence.a.y + dy }, b: { x: fence.b.x + dx, y: fence.b.y + dy } };
}
