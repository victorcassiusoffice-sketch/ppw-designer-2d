import { describe, it, expect } from 'vitest';
import { stream, readingSchema, series, totals, siteSchema, pilotSchema } from './contract';
import { samplePilot } from './example';
import { project } from './projection';
import { dimensions } from './resize';
describe('pilot field records', () => {
  it('only accepts complete allow-listed player addresses', () => {
    for (const host of ['www.youtube.com', 'www.youtube-nocookie.com'])
      expect(stream.safeParse('https://' + host + '/embed/aBc123XyZ99').success).toBe(true);
    for (const v of [
      'http://www.youtube.com/embed/aBc123XyZ99',
      'https://example.org/embed/aBc123XyZ99',
      'https://www.youtube.com/embed/aBc123XyZ99?autoplay=1',
    ])
      expect(stream.safeParse(v).success).toBe(false);
  });
  it('rejects unknown fields, invalid coordinates, readings and dates', () => {
    const p = samplePilot();
    expect(pilotSchema.safeParse({ ...p, extra: 1 }).success).toBe(false);
    expect(siteSchema.safeParse({ ...p.sites[0], lat: 91 }).success).toBe(false);
    for (const cover of [-1, 101, Infinity])
      expect(readingSchema.safeParse({ ...p.readings[0], cover }).success).toBe(false);
    expect(
      pilotSchema.safeParse({ ...p, photos: [{ ...p.photos[0], date: '2026-02-31' }] }).success,
    ).toBe(false);
  });
  it('orders cover by site and month and separates units', () => {
    const p = samplePilot();
    expect(series([...p.readings].reverse(), 'wall').map((r) => r.cover)).toEqual([12, 26, 41]);
    expect(series(p.readings, 'rack')).toEqual([]);
    const result = totals([...p.logs, { ...p.logs[0], unit: 'kg' }]);
    expect(result.find((x) => x.unit === 'kg')?.quantity).toBe(1.2);
    expect(result.find((x) => x.type === 'Masonry' && x.unit === 't')?.quantity).toBeCloseTo(3.3);
  });
  it('places the harbour north-west of the bay and Rodrigues in its inset', () => {
    const [x, y] = project(57.5, -20.16),
      [bx, by] = project(57.71, -20.44);
    expect(x).toBeLessThan(bx);
    expect(y).toBeLessThan(by);
    expect(project(63.42, -19.68)[0]).toBeGreaterThan(520);
  });
  it('preserves aspect ratio and never enlarges an input', () => {
    expect(dimensions(4000, 3000)).toEqual([1600, 1200]);
    expect(dimensions(300, 500)).toEqual([300, 500]);
    expect(() => dimensions(0, 30)).toThrow();
  });
});
