import type { OrbitCamera } from './roomView3d';

export interface PinchSample { x: number; y: number; distance: number }

/** Resolve every two-finger frame against its original camera. Pointer events
 * arrive one finger at a time: incremental pan followed by zoom would integrate
 * their temporary midpoint movement at different scales, drifting after every
 * otherwise symmetric pinch. A baseline also makes clamping reversible. */
export function pinchOrbitCamera(
  camera: OrbitCamera, start: PinchSample, current: PinchSample,
  viewportHeight: number, minDistance: number, maxDistance: number,
): OrbitCamera {
  if (start.distance < 2 || current.distance < 2 || ![start.x, start.y, start.distance, current.x, current.y, current.distance].every(Number.isFinite)) return camera;
  const panned = panOrbitCamera(camera, current.x - start.x, current.y - start.y, viewportHeight);
  return { ...panned, distanceM: Math.max(minDistance, Math.min(maxDistance, camera.distanceM * start.distance / current.distance)) };
}

/** Keep world-to-screen scale fixed when an inspector/catalog changes the canvas height. */
export function cameraForViewport(camera: OrbitCamera, viewportHeight: number, referenceHeight: number): OrbitCamera {
  if (viewportHeight <= 0 || referenceHeight <= 0 || viewportHeight === referenceHeight) return camera;
  return { ...camera, fovRad: 2 * Math.atan(Math.tan(camera.fovRad / 2) * viewportHeight / referenceHeight) };
}

/** Move the view along the ground, keeping the point under a dragged finger. */
export function panOrbitCamera(camera: OrbitCamera, dxPixels: number, dyPixels: number, viewportHeight: number): OrbitCamera {
  if (viewportHeight <= 0) return camera;
  const scale = 2 * camera.distanceM * Math.tan(camera.fovRad / 2) / viewportHeight;
  const forward = dyPixels * scale / Math.max(0.3, Math.sin(camera.elevationRad));
  const right = -dxPixels * scale;
  const sin = Math.sin(camera.azimuthRad), cos = Math.cos(camera.azimuthRad);
  return { ...camera, target: {
    x: camera.target.x + right * cos + forward * sin,
    y: camera.target.y - right * sin + forward * cos,
    z: camera.target.z,
  } };
}

/** Signed shortest turn, including camera angles that have crossed ±π repeatedly. */
export function shortestAngleDelta(from: number, to: number): number {
  const turn = Math.PI * 2;
  return ((to - from + Math.PI) % turn + turn) % turn - Math.PI;
}

export function cameraAtRest(current: OrbitCamera, target: OrbitCamera): boolean {
  return Math.abs(shortestAngleDelta(current.azimuthRad, target.azimuthRad)) < 0.0001
    && Math.abs(current.elevationRad - target.elevationRad) < 0.0001
    && Math.abs(current.fovRad - target.fovRad) < 0.0001
    && Math.abs(current.distanceM - target.distanceM) < 0.001
    && Math.hypot(current.target.x - target.target.x, current.target.y - target.target.y, current.target.z - target.target.z) < 0.001;
}

/** Frame-rate-independent easing: one response period closes 63% of the gap. */
export function dampOrbitCamera(current: OrbitCamera, target: OrbitCamera, elapsedMs: number, responseMs = 35): OrbitCamera {
  if (responseMs <= 0 || cameraAtRest(current, target)) return target;
  const alpha = 1 - Math.exp(-Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) / responseMs);
  const mix = (from: number, to: number) => from + (to - from) * alpha;
  const next: OrbitCamera = {
    azimuthRad: current.azimuthRad + shortestAngleDelta(current.azimuthRad, target.azimuthRad) * alpha,
    elevationRad: mix(current.elevationRad, target.elevationRad),
    distanceM: mix(current.distanceM, target.distanceM),
    fovRad: mix(current.fovRad, target.fovRad),
    target: {
      x: mix(current.target.x, target.target.x),
      y: mix(current.target.y, target.target.y),
      z: mix(current.target.z, target.target.z),
    },
  };
  return cameraAtRest(next, target) ? target : next;
}
