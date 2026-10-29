import type { CanvasSiteProjection } from '../components/canvasSiteBridge';
import { SiteAnnotation } from './SiteAnnotation';
import type { AnnotationView } from './annotationLayout';
import { area } from './geometry';
import type { GeoSite } from './types';

const projections = new WeakMap<GeoSite, CanvasSiteProjection>();

/** Only the deferred validator supplies accepted, deeply frozen canonical data. */
export function projectSiteForCanvas(world: GeoSite): CanvasSiteProjection {
  const previous = projections.get(world);
  if (previous) return previous;
  const label = `${world.name} · N ↑ · boundary drawn / typed by you`;
  const projection: CanvasSiteProjection = Object.freeze({
    polygon: world.polygon,
    areaM2: area(world.polygon),
    label,
    annotation: (view: AnnotationView) => <view.Layer name="site-annotation" listening={false}>
      <SiteAnnotation label={label} anchor={world.polygon[0]} view={view} />
    </view.Layer>,
  });
  projections.set(world, projection);
  return projection;
}
