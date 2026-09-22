import { Group, Line } from 'react-konva';
import { wallFinishHighlight, wallPaintBand } from '../designer/wallFinishPlan';
import { sheenOfFinish } from '../data/wallPaints';
import type { Vertex } from '../lib/geometry';

export function PlanWallPaint({ a, b, hex, finish, width, offset = 0 }: {
  a: Vertex; b: Vertex; hex: string; finish?: string; width: number; offset?: number;
}): JSX.Element | null {
  const points = wallPaintBand(a, b, width, offset);
  if (!points.length) return null;
  return (
    <Group name={`wall-paint-band wall-paint-${finish ?? 'unknown'}`} listening={false}>
      <Line points={points} closed fill={hex} />
      {sheenOfFinish(finish) > 0 && (
        <Line points={points} closed
          fillLinearGradientStartPoint={a}
          fillLinearGradientEndPoint={b}
          fillLinearGradientColorStops={wallFinishHighlight(finish)} />
      )}
    </Group>
  );
}
