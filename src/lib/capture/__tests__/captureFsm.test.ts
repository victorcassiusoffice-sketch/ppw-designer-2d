/**
 * Capture-flow FSM — pure-logic proof (`p1-capture-flow-finish` GATE-1 #4).
 *
 * Deterministic, no camera / canvas / network: proves the state machine
 * advances front→side→back, blocks submit until the required set is
 * complete, and that every error kind carries a recover action.
 */
import { describe, it, expect } from 'vitest';
import {
  STEP_ORDER,
  SHOT_ORDER,
  nextStep,
  prevStep,
  shotSetStatus,
  isRequiredShot,
  canSubmit,
  submitBlockedReason,
  shotGuidance,
  describeError,
  recoverActionsFor,
  type CaptureStep,
  type ShotPresence,
  type CaptureErrorKind,
} from '../captureFsm';

describe('capture FSM — step ordering', () => {
  it('walks prepare → camera → calibrate → dimensions → shots → review', () => {
    expect(STEP_ORDER).toEqual([
      'prepare', 'camera', 'calibrate', 'dimensions', 'shots', 'review',
    ]);
  });

  it('nextStep advances and clamps at the end', () => {
    let s: CaptureStep = 'prepare';
    const walked: CaptureStep[] = [s];
    for (let i = 0; i < 10; i++) { s = nextStep(s); walked.push(s); }
    expect(walked.slice(0, 6)).toEqual(STEP_ORDER);
    expect(nextStep('review')).toBe('review'); // clamps
  });

  it('prevStep retreats and clamps at the start', () => {
    expect(prevStep('review')).toBe('shots');
    expect(prevStep('prepare')).toBe('prepare'); // clamps
  });
});

describe('capture FSM — shot set advances front → side → back', () => {
  const present = (front: boolean, side: boolean, back: boolean): ShotPresence => ({ front, side, back });

  it('orders shots front, side, back', () => {
    expect(SHOT_ORDER).toEqual(['front', 'side', 'back']);
  });

  it('front is required; side and back are optional', () => {
    expect(isRequiredShot('front')).toBe(true);
    expect(isRequiredShot('side')).toBe(false);
    expect(isRequiredShot('back')).toBe(false);
  });

  it('tracks the set as the merchant captures front → side → back', () => {
    const s0 = shotSetStatus(present(false, false, false));
    expect(s0.complete).toBe(false);
    expect(s0.missingRequired).toEqual(['front']);
    expect(s0.nextOptional).toBe('side');

    const s1 = shotSetStatus(present(true, false, false));
    expect(s1.complete).toBe(true); // front-only is a valid, complete set
    expect(s1.captured).toEqual(['front']);
    expect(s1.nextOptional).toBe('side');

    const s2 = shotSetStatus(present(true, true, false));
    expect(s2.captured).toEqual(['front', 'side']);
    expect(s2.nextOptional).toBe('back');

    const s3 = shotSetStatus(present(true, true, true));
    expect(s3.captured).toEqual(['front', 'side', 'back']);
    expect(s3.remainingOptional).toEqual([]);
    expect(s3.nextOptional).toBeNull();
  });
});

describe('capture FSM — submit gating (blocks until set complete)', () => {
  it('blocks submit until front + calibration + dimensions are all present', () => {
    expect(canSubmit({ hasFront: false, hasCalibration: false, hasDimensions: false })).toBe(false);
    expect(canSubmit({ hasFront: true, hasCalibration: false, hasDimensions: false })).toBe(false);
    expect(canSubmit({ hasFront: true, hasCalibration: true, hasDimensions: false })).toBe(false);
    expect(canSubmit({ hasFront: true, hasCalibration: true, hasDimensions: true })).toBe(true);
  });

  it('names the first missing requirement', () => {
    expect(submitBlockedReason({ hasFront: false, hasCalibration: false, hasDimensions: false }))
      .toMatch(/front/i);
    expect(submitBlockedReason({ hasFront: true, hasCalibration: false, hasDimensions: false }))
      .toMatch(/calibrate/i);
    expect(submitBlockedReason({ hasFront: true, hasCalibration: true, hasDimensions: false }))
      .toMatch(/dimension/i);
    expect(submitBlockedReason({ hasFront: true, hasCalibration: true, hasDimensions: true }))
      .toBeNull();
  });
});

describe('capture FSM — per-shot guidance', () => {
  it('front is not optional and side/back are', () => {
    expect(shotGuidance('front').optional).toBe(false);
    expect(shotGuidance('side').optional).toBe(true);
    expect(shotGuidance('back').optional).toBe(true);
  });

  it('every slot carries a non-empty instruction + label', () => {
    for (const slot of SHOT_ORDER) {
      const g = shotGuidance(slot);
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.instruction.length).toBeGreaterThan(0);
    }
  });
});

describe('capture FSM — every error state offers a recover action (no dead ends)', () => {
  const KINDS: CaptureErrorKind[] = [
    'pdf-unreachable', 'camera-denied', 'camera-unavailable',
    'capture-failed', 'capture-blurry', 'upload-failed', 'calibrate-failed',
  ];

  it('each error kind has a title, body and at least one recover action', () => {
    for (const kind of KINDS) {
      const d = describeError(kind);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.body.length).toBeGreaterThan(0);
      expect(d.actions.length).toBeGreaterThan(0);
      expect(recoverActionsFor(kind)).toEqual(d.actions);
    }
  });

  it('blocking errors offer a retry-or-continue path', () => {
    // PDF failure must not be a dead end — retry AND continue-anyway.
    const pdf = recoverActionsFor('pdf-unreachable').map((a) => a.kind);
    expect(pdf).toContain('retry');
    expect(pdf).toContain('continue');

    // Camera denial must offer a retry.
    expect(recoverActionsFor('camera-denied').map((a) => a.kind)).toContain('retry');

    // A blurry capture must offer retake AND keep-anyway.
    const blur = recoverActionsFor('capture-blurry').map((a) => a.kind);
    expect(blur).toContain('retake');
    expect(blur).toContain('continue');

    // Upload/calibrate failures must offer retry.
    expect(recoverActionsFor('upload-failed').map((a) => a.kind)).toContain('retry');
    expect(recoverActionsFor('calibrate-failed').map((a) => a.kind)).toContain('retry');
  });
});
