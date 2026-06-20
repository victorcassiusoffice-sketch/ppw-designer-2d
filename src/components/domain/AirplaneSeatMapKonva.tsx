/**
 * AirplaneSeatMapKonva — the react-konva painter for the cabin seat-map
 * (DESIGNER-EXPANSION P5).
 *
 * Split out from `AirplaneSeatMapCanvas` and loaded ONLY via dynamic import in
 * a canvas-capable browser. This isolates the static `react-konva` import so it
 * never enters a headless test's module graph (konva's node build requires the
 * native `canvas` package, which is intentionally NOT a dependency). The 2D
 * boot therefore never regresses and the SVG fallback stays dependency-free.
 */
import { Stage, Layer, Rect } from 'react-konva';
import type { SeatMap } from '../../lib/domain/seatMap';

const EMPTY_FILL = '#f4f6f8';
const EMPTY_STROKE = '#d8dde3';
const SEAT_FILL = '#fff7e0';
const SEAT_STROKE = '#c9a227';

export interface AirplaneSeatMapKonvaProps {
  seatMap: SeatMap;
  filledCellIds?: ReadonlySet<string>;
}

export default function AirplaneSeatMapKonva({
  seatMap,
  filledCellIds,
}: AirplaneSeatMapKonvaProps): JSX.Element {
  return (
    <Stage
      width={seatMap.widthPx}
      height={seatMap.heightPx}
      data-testid="airplane-seatmap-stage"
    >
      <Layer>
        {seatMap.cells.map((cell) => {
          const filled = filledCellIds?.has(cell.id) ?? false;
          return (
            <Rect
              key={cell.id}
              x={cell.xPx}
              y={cell.yPx}
              width={cell.sizePx}
              height={cell.sizePx}
              cornerRadius={4}
              fill={filled ? SEAT_FILL : EMPTY_FILL}
              stroke={filled ? SEAT_STROKE : EMPTY_STROKE}
              strokeWidth={1}
            />
          );
        })}
      </Layer>
    </Stage>
  );
}
