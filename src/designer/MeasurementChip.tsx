/**
 * MeasurementChip — the live dimension readout while drawing (Vic
 * 2026-08-25, complaint 3: *"the live measurement numbers are too small
 * to read"*).
 *
 * The old readouts were `fontSize={11}` and `fontSize={13}` **in Konva
 * space**, so they were scaled by the Stage transform along with the room.
 * At the 0.3 minimum zoom an 11 px label rendered at ~3 px on screen —
 * genuinely unreadable, and the number is the whole point of drawing to a
 * measurement.
 *
 * This chip is authored in SCREEN px and divides every dimension by the
 * current viewport scale, so it renders at a constant
 * `MEASURE_MIN_SCREEN_PX` no matter how far in or out the user has zoomed.
 * Blueprint register: gold numerals on a near-black plate, matching the
 * dimension callouts in `Design/Designer.jpeg`.
 *
 * Konva-only — must be rendered inside a `<Layer>`.
 */
import { Group, Rect, Text } from 'react-konva';
import {
  MEASURE_BG,
  MEASURE_BG_OPACITY,
  MEASURE_TEXT,
  measureChipMetrics,
} from './blueprintTheme';

export interface MeasurementChipProps {
  /** Chip centre, in Konva/stage units (metres × pxPerMetre). */
  x: number;
  y: number;
  /** Already-formatted, e.g. `"3.50 m"`. */
  text: string;
  /** Current viewport scale — the chip divides by this to stay screen-sized. */
  scale: number;
  /**
   * Nudge upward in SCREEN px so a chip can clear the line it measures.
   * Scale-corrected like everything else.
   */
  offsetYPx?: number;
  /** Emphasised (brighter plate + hairline) — used for the live segment. */
  live?: boolean;
}

export function MeasurementChip({
  x,
  y,
  text,
  scale,
  offsetYPx = 0,
  live = false,
}: MeasurementChipProps): JSX.Element {
  const { fontSize, halfWidth, height, cornerRadius } = measureChipMetrics(scale);
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const dy = offsetYPx / safeScale;
  return (
    <Group x={x} y={y + dy} listening={false}>
      <Rect
        x={-halfWidth}
        y={-height / 2}
        width={halfWidth * 2}
        height={height}
        cornerRadius={cornerRadius}
        fill={MEASURE_BG}
        opacity={live ? Math.min(1, MEASURE_BG_OPACITY + 0.12) : MEASURE_BG_OPACITY}
        stroke={live ? MEASURE_TEXT : undefined}
        strokeWidth={live ? 1 / safeScale : 0}
      />
      <Text
        x={-halfWidth}
        // Konva anchors text at its top edge; centre it on the plate.
        y={-fontSize * 0.58}
        width={halfWidth * 2}
        text={text}
        fontSize={fontSize}
        fontStyle="bold"
        fontFamily="Inter, sans-serif"
        fill={MEASURE_TEXT}
        align="center"
      />
    </Group>
  );
}
