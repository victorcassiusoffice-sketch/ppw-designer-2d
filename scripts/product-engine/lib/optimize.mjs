/**
 * Two served copies of a raw body: the laptop one (about 20,000 triangles, WebP 1024/512, Draco)
 * and the phone one (about 5,000 triangles, WebP 512/256, Draco). Reuses `optimizeGlb` from
 * scripts/optimize-models.mjs, the September pipeline.
 */
import fs from 'node:fs';
import { optimizeGlb } from '../../optimize-models.mjs';

/** The budgets the gate checks. Bytes are the served file on disk; triangles as read back from it. */
export const BUDGETS = {
  served: { target: 20000, triangles: 25000, bytes: 350 * 1024, base: 1024, mr: 512, error: 0.001 },
  phone: { target: 5000, triangles: 7500, bytes: 150 * 1024, base: 512, mr: 256, error: 0.02 },
};

export async function makeCopies(rawPath, servedPath, phonePath) {
  const served = await optimizeGlb(rawPath, servedPath, { target: BUDGETS.served.target, base: BUDGETS.served.base, mr: BUDGETS.served.mr, error: BUDGETS.served.error });
  const phone = await optimizeGlb(rawPath, phonePath, { target: BUDGETS.phone.target, base: BUDGETS.phone.base, mr: BUDGETS.phone.mr, error: BUDGETS.phone.error });
  return {
    served: { path: servedPath, bytes: fs.statSync(servedPath).size, triangles: Math.round(served.triangles), rawBytes: served.inBytes },
    phone: { path: phonePath, bytes: fs.statSync(phonePath).size, triangles: Math.round(phone.triangles) },
  };
}

export function withinBudget(copy, budget) {
  return { triangles: copy.triangles <= budget.triangles, bytes: copy.bytes <= budget.bytes };
}
