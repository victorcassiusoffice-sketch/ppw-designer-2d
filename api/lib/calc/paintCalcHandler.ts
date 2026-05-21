/**
 * Tweak 03 (Phase C) — `/api/calc/paint` handler.
 *
 * Per the brief: "API: NEW endpoint `/api/calc/paint` (input: wall_ids[];
 * output: total_litres + product_recs). One additional lambda — verify
 * 12/12 cap (see Master file §Lambda check)."
 *
 * Per `06-Roadmap/skills/vercel_catchall_folding.md`: this folds into
 * an existing router rather than consuming a slot. We add a
 * `/api/calc/:type` discriminator inside `merchants-router.ts` (the
 * cheapest router to extend — capture endpoints already live there).
 * Net Vercel function count stays 11/12 — one slot of headroom.
 *
 * Request shape mirrors the calculator core (`src/lib/paintCalculator.ts`)
 * with a strict whitelist — wall geometry + optional paintId/coats.
 */

import { calculatePaint, type PaintCalcResult } from '../../../src/lib/paintCalculator.js';
import type { WallSegment } from '../../../src/store/wallStore.js';

interface MinimalReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

interface PaintCalcRequest {
  walls: WallSegment[];
  paintId?: string;
  coats?: number;
}

function isPaintCalcRequest(x: unknown): x is PaintCalcRequest {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  if (!Array.isArray(r.walls)) return false;
  for (const w of r.walls) {
    if (!w || typeof w !== 'object') return false;
    const wo = w as Record<string, unknown>;
    if (typeof wo.height_mm !== 'number') return false;
    if (!wo.start || !wo.end) return false;
    const s = wo.start as Record<string, unknown>;
    const e = wo.end as Record<string, unknown>;
    if (typeof s.x_mm !== 'number' || typeof s.y_mm !== 'number') return false;
    if (typeof e.x_mm !== 'number' || typeof e.y_mm !== 'number') return false;
  }
  if (r.paintId !== undefined && typeof r.paintId !== 'string') return false;
  if (r.coats !== undefined && typeof r.coats !== 'number') return false;
  return true;
}

export async function paintCalcHandler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const body = req.body;
  if (!isPaintCalcRequest(body)) {
    res.status(422).json({ error: 'invalid_body', expected: '{ walls: WallSegment[], paintId?: string, coats?: number }' });
    return;
  }
  try {
    const result: PaintCalcResult = calculatePaint({
      walls: body.walls,
      paintId: body.paintId,
      coats: body.coats,
    });
    res.status(200).json({
      total_area_m2: result.total_area_m2,
      litres_per_coat: result.litres_per_coat,
      coats: result.coats,
      litres_total: result.litres_total,
      paint: result.paint
        ? {
            id: result.paint.id,
            name: result.paint.name,
            hex: result.paint.hex,
            coverage_m2_per_litre: result.paint.coverage_m2_per_litre,
            price_per_litre_mur: result.paint.price_per_litre_mur,
          }
        : undefined,
      total_price_mur: result.total_price_mur,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'calc_failed';
    res.status(500).json({ error: 'calc_failed', detail: msg });
  }
}

/**
 * Dispatch for `/api/calc/:type` — the catch-all the merchants-router
 * forwards to. Currently only `paint` is implemented; future types
 * (flooring area, panel m² → sheets) plug in here.
 */
export async function calcDispatch(type: string, req: MinimalReq, res: MinimalRes): Promise<void> {
  if (type === 'paint') {
    return paintCalcHandler(req, res);
  }
  res.status(404).json({ error: 'unknown_calc_type', type });
}
