/**
 * AirplaneCabinFlow — free-place cabin layout flow (DESIGNER-EXPANSION P4).
 *
 * The airplane domain uses `placement: 'free'`: the user picks a cabin
 * monument from the catalog (`DomainCatalogStrip`) and places it onto the
 * fuselage section's seat-grid floor. The grid dimensions come from the P3
 * `getDefaultSpace('airplane')` `FuselageSectionSpace.floorGrid`.
 *
 * This is the config FLOW (P4): selection + free placement onto the template
 * space, held in local flow state. The real Konva 2D seat-map renderer is P5
 * (this DOM grid is the interaction surface, deliberately decoupled from the
 * Konva stable-lock core so P5 can mirror it without a rewrite).
 */
import { useMemo, useState } from 'react';
import { getDefaultSpace } from '../../lib/domain';
import type { FuselageSectionSpace } from '../../lib/domain';
import { getProductById } from '../../data/products';
import { DomainCatalogStrip } from './DomainCatalogStrip';
import { AirplaneSeatMapCanvas } from './AirplaneSeatMapCanvas';
import { DomainMirror3D } from './DomainMirror3D';

/** A placement = which product sits on which grid cell. */
type Placements = Record<string, string>; // cellKey "r-c" -> productId

function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function AirplaneCabinFlow(): JSX.Element {
  const space = useMemo(
    () => getDefaultSpace('airplane') as FuselageSectionSpace,
    [],
  );
  const { rows, cols } = space.floorGrid;

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placements>({});

  function placeOnCell(row: number, col: number): void {
    if (!selectedProductId) return;
    setPlacements((p) => ({ ...p, [cellKey(row, col)]: selectedProductId }));
  }

  const placedCount = Object.keys(placements).length;

  // Seat-map cell ids use the `r{row}-c{col}` form; placement keys are
  // `{row}-{col}` — map across so filled seats tint on the 2D render.
  const filledSeatIds = useMemo(
    () => new Set(Object.keys(placements).map((k) => `r${k}`.replace('-', '-c'))),
    [placements],
  );

  return (
    <section
      data-testid="airplane-cabin-flow"
      className="airplane-cabin-flow"
      aria-label="Airplane cabin layout"
    >
      <header className="airplane-cabin-head">
        <h3>Cabin section</h3>
        <p className="airplane-cabin-dims" data-testid="airplane-cabin-dims">
          {space.lengthCm} cm × {space.crossSectionWidthCm} cm · {rows}×{cols} grid
        </p>
        <p className="airplane-cabin-count" data-testid="airplane-placed-count">
          {placedCount} placed
        </p>
      </header>

      <DomainCatalogStrip
        domain="airplane"
        onPick={setSelectedProductId}
        selectedProductId={selectedProductId}
      />

      {/* P5 — 2D Konva top-down seat-map render (SVG fallback when headless). */}
      <div className="airplane-seatmap-wrap" data-testid="airplane-seatmap-wrap">
        <AirplaneSeatMapCanvas filledCellIds={filledSeatIds} />
      </div>

      {/* P5 — procedural 3D cabin mirror (guarded SVG projection). */}
      <DomainMirror3D domain="airplane" />

      <div
        className="airplane-seat-grid"
        data-testid="airplane-seat-grid"
        role="grid"
        aria-label="Cabin floor grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '4px',
        }}
      >
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const key = cellKey(r, c);
            const productId = placements[key];
            const product = productId ? getProductById(productId) : undefined;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                data-testid={`airplane-cell-${key}`}
                data-filled={productId ? 'true' : 'false'}
                className={productId ? 'airplane-cell is-filled' : 'airplane-cell'}
                onClick={() => placeOnCell(r, c)}
                title={product?.name ?? 'Empty'}
              >
                {productId ? '•' : ''}
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}
