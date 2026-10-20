import { Circle, Group, Line } from 'react-konva';
import type { ServiceRun } from '../designer/buildingServices';
import { SERVICE_SYSTEMS, serviceRunPoints3D } from '../designer/buildingServices';

/** Plan projection of the same measured 3D centre lines. A riser projects to a ring. */
export function ServiceRoutesPlanLayer({ runs, pxPerMetre, scale, onSelect }: { runs: ServiceRun[]; pxPerMetre: number; scale: number; onSelect?: (id: string) => void }) {
  return <Group name="service-routes" listening={Boolean(onSelect)}>{runs.map(run => {
    const colour = SERVICE_SYSTEMS.find(system => system.id === run.system)?.colour ?? '#387e85';
    const points = serviceRunPoints3D(run);
    return <Group key={run.id} name={`service-route-${run.id}`} onClick={event => { event.cancelBubble = true; onSelect?.(run.id); }} onTap={event => { event.cancelBubble = true; onSelect?.(run.id); }}>
      <Line points={points.flatMap(point => [point.x * pxPerMetre, point.y * pxPerMetre])} stroke={colour} strokeWidth={Math.max(run.diameterMm / 1000 * pxPerMetre, 2 / scale)} hitStrokeWidth={14 / scale} lineJoin="round" lineCap="round" />
      {points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y) < 0.001 && Math.abs(point.elevationM - points[index].elevationM) > 0.001 ? <Circle key={index} x={point.x * pxPerMetre} y={point.y * pxPerMetre} radius={4 / scale} fill="#fffdf4" stroke={colour} strokeWidth={2 / scale} /> : null)}
    </Group>;
  })}</Group>;
}
