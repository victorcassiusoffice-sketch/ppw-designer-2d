/**
 * The orientation law (2026-09-17), as a module both `scripts/orient-apply.mjs` and the product
 * engine use. A photo-generated body faces whichever way the photo was taken; the plan's art puts
 * each machine's "head" (console, screen, handlebars, weight tower) on a known side at rotation 0.
 * The fit turns a body by modelFrontYaw + swapYaw + frontEdgeYaw; this tries the four fronts and
 * keeps the one whose rotated head vector best matches the art.
 */

/** Where the plan's top-down art shows the head at rotation 0. Read off the art 2026-09-17. */
export const ART_HEAD = {
  'k1-nordictrack-2450': 'right',
  'k1-nordictrack-tour-de-france': 'right',
  'k1-nordictrack-gx10': 'right',
  'k1-schwinn-700ic': 'left',
  'k1-proform-carbon-tl': 'right',
  'k1-nordictrack-x16': 'right',
  'k1-nordictrack-rw900': 'left',
  'k1-vision-t600-03': 'right',
  'k1-vision-t600e-02': 'left',
  'k1-matrix-mg-glute': 'left',
  'k1-matrix-versa-adabd': 'left',
  'k1-vision-smith': 'top',
  'k1-bowflex-xtreme-2se': 'top',
};

export const EPS = 1e-9;
export const FRONT_YAW = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };
export const EDGE_YAW = { bottom: 0, top: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
/** Plan directions as three-frame xz vectors: right = +x, left = −x, bottom (plan +y) = +z, top = −z. */
export const ART_VEC = { right: [1, 0], left: [-1, 0], bottom: [0, 1], top: [0, -1] };

export function rotY(v, a) {
  const [x, z] = v;
  return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
}

/** The fit's swap decision for `lengthAxis: auto`: by aspect, exactly as `fitToSize` does it. */
export function swappedFor({ ex, ez, lengthCm, widthCm, lengthAxis = 'auto' }) {
  if (lengthAxis === 'x') return false;
  if (lengthAxis === 'z') return true;
  const catalogAspect = lengthCm / widthCm;
  return Math.abs(Math.log(ez / ex / catalogAspect)) + EPS < Math.abs(Math.log(ex / ez / catalogAspect));
}

/**
 * The head's centroid in the body's own frame (x, z as fractions of the half-extents) → the
 * `modelFront` that lands it where the art puts it. `weak` means the body has no clear head
 * (a symmetric product); the caller keeps the default and checks the render.
 */
export function pickModelFront({ head, art, swapped, frontEdge = 'bottom' }) {
  const want = ART_VEC[art];
  if (!want) throw new Error(`unknown art side ${art}`);
  const swapYaw = swapped ? Math.PI / 2 : 0;
  const fe = EDGE_YAW[frontEdge] ?? 0;
  let best = null;
  for (const front of Object.keys(FRONT_YAW)) {
    const r = rotY([head.x, head.z], FRONT_YAW[front] + swapYaw + fe);
    const score = r[0] * want[0] + r[1] * want[1];
    if (!best || score > best.score) best = { front, score, rotated: r };
  }
  const weak = Math.hypot(head.x, head.z) < 0.15;
  return { ...best, weak };
}

/**
 * Where a body's head lands on the plan for a given `modelFront` (the check, not the choice):
 * the rotated head vector's dot product with the art side. ≥ 0.5 of its length counts as agreeing.
 */
export function headAgreesWithArt({ head, art, modelFront = '+z', swapped, frontEdge = 'bottom' }) {
  const want = ART_VEC[art];
  if (!want) return { agrees: false, score: 0, reason: `unknown art side ${art}` };
  const r = rotY([head.x, head.z], (FRONT_YAW[modelFront] ?? 0) + (swapped ? Math.PI / 2 : 0) + (EDGE_YAW[frontEdge] ?? 0));
  const len = Math.hypot(r[0], r[1]);
  const score = len < EPS ? 0 : (r[0] * want[0] + r[1] * want[1]) / len;
  return { agrees: score >= 0.5, score, weak: len < 0.15 };
}
