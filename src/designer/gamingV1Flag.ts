/**
 * Sims-Parity Gaming Layer 1 feature flag.
 *
 * Reads `?ui=gaming-v1` from the URL. The flag flip itself happens
 * in DT-19 (server-side LD); until then this util drives client-side
 * gating only so DT-11..DT-18 can ship dormant components behind the
 * query-param.
 *
 * Honoured constraint: Konva STABLE LOCK 26c144c — every new Gaming
 * Layer 1 surface mounts ONLY when this flag is on. Default off.
 */

export function isGamingV1Active(searchString: string = ''): boolean {
  // Allow either a "?ui=gaming-v1" query OR a "gaming_v1" flag in
  // localStorage so developers can toggle quickly without a URL edit.
  try {
    const params = new URLSearchParams(searchString || (typeof window !== 'undefined' ? window.location.search : ''));
    if (params.get('ui') === 'gaming-v1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('gaming_v1') === '1') return true;
  } catch {
    // ignore
  }
  return false;
}

export const GAMING_V1_QUERY_KEY = 'ui';
export const GAMING_V1_QUERY_VALUE = 'gaming-v1';
