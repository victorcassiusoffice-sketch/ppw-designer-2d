import { useEffect, useState } from 'react';
import type { Product } from '../data/products.schema';
import { canRenderPlanModel, planModelKey, planModelShadowKey, type PlanShadowDirection } from '../designer/planModel';
import type { PlanModelShadow } from '../lib/topdown/modelSnapshot';

/** Lazy: ordinary empty plans never load Three. One cached bitmap per product,
 * not a live renderer per placed item; dragging and zooming do not regenerate it. */
export function usePlanModelImage(product: Product): HTMLCanvasElement | null {
  const enabled = canRenderPlanModel(product);
  const key = planModelKey(product);
  const [result, setResult] = useState<{ key: string; image: HTMLCanvasElement | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void import('../lib/topdown/modelSnapshot').then(module => module.planModelSnapshot(product))
      .then(image => { if (active) setResult({ key, image }); })
      .catch(() => { /* Existing art remains usable if WebGL is unavailable. */ });
    return () => { active = false; };
    // The key contains every product field consumed by the renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  return result?.key === key ? result.image : null;
}

/** One reusable, transparent cast-shadow photograph per shape, orientation and
 * light direction. Moving/zooming never rerenders; a new angle does. */
export function usePlanModelShadow(product: Product, rotationDeg: number, direction: PlanShadowDirection, enabled = true): PlanModelShadow | null {
  const supported = enabled && canRenderPlanModel(product);
  const key = planModelShadowKey(product, rotationDeg, direction);
  const [result, setResult] = useState<{ key: string; shadow: PlanModelShadow | null } | null>(null);
  useEffect(() => {
    if (!supported) return;
    let active = true;
    void import('../lib/topdown/modelSnapshot').then(module => module.planModelShadowSnapshot(product, rotationDeg, direction))
      .then(shadow => { if (active) setResult({ key, shadow }); }).catch(() => {});
    return () => { active = false; };
    // Stable key contains the complete rendering inputs; placement is absent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, key]);
  return supported && result?.key === key ? result.shadow : null;
}
