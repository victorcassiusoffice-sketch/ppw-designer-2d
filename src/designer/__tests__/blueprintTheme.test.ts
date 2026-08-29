/**
 * blueprintTheme — measurement legibility + the paper palette contract.
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
 * Paper theme (2026-08-29, WP-E): the second half pins the palette the e2e
 * colour predicates and the wall pixel-scan depend on. Walls are the only
 * near-black thing on the plan; everything else must stay out of the
 * `ROOM_BORDER_SCAN` band, INCLUDING things drawn in wall ink at low opacity
 * once they are composited onto paper.
 */
import { describe, it, expect } from 'vitest';
import {
  MEASURE_MIN_SCREEN_PX,
  measureChipMetrics,
  measureFontSize,
  isRoomBorderPixel,
  ROOM_BORDER_SCAN,
  CANVAS_GROUND,
  SITE_FILL,
  SITE_STROKE,
  OUTDOOR_FILL,
  ROOM_FILL,
  ROOM_FILL_ACTIVE,
  WALL_INK,
  WALL_INK_GHOST,
  WALL_SHADOW,
  WALL_SHADOW_BLUR_PX,
  WALL_SHADOW_OFFSET,
  WALL_GOLD,
  WALL_GOLD_BRIGHT,
  WALL_STROKE_PX,
  WALL_INNER_STROKE,
  GRID_LINE,
  GRID_MAJOR_OPACITY,
  GRID_MINOR_OPACITY,
  LABEL_TEXT,
  LABEL_TEXT_MUTED,
  LABEL_HALO,
  DIM_LINE,
  MEASURE_BG,
  MEASURE_BG_OPACITY,
  MEASURE_TEXT,
  SELECT_STROKE,
  HANDLE_FILL,
  DOOR_LEAF,
  DOOR_ARC,
  DOOR_TARGET_WALL,
  GHOST_VALID_FILL,
  GHOST_VALID_STROKE,
  GHOST_INVALID,
  GHOST_INVALID_FILL,
  LIGHT_GLOW_CORE,
  LIGHT_GLOW_EDGE,
  GREENERY_FILL,
  GREENERY_STROKE,
  ITEM_SHADOW,
  DOCK_BG,
  DOCK_BG_RAISED,
  DOCK_BORDER,
  DOCK_TEXT,
  DOCK_TEXT_MUTED,
  DOCK_ACCENT,
} from '../blueprintTheme';

type Rgb = [number, number, number];

