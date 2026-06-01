/**
 * V-RENDER-4 (2026-05-27) — share-render helper tests.
 *
 * The "Share render" button exports the Konva stage via
 * `stage.toDataURL({ pixelRatio: 2 })` (a data:image/png string) and
 * hands it to the Web Share sheet. The base64 → Blob decode must be
 * synchronous (no await/fetch microtask) or iOS Safari rejects
 * navigator.share() with NotAllowedError. These tests cover that decode
 * — brief test #4's non-empty-render assertion in a node-runnable form.
 */

import { describe, it, expect } from 'vitest';
import {
  dataUrlToBlob,
  clampCapturePixelRatio,
  safeStageDataUrl,
  MAX_CANVAS_AREA_PX,
  MAX_CANVAS_DIM_PX,
  type CapturableStage,
} from '../shareImage';

// A 1x1 transparent PNG — the smallest valid image/png data URL.
const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('dataUrlToBlob', () => {
  it('decodes a data:image/png URL into a non-empty image/png Blob', () => {
    const blob = dataUrlToBlob(PNG_1x1);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('preserves the declared mime type from the header', () => {
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    expect(dataUrlToBlob(jpeg).type).toBe('image/jpeg');
  });

  it('throws on a string that is not a data URL', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow();
  });

  it('decodes synchronously (returns a Blob, not a Promise)', () => {
    // The iOS gesture rule depends on this being synchronous.
    const result = dataUrlToBlob(PNG_1x1);
    expect(typeof (result as unknown as { then?: unknown }).then).toBe('undefined');
  });
});

/**
 * Mobile capture fix (2026-06-01) — regression coverage.
 *
 * Reproduces the two ways the Konva "Share render" silently failed on
 * mobile: (1) a large retina stage that toDataURL'd to a blank image past
 * iOS Safari's canvas limit, and (2) a tainted canvas (cross-origin image
 * with no CORS headers) whose toDataURL throws and crashed the handler.
 */
describe('clampCapturePixelRatio', () => {
  it('leaves the requested ratio untouched for a typical phone stage', () => {
    // Portrait phone canvas region — nowhere near the limit.
    expect(clampCapturePixelRatio(390, 700, 2)).toBe(2);
  });

  it('leaves the requested ratio untouched for a typical desktop stage', () => {
    expect(clampCapturePixelRatio(1200, 800, 2)).toBe(2);
  });

  it('clamps down when desired ratio would exceed the canvas area limit', () => {
    // 2500 × 2000 css px @2x = 5000 × 4000 = 20M px > 16.7M → must clamp.
    const pr = clampCapturePixelRatio(2500, 2000, 2);
    expect(pr).toBeLessThan(2);
    const outW = 2500 * pr;
    const outH = 2000 * pr;
    expect(outW * outH).toBeLessThanOrEqual(MAX_CANVAS_AREA_PX + 1);
    expect(Math.max(outW, outH)).toBeLessThanOrEqual(MAX_CANVAS_DIM_PX + 1);
  });

  it('clamps to the single-dimension limit for a very wide stage', () => {
    // 5000 css px wide @2x = 10000 px > 4096 single-dim cap.
    const pr = clampCapturePixelRatio(5000, 200, 2);
    expect(5000 * pr).toBeLessThanOrEqual(MAX_CANVAS_DIM_PX + 1);
  });

  it('never returns below the 0.5 floor even for an enormous stage', () => {
    expect(clampCapturePixelRatio(100000, 100000, 2)).toBeGreaterThanOrEqual(0.5);
  });
});

describe('safeStageDataUrl', () => {
  function fakeStage(opts: {
    w: number;
    h: number;
    out: string | (() => never);
  }): CapturableStage & { lastPixelRatio?: number } {
    const stage = {
      width: () => opts.w,
      height: () => opts.h,
      toDataURL(config?: { pixelRatio?: number }) {
        stage.lastPixelRatio = config?.pixelRatio;
        if (typeof opts.out === 'function') return opts.out();
        return opts.out;
      },
    } as CapturableStage & { lastPixelRatio?: number };
    return stage;
  }

  it('returns the data URL on a successful export', () => {
    const stage = fakeStage({ w: 390, h: 700, out: PNG_1x1 });
    expect(safeStageDataUrl(stage)).toBe(PNG_1x1);
  });

  it('passes a clamped pixelRatio to toDataURL for a huge stage', () => {
    const stage = fakeStage({ w: 4000, h: 4000, out: PNG_1x1 });
    safeStageDataUrl(stage, 2);
    expect(stage.lastPixelRatio).toBeLessThan(2);
  });

  it('returns null (no throw) when the canvas is tainted', () => {
    const stage = fakeStage({
      w: 390,
      h: 700,
      out: () => {
        throw new DOMException('Tainted canvases may not be exported.', 'SecurityError');
      },
    });
    expect(safeStageDataUrl(stage)).toBeNull();
  });

  it('returns null for an empty/blank export string', () => {
    const stage = fakeStage({ w: 390, h: 700, out: '' });
    expect(safeStageDataUrl(stage)).toBeNull();
  });
});
