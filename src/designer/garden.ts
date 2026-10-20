/** Ground-level landscaping; optional sourced paving remains part of its surface. */
import { pointInPolygon, type Polygon, type Vertex } from '../lib/geometry';
import { isSimpleMeasuredPolygon } from './measuredPath';

export const GARDEN_SURFACES = {
  lawn: { label: 'Lawn', hex: '#70934f' },
  soil: { label: 'Planting bed', hex: '#795841' },
  gravel: { label: 'Gravel', hex: '#b5afa0' },
  path: { label: 'Paved path', hex: '#c5bca9' },
  concrete: { label: 'Concrete', hex: '#a7aaa8' },
  tarmac: { label: 'Tarmac / asphalt', hex: '#42484b' },
  pool: { label: 'Swimming pool', hex: '#5db6c3' },
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
  /** Sampled, closed plan outline in world metres. Absent means rectangle. */
  outline?: Polygon;
  /** Physical material depth, independent of the plan's depthM dimension. */
  thicknessM?: number;
  subBaseDepthM?: number;
  pool?: GardenPool;
}
export interface GardenPool {
  /** Inner floor-to-rim depth and water depth measured from the floor. */
  shellDepthM: number;
  waterDepthM: number;
  wallThicknessM: number;
  baseThicknessM: number;
  excavationMarginM: number;
  stage: 'excavation' | 'shell' | 'filled';
  /** Reference only: custom geometry is never claimed to be the supplier's mould. */
  productReferenceId?: string;
}
export const DEFAULT_GARDEN_POOL: GardenPool = {
  shellDepthM: 1.5, waterDepthM: 1.35, wallThicknessM: 0.2, baseThicknessM: 0.2,
  excavationMarginM: 0.3, stage: 'filled',
};
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
export type GardenPlacement =
  | { kind: 'surface' | 'fence'; id: string; mode?: 'move' | 'resize' }
  | { kind: 'surface'; mode: 'draw'; surfaceKind: GardenSurfaceKind; pavingProductId?: string; id?: never };

export const isGardenAreaGesture = (placement: GardenPlacement | null): boolean => placement?.mode === 'draw' || placement?.mode === 'resize';

/** Last-drawn surfaces win, matching their visual stacking order. */
export function gardenElementAt(garden: Garden | undefined, point: Vertex, toleranceM = 0.2): string | null {
  for (const fence of [...(garden?.fences ?? [])].reverse()) {
    const dx = fence.b.x - fence.a.x, dy = fence.b.y - fence.a.y;
    const t = Math.max(0, Math.min(1, ((point.x - fence.a.x) * dx + (point.y - fence.a.y) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(point.x - fence.a.x - t * dx, point.y - fence.a.y - t * dy) <= toleranceM) return fence.id;
  }
  return [...(garden?.surfaces ?? [])].reverse().find(surface => pointInPolygon(point, gardenSurfacePolygon(surface)))?.id ?? null;
}

/** A floor-style drag sets both corners, in either direction, in one edit. */
export function gardenRectFromPoints(a: Vertex, b: Vertex, stepM = 0.1): Pick<GardenSurface, 'x' | 'y' | 'widthM' | 'depthM'> | null {
  const step = Number.isFinite(stepM) && stepM > 0 ? stepM : 0.1;
  const snap = (n: number) => Number((Math.round(n / step) * step).toFixed(6));
  const x = snap(Math.min(a.x, b.x));
  const y = snap(Math.min(a.y, b.y));
  const widthM = snap(Math.max(a.x, b.x)) - x;
  const depthM = snap(Math.max(a.y, b.y)) - y;
  if (![x, y, widthM, depthM].every(Number.isFinite) || widthM < 0.2 - 1e-8 || depthM < 0.2 - 1e-8 || widthM > 500 || depthM > 500) return null;
  return { x, y, widthM: Number(Math.max(0.2, widthM).toFixed(6)), depthM: Number(Math.max(0.2, depthM).toFixed(6)) };
}

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
  if (v.outline !== undefined && (!isSimpleMeasuredPolygon(v.outline) || !v.outline.every(pointValid)
    || v.outline.some(p => p.x < v.x - 1e-6 || p.x > v.x + v.widthM + 1e-6 || p.y < v.y - 1e-6 || p.y > v.y + v.depthM + 1e-6))) return null;
  if (v.thicknessM !== undefined && !finite(v.thicknessM, 0.001, 5)) return null;
  if (v.subBaseDepthM !== undefined && !finite(v.subBaseDepthM, 0, 10)) return null;
  const pool = v.kind === 'pool' ? normaliseGardenPool(v.pool ?? DEFAULT_GARDEN_POOL) : undefined;
  // Pool takeoffs currently describe a rectangular, flat-bottom basin only.
  if (v.kind === 'pool' && (!pool || v.outline)) return null;
  return {
    id: v.id, kind: v.kind, x: v.x, y: v.y, widthM: v.widthM, depthM: v.depthM, elevationM: v.elevationM,
    ...(typeof v.pavingProductId === 'string' && idValid(v.pavingProductId.trim()) ? { pavingProductId: v.pavingProductId.trim() } : {}),
    ...(v.outline ? { outline: v.outline.map(p => ({ ...p })) } : {}),
    ...(v.thicknessM !== undefined ? { thicknessM: v.thicknessM } : {}),
    ...(v.subBaseDepthM !== undefined ? { subBaseDepthM: v.subBaseDepthM } : {}),
    ...(pool ? { pool } : {}),
  };
}

export function normaliseGardenPool(value: unknown): GardenPool | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as GardenPool;
  if (!finite(v.shellDepthM, 0.2, 10) || !finite(v.waterDepthM, 0, v.shellDepthM)
    || !finite(v.wallThicknessM, 0.01, 2) || !finite(v.baseThicknessM, 0.01, 2)
    || !finite(v.excavationMarginM, 0, 5) || !['excavation', 'shell', 'filled'].includes(v.stage)) return null;
  return { shellDepthM: v.shellDepthM, waterDepthM: v.waterDepthM, wallThicknessM: v.wallThicknessM,
    baseThicknessM: v.baseThicknessM, excavationMarginM: v.excavationMarginM, stage: v.stage,
    ...(idValid(v.productReferenceId) ? { productReferenceId: v.productReferenceId } : {}) };
}

/** Moving/resizing an outline uses the same affine mapping as its visible bounds. */
export function gardenSurfacePatch(original: GardenSurface, patch: Partial<Omit<GardenSurface, 'id'>>): GardenSurface {
  const next = { ...original, ...patch };
  if (original.outline && !Object.prototype.hasOwnProperty.call(patch, 'outline')) next.outline = original.outline.map(p => ({
    x: next.x + (p.x - original.x) * next.widthM / original.widthM,
    y: next.y + (p.y - original.y) * next.depthM / original.depthM,
  }));
  return next;
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
  if (surface.outline) return surface.outline;
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
