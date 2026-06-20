/**
 * AirplaneSeatMapCanvas — 2D top-down cabin seat-map (DESIGNER-EXPANSION P5).
 *
 * The airplane domain's `render.primary2d` is `topdown-2d`. This renders the
 * `buildSeatMap` model. In a canvas-capable browser it lazy-loads the Konva
 * painter (`AirplaneSeatMapKonva`) — the same Stage/Layer/Rect engine the
 * wellness RoomCanvas uses. In a headless / no-canvas environment (jsdom, SSR)
 * it renders a deterministic SVG of the SAME model.
 *
 * The Konva painter is a DYNAMIC import so `react-konva` (whose node build
 * needs the native `canvas` package) never enters a headless test's module
 * graph — keeping the fallback dependency-free and the 2D boot regression-proof
 * (per the P5 "lazy-load … never regresses 2D boot" + guarded-fallback gate).
 */
import { Suspense, lazy, useMemo } from 'react';
import { getDefaultSpace } from '../../lib/domain';
import type { FuselageSectionSpace } from '../../lib/domain';
import { buildSeatMap } from '../../lib/domain/seatMap';
import { hasCanvas2d } from '../../lib/domain/renderCaps';

const AirplaneSeatMapKonva = lazy(() => import('./AirplaneSeatMapKonva'));

export interface AirplaneSeatMapCanvasProps {
  /** Cell ids ("r{row}-c{col}") that hold a placed product → drawn filled. */
  filledCellIds?: ReadonlySet<string>;
}

const EMPTY_FILL = '#f4f6f8';
const EMPTY_STROKE = '#d8dde3';
const SEAT_FILL = '#fff7e0';
const SEAT_STROKE = '#c9a227';

export function AirplaneSeatMapCanvas({
  filledCellIds,
}: AirplaneSeatMapCanvasProps): JSX.Element {
  const seatMap = useMemo(() => {
    const space = getDefaultSpace('airplane') as FuselageSectionSpace;
    return buildSeatMap(space);
  }, []);

  // Canvas-capable browser → lazy Konva painter.
  if (hasCanvas2d()) {
    return (
      <Suspense fallback={<div data-testid="airplane-seatmap-loading" />}>
        <AirplaneSeatMapKonva seatMap={seatMap} filledCellIds={filledCellIds} />
      </Suspense>
    );
  }

  // Headless / no-canvas → SVG fallback of the identical model.
  return (
    <svg
      data-testid="airplane-seatmap-svg"
      role="img"
      aria-label="Cabin seat map"
      width={seatMap.widthPx}
      height={seatMap.heightPx}
      viewBox={`0 0 ${seatMap.widthPx} ${seatMap.heightPx}`}
    >
      {seatMap.cells.map((cell) => {
        const filled = filledCellIds?.has(cell.id) ?? false;
        return (
          <rect
            key={cell.id}
            data-testid={`seatmap-cell-${cell.id}`}
            x={cell.xPx}
            y={cell.yPx}
            width={cell.sizePx}
            height={cell.sizePx}
            rx={4}
            fill={filled ? SEAT_FILL : EMPTY_FILL}
            stroke={filled ? SEAT_STROKE : EMPTY_STROKE}
          />
        );
      })}
    </svg>
  );
}