/** Parse `#RRGGBB` into a channel triple for the pixel-scan assertions. */
function rgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Parse `rgba(r,g,b,a)` into channels + alpha. */
function rgba(str: string): { rgb: Rgb; a: number } {
  const m = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(str);
  if (!m) throw new Error(`not an rgba() string: ${str}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) };
}

/** Source-over composite of `fg` at `alpha` onto an opaque `bg` — what the canvas actually holds. */
function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as Rgb;
}

/** WCAG relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio. */
function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
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

describe('paper palette — the token contract the e2e colour predicates lean on', () => {
  it('pins the structural colours and the wall geometry', () => {
    expect(WALL_INK).toBe('#2A2926');
    expect(ROOM_FILL).toBe('#F8F5EE');
    expect(ROOM_FILL_ACTIVE).toBe('#FDFBF6');
    expect(CANVAS_GROUND).toBe('#E7E2D8');
    expect(SITE_FILL).toBe('#EFEAE0');
    expect(OUTDOOR_FILL).toBe('#EDE9DE');
    expect(SELECT_STROKE).toBe('#3D8F79');
    expect(HANDLE_FILL).toBe('#3D8F79');
    expect(GHOST_VALID_STROKE).toBe('#3D8F79');
    expect(GHOST_INVALID).toBe('#C9553F');
    expect(DOOR_TARGET_WALL).toBe('#3D8F79');
    expect(WALL_STROKE_PX).toBe(10);
    expect(WALL_SHADOW_BLUR_PX).toBe(14);
    expect(WALL_SHADOW_OFFSET).toEqual({ x: 5, y: 7 });
    expect(ROOM_BORDER_SCAN).toEqual({ max: 50, minAlpha: 200, inset: WALL_STROKE_PX / 2 });
  });

  it('keeps the deprecated gold names as aliases of their replacements', () => {
    // Many files still import these; the integrator migrates them gradually.
    expect(WALL_GOLD).toBe(WALL_INK);
    expect(WALL_GOLD_BRIGHT).toBe(SELECT_STROKE);
  });

  it('leaves the shop-skin dock tokens untouched by the reskin', () => {
    expect(DOCK_BG).toBe('#efede8');
    expect(DOCK_BG_RAISED).toBe('#faf9f5');
    expect(DOCK_BORDER).toBe('#dcd9d0');
    expect(DOCK_TEXT).toBe('#37362f');
    expect(DOCK_TEXT_MUTED).toBe('#85826f');
    expect(DOCK_ACCENT).toBe('#79c7ad');
  });

  it('paper surfaces are light and warm, and step darker from active room out to the ground', () => {
    const surfaces = [ROOM_FILL_ACTIVE, ROOM_FILL, SITE_FILL, OUTDOOR_FILL, CANVAS_GROUND].map(rgb);
    for (const [r, g, b] of surfaces) {
      expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(200);
      // Warm: red >= green >= blue, never a cool cast.
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
    }
    const lums = surfaces.map(luminance);
    for (let i = 1; i < lums.length; i += 1) expect(lums[i]).toBeLessThan(lums[i - 1]);
  });

  it('the grid is drawn in wall ink but stays quiet', () => {
    expect(GRID_LINE).toBe(WALL_INK);
    expect(GRID_MAJOR_OPACITY).toBeLessThanOrEqual(0.15);
    expect(GRID_MINOR_OPACITY).toBeLessThan(GRID_MAJOR_OPACITY);
    expect(GRID_MINOR_OPACITY).toBeGreaterThan(0);
  });

  it('the wall shadow, ghost storey and item shadow are low-alpha ink', () => {
    for (const token of [WALL_SHADOW, WALL_INK_GHOST, ITEM_SHADOW, DOOR_ARC, LABEL_TEXT_MUTED, WALL_INNER_STROKE]) {
      const { a } = rgba(token);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(1);
    }
    expect(rgba(WALL_INK_GHOST).rgb).toEqual(rgb(WALL_INK));
    expect(rgba(DOOR_ARC).rgb).toEqual(rgb(DOOR_LEAF));
    // The light pool fades to fully transparent at its edge.
    expect(rgba(LIGHT_GLOW_EDGE).a).toBe(0);
    expect(rgba(LIGHT_GLOW_EDGE).rgb).toEqual(rgba(LIGHT_GLOW_CORE).rgb);
  });

  it('text reads on paper (WCAG AA) and the selection accent clears the non-text floor', () => {
    expect(contrast(rgb(LABEL_TEXT), rgb(ROOM_FILL))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb(LABEL_TEXT), rgb(CANVAS_GROUND))).toBeGreaterThanOrEqual(4.5);
    // The chip plate is MEASURE_BG at MEASURE_BG_OPACITY over the room floor.
    const plate = over(rgb(MEASURE_BG), MEASURE_BG_OPACITY, rgb(ROOM_FILL));
    expect(contrast(rgb(MEASURE_TEXT), plate)).toBeGreaterThanOrEqual(4.5);
    // WCAG 1.4.11 non-text contrast for outlines/handles.
    expect(contrast(rgb(SELECT_STROKE), rgb(ROOM_FILL))).toBeGreaterThanOrEqual(3);
    expect(contrast(rgb(GHOST_INVALID), rgb(ROOM_FILL))).toBeGreaterThanOrEqual(3);
    expect(contrast(rgb(DIM_LINE), rgb(ROOM_FILL))).toBeGreaterThanOrEqual(2);
    // The label halo is the paper itself.
    expect(LABEL_HALO).toBe(ROOM_FILL);
  });

  it('greenery is muted sage, never saturated', () => {
    for (const hex of [GREENERY_FILL, GREENERY_STROKE]) {
      const [r, g, b] = rgb(hex);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
      // Saturation proxy: the green channel leads by well under 100.
      expect(g - Math.min(r, b)).toBeLessThan(100);
    }
    expect(luminance(rgb(GREENERY_STROKE))).toBeLessThan(luminance(rgb(GREENERY_FILL)));
    expect(luminance(rgb(SITE_STROKE))).toBeLessThan(luminance(rgb(SITE_FILL)));
  });
});

describe('isRoomBorderPixel — the e2e canvas pixel-scan predicate (charcoal walls)', () => {
  it('matches the wall ink and its deprecated alias', () => {
    expect(isRoomBorderPixel(...rgb(WALL_INK))).toBe(true);
    expect(isRoomBorderPixel(...rgb(WALL_GOLD))).toBe(true);
  });

  it('is a strict per-channel bound at ROOM_BORDER_SCAN.max', () => {
    const m = ROOM_BORDER_SCAN.max;
    expect(isRoomBorderPixel(m - 1, m - 1, m - 1)).toBe(true);
    expect(isRoomBorderPixel(m, m - 1, m - 1)).toBe(false);
    expect(isRoomBorderPixel(m - 1, m, m - 1)).toBe(false);
    expect(isRoomBorderPixel(m - 1, m - 1, m)).toBe(false);
    expect(isRoomBorderPixel(0, 0, 0)).toBe(true);
  });

  it('rejects every paper surface (no false room origin)', () => {
    for (const hex of [CANVAS_GROUND, SITE_FILL, OUTDOOR_FILL, ROOM_FILL, ROOM_FILL_ACTIVE]) {
      expect(isRoomBorderPixel(...rgb(hex)), hex).toBe(false);
    }
    expect(isRoomBorderPixel(255, 255, 255)).toBe(false);
  });

  it('rejects the grid AS DRAWN — wall ink at grid opacity composited onto paper', () => {
    // GRID_LINE's raw hex IS the wall ink by design; what reaches the canvas
    // is that ink at <= 0.12 opacity over paper, which is far above the band.
    for (const bg of [CANVAS_GROUND, ROOM_FILL, ROOM_FILL_ACTIVE, SITE_FILL]) {
      for (const alpha of [GRID_MAJOR_OPACITY, GRID_MINOR_OPACITY]) {
        const px = over(rgb(GRID_LINE), alpha, rgb(bg));
        expect(isRoomBorderPixel(...px), `grid @${alpha} over ${bg}`).toBe(false);
        expect(Math.min(...px)).toBeGreaterThan(150);
      }
    }
  });

  it('rejects the wall shadow, the ghost storey, item shadows and the chip plate once composited', () => {
    const shadow = rgba(WALL_SHADOW);
    const ghost = rgba(WALL_INK_GHOST);
    const item = rgba(ITEM_SHADOW);
    const arc = rgba(DOOR_ARC);
    for (const bg of [CANVAS_GROUND, ROOM_FILL, OUTDOOR_FILL]) {
      expect(isRoomBorderPixel(...over(shadow.rgb, shadow.a, rgb(bg)))).toBe(false);
      expect(isRoomBorderPixel(...over(ghost.rgb, ghost.a, rgb(bg)))).toBe(false);
      expect(isRoomBorderPixel(...over(item.rgb, item.a, rgb(bg)))).toBe(false);
      expect(isRoomBorderPixel(...over(arc.rgb, arc.a, rgb(bg)))).toBe(false);
      // Measurement chip plate: never fully opaque, so never solid wall ink.
      expect(MEASURE_BG_OPACITY).toBeLessThan(1);
      expect(isRoomBorderPixel(...over(rgb(MEASURE_BG), MEASURE_BG_OPACITY, rgb(bg)))).toBe(false);
    }
  });

  it('rejects labels, dimension lines, selection chrome, ghosts, openings highlight and greenery', () => {
    const solids = [
      LABEL_TEXT,
      DIM_LINE,
      SELECT_STROKE,
      HANDLE_FILL,
      DOOR_TARGET_WALL,
      GHOST_VALID_STROKE,
      GHOST_INVALID,
      GREENERY_FILL,
      GREENERY_STROKE,
      SITE_STROKE,
    ];
    for (const hex of solids) expect(isRoomBorderPixel(...rgb(hex)), hex).toBe(false);
    for (const token of [GHOST_VALID_FILL, GHOST_INVALID_FILL, LABEL_TEXT_MUTED, LIGHT_GLOW_CORE]) {
      expect(isRoomBorderPixel(...rgba(token).rgb), token).toBe(false);
    }
  });

  it('rejects the two darkest catalog floors that are NOT quarantined (gym tile, eva-combat)', () => {
    // floorMaterials.ts: gym rubber tile #3a3a3a and EVA combat mat #1f2a44.
    expect(isRoomBorderPixel(58, 58, 58)).toBe(false);
    expect(isRoomBorderPixel(31, 42, 68)).toBe(false);
  });

  it('accepts the solid core of the wall stroke but not its antialiased fringe', () => {
    const ink = rgb(WALL_INK);
    const paper = rgb(ROOM_FILL);
    expect(isRoomBorderPixel(...over(ink, 0.97, paper))).toBe(true);
    expect(isRoomBorderPixel(...over(ink, 0.9, paper))).toBe(false);
    // Fringe pixels on the layer canvas are also filtered by alpha upstream.
    expect(ROOM_BORDER_SCAN.minAlpha).toBeGreaterThanOrEqual(200);
  });

  it('door leaves are deliberately wall ink — they sit ON the wall line', () => {
    // Documented, not defended: a leaf can never be further left/top than the
    // wall it hangs from, so it cannot shift the scanned origin outward.
    expect(DOOR_LEAF).toBe(WALL_INK);
  });
});
