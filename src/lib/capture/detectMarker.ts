/**
 * Sims-Parity DT-20 — ArUco marker detection (CAP.12 auto-pose).
 *
 * VC-1 LOCKED: marker ID set is `[0, 1, 2, 3]` (TL, TR, BR, BL).
 * The v2 reference PDF (`/api/capture/reference-page-v2.pdf`) draws
 * those four markers; this module detects them and emits a
 * 4-corner homography source identical in shape to the v1
 * corner-tap output (DT-06 `ScaleFromMarkerOutput`).
 *
 * Lazy-loaded — js-aruco2 is ~120 KB; the import lives inside
 * the call so the marketing-route bundle never pays for it.
 *
 * Below the confidence threshold the caller should fall back to
 * the v1 corner-tap UI.
 */

import type { CornerPoint } from './scaleFromMarker';

/** VC-1 locked marker IDs in TL → TR → BR → BL order. */
export const ARUCO_MARKER_IDS: readonly [number, number, number, number] = [0, 1, 2, 3];

export interface DetectMarkerResult {
  /** True iff all 4 expected markers (IDs 0–3) detected. */
  ok: boolean;
  /** Auto-pose 4 corners in TL→TR→BR→BL order, image-px space. */
  corners?: [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
  /** Mean per-corner reprojection error (RMS-like). */
  deltaRMS?: number;
  /** Detected marker IDs (for diagnostics). */
  detectedIds: number[];
}

interface ArucoDetectorLike {
  detect(image: ImageData): Array<{ id: number; corners: Array<{ x: number; y: number }> }>;
}

let detectorPromise: Promise<ArucoDetectorLike | null> | null = null;

async function loadDetector(): Promise<ArucoDetectorLike | null> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    try {
      // Lazy import — bundles only inside the capture chunk.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (await import('js-aruco2')) as any;
      // js-aruco2 exposes AR.Detector — fall through gracefully if shape differs.
      const ctor = mod?.AR?.Detector ?? mod?.default?.AR?.Detector ?? mod?.Detector;
      if (typeof ctor !== 'function') return null;
      return new ctor() as ArucoDetectorLike;
    } catch {
      return null;
    }
  })();
  return detectorPromise;
}

/** Reset the cached detector — test-only utility. */
export function __resetDetectorCacheForTests(): void {
  detectorPromise = null;
}

/**
 * Pure-fn wrapper around js-aruco2.AR.Detector.detect().
 *
 * Returns `ok: true` only when all four VC-1 marker IDs are found.
 * The corners come back as TL→TR→BR→BL in image-px space —
 * compatible with `scaleFromMarker` upstream.
 */
export async function detectMarker(image: ImageData): Promise<DetectMarkerResult> {
  const detector = await loadDetector();
  if (!detector) {
    return { ok: false, detectedIds: [] };
  }

  let raw: Array<{ id: number; corners: Array<{ x: number; y: number }> }>;
  try {
    raw = detector.detect(image);
  } catch {
    return { ok: false, detectedIds: [] };
  }
  const detectedIds = raw.map((r) => r.id);

  // Need all four expected IDs.
  const byId = new Map(raw.map((r) => [r.id, r]));
  if (!ARUCO_MARKER_IDS.every((id) => byId.has(id))) {
    return { ok: false, detectedIds };
  }

  // Build TL→TR→BR→BL from the four markers. Each ArUco marker
  // itself is a tiny quad — we use its centre as the page-corner
  // landmark.
  const centres = ARUCO_MARKER_IDS.map((id) => {
    const m = byId.get(id)!;
    const cx = m.corners.reduce((s, c) => s + c.x, 0) / m.corners.length;
    const cy = m.corners.reduce((s, c) => s + c.y, 0) / m.corners.length;
    return { xPx: cx, yPx: cy };
  });
  const corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint] = [
    centres[0], centres[1], centres[2], centres[3],
  ];

  // Rough deltaRMS — sum of per-marker corner spread (closer = sharper detect).
  let sse = 0;
  for (const m of raw.filter((r) => ARUCO_MARKER_IDS.includes(r.id))) {
    const cx = m.corners.reduce((s, c) => s + c.x, 0) / m.corners.length;
    const cy = m.corners.reduce((s, c) => s + c.y, 0) / m.corners.length;
    for (const c of m.corners) {
      const dx = c.x - cx;
      const dy = c.y - cy;
      sse += dx * dx + dy * dy;
    }
  }
  const deltaRMS = Math.sqrt(sse / (4 * ARUCO_MARKER_IDS.length));

  return { ok: true, corners, deltaRMS, detectedIds };
}
