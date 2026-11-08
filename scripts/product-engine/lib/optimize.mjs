/**
 * Two served copies of a raw body: the laptop one (about 20,000 triangles, WebP 1024/512, Draco)
 * and the phone one (about 5,000 triangles, WebP 512/256, Draco). Reuses `optimizeGlb` from
 * scripts/optimize-models.mjs, the September pipeline.
 */
import fs from 'node:fs';
import { optimizeGlb } from '../../optimize-models.mjs';

/** The budgets the gate checks. Bytes are the served file on disk; triangles as read back from it. */
export const BUDGETS = {
  // `error` is the simplifier's first bound; it loosens in steps up to `maxError` until the count
  // is within 15 % of `target` (a 500k-triangle Hunyuan body needs that; most bodies never do).
  served: { target: 20000, triangles: 25000, bytes: 350 * 1024, base: 1024, mr: 512, error: 0.001, maxError: 0.02 },
  // The phone limit is 10,000: a dense body with many separate shells (Hunyuan3D v3) has a floor
  // near 8,500 triangles that no error bound passes; 10,000 × 20 items is still light for a phone.
  phone: { target: 5000, triangles: 10000, bytes: 150 * 1024, base: 512, mr: 256, error: 0.02, maxError: 0.2 },
};

export async function makeCopies(rawPath, servedPath, phonePath) {
  const opts = (b) => ({ target: b.target, base: b.base, mr: b.mr, error: b.error, maxError: b.maxError });
  const served = await optimizeGlb(rawPath, servedPath, opts(BUDGETS.served));
  const phone = await optimizeGlb(rawPath, phonePath, opts(BUDGETS.phone));
  return {
    served: { path: servedPath, bytes: fs.statSync(servedPath).size, triangles: Math.round(served.triangles), rawBytes: served.inBytes, passes: served.passes },
    phone: { path: phonePath, bytes: fs.statSync(phonePath).size, triangles: Math.round(phone.triangles), passes: phone.passes },
  };
}

export function withinBudget(copy, budget) {
  return { triangles: copy.triangles <= budget.triangles, bytes: copy.bytes <= budget.bytes };
}
