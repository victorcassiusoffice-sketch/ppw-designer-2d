/**
 * haptics — tiny guarded wrapper over the Web Vibration API for the
 * mobile Sims designer (PARITY-MATRIX M15).
 *
 * The mobile interaction spec §7 requires haptics on every meaningful
 * event (snap, place, rotate-detent, duplicate, delete, invalid) "to sell
 * the tactile, no-modal feel". iOS Safari does NOT implement
 * `navigator.vibrate` (only Android Chrome + most Android browsers do), so
 * every call is fully guarded and silently no-ops where the API is absent
 * — there is no iOS-web haptic primitive available to a PWA, so Android is
 * where this fires. Kept framework-free so it's callable from Konva event
 * handlers, key handlers and DOM buttons alike.
 *
 * Patterns are intentionally short (≤30 ms) so they read as a "tick", not a
 * buzz, and never block the gesture.
 */

export type HapticEvent =
  | 'snap'
  | 'place'
  | 'rotate'
  | 'duplicate'
  | 'delete'
  | 'invalid'
  | 'select';

// Vibration durations (ms) per event. `invalid` is the only double-pulse
// (an error "buzz-buzz"); everything else is a single crisp tick.
const PATTERNS: Record<HapticEvent, number | number[]> = {
  snap: 8,
  select: 6,
  place: 18,
  rotate: 10,
  duplicate: 14,
  delete: 24,
  invalid: [16, 40, 16],
};

function canVibrate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

/**
 * Fire the haptic for a given event. No-ops silently when the platform
 * has no Vibration API (iOS Safari, desktop) or when the user has a
 * coarse-pointer-less device. Never throws.
 */
export function haptic(event: HapticEvent): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[event]);
  } catch {
    // Some embedded webviews throw on vibrate during a non-user gesture.
    // Haptics are pure polish — swallow and continue.
  }
}

/** True when the running device exposes a usable Vibration API. */
export function hapticsAvailable(): boolean {
  return canVibrate();
}
