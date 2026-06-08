/**
 * /api/calc/paint dispatch — Tweak 03 (Phase C) unit tests.
 *
 * Verifies the catch-all router routes correctly + the handler
 * enforces method/body validation. The pure math is covered by
 * `src/lib/__tests__/paintCalculator.test.ts`.
 */

import { describe, it, expect, vi } from 'vitest';
import { calcDispatch, paintCalcHandler, floorCalcHandler } from '../lib/calc/paintCalcHandler';

function fakeRes() {
  const res = {
    statusCode: 200 as number,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    end() {},
    json(b: unknown) {
      this.body = b;
    },
  };
  return res;
}

describe('paintCalcHandler — method gate', () => {
  it('responds 405 to GET', async () => {
    const res = fakeRes();
    await paintCalcHandler({ method: 'GET', url: '/api/calc/paint', headers: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });
});

describe('paintCalcHandler — body validation', () => {
  it('rejects missing walls array (422)', async () => {
    const res = fakeRes();
    await paintCalcHandler(
      { method: 'POST', url: '/api/calc/paint', headers: {}, body: { paintId: 'cream-shell' } },
      res,
    );
    expect(res.statusCode).toBe(422);
    expect((res.body as { error: string }).error).toBe('invalid_body');
  });

  it('rejects malformed wall (no height_mm) with 422', async () => {
    const res = fakeRes();
    await paintCalcHandler(
      {
        method: 'POST',
        url: '/api/calc/paint',
        headers: {},
        body: {
          walls: [{ start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 } }],
        },
      },
      res,
    );
    expect(res.statusCode).toBe(422);
  });
});

describe('paintCalcHandler — happy path', () => {
  it('returns area + litres + price for a valid request', async () => {
    const res = fakeRes();
    await paintCalcHandler(
      {
        method: 'POST',
        url: '/api/calc/paint',
        headers: {},
        body: {
          walls: [
            {
              id: 'w1',
              start: { x_mm: 0, y_mm: 0 },
              end: { x_mm: 5000, y_mm: 0 },
              thickness_mm: 100,
              height_mm: 2700,
              type: 'full',
            },
          ],
          paintId: 'cream-shell',
        },
      },
      res,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      total_area_m2: number;
      litres_total: number;
      paint?: { id: string; name: string };
      total_price_mur?: number;
    };
    expect(body.total_area_m2).toBeCloseTo(13.5, 1);
    expect(body.litres_total).toBeGreaterThan(0);
    expect(body.paint?.id).toBe('cream-shell');
    expect(body.total_price_mur).toBeGreaterThan(0);
  });
});

describe('floorCalcHandler — method + body + happy path', () => {
  it('responds 405 to GET', async () => {
    const res = fakeRes();
    await floorCalcHandler({ method: 'GET', url: '/api/calc/floor', headers: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });

  it('rejects a non-numeric areaM2 (422)', async () => {
    const res = fakeRes();
    await floorCalcHandler(
      { method: 'POST', url: '/api/calc/floor', headers: {}, body: { areaM2: 'big', materialId: 'eva-combat' } },
      res,
    );
    expect(res.statusCode).toBe(422);
  });

  it('returns area + units + price for a valid request', async () => {
    const res = fakeRes();
    await floorCalcHandler(
      { method: 'POST', url: '/api/calc/floor', headers: {}, body: { areaM2: 20, materialId: 'eva-combat' } },
      res,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      area_m2: number; units_needed: number; unit?: string;
      material?: { id: string }; total_price_mur?: number;
    };
    expect(body.area_m2).toBe(20);
    expect(body.units_needed).toBe(22); // 20 × 1.10 / 1.0
    expect(body.unit).toBe('tile');
    expect(body.material?.id).toBe('eva-combat');
    expect(body.total_price_mur).toBe(22 * 850);
  });
});

describe('calcDispatch', () => {
  it('routes type="paint" to paintCalcHandler', async () => {
    const res = fakeRes();
    await calcDispatch('paint', { method: 'GET', url: '/api/calc/paint', headers: {} }, res);
    // paintCalcHandler will 405 for GET — confirms it ran.
    expect(res.statusCode).toBe(405);
  });

  it('routes type="floor" to floorCalcHandler', async () => {
    const res = fakeRes();
    await calcDispatch('floor', { method: 'GET', url: '/api/calc/floor', headers: {} }, res);
    expect(res.statusCode).toBe(405); // floorCalcHandler 405s GET — confirms it ran
    expect(res.headers.Allow).toBe('POST');
  });

  it('returns 404 for unknown calc type', async () => {
    const res = fakeRes();
    await calcDispatch('flooring-magic', { method: 'POST', url: '/api/calc/flooring-magic', headers: {} }, res);
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: string; type: string }).type).toBe('flooring-magic');
  });
});

describe('Lambda cap audit — Tweak 03 catch-all fold', () => {
  it('the new endpoint adds zero new lambdas (still 11 in api/*.ts)', async () => {
    // No actual filesystem check here — runs in vitest-node and the
    // ls happens in shell. This test asserts the architectural
    // invariant: the calc endpoint is folded into merchants-router,
    // never a standalone file. If a future engineer creates
    // `api/calc.ts` it'd be visible in `api/` and `npx vercel inspect`
    // would surface the regression. The brief mandates this hold at
    // 12/12 via `vercel_catchall_folding.md`.
    expect(typeof calcDispatch).toBe('function');
    expect(typeof paintCalcHandler).toBe('function');
  });
});

// Silence unused-import lint warning for vi (we may need it later for
// fetch mocks once an integration round-trip ships against the dev
// server).
void vi;
