/**
 * P3-2 — room estimate panel (beta, flag-gated via ?paint=1).
 *
 * Two zones in one panel:
 *   • Paint    — actual property painted faces → litres → purchasable tins.
 *   • Flooring — floor area (active room polygon) → tiles/rolls + MUR price.
 *
 * Paint shares the cart and /api/calc/paint mode=property engine. Flooring
 * shows placed material plus an explicitly hypothetical whole-room calculator.
 * Self-contained fixed-position card so it can't disturb
 * the locked Konva render core. OFF by default — see `paintEstimateFlag.ts`.
 * Visual sign-off + the product decision to make it default-on are [VIC-VERIFY].
 */
import { useMemo, useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { polygonArea } from '../lib/geometry';
import { deriveWallPaintOrders } from '../designer/wallPaintCalc';
import { DEFAULT_WALL_HEIGHT_M } from '../data/wallPaints';
import { PaintCoatsControl } from './PaintCoatsControl';
import './wallSurfaceOptions.css';
import { calculateFloor } from '../lib/floorCalculator';
import { FLOOR_MATERIALS, findFloorMaterialById } from '../data/floorMaterials';
// Per-tile floors laid with the Floor tool price by TILES TO ORDER, not by area (Vic 2026-08-28).
import { roomFloorOrders } from '../designer/floorTiles';
import { usePropertyStore } from '../store/propertyStore';

const fmtMur = (n: number) => `MUR ${Math.round(n).toLocaleString('en-MU')}`;

function PaintSection() {
  const property = usePropertyStore(s => s.property);
  const orders = useMemo(() => deriveWallPaintOrders(property, property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M), [property]);

  return (
    <section data-testid="paint-section">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-ppw-slate">Painted walls · whole building</h3>
      <PaintCoatsControl />
      {orders.length === 0 ? <p className="text-[11px] text-ppw-slate">Apply a paint to a wall to see the same whole-tin estimate as your cart.</p>
        : orders.map(order => <div className="mt-2 text-[11px]" key={order.key}>
          <strong>{order.paint.name}{order.isPrimer ? ' · primer' : ''}</strong>
          <p>{order.areaM2.toFixed(1)} m² · {order.coats} coat{order.coats === 1 ? '' : 's'} · {order.wastePct}% extra</p>
          <p><span data-testid="paint-litres">{order.litres.toFixed(1)} L</span> needed → {order.fill.tins.map(tin => `${tin.count} × ${tin.sizeL} L`).join(' + ')}</p>
          <strong data-testid="paint-price">{fmtMur(order.fill.totalMur)}</strong>
        </div>)}
    </section>
  );
}

function FloorSection() {
  const polygon = useDesignStore((s) => s.polygon);
  const areaM2 = useMemo(() => polygonArea(polygon), [polygon]);

  // The ACTUAL laid floor, if this room has one. Distinct from the
  // hypothetical calculator below, which answers "what if the whole room
  // were material X" and stays the right tool for sheet goods.
  const activeRoom = usePropertyStore((st) =>
    st.property.rooms.find((r) => r.id === st.property.activeRoomId),
  );
  const paintedLines = useMemo(
    () => (activeRoom ? roomFloorOrders(activeRoom) : []),
    [activeRoom],
  );
  const [materialId, setMaterialId] = useState<string>(FLOOR_MATERIALS[0]?.id ?? '');
  const result = useMemo(
    () => calculateFloor({ areaM2, materialId: materialId || undefined }),
    [areaM2, materialId],
  );
  const unitLabel = result.units_needed === 1 ? (result.unit ?? 'unit') : `${result.unit ?? 'unit'}s`;

  return (
    <section data-testid="floor-section" className="mt-3 border-t border-ppw-stone pt-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-ppw-slate">Flooring (floor)</h3>
      {paintedLines.length > 0 && (
        <div className="mb-2 rounded border border-ppw-teal/40 bg-ppw-mist p-2" data-testid="painted-floor-order">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ppw-slate">
            Floor
          </p>
          {paintedLines.map((line) => {
            const m = findFloorMaterialById(line.materialId);
            if (!m) return null;
            const total = line.order.unitsToOrder * m.price_per_unit_mur;
            return (
              <div key={line.materialId} className="mt-1 text-[11px]">
                <span className="font-semibold text-ppw-ink">{m.name}</span>
                <br />
                {/* Vic 2026-08-28: the quote is built on TILES TO ORDER -
                    whole purchasable units, what K1 ships in boxes - with
                    covered m2 alongside as context. A customer billed for
                    an area but sent a tile count cannot reconcile the two. */}
                <span data-testid={`painted-units-${line.materialId}`} className="font-semibold">
                  {line.order.unitsToOrder} {line.order.unitsToOrder === 1 ? m.unit : `${m.unit}s`}
                </span>
                <span className="opacity-70">
                  {' '}to order · {line.order.wholeTiles} whole
                  {line.order.cutTiles > 0 ? ` · ${line.order.cutTiles} cut` : ''}
                </span>
                <br />
                <span className="opacity-70">covers ~{line.order.coveredM2} m²</span>
                {' · '}
                <span className="font-bold text-ppw-teal" data-testid={`painted-price-${line.materialId}`}>
                  {fmtMur(total)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {areaM2 <= 0 ? (
        <p className="text-[11px] text-ppw-slate">Define a room to estimate flooring.</p>
      ) : (
        <>
          <p className="text-[11px] text-ppw-slate">
            Floor area: <span className="font-semibold text-ppw-ink">{result.area_m2.toFixed(1)} m²</span>
            <span className="ml-1 opacity-70">(+{result.waste_pct}% waste)</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {FLOOR_MATERIALS.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.name}
                aria-label={m.name}
                aria-pressed={materialId === m.id}
                onClick={() => setMaterialId(m.id)}
                className={`h-6 w-6 rounded border-2 ${materialId === m.id ? 'border-ppw-teal' : 'border-ppw-stone'}`}
                style={{ background: m.hex }}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px]">
            Material needed:{' '}
            <span className="font-semibold" data-testid="floor-units">{result.units_needed} {unitLabel}</span>
          </p>
          {result.material && result.total_price_mur !== undefined && (
            <p className="text-[11px]">
              {result.material.name} ·{' '}
              <span className="font-bold text-ppw-teal" data-testid="floor-price">{fmtMur(result.total_price_mur)}</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function RoomEstimatePanel(): JSX.Element {
  return (
    <div
      data-testid="room-estimate-panel"
      className="pointer-events-auto absolute bottom-4 left-4 z-20 w-64 rounded-lg border border-ppw-stone bg-white/95 p-3 text-ppw-ink shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide">Room estimate</h2>
        <span className="rounded bg-ppw-stone px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ppw-slate">beta</span>
      </div>
      <PaintSection />
      <FloorSection />
    </div>
  );
}
