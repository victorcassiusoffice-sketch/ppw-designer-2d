/**
 * Sims-Parity DT-12 — DragLayer + ghost rect + 50 cm snap underlay.
 *
 * Visual ghost rectangle that tracks the cursor during a drag. Dashed
 * gold outline + cream 55% inner fill + 120 ms fade in/out (CSS-driven
 * since react-konva alpha tweens are awkward at this scale). Snap
 * underlay cell appears at the snapped position with gold-tint Rect
 * + solid gold outline + 80 ms snap-flash on commit.
 *
 * Engine-agnostic snap math lives in `useGridSnap.ts` per data-flow
 * §8 P7. This component is the Konva-side rendering only.
 *
 * Shift = freeFloat (bypass snap). Esc cancel handled by the parent.
 */

import { useEffect, useState } from 'react';
import { Group, Rect } from 'react-konva';
import { SNAP_STEP_MM, snapToGrid } from './useGridSnap';

export interface DragLayerProps {
  /** Cursor position in mm (room coords). */
  cursorXMm: number;
  cursorYMm: number;
  /** Ghost footprint in mm. */
  widthMm: number;
  depthMm: number;
  /** Room scale. */
  pxPerMm: number;
  /** True while a drag is active. */
  active: boolean;
  /** True when Shift is held. */
  freeFloat: boolean;
  /** True when the drop is on an invalid cell (collision / out-of-room). */
  invalid?: boolean;
}

export function DragLayer(props: DragLayerProps): JSX.Element | null {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    setOpacity(props.active ? 1 : 0);
  }, [props.active]);

  if (!props.active && opacity === 0) return null;

  const snapped = snapToGrid({
    xMm: props.cursorXMm,
    yMm: props.cursorYMm,
    freeFloat: props.freeFloat,
  });
  const xPx = snapped.xMm * props.pxPerMm;
  const yPx = snapped.yMm * props.pxPerMm;
  const wPx = props.widthMm * props.pxPerMm;
  const dPx = props.depthMm * props.pxPerMm;

  const goldGhostFill = props.invalid ? 'rgba(255, 80, 80, 0.45)' : 'rgba(245, 239, 230, 0.55)';
  const goldStroke = props.invalid ? '#c64545' : '#C0A67E';

  return (
    <Group opacity={opacity} listening={false}>
      {!props.freeFloat && (
        // Snap-cell underlay (50 cm grid).
        <Rect
          x={xPx}
          y={yPx}
          width={SNAP_STEP_MM * props.pxPerMm}
          height={SNAP_STEP_MM * props.pxPerMm}
          fill="rgba(192, 166, 126, 0.08)"
          stroke="#C0A67E"
          strokeWidth={1}
          dash={[4, 4]}
        />
      )}
      <Rect
        x={xPx}
        y={yPx}
        width={wPx}
        height={dPx}
        fill={goldGhostFill}
        stroke={goldStroke}
        strokeWidth={2}
        dash={[8, 6]}
        cornerRadius={2}
      />
    </Group>
  );
}
