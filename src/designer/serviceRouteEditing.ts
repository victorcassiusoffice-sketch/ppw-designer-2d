import type { ServicePoint } from './buildingServices';

export type ServiceAngleSnap = 'free' | '45' | '90';
/** Plan snapping changes only XY; node elevations remain independent measured inputs. */
export function snapServicePoint(
  point: ServicePoint,
  previous: ServicePoint | undefined,
  grid: boolean,
  angle: ServiceAngleSnap,
): ServicePoint {
  let next = {
    ...point,
    x: grid ? Math.round(point.x * 20) / 20 : point.x,
    y: grid ? Math.round(point.y * 20) / 20 : point.y,
  };
  if (previous && angle !== 'free') {
    const dx = next.x - previous.x,
      dy = next.y - previous.y;
    const step = (Number(angle) * Math.PI) / 180;
    const theta = Math.round(Math.atan2(dy, dx) / step) * step;
    // Project onto the selected direction; orthogonal snapping retains its major coordinate.
    const distance = dx * Math.cos(theta) + dy * Math.sin(theta);
    next = {
      ...next,
      x: previous.x + distance * Math.cos(theta),
      y: previous.y + distance * Math.sin(theta),
    };
    next.x = Number(next.x.toPrecision(13));
    next.y = Number(next.y.toPrecision(13));
  }
  return next;
}
