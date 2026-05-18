/**
 * Sims-Parity DT-29 — WebXR AR-measure math (CAP.15).
 *
 * Pure-fn: given two AR-anchored 3D points (XYZ in metres), compute
 * the real-world span between them in mm. Used by the
 * `XRCaptureStage` two-tap measure interaction — merchant taps a
 * floor anchor at one corner of the product, then at the opposite
 * corner, and the X-axis span auto-fills the dimension form's
 * `width` field.
 *
 * Browser support: WebXR's `immersive-ar` session + hit-test module
 * required. Feature-detection lives at the XRCaptureStage entry; if
 * absent, capture flow falls back to DT-20 v2 ArUco auto-pose.
 */

export interface XrPoint3 {
  x: number; // metres
  y: number;
  z: number;
}

/** Euclidean distance between two anchors, returned in mm. */
export function distanceMm(a: XrPoint3, b: XrPoint3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000;
}

/**
 * Floor-plane horizontal span (mm) — drops the y-axis so a tap
 * slightly above the floor doesn't inflate the measurement.
 */
export function floorSpanMm(a: XrPoint3, b: XrPoint3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz) * 1000;
}

/**
 * Feature-detect WebXR `immersive-ar` support. Returns the support
 * state synchronously when navigator.xr is missing; async-checks
 * isSessionSupported when present.
 */
export async function isWebXRArAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xr = (navigator as any).xr;
  if (!xr || typeof xr.isSessionSupported !== 'function') return false;
  try {
    return await xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

export interface XrMeasureResult {
  /** Mode that produced the measurement. */
  mode: 'two-tap-floor';
  /** Anchor A in world XYZ (metres). */
  anchorA: XrPoint3;
  /** Anchor B in world XYZ (metres). */
  anchorB: XrPoint3;
  /** Horizontal span in mm — pipes into DimensionForm.width. */
  widthMm: number;
}

export function buildXrMeasureResult(a: XrPoint3, b: XrPoint3): XrMeasureResult {
  return {
    mode: 'two-tap-floor',
    anchorA: a,
    anchorB: b,
    widthMm: Math.round(floorSpanMm(a, b)),
  };
}
