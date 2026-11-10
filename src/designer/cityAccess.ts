import type { CityModel, CityPoint } from './city';

function nearestLine(point: CityPoint, routes: {points: CityPoint[]}[]) {
  let nearest = Infinity;
  for (const route of routes) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i-1], b = route.points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy) / length2)) : 0;
    nearest = Math.min(nearest, Math.hypot(point.x-a.x-t*dx, point.y-a.y-t*dy));
  }
  return Number.isFinite(nearest) ? nearest : null;
}

export function districtDistances(model: CityModel, point: CityPoint) {
  return [{label:'Road',distance:nearestLine(point, model.roads)},
    ...(['water','sewer','power','fibre'] as const).map(system => ({
      label:system[0].toUpperCase()+system.slice(1),distance:nearestLine(point, model.networks.filter(n => n.system === system)),
    }))];
}
