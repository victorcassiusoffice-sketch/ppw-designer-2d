/**
 * Capture-flow FSM — pure logic for the merchant onboarding capture journey.
 *
 * `p1-capture-flow-finish` (Designer Audit Tracker 2026-06-03). The
 * CaptureModal (DT-05..DT-08) was a happy-path front-only stub: the
 * `side-back` step just said "optional — skip ahead" and the review step
 * only reconciled the front shot. This module makes the journey finished:
 *   • a multi-shot set (front required, side + back optional, ordered),
 *   • submit gating (no submit until the required set + calibration +
 *     dimensions are present),
 *   • a closed catalogue of error states, each with a recover action so
 *     there are no dead ends.
 *
 * Pure + framework-free so the state machine is deterministically testable
 * with no camera, canvas or network (GATE-1 capture-FSM tests).
 */

export type CaptureStep =
  | 'prepare'
  | 'camera'
  | 'calibrate'
  | 'dimensions'
  | 'shots'
  | 'review';

/** Linear order the merchant walks through. */
export const STEP_ORDER: CaptureStep[] = [
  'prepare',
  'camera',
  'calibrate',
  'dimensions',
  'shots',
  'review',
];

export function nextStep(step: CaptureStep): CaptureStep {
  const i = STEP_ORDER.indexOf(step);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : step;
}

export function prevStep(step: CaptureStep): CaptureStep {
  const i = STEP_ORDER.indexOf(step);
  return i > 0 ? STEP_ORDER[i - 1] : step;
}

// ─── Shot set ────────────────────────────────────────────────────────────

export type ShotSlot = 'front' | 'side' | 'back';

/** Capture order. Front drives calibration; side/back are auxiliary. */
export const SHOT_ORDER: ShotSlot[] = ['front', 'side', 'back'];

/** Which slots a merchant MUST capture before they can submit. */
export const REQUIRED_SHOTS: ShotSlot[] = ['front'];

/** Slots a merchant MAY add to enrich the listing. */
export const OPTIONAL_SHOTS: ShotSlot[] = ['side', 'back'];

/** Presence map — true once a slot holds a captured frame. */
export type ShotPresence = Record<ShotSlot, boolean>;

export interface ShotSetStatus {
  /** Slots captured so far, in SHOT_ORDER. */
  captured: ShotSlot[];
  /** Required slots still missing, in SHOT_ORDER. */
  missingRequired: ShotSlot[];
  /** Optional slots not yet captured, in SHOT_ORDER. */
  remainingOptional: ShotSlot[];
  /** The next optional slot to suggest (first uncaptured optional), or null. */
  nextOptional: ShotSlot | null;
  /** True once every REQUIRED_SHOTS slot is present. */
  complete: boolean;
}

export function shotSetStatus(present: ShotPresence): ShotSetStatus {
  const captured = SHOT_ORDER.filter((s) => present[s]);
  const missingRequired = REQUIRED_SHOTS.filter((s) => !present[s]);
  const remainingOptional = OPTIONAL_SHOTS.filter((s) => !present[s]);
  return {
    captured,
    missingRequired,
    remainingOptional,
    nextOptional: remainingOptional[0] ?? null,
    complete: missingRequired.length === 0,
  };
}

export function isRequiredShot(slot: ShotSlot): boolean {
  return REQUIRED_SHOTS.includes(slot);
}

// ─── Submit gating ───────────────────────────────────────────────────────

export interface SubmitReadiness {
  hasFront: boolean;
  hasCalibration: boolean;
  hasDimensions: boolean;
}

/**
 * The review/reconcile step may only enable Submit once the required shot
 * set is captured AND the front shot is calibrated AND dimensions are typed.
 */
export function canSubmit(r: SubmitReadiness): boolean {
  return r.hasFront && r.hasCalibration && r.hasDimensions;
}

/** Human-readable reason Submit is blocked, or null when ready. */
export function submitBlockedReason(r: SubmitReadiness): string | null {
  if (!r.hasFront) return 'Capture the front photo first.';
  if (!r.hasCalibration) return 'Calibrate the reference page first.';
  if (!r.hasDimensions) return 'Enter the product dimensions first.';
  return null;
}

