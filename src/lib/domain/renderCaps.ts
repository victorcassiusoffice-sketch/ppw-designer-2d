/**
 * Render-capability probes (DESIGNER-EXPANSION P5).
 *
 * The per-domain renderers lazy-degrade: a Konva canvas / WebGL mirror only
 * mounts where the browser can actually paint it. Headless test runners
 * (jsdom / node) have no 2D canvas or WebGL context, so these guards let the
 * components render a deterministic SVG/DOM fallback instead of throwing —
 * which is exactly the "guarded fallback when WebGL/headless unavailable"
 * the P5 gate requires.
 *
 * Both probes are defensive (wrapped in try/catch) and SSR-safe (no `document`
 * → returns false). They also short-circuit under jsdom: jsdom has no canvas
 * backend and *emits a console error* if `getContext` is called, so we detect
 * it by user-agent and return false WITHOUT touching `getContext` — keeping
 * the headless fallback path noise-free for the render gate.
 */

/** True under a jsdom test runner (no real canvas/WebGL backend). */
function isJsdom(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('jsdom')
  );
}

/** True when a 2D canvas context is obtainable (real browser; not jsdom/node). */
export function hasCanvas2d(): boolean {
  try {
    if (typeof document === 'undefined' || isJsdom()) return false;
    const canvas = document.createElement('canvas');
    return typeof canvas.getContext === 'function' && canvas.getContext('2d') != null;
  } catch {
    return false;
  }
}

/** True when a WebGL context is obtainable. False in jsdom/node + on GL-less hosts. */
export function hasWebGL(): boolean {
  try {
    if (typeof document === 'undefined' || isJsdom()) return false;
    const canvas = document.createElement('canvas');
    if (typeof canvas.getContext !== 'function') return false;
    const gl =
      canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    return gl != null;
  } catch {
    return false;
  }
}
