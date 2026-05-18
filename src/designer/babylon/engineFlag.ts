/**
 * Sims-Parity DT-21 — Babylon engine query-string gate.
 *
 * Visit `?engine=babylon` → BabylonRoom mounts in place of the Konva
 * RoomCanvas. Visit `?engine=konva` (or no param) → Konva path.
 *
 * Default is OFF — Konva remains the production default until DT-28
 * (Konva sunset) flips this. V7=YES unblocks the surface; V8=NO
 * means procedural meshes only (no hero-glTF), but that's a DT-22+
 * concern.
 */

export function isBabylonActive(searchString: string = ''): boolean {
  try {
    const params = new URLSearchParams(
      searchString || (typeof window !== 'undefined' ? window.location.search : ''),
    );
    return params.get('engine') === 'babylon';
  } catch {
    return false;
  }
}

export const ENGINE_QUERY_KEY = 'engine';
export const ENGINE_BABYLON_VALUE = 'babylon';
export const ENGINE_KONVA_VALUE = 'konva';
