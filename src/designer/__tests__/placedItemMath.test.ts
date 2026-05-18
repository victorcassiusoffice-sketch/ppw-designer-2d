/**
 * Sims-Parity DT-11 — placedItemMath pure-fn tests.
 *
 * Covers both shadow paths (GL1.04 + GL1.04b), GL1.01b crop variants,
 * wood-grain alignment.
 */
import { describe, it, expect } from 'vitest';
import {
  shadowGeometry,
  cropRect,
  woodGrainRotationDeg,
  type PlacedItemModel,
} from '../placedItemMath';

const baseItem: PlacedItemModel = {
  xPx: 100,
  yPx: 200,
  widthMm: 800,
  depthMm: 600,
  heightMm: 450,
  pxPerMm: 0.5,
  photoAlphaClean: false,
};

describe('DT-11 / shadowGeometry — GL1.04 (alpha_clean=true)', () => {
  const item: PlacedItemModel = { ...baseItem, photoAlphaClean: true };
  const g = shadowGeometry(item);

  it('uses the GL1.04 (behind-item) path', () => {
    expect(g.path).toBe('GL1.04');
  });
  it('centres on item footprint', () => {
    // wPx = 400, dPx = 300 — centre at (100+200, 200+150) = (300, 350).
    expect(g.centreXPx).toBe(300);
    expect(g.centreYPx).toBe(350);
  });
  it('radiusX = width × 1.05 (diameter) ÷ 2', () => {
    expect(g.radiusXPx).toBe((400 * 1.05) / 2);
  });
  it('radiusY = depth × 0.4 ÷ 2', () => {
    expect(g.radiusYPx).toBe((300 * 0.4) / 2);
  });
  it('opacity 0.18, blur 6, offset (2, 1)', () => {
    expect(g.opacity).toBe(0.18);
    expect(g.blur).toBe(6);
    expect(g.offsetXPx).toBe(2);
    expect(g.offsetYPx).toBe(1);
  });
});

describe('DT-11 / shadowGeometry — GL1.04b (alpha_clean=false)', () => {
  const g = shadowGeometry(baseItem);

  it('uses the GL1.04b (synthetic offset-below) path', () => {
    expect(g.path).toBe('GL1.04b');
  });
  it('centres below the photo bottom by heightMm × 0.04 × pxPerMm', () => {
    // bottom edge at y + dPx = 200 + 300 = 500. heightMm*0.04*pxPerMm = 450*0.04*0.5 = 9.
    // centreY = bottom + 9 = 509.
    expect(g.centreYPx).toBe(509);
  });
  it('radiusY is shorter (depth × 0.4 × 0.6 ÷ 2)', () => {
    expect(g.radiusYPx).toBe((300 * 0.4 * 0.6) / 2);
  });
  it('zero offset (no drop shadow)', () => {
    expect(g.offsetXPx).toBe(0);
    expect(g.offsetYPx).toBe(0);
  });
  it('same opacity/blur tokens as GL1.04', () => {
    expect(g.opacity).toBe(0.18);
    expect(g.blur).toBe(6);
  });
});

describe('DT-11 / cropRect (GL1.01b)', () => {
  it('returns null when bbox absent (v1 fallback)', () => {
    expect(cropRect(baseItem)).toBeNull();
  });
  it('passes bbox through when present', () => {
    const r = cropRect({
      ...baseItem,
      silhouetteBboxPx: { x: 120, y: 80, width: 800, height: 1200 },
    });
    expect(r).toEqual({ x: 120, y: 80, width: 800, height: 1200 });
  });
  it('clamps bbox to image natural bounds', () => {
    const r = cropRect({
      ...baseItem,
      silhouetteBboxPx: { x: -10, y: 5, width: 100000, height: 100000 },
      imageNaturalWidthPx: 1920,
      imageNaturalHeightPx: 1080,
    });
    expect(r).toEqual({ x: 0, y: 5, width: 1920, height: 1075 });
  });
});

describe('DT-11 / woodGrainRotationDeg', () => {
  it('returns 0 when room width ≥ depth (longest axis horizontal)', () => {
    expect(woodGrainRotationDeg(5000, 3000)).toBe(0);
  });
  it('returns 90 when room depth > width (longest axis vertical)', () => {
    expect(woodGrainRotationDeg(3000, 5000)).toBe(90);
  });
});
