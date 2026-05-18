/**
 * Sims-Parity DT-11 — wall slab Konva component.
 *
 * Renders a single wall segment as a Group of:
 *   • Outer stroke (ink #0E0E10).
 *   • Cream inner fill (#F5EFE6 at 60% opacity).
 *   • Optional window cutouts (rectangles drawn cream-light to
 *     suggest a sky beyond, kept rectangular for v1).
 *
 * Additive component — drop into a new <Layer> on the Konva stage
 * behind the placed items. The existing RoomCanvas render-core is
 * untouched (Konva stable-lock 26c144c).
 */

import { Group, Rect } from 'react-konva';

export interface WallSlabProps {
  /** Slab position in canvas px (top-left). */
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  /** Optional windows in slab-local coords. */
  windows?: Array<{ xPx: number; yPx: number; widthPx: number; heightPx: number }>;
}

export function WallSlab(props: WallSlabProps): JSX.Element {
  const { xPx, yPx, widthPx, heightPx, windows = [] } = props;
  return (
    <Group x={xPx} y={yPx} listening={false}>
      <Rect
        x={0}
        y={0}
        width={widthPx}
        height={heightPx}
        fill="rgba(245, 239, 230, 0.6)"
        stroke="rgb(14, 14, 16)"
        strokeWidth={1.5}
      />
      {windows.map((w, i) => (
        <Rect
          key={i}
          x={w.xPx}
          y={w.yPx}
          width={w.widthPx}
          height={w.heightPx}
          fill="rgba(245, 239, 230, 0.95)"
          stroke="rgba(192, 166, 126, 0.7)"
          strokeWidth={1.5}
        />
      ))}
    </Group>
  );
}
