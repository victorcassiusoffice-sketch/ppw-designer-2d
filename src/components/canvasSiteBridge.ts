import { useSyncExternalStore, type ReactNode } from 'react';
import type { Polygon, Viewport } from '../lib/geometry';
import type { Site } from '../store/propertyStore';

export interface CanvasSiteProjection {
  polygon: Polygon;
  areaM2: number;
  label: string;
  annotation: (view: {
    pxPerMetre: number;
    viewport: Viewport;
    size: { width: number; height: number };
    container: HTMLElement | null;
    Layer: typeof import('react-konva').Layer;
    Rect: typeof import('react-konva').Rect;
    Line: typeof import('react-konva').Line;
    Text: typeof import('react-konva').Text;
    palette: { ink: string; ground: string };
  }) => ReactNode;
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
