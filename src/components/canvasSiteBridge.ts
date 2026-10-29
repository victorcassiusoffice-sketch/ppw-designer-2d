import { useSyncExternalStore, type ReactNode } from 'react';
import type { Polygon } from '../lib/geometry';
import type { Site } from '../store/propertyStore';

export interface CanvasSiteProjection {
  polygon: Polygon;
  areaM2: number;
  label: string;
  annotation: (view: { pxPerMetre: number; scale: number; line: (points: number[], width: number) => ReactNode }) => ReactNode;
}
type Adapter = (site: Site | null) => CanvasSiteProjection | undefined;
let adapter: Adapter | undefined;
const listeners = new Set<() => void>();
const snapshot = () => adapter;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** A deferred implementation registers after paint; this seam cannot interpret world. */
export function installCanvasSiteAdapter(next: Adapter | undefined): void {
  if (adapter === next) return;
  adapter = next;
  listeners.forEach(listener => listener());
}
export function useCanvasSiteProjection(site: Site | null): CanvasSiteProjection | undefined {
  return useSyncExternalStore(subscribe, snapshot, snapshot)?.(site);
}

/** Original rectangular plot fallback; an opaque extension remains withheld. */
export function canvasSitePolygon(site: Site | null, projection?: CanvasSiteProjection): Polygon | null {
  if (!site) return null;
  if (site.world !== undefined) return projection?.polygon ?? null;
  const ox = site.originM?.x ?? 0;
  const oy = site.originM?.y ?? 0;
  return [
    { x: ox, y: oy },
    { x: ox + site.widthM, y: oy },
    { x: ox + site.widthM, y: oy + site.depthM },
    { x: ox, y: oy + site.depthM },
  ];
}
export function canvasSiteArea(site: Site | null, projection?: CanvasSiteProjection): number {
  return site?.world !== undefined ? projection?.areaM2 ?? 0 : site ? site.widthM * site.depthM : 0;
}
