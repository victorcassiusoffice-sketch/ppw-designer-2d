/**
 * blueprintTheme — measurement legibility + palette contract.
 *
 * Complaint 3 (Vic 2026-08-25): the live measurement numbers while drawing
 * were unreadable. The root cause was that a Konva `fontSize` lives in
 * STAGE space, so the Stage's scale transform shrinks it: at the app's 0.3
 * minimum zoom the old `fontSize={11}` rendered at 3.3 screen px.
 *
 * The fix is `measureFontSize(scale)`, and the property that matters is:
 *
 *     rendered_px === MEASURE_MIN_SCREEN_PX   for every legal scale
 *
 * These tests pin exactly that, plus the guards for a degenerate scale (a
 * Konva Stage can report 0 for one frame during a ResizeObserver race).
 */
import { describe, it, expect } from 'vitest';
import {
  MEASURE_MIN_SCREEN_PX,
  measureChipMetrics,
  measureFontSize,
  isRoomBorderPixel,
  CANVAS_GROUND,
  ROOM_FILL,
  WALL_GOLD,
  WALL_GOLD_BRIGHT,
  GRID_LINE,
} from '../blueprintTheme';

/** Parse `#RRGGBB` into a channel triple for the pixel-scan assertions. */
function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

describe('measureFontSize — screen-space constancy', () => {
  // The app clamps zoom to [MIN_SCALE 0.3, MAX_SCALE 3] (RoomCanvas), so
  // sweep across and past that range.
  const SCALES = [0.3, 0.5, 0.75, 1, 1.5, 2, 2.5, 3];

  it.each(SCALES)('renders at exactly %s× → still MEASURE_MIN_SCREEN_PX on screen', (scale) => {
    const fontSize = measureFontSize(scale);
    // What the user actually sees is fontSize × scale.
    expect(fontSize * scale).toBeCloseTo(MEASURE_MIN_SCREEN_PX, 10);
  });

  it('the rendered size is CONSTANT across every scale (the whole point)', () => {
    const rendered = SCALES.map((s) => measureFontSize(s) * s);
    for (const r of rendered) expect(r).toBeCloseTo(MEASURE_MIN_SCREEN_PX, 10);
    expect(new Set(rendered.map((r) => r.toFixed(6))).size).toBe(1);
  });

  it('is at least 16 screen px — the legibility floor', () => {
    expect(MEASURE_MIN_SCREEN_PX).toBeGreaterThanOrEqual(16);
  });

  it('beats the old fixed fontSize={11} at every zoom below 100%', () => {
    for (const scale of [0.3, 0.5, 0.75]) {
      const old = 11 * scale;
      const now = measureFontSize(scale) * scale;
      expect(now).toBeGreaterThan(old);
    }
  });

  it('honours a custom target', () => {
    expect(measureFontSize(2, 24) * 2).toBeCloseTo(24, 10);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to the target for a degenerate scale (%s)',
    (bad) => {
      expect(measureFontSize(bad as number)).toBe(MEASURE_MIN_SCREEN_PX);
    },
  );
});

describe('measureChipMetrics — the plate scales with its text', () => {
  it('every dimension is proportional to the font size', () => {
    const m = measureChipMetrics(1);
    expect(m.fontSize).toBeCloseTo(MEASURE_MIN_SCREEN_PX, 10);
    expect(m.halfWidth).toBeGreaterThan(m.fontSize);
    expect(m.height).toBeGreaterThan(m.fontSize);
    expect(m.cornerRadius).toBeGreaterThan(0);
  });

  it('renders to identical SCREEN geometry at 0.3× and 3×', () => {
    const lo = measureChipMetrics(0.3);
    const hi = measureChipMetrics(3);
    expect(lo.halfWidth * 0.3).toBeCloseTo(hi.halfWidth * 3, 10);
    expect(lo.height * 0.3).toBeCloseTo(hi.height * 3, 10);
    expect(lo.fontSize * 0.3).toBeCloseTo(hi.fontSize * 3, 10);
  });

  it('is wide enough for a two-decimal metre reading', () => {
    const m = measureChipMetrics(1);
    // "12.34 m" ≈ 7 glyphs; Inter bold averages ~0.55em per glyph.
    expect(m.halfWidth * 2).toBeGreaterThan(m.fontSize * 7 * 0.55);
  });
});

describe('isRoomBorderPixel — the e2e canvas pixel-scan predicate', () => {
  it('matches both gold wall tones', () => {
    expect(isRoomBorderPixel(...rgb(WALL_GOLD))).toBe(true);
    expect(isRoomBorderPixel(...rgb(WALL_GOLD_BRIGHT))).toBe(true);
  });

  it('rejects every other blueprint surface (no false room origin)', () => {
    expect(isRoomBorderPixel(...rgb(CANVAS_GROUND))).toBe(false);
    expect(isRoomBorderPixel(...rgb(ROOM_FILL))).toBe(false);
    expect(isRoomBorderPixel(...rgb(GRID_LINE))).toBe(false);
    // White chrome and the old dark stroke must not read as a wall either.
    expect(isRoomBorderPixel(255, 255, 255)).toBe(false);
    expect(isRoomBorderPixel(14, 27, 31)).toBe(false);
  });

  it('tolerates antialiasing between the two gold tones', () => {
    const [r1, g1, b1] = rgb(WALL_GOLD);
    const [r2, g2, b2] = rgb(WALL_GOLD_BRIGHT);
    const mid: [number, number, number] = [
      Math.round((r1 + r2) / 2),
      Math.round((g1 + g2) / 2),
      Math.round((b1 + b2) / 2),
    ];
    expect(isRoomBorderPixel(...mid)).toBe(true);
  });
});
