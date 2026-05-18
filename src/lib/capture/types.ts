/**
 * Sims-Parity DT-01 — CapturePacket Zod schema.
 *
 * The handoff contract from the in-browser CaptureModal (DT-05..DT-08)
 * to the server `/capture/calibrate` endpoint (DT-04) and onward to the
 * M9.B.1 `add_product` agent intent (DT-09). Mirrors §2 of
 * `06-Roadmap/sims-parity/master/MASTER-DATA-FLOW.md` and §1 of
 * `MASTER-BUILD-PLAN.md`.
 *
 * Bound constants (server-side validation in DT-04):
 *   pixelsPerMm ∈ [0.3, 30]
 *   rmsCalibrationError ≤ 8 (pixels)
 *   dimensions ∈ [1, 5000] mm
 *
 * silhouette_bbox_px is OPTIONAL because the v1 corner-tap path may emit
 * a rough bbox from A4-rect mask edges, while the v2 ArUco auto-pose path
 * always emits a precise one. Renderer (DT-11 GL1.01b) renders the full
 * photo if absent (known degradation, accepted at v1).
 */

import { z } from 'zod';

export const CAPTURE_PATHS = ['a4-corner-tap', 'aruco', 'webxr-plane'] as const;
export type CapturePath = (typeof CAPTURE_PATHS)[number];

export const SilhouetteBboxPxSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type SilhouetteBboxPx = z.infer<typeof SilhouetteBboxPxSchema>;

export const CapturePhotoFrontSchema = z.object({
  blobUrl: z.string().url(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  pixelsPerMm: z.number().positive(),
  rmsCalibrationError: z.number().nonnegative(),
  alphaClean: z.boolean().default(false),
  silhouette_bbox_px: SilhouetteBboxPxSchema.optional(),
});
export type CapturePhotoFront = z.infer<typeof CapturePhotoFrontSchema>;

const CapturePhotoSideOrBackSchema = z
  .object({ blobUrl: z.string().url() })
  .partial()
  .optional();

export const DimensionsMmSchema = z.object({
  width: z.number().int().positive().max(5000),
  depth: z.number().int().positive().max(5000),
  height: z.number().int().positive().max(5000),
});
export type DimensionsMm = z.infer<typeof DimensionsMmSchema>;

export const TypedVsMeasuredSchema = z.object({
  deltaPct: z.number(),
  flagged: z.boolean(),
  overrideReason: z.string().optional(),
});
export type TypedVsMeasured = z.infer<typeof TypedVsMeasuredSchema>;

export const CapturePacketSchema = z.object({
  scaleLockId: z.string().uuid(),
  capturedAt: z.string().datetime(),
  path: z.enum(CAPTURE_PATHS),
  photoFront: CapturePhotoFrontSchema,
  photoSide: CapturePhotoSideOrBackSchema,
  photoBack: CapturePhotoSideOrBackSchema,
  dimensionsMm: DimensionsMmSchema,
  typedVsMeasured: TypedVsMeasuredSchema,
});
export type CapturePacket = z.infer<typeof CapturePacketSchema>;

/**
 * VC-2 invalidation reason tag — set on `product_capture_scale_locks.invalidation_reason`
 * when a merchant edits `dimensions_mm` post-capture (enforced by DT-09).
 */
export const SCALE_LOCK_INVALIDATION_REASONS = [
  'merchant_dim_edit',
  'merchant_recapture',
  'admin_override',
] as const;
export type ScaleLockInvalidationReason = (typeof SCALE_LOCK_INVALIDATION_REASONS)[number];
