/**
 * Sims-Parity DT-24 — Babylon mobile touch (L2.08).
 *
 * Babylon's ArcRotateCamera.attachControl() defaults already wire:
 *   • 1-finger drag → orbit (alpha/beta)
 *   • 2-finger drag → pan (when panningSensibility > 0)
 *   • pinch → zoom (when pinchPrecision > 0)
 *
 * The DT-21 Camera.ts builder sets `pinchPrecision: 50` and
 * `panningSensibility: 1000`, so mobile gestures work out of the
 * box. This module exposes a small tuning helper so per-device
 * profiles can be applied without touching the camera builder.
 */

import type { ArcRotateCamera } from '@babylonjs/core';

export interface TouchProfile {
  pinchPrecision: number;
  panningSensibility: number;
  wheelPrecision: number;
}

export const TOUCH_PROFILE_MOBILE: TouchProfile = {
  pinchPrecision: 30, // looser pinch on touch (less precision-sensitive thumbs)
  panningSensibility: 700, // 2-finger pan slightly more responsive
  wheelPrecision: 30,
};

export const TOUCH_PROFILE_DESKTOP: TouchProfile = {
  pinchPrecision: 50,
  panningSensibility: 1000,
  wheelPrecision: 30,
};

export function applyTouchProfile(camera: ArcRotateCamera, profile: TouchProfile): void {
  camera.pinchPrecision = profile.pinchPrecision;
  camera.panningSensibility = profile.panningSensibility;
  camera.wheelPrecision = profile.wheelPrecision;
}
