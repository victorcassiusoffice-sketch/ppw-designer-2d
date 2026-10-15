import { cameraBasis, DEFAULT_AZIMUTH_RAD, projectPoint, type OrbitCamera } from './roomView3d';
import { panOrbitCamera, pinchOrbitCamera, type PinchSample } from './cameraMotion';

export type CameraProjection = 'perspective' | 'orthographic';
export type ProfessionalView = 'dollhouse' | 'above' | 'front' | 'axonometric' | 'plan' | 'north' | 'east' | 'south' | 'west';
export const PROFESSIONAL_VIEWS: ReadonlyArray<{ id: ProfessionalView; label: string; projection: CameraProjection }> = [
  { id: 'dollhouse', label: 'Perspective', projection: 'perspective' },
  { id: 'above', label: 'Above · perspective', projection: 'perspective' },
  { id: 'front', label: 'Front · perspective', projection: 'perspective' },
  { id: 'axonometric', label: 'Axonometric', projection: 'orthographic' },
  { id: 'plan', label: 'Top · orthographic', projection: 'orthographic' },
  { id: 'north', label: 'North elevation', projection: 'orthographic' },
  { id: 'east', label: 'East elevation', projection: 'orthographic' },
  { id: 'south', label: 'South elevation', projection: 'orthographic' },
  { id: 'west', label: 'West elevation', projection: 'orthographic' },
];

/** Orientation and projection only: selections, presets and opening a panel
 * never refit a measured project. North is the plan's negative Y direction. */
export function cameraForProfessionalView(camera: OrbitCamera, view: ProfessionalView): OrbitCamera {
  const deg = Math.PI / 180;
  const angles: Record<ProfessionalView, [number, number]> = {
    dollhouse: [DEFAULT_AZIMUTH_RAD, 35 * deg], above: [0, 78 * deg], front: [0, 12 * deg],
    axonometric: [Math.PI / 4, Math.atan(1 / Math.sqrt(2))], plan: [0, Math.PI / 2 - 0.000001],
    north: [Math.PI, 0], east: [Math.PI / 2, 0], south: [0, 0], west: [-Math.PI / 2, 0],
  };
  return { ...camera, azimuthRad: angles[view][0], elevationRad: angles[view][1] };
}

/** Matching the perspective camera's target plane prevents a projection toggle
 * from changing the apparent scale. Distance remains the user's zoom control. */
export function orthographicHalfHeight(camera: OrbitCamera): number {
  return camera.distanceM * Math.tan(camera.fovRad / 2);
}

export function projectProfessionalPoint(point: { x: number; y: number; z: number }, camera: OrbitCamera,
  viewport: { width: number; height: number }, projection: CameraProjection) {
  const basis = cameraBasis(camera);
  if (projection === 'perspective') return projectPoint(point, basis, camera, viewport);
  const delta = { x: point.x - camera.target.x, y: point.y - camera.target.y, z: point.z - camera.target.z };
  const dot = (v: typeof delta) => delta.x * v.x + delta.y * v.y + delta.z * v.z;
  const scale = viewport.height / (2 * orthographicHalfHeight(camera));
  return { x: viewport.width / 2 + dot(basis.right) * scale, y: viewport.height / 2 - dot(basis.up) * scale };
}

export function panProfessionalCamera(camera: OrbitCamera, dx: number, dy: number, viewportHeight: number, projection: CameraProjection): OrbitCamera {
  if (projection === 'perspective') return panOrbitCamera(camera, dx, dy, viewportHeight);
  const basis = cameraBasis(camera), scale = 2 * orthographicHalfHeight(camera) / Math.max(1, viewportHeight);
  return { ...camera, target: {
    x: camera.target.x + (-dx * basis.right.x + dy * basis.up.x) * scale,
    y: camera.target.y + (-dx * basis.right.y + dy * basis.up.y) * scale,
    z: camera.target.z + (-dx * basis.right.z + dy * basis.up.z) * scale,
  } };
}

export function pinchProfessionalCamera(camera: OrbitCamera, start: PinchSample, current: PinchSample,
  viewportHeight: number, minDistance: number, maxDistance: number, projection: CameraProjection): OrbitCamera {
  if (projection === 'perspective') return pinchOrbitCamera(camera, start, current, viewportHeight, minDistance, maxDistance);
  if (!(start.distance > 0) || !(current.distance > 0)) return camera;
  const moved = panProfessionalCamera(camera, current.x - start.x, current.y - start.y, viewportHeight, projection);
  return { ...moved, distanceM: Math.min(maxDistance, Math.max(minDistance, camera.distanceM * start.distance / current.distance)) };
}
