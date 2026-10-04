import { DEFAULT_AZIMUTH_RAD, DEFAULT_FOV_RAD, type Bounds2, type OrbitCamera } from './roomView3d';

/** Fit the actual projected eight corners rather than a bounding sphere.
 * A sphere wastes much of a landscape viewport and makes the model look tiny.
 * The elevated dollhouse angle reveals furniture behind internal walls.
 * Called only on first entry or the user's explicit Fit action. */
export function fitArchitecturalCamera(bounds: Bounds2, heightM: number, aspect = 1.4): OrbitCamera {
  const h = Math.max(0.5, Number.isFinite(heightM) ? heightM : 2.7);
  const viewportAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.4;
  const elevation = 46 * Math.PI / 180;
  const azimuth = DEFAULT_AZIMUTH_RAD;
  const target = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, z: 0 };
  const sinA = Math.sin(azimuth), cosA = Math.cos(azimuth), sinE = Math.sin(elevation), cosE = Math.cos(elevation);
  const tan = Math.tan(DEFAULT_FOV_RAD / 2);
  let distance = Infinity;
  // The source plan bounds lie on interior wall faces. Include the physical
  // wall/slab thickness so fitting never clips the exterior building edge.
  // The nearest floor corner is magnified by perspective. A fixed midpoint
  // target leaves large empty space above a single-storey plan. Find a stable
  // vertical aim inside the building that centres its projected volume.
  for (let sample = 0; sample <= 24; sample++) {
    const targetZ = h * 0.7 * sample / 24;
    let required = 2;
    for (const x of [bounds.minX - 0.2, bounds.maxX + 0.2]) {
      for (const y of [bounds.minY - 0.2, bounds.maxY + 0.2]) {
        for (const z of [-0.18, h + 0.12]) {
          const dx = x - target.x, dy = y - target.y, dz = z - targetZ;
          const horizontal = dx * cosA - dy * sinA;
          const vertical = -dx * sinA * sinE - dy * cosA * sinE + dz * cosE;
          const depth = -dx * sinA * cosE - dy * cosA * cosE - dz * sinE;
          required = Math.max(required, Math.abs(horizontal) / (tan * viewportAspect * 0.88) - depth, Math.abs(vertical) / (tan * 0.9) - depth);
        }
      }
    }
    if (required < distance) { distance = required; target.z = targetZ; }
  }
  return { target, azimuthRad: azimuth, elevationRad: elevation, distanceM: distance, fovRad: DEFAULT_FOV_RAD };
}