// ─── Per-shot guidance ───────────────────────────────────────────────────

export interface ShotGuidance {
  /** Short label for the slot, e.g. "Side photo". */
  label: string;
  /** One-line instruction shown above the camera for this shot. */
  instruction: string;
  /** Whether the merchant may skip this shot. */
  optional: boolean;
}

const SHOT_GUIDANCE: Record<ShotSlot, ShotGuidance> = {
  front: {
    label: 'Front photo',
    instruction:
      'Lay the printed A4 reference page flat beside the product and shoot the front straight-on.',
    optional: false,
  },
  side: {
    label: 'Side photo',
    instruction:
      'Turn the product 90° and shoot the side — same distance, A4 page still in frame.',
    optional: true,
  },
  back: {
    label: 'Back photo',
    instruction:
      'Turn the product to show the back. Keep the A4 page flat in the frame for scale.',
    optional: true,
  },
};

export function shotGuidance(slot: ShotSlot): ShotGuidance {
  return SHOT_GUIDANCE[slot];
}

// ─── Error states + recover actions (no dead ends) ───────────────────────

export type CaptureErrorKind =
  | 'pdf-unreachable'
  | 'camera-denied'
  | 'camera-unavailable'
  | 'capture-failed'
  | 'capture-blurry'
  | 'upload-failed'
  | 'calibrate-failed';

export type RecoverKind = 'retry' | 'retake' | 'continue' | 'back' | 'cancel';

export interface RecoverAction {
  label: string;
  kind: RecoverKind;
}

export interface CaptureErrorDescriptor {
  title: string;
  /** Body copy describing the failure in plain language. */
  body: string;
  /** Ordered recover actions — the first is the primary CTA. Never empty. */
  actions: RecoverAction[];
}

const ERROR_CATALOGUE: Record<CaptureErrorKind, CaptureErrorDescriptor> = {
  'pdf-unreachable': {
    title: 'Reference page unavailable',
    body:
      "We couldn't load the A4 reference PDF just now. You can retry, or continue if you already have it printed.",
    actions: [
      { label: 'Retry', kind: 'retry' },
      { label: 'I already printed it', kind: 'continue' },
      { label: 'Cancel', kind: 'cancel' },
    ],
  },
  'camera-denied': {
    title: 'Camera permission needed',
    body:
      'Allow camera access in your browser to take the photo, then try again. On iPhone: Settings → Safari → Camera → Allow.',
    actions: [
      { label: 'Try again', kind: 'retry' },
      { label: 'Cancel', kind: 'cancel' },
    ],
  },
  'camera-unavailable': {
    title: 'Camera not available',
    body:
      'This browser or device has no usable camera. Open the Designer on a phone with a rear camera to capture.',
    actions: [
      { label: 'Try again', kind: 'retry' },
      { label: 'Cancel', kind: 'cancel' },
    ],
  },
  'capture-failed': {
    title: "Couldn't capture the photo",
    body: 'Something went wrong taking the shot. Try again.',
    actions: [
      { label: 'Retake', kind: 'retake' },
      { label: 'Cancel', kind: 'cancel' },
    ],
  },
  'capture-blurry': {
    title: 'Photo looks blurry',
    body:
      'The shot may be too blurry to scale accurately. Retake it, or keep it if you are happy.',
    actions: [
      { label: 'Retake', kind: 'retake' },
      { label: 'Keep anyway', kind: 'continue' },
    ],
  },
  'upload-failed': {
    title: 'Upload failed',
    body: "We couldn't upload the photo. Check your connection and retry.",
    actions: [
      { label: 'Retry', kind: 'retry' },
      { label: 'Back', kind: 'back' },
    ],
  },
  'calibrate-failed': {
    title: 'Could not save the capture',
    body:
      "The scale-lock server didn't accept the capture. Retry, or go back and review the shots.",
    actions: [
      { label: 'Retry', kind: 'retry' },
      { label: 'Back', kind: 'back' },
    ],
  },
};

export function describeError(kind: CaptureErrorKind): CaptureErrorDescriptor {
  return ERROR_CATALOGUE[kind];
}

export function recoverActionsFor(kind: CaptureErrorKind): RecoverAction[] {
  return ERROR_CATALOGUE[kind].actions;
}
