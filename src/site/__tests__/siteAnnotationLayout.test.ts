import { describe, expect, it } from 'vitest';
import { layoutSiteAnnotation } from '../annotationLayout';

// Unequal glyph advances exercise real wrapping rather than character counts.
const measure = (text: string) => Array.from(text).reduce((width, glyph) =>
  width + (glyph === 'W' ? 11 : glyph === 'i' ? 3 : glyph === ' ' ? 4 : 7), 0);
const source = ' · N ↑ · boundary drawn / typed by you';

describe('deferred geographic annotation fits the measured drawing rectangle', () => {
  for (const width of [315, 390, 1176]) for (const height of [250, 268.5, 430]) {
    it(`keeps full text and north inside ${width}×${height} after tools resize, zoom and pan`, () => {
      const label = `${'Western boundary Wi '.repeat(7).trim()}${source}`;
      for (const scale of [0.2, 1, 3]) for (const pan of [-1500, 0, 1500]) {
        const viewport = { x: pan, y: -pan, scale };
        const layout = layoutSiteAnnotation(label, { x: 50, y: 50 }, {
          pxPerMetre: 30, viewport, size: { width, height },
        }, measure, 60)!;
        const left = layout.x * scale + viewport.x;
        const top = layout.y * scale + viewport.y;
        expect(left).toBeGreaterThanOrEqual(8 - 1e-8);
        expect(top).toBeGreaterThanOrEqual(60 - 1e-8);
        expect(left + layout.width * scale).toBeLessThanOrEqual(width - 8 + 1e-8);
        expect(top + layout.height * scale).toBeLessThanOrEqual(height - 8 + 1e-8);
        expect(layout.fontSize * scale).toBeCloseTo(11);
        expect(layout.text.replace(/\s/g, '')).toBe(label.replace(/\s/g, ''));
        expect(layout.text).not.toContain('…');
        for (const line of layout.text.split('\n')) expect(measure(line)).toBeLessThanOrEqual(layout.width * scale + 1e-8);
        const points = layout.points.map((value, index) => value * scale + (index % 2 ? viewport.y : viewport.x));
        for (let index = 0; index < points.length; index += 2) {
          expect(points[index]).toBeGreaterThanOrEqual(8 - 1e-8);
          expect(points[index]).toBeLessThanOrEqual(width - 8 + 1e-8);
          expect(points[index + 1]).toBeGreaterThanOrEqual(8 - 1e-8);
          expect(points[index + 1]).toBeLessThanOrEqual(height - 8 + 1e-8);
        }
        expect(points[3]).toBeLessThan(points[1]);
        expect(layout.strokeWidth * scale).toBeCloseTo(1.5);
        expect(layout.backing.x * scale + viewport.x).toBeGreaterThanOrEqual(4 - 1e-8);
        expect(layout.backing.y * scale + viewport.y).toBeGreaterThanOrEqual(56 - 1e-8);
        expect((layout.backing.x + layout.backing.width) * scale + viewport.x).toBeLessThanOrEqual(width - 4 + 1e-8);
        expect((layout.backing.y + layout.backing.height) * scale + viewport.y).toBeLessThanOrEqual(height - 4 + 1e-8);
      }
    });
  }

  it('wraps a full 160-character token without deleting any name or provenance glyph', () => {
    const label = `${'W'.repeat(160)}${source}`;
    const layout = layoutSiteAnnotation(label, { x: 0, y: 0 }, {
      pxPerMetre: 30, viewport: { x: 40, y: 40, scale: 0.4 }, size: { width: 315, height: 250 },
    }, measure)!;
    expect(layout.text.replace(/\s/g, '')).toBe(label.replace(/\s/g, ''));
    expect(layout.text).toContain('boundary');
    expect(layout.text).toContain('typed by you');
    expect(layout.text.split('\n').length).toBeGreaterThan(3);
    expect(layout.height * 0.4).toBeLessThan(234);
    for (const line of layout.text.split('\n')) expect(measure(line)).toBeLessThanOrEqual(layout.width * 0.4);
  });

  it('withholds a collapsed or too-short full annotation and recovers without deleting words', () => {
    const label = `${'W'.repeat(160)}${source}`;
    const view = { pxPerMetre: 30, viewport: { x: 0, y: 0, scale: 1 }, size: { width: 390, height: 268.5 } };
    for (const size of [{ width: 0, height: 268.5 }, { width: 40, height: 268.5 }, { width: 390, height: 0 }, { width: 390, height: 70 }]) {
      expect(layoutSiteAnnotation(label, { x: 0, y: 0 }, { ...view, size }, measure, 60)).toBeNull();
    }
    const restored = layoutSiteAnnotation(label, { x: 0, y: 0 }, view, measure, 60)!;
    expect(restored.text.replace(/\s/g, '')).toBe(label.replace(/\s/g, ''));
    expect(restored.y).toBeGreaterThanOrEqual(60);
    expect(restored.y + restored.height).toBeLessThanOrEqual(260.5);
  });

  it('uses the reduced measured height when tools open, without moving or modifying the plot anchor', () => {
    const anchor = Object.freeze({ x: 10, y: 10 });
    const viewport = Object.freeze({ x: 5, y: 5, scale: 1 });
    const input = { pxPerMetre: 30, viewport, size: { width: 315, height: 430 } };
    const closed = layoutSiteAnnotation(`My plot${source}`, anchor, input, measure)!;
    const open = layoutSiteAnnotation(`My plot${source}`, anchor, { ...input, size: { width: 315, height: 250 } }, measure)!;
    expect(open.y).toBeLessThan(closed.y);
    expect(open.y + viewport.y + open.height).toBeLessThanOrEqual(242);
    expect(open.text).toBe(closed.text);
    expect(anchor).toEqual({ x: 10, y: 10 });
    expect(viewport).toEqual({ x: 5, y: 5, scale: 1 });
  });
});
