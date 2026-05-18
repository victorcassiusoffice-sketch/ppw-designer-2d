/**
 * Sims-Parity DT-21 — Babylon engine query-string gate.
 *
 * Visit `?engine=babylon` → BabylonRoom mounts in place of the Konva
 * RoomCanvas. Visit `?engine=konva` (or no param) → Konva path
 * (today; DT-28 will swap the default-no-param branch to Babylon
 * once the 14-day Sentry soak completes).
 *
 * DT-28 (L2.14) wired the `getDefaultEngine()` helper. Explicit
 * ?engine= values still override the default in either direction —
 * the rollback path stays open even after the default flips.
 */

import { getDefaultEngine } from './defaultEngine';

export function isBabylonActive(searchString: string = ''): boolean {
  try {
    const params = new URLSearchParams(
      searchString || (typeof window !== 'undefined' ? window.location.search : ''),
    );
    const explicit = params.get('engine');
    if (explicit === 'babylon') return true;
    if (explicit === 'konva') return false;
    return getDefaultEngine() === 'babylon';
  } catch {
    return false;
  }
}

export const ENGINE_QUERY_KEY = 'engine';
export const ENGINE_BABYLON_VALUE = 'babylon';
export const ENGINE_KONVA_VALUE = 'konva';
