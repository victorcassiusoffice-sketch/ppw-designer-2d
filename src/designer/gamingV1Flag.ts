/**
 * Sims-Parity Gaming Layer 1 feature flag.
 *
 * **V4 default-ON (2026-05-18 Vic action):** Gaming Layer 1 polish
 * (DT-11..DT-18 surfaces) is now the permanent default UI at
 * designer.ppwellness.co. No time-bomb, no trial — this IS the UI.
 *
 * Override paths (kept for diagnostics + rollback safety):
 *   • `?ui=classic` — disable Gaming Layer 1 (visible after a
 *     hard refresh with that query string).
 *   • `localStorage.gaming_v1 = '0'` — same effect, persists across
 *     refreshes for a single device.
 *
 * Konva STABLE LOCK 26c144c still honoured — Gaming surfaces mount
 * additively on top of the existing render-core, not as a replacement.
 */

export function isGamingV1Active(searchString: string = ''): boolean {
  try {
    const params = new URLSearchParams(
      searchString || (typeof window !== 'undefined' ? window.location.search : ''),
    );
    // Explicit disable wins over default.
    if (params.get('ui') === 'classic') return false;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('gaming_v1') === '0') return false;
    // Explicit enable also fine — equivalent to default now.
    if (params.get('ui') === 'gaming-v1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('gaming_v1') === '1') return true;
  } catch {
    // ignore
  }
  // Default-ON (V4 Vic action).
  return true;
}

export const GAMING_V1_QUERY_KEY = 'ui';
export const GAMING_V1_QUERY_VALUE = 'gaming-v1';
export const GAMING_V1_DISABLE_VALUE = 'classic';
