/**
 * P3-2 — paint / flooring estimate panel (beta, flag-gated via ?paint=1).
 *
 * Reads the current room's walls from `wallStore`, lets the customer pick an
 * eco-paint colour + coats, and shows the litres needed + product SKU + price
 * using the live `calculatePaint` engine (the same maths behind /api/calc/paint).
 *
 * Self-contained fixed-position card so it can't disturb the locked Konva
 * render core. OFF by default — see `paintEstimateFlag.ts`. Visual sign-off +
 * the product decision to make it default-on are [VIC-VERIFY].
 */
import { useMemo, useState } from 'react';
import { useWallStore } from '../store/wallStore';
import { calculatePaint } from '../lib/paintCalculator';
import { ECO_PAINT_PALETTE } from '../data/paintPalette';

export function PaintEstimatePanel(): JSX.Element {
  const walls = useWallStore((s) => s.walls);
  const [paintId, setPaintId] = useState<string>(ECO_PAINT_PALETTE[0]?.id ?? '');
  const [coats, setCoats] = useState<number>(2);

  const result = useMemo(
    () => calculatePaint({ walls, paintId: paintId || undefined, coats }),
    [walls, paintId, coats],
  );

  const fmtMur = (n: number) => `MUR ${Math.round(n).toLocaleString('en-MU')}`;

  return (
    <div
      data-testid="paint-estimate-panel"
      className="pointer-events-auto absolute bottom-4 left-4 z-20 w-64 rounded-lg border border-ppw-stone bg-white/95 p-3 text-ppw-ink shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide">Paint estimate</h2>
        <span className="rounded bg-ppw-stone px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ppw-slate">beta</span>
      </div>

      {walls.length === 0 ? (
        <p className="text-[11px] text-ppw-slate">Draw walls to estimate paint.</p>
      ) : (
        <>
          <p className="text-[11px] text-ppw-slate">
            Wall area: <span className="font-semibold text-ppw-ink">{result.total_area_m2.toFixed(1)} m²</span>
          </p>

          <label className="mt-2 block text-[10px] font-semibold uppercase text-ppw-slate">Colour</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {ECO_PAINT_PALETTE.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={paintId === p.id}
                onClick={() => setPaintId(p.id)}
                className={`h-6 w-6 rounded-full border-2 ${paintId === p.id ? 'border-ppw-teal' : 'border-ppw-stone'}`}
                style={{ background: p.hex }}
              />
            ))}
          </div>

          <label className="mt-2 block text-[10px] font-semibold uppercase text-ppw-slate">
            Coats: {coats}
          </label>
          <input
            type="range"
            min={1}
            max={3}
            value={coats}
            onChange={(e) => setCoats(Number(e.target.value))}
            className="w-full"
            data-testid="paint-coats"
          />

          <div className="mt-2 border-t border-ppw-stone pt-2 text-[11px]">
            <p>
              Paint needed:{' '}
              <span className="font-semibold" data-testid="paint-litres">{result.litres_total} L</span>
            </p>
            {result.paint && result.total_price_mur !== undefined && (
              <p className="mt-0.5">
                {result.paint.name} ·{' '}
                <span className="font-bold text-ppw-teal" data-testid="paint-price">{fmtMur(result.total_price_mur)}</span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
