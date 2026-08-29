/** Aspect fix (2026-08-24) — fitImageToFootprint unit suite. */
import { describe, expect, it } from 'vitest';
import { FILL_TOLERANCE, fitImageToFootprint, planImageFit } from '../imageFit';

/** Bounding box of the drawn art in footprint axes (post-rotation). */
function footprintBox(plan: ReturnType<typeof planImageFit>) {
  const boxW = plan.rotationDeg === 90 ? plan.drawH : plan.drawW;
  const boxH = plan.rotationDeg === 90 ? plan.drawW : plan.drawH;
  return { x: plan.offsetX, y: plan.offsetY, w: boxW, h: boxH };
}

describe('planImageFit (WP-B, 2026-08-29)', () => {
  it('square content on a 3:1 footprint is contain-back (67% mismatch), anchored to the top', () => {
    const p = planImageFit({ contentW: 100, contentH: 100, footW: 300, footH: 100 });
    expect(p.mode).toBe('contain-back');
    expect(p.rotationDeg).toBe(0);
    expect(p.drawW).toBeCloseTo(100);
    expect(p.drawH).toBeCloseTo(100);
    // Centred horizontally, flush to the back edge (y = 0).
    expect(p.offsetX).toBeCloseTo(100);
    expect(p.offsetY).toBe(0);
  });

  it('2.75:1 content on a 3:1 footprint fills exactly (8% mismatch)', () => {
    const p = planImageFit({ contentW: 275, contentH: 100, footW: 300, footH: 100 });
    expect(p.mode).toBe('fill');
    expect(p.rotationDeg).toBe(0);
    expect(p.drawW).toBe(300);
    expect(p.drawH).toBe(100);
    expect(p.offsetX).toBe(0);
    expect(p.offsetY).toBe(0);
  });

  it('the real demo art (console 772x289 on 120x40, shelf 822x186 on 80x20) fills', () => {
    expect(planImageFit({ contentW: 772, contentH: 289, footW: 120, footH: 40 }).mode).toBe('fill');
    expect(planImageFit({ contentW: 822, contentH: 186, footW: 80, footH: 20 }).mode).toBe('fill');
  });

  it('portrait content on a landscape footprint rotates 90 and still fills when close', () => {
    // 100x275 portrait → 2.75:1 after rotation vs 3:1 → fill.
    const p = planImageFit({ contentW: 100, contentH: 275, footW: 300, footH: 100 });
    expect(p.rotationDeg).toBe(90);
    expect(p.mode).toBe('fill');
    // Image axes: width along footH, height along footW.
    expect(p.drawW).toBe(100);
    expect(p.drawH).toBe(300);
    expect(footprintBox(p)).toEqual({ x: 0, y: 0, w: 300, h: 100 });
  });

  it('portrait content that is too long rotates and contain-backs at the top (worked example)', () => {
    // 100x500 → 5:1 after rotation vs 3:1 = 67% → contain, width-limited (scale 0.6).
    const p = planImageFit({ contentW: 100, contentH: 500, footW: 300, footH: 100 });
    expect(p.rotationDeg).toBe(90);
    expect(p.mode).toBe('contain-back');
    expect(p.drawW).toBeCloseTo(60);
    expect(p.drawH).toBeCloseTo(300);
    const box = footprintBox(p);
    expect(box.w).toBeCloseTo(300);
    expect(box.h).toBeCloseTo(60);
    expect(box.x).toBeCloseTo(0);
    expect(box.y).toBe(0);
  });

  it('wider-than-footprint content is width-limited, offsetX 0, slack left at the front', () => {
    // 5:1 on 3:1 (67%) → box 300x60 at the top; the bottom 40 stays bare.
    const p = planImageFit({ contentW: 500, contentH: 100, footW: 300, footH: 100 });
    expect(p.mode).toBe('contain-back');
    expect(p.rotationDeg).toBe(0);
    expect(footprintBox(p)).toEqual({ x: 0, y: 0, w: 300, h: 60 });
  });

  it('never centres vertically: a contained box always starts at y = 0', () => {
    const cases = [
      { contentW: 100, contentH: 100, footW: 300, footH: 100 },
      { contentW: 500, contentH: 100, footW: 300, footH: 100 },
      { contentW: 100, contentH: 500, footW: 300, footH: 100 },
      { contentW: 300, contentH: 100, footW: 100, footH: 100 },
    ];
    for (const c of cases) {
      const p = planImageFit({ ...c, mode: 'contain-back' });
      expect(p.offsetY).toBe(0);
      const box = footprintBox(p);
      expect(box.x + box.w).toBeLessThanOrEqual(c.footW + 1e-9);
      expect(box.h).toBeLessThanOrEqual(c.footH + 1e-9);
    }
  });

  it("mode 'fill' forces a stretch even at 67% mismatch", () => {
    const p = planImageFit({ contentW: 100, contentH: 100, footW: 300, footH: 100, mode: 'fill' });
    expect(p.mode).toBe('fill');
    expect(p.drawW).toBe(300);
    expect(p.drawH).toBe(100);
  });

  it("mode 'contain-back' forces the true aspect even when within tolerance", () => {
    const p = planImageFit({ contentW: 275, contentH: 100, footW: 300, footH: 100, mode: 'contain-back' });
    expect(p.mode).toBe('contain-back');
    expect(p.drawW).toBeCloseTo(275);
    expect(p.drawH).toBeCloseTo(100);
    expect(p.offsetX).toBeCloseTo(12.5);
    expect(p.offsetY).toBe(0);
  });

  it('honours a custom fillTolerance and exposes the default', () => {
    expect(FILL_TOLERANCE).toBe(0.35);
    const tight = planImageFit({ contentW: 275, contentH: 100, footW: 300, footH: 100, fillTolerance: 0.05 });
    expect(tight.mode).toBe('contain-back');
    const loose = planImageFit({ contentW: 100, contentH: 100, footW: 300, footH: 100, fillTolerance: 0.7 });
    expect(loose.mode).toBe('fill');
  });

  it('square-ish content (within 2% of 1:1) never rotates', () => {
    // 100x101 (1% off square) on a 1:3 portrait footprint: no rotation,
    // scale 1 → box 100x101 at the top.
    const p = planImageFit({ contentW: 100, contentH: 101, footW: 100, footH: 300 });
    expect(p.rotationDeg).toBe(0);
    expect(p.mode).toBe('contain-back');
    expect(footprintBox(p)).toEqual({ x: 0, y: 0, w: 100, h: 101 });
  });

  it('degenerate inputs fall back to a plain fill with zero offsets', () => {
    const p = planImageFit({ contentW: 0, contentH: 0, footW: 200, footH: 100 });
    expect(p).toEqual({ rotationDeg: 0, drawW: 200, drawH: 100, offsetX: 0, offsetY: 0, mode: 'fill' });
  });
});

