/**
 * WP-B (2026-08-29) — contentBoxFromRGBA / hasTransparency unit suite.
 *
 * The DOM wrapper (contentBoxForImage) needs a real 2D canvas and cannot
 * run under node/jsdom; only the pure pixel maths is exercised here with
 * synthetic RGBA buffers. Its wiring is covered by the canvas e2e specs.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALPHA_THRESHOLD,
  DEFAULT_WHITE_MIN,
  DEFAULT_WHITE_SPREAD,
  contentBoxFromRGBA,
  hasTransparency,
  isFullBox,
} from '../imageContent';

type RGBA = [number, number, number, number];

/** Solid canvas of `bg`, then paint `rect` with `fg`. */
function synth(
  width: number,
  height: number,
  bg: RGBA,
  rect?: { x: number; y: number; w: number; h: number; fg: RGBA },
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(bg, i * 4);
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) data.set(rect.fg, (y * width + x) * 4);
    }
  }
  return data;
}

const CLEAR: RGBA = [0, 0, 0, 0];
const WHITE: RGBA = [255, 255, 255, 255];
const OAK: RGBA = [214, 180, 140, 255];

describe('contentBoxFromRGBA', () => {
  it('transparent PNG-like: tight box of opaque pixels, alpha alone', () => {
    // 1024-wide slab with a 772x289 table at (126, 380) — the console-table shape.
    const data = synth(1024, 1024, CLEAR, { x: 126, y: 380, w: 772, h: 289, fg: OAK });
    expect(contentBoxFromRGBA(data, 1024, 1024)).toEqual({ x: 126, y: 380, w: 772, h: 289 });
  });

  it('white-background JPEG-like: near-white margin is keyed out', () => {
    // Opaque near-white slab (JPEG noise: 240..250, spread 8) around an oak rect.
    const data = synth(64, 32, [244, 248, 240, 255], { x: 8, y: 4, w: 40, h: 20, fg: OAK });
    expect(contentBoxFromRGBA(data, 64, 32)).toEqual({ x: 8, y: 4, w: 40, h: 20 });
  });

  it('white key OFF keeps an opaque near-white slab as content (full box)', () => {
    const data = synth(64, 32, WHITE, { x: 8, y: 4, w: 40, h: 20, fg: OAK });
    expect(contentBoxFromRGBA(data, 64, 32, { whiteKey: false })).toEqual({ x: 0, y: 0, w: 64, h: 32 });
  });

  it('all-white opaque image returns the full box', () => {
    const data = synth(16, 8, WHITE);
    expect(contentBoxFromRGBA(data, 16, 8)).toEqual({ x: 0, y: 0, w: 16, h: 8 });
  });

  it('fully transparent image returns the full box', () => {
    const data = synth(16, 8, CLEAR);
    expect(contentBoxFromRGBA(data, 16, 8)).toEqual({ x: 0, y: 0, w: 16, h: 8 });
  });

  it('all-opaque coloured image returns the full box (nothing to trim)', () => {
    const data = synth(16, 8, OAK);
    expect(contentBoxFromRGBA(data, 16, 8)).toEqual({ x: 0, y: 0, w: 16, h: 8 });
  });

  it('alpha at or below the threshold is background; just above is content', () => {
    const w = 10;
    const h = 10;
    const data = synth(w, h, CLEAR);
    // Faint halo pixel at (1,1) — ignored. Real pixel at (5,6) — content.
    data.set([0, 0, 0, DEFAULT_ALPHA_THRESHOLD], (1 * w + 1) * 4);
    data.set([0, 0, 0, DEFAULT_ALPHA_THRESHOLD + 1], (6 * w + 5) * 4);
    expect(contentBoxFromRGBA(data, w, h)).toEqual({ x: 5, y: 6, w: 1, h: 1 });
    // Raising the threshold drops the second pixel too → full box.
    expect(contentBoxFromRGBA(data, w, h, { alphaThreshold: 9 })).toEqual({ x: 0, y: 0, w, h });
  });

  it('near-white needs BOTH a high floor and a small spread', () => {
    const w = 8;
    const h = 1;
    const data = synth(w, h, WHITE);
    // Bright but tinted (spread 20 > 14) → content.
    data.set([255, 255, 235, 255], 2 * 4);
    // Light grey below the floor (230 < 236) → content.
    data.set([230, 230, 230, 255], 5 * 4);
    expect(contentBoxFromRGBA(data, w, h)).toEqual({ x: 2, y: 0, w: 4, h: 1 });
    // Loosened key swallows both.
    expect(contentBoxFromRGBA(data, w, h, { whiteMin: 220, whiteSpread: 30 })).toEqual({ x: 0, y: 0, w, h });
    expect(DEFAULT_WHITE_MIN).toBe(236);
    expect(DEFAULT_WHITE_SPREAD).toBe(14);
  });

  it('white PARTS of a product survive when they sit inside the coloured extent', () => {
    // Oak rect with a white stripe through its middle: the box is the oak extent.
    const data = synth(40, 20, CLEAR, { x: 5, y: 5, w: 30, h: 10, fg: OAK });
    for (let x = 5; x < 35; x++) data.set(WHITE, (10 * 40 + x) * 4);
    expect(contentBoxFromRGBA(data, 40, 20)).toEqual({ x: 5, y: 5, w: 30, h: 10 });
  });

  it('stride sampling never crops content: the box contains the true box, within stride-1 slack', () => {
    const truth = { x: 13, y: 7, w: 51, h: 23 };
    const data = synth(100, 60, CLEAR, { ...truth, fg: OAK });
    for (const stride of [2, 3, 4, 7]) {
      const box = contentBoxFromRGBA(data, 100, 60, { stride });
      expect(box.x).toBeLessThanOrEqual(truth.x);
      expect(box.y).toBeLessThanOrEqual(truth.y);
      expect(box.x + box.w).toBeGreaterThanOrEqual(truth.x + truth.w);
      expect(box.y + box.h).toBeGreaterThanOrEqual(truth.y + truth.h);
      expect(truth.x - box.x).toBeLessThanOrEqual(stride - 1);
      expect(truth.y - box.y).toBeLessThanOrEqual(stride - 1);
      expect(box.x + box.w - (truth.x + truth.w)).toBeLessThanOrEqual(stride - 1);
      expect(box.y + box.h - (truth.y + truth.h)).toBeLessThanOrEqual(stride - 1);
    }
    // stride 1 is exact.
    expect(contentBoxFromRGBA(data, 100, 60, { stride: 1 })).toEqual(truth);
  });

  it('stride slack is clamped to the image bounds', () => {
    const data = synth(20, 20, CLEAR, { x: 0, y: 0, w: 20, h: 20, fg: OAK });
    expect(contentBoxFromRGBA(data, 20, 20, { stride: 6 })).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it('content touching the edges yields the full box', () => {
    const data = synth(12, 6, OAK);
    const box = contentBoxFromRGBA(data, 12, 6);
    expect(isFullBox(box, 12, 6)).toBe(true);
  });

  it('degenerate sizes or a short buffer return the full (clamped) box', () => {
    expect(contentBoxFromRGBA(new Uint8ClampedArray(0), 0, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(contentBoxFromRGBA(new Uint8ClampedArray(4), 4, 4)).toEqual({ x: 0, y: 0, w: 4, h: 4 });
    expect(contentBoxFromRGBA(new Uint8ClampedArray(16), -3, 2)).toEqual({ x: 0, y: 0, w: 0, h: 2 });
  });

  it('accepts a plain Uint8Array too', () => {
    const src = synth(6, 6, CLEAR, { x: 2, y: 1, w: 3, h: 4, fg: OAK });
    expect(contentBoxFromRGBA(new Uint8Array(src), 6, 6)).toEqual({ x: 2, y: 1, w: 3, h: 4 });
  });
});

describe('hasTransparency', () => {
  it('is false for a fully opaque buffer', () => {
    expect(hasTransparency(synth(8, 8, OAK))).toBe(false);
    expect(hasTransparency(synth(8, 8, WHITE))).toBe(false);
  });

  it('is true when any pixel is not fully opaque', () => {
    const data = synth(8, 8, OAK);
    data[(3 * 8 + 3) * 4 + 3] = 254;
    expect(hasTransparency(data)).toBe(true);
    expect(hasTransparency(synth(8, 8, CLEAR))).toBe(true);
  });

  it('is false for an empty buffer', () => {
    expect(hasTransparency(new Uint8ClampedArray(0))).toBe(false);
  });
});

describe('isFullBox', () => {
  it('matches only the exact full-image box', () => {
    expect(isFullBox({ x: 0, y: 0, w: 10, h: 5 }, 10, 5)).toBe(true);
    expect(isFullBox({ x: 1, y: 0, w: 9, h: 5 }, 10, 5)).toBe(false);
    expect(isFullBox({ x: 0, y: 0, w: 10, h: 4 }, 10, 5)).toBe(false);
  });
});
