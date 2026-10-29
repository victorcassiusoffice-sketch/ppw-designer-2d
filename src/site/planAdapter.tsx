import type { CanvasSiteProjection } from '../components/canvasSiteBridge';
import { area } from './geometry';
import type { GeoSite } from './types';

const projections = new WeakMap<GeoSite, CanvasSiteProjection>();

/** Only the deferred validator supplies accepted, deeply frozen canonical data. */
export function projectSiteForCanvas(world: GeoSite): CanvasSiteProjection {
  const previous = projections.get(world);
  if (previous) return previous;
  const projection: CanvasSiteProjection = Object.freeze({
    polygon: world.polygon,
    areaM2: area(world.polygon),
    label: `${world.name} · N ↑ · boundary drawn / typed by you`,
    annotation: ({ pxPerMetre, scale, line }: Parameters<CanvasSiteProjection['annotation']>[0]) => {
      const x = world.polygon[0].x * pxPerMetre;
      const y = world.polygon[0].y * pxPerMetre;
      return line([
        x, y - 12 / scale,
        x, y - 42 / scale,
        x - 5 / scale, y - 34 / scale,
        x, y - 42 / scale,
        x + 5 / scale, y - 34 / scale,
      ], 1.5 / scale);
    },
  });
  projections.set(world, projection);
  return projection;
}