describe('fitImageToFootprint', () => {
  it('matching-aspect art fills the footprint exactly (no rotation)', () => {
    // 2050×950 art on a 205×95 px footprint — the authored K1 case.
    const f = fitImageToFootprint(2050, 950, 205, 95);
    expect(f.rotationDeg).toBe(0);
    expect(f.drawW).toBe(205);
    expect(f.drawH).toBe(95);
  });

  it('square art on a long footprint is contained, never stretched', () => {
    // 400×400 placeholder on a 205×95 footprint: previously stretched
    // 2.16:1 — now a centred 95×95 square.
    const f = fitImageToFootprint(400, 400, 205, 95);
    expect(f.rotationDeg).toBe(0);
    expect(f.drawW).toBeCloseTo(95);
    expect(f.drawH).toBeCloseTo(95);
  });

  it('portrait art on a landscape footprint rotates 90° to align long axes', () => {
    // 600×1200 (portrait) art, 200×100 (landscape) footprint.
    const f = fitImageToFootprint(600, 1200, 200, 100);
    expect(f.rotationDeg).toBe(90);
    // Post-rotation extents: 1200→along footW, 600→along footH.
    // scale = min(200/1200, 100/600) = 1/6 → draw 100×200 pre-rotation.
    expect(f.drawW).toBeCloseTo(100);
    expect(f.drawH).toBeCloseTo(200);
  });

  it('portrait art matching the rotated aspect snap-fills after rotation', () => {
    // 950×2050 portrait art on a 205×95 landscape footprint.
    const f = fitImageToFootprint(950, 2050, 205, 95);
    expect(f.rotationDeg).toBe(90);
    expect(f.drawW).toBe(95);
    expect(f.drawH).toBe(205);
  });

  it('mildly-off aspect within 2% snaps to exact fill', () => {
    const f = fitImageToFootprint(2020, 950, 205, 95); // 2.13 vs 2.16 → 1.5% off
    expect(f.drawW).toBe(205);
    expect(f.drawH).toBe(95);
  });

  it('wider-than-footprint art is height-limited by width', () => {
    // 4:1 art on a 2:1 footprint → width-bound: draw 200×50.
    const f = fitImageToFootprint(2000, 500, 200, 100);
    expect(f.rotationDeg).toBe(0);
    expect(f.drawW).toBeCloseTo(200);
    expect(f.drawH).toBeCloseTo(50);
  });

  it('degenerate inputs fall back to a plain fill', () => {
    const f = fitImageToFootprint(0, 0, 200, 100);
    expect(f.drawW).toBe(200);
    expect(f.drawH).toBe(100);
  });
});
