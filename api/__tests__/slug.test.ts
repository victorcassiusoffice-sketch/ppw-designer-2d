import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '../_lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Peak Performance Wellness')).toBe('peak-performance-wellness');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Côte d\'Azur')).toBe('cafe-cote-d-azur');
  });

  it('collapses runs and trims edges', () => {
    expect(slugify('  --Hello---World!!  ')).toBe('hello-world');
  });

  it('drops symbols', () => {
    expect(slugify('Ocean & Sand Co.')).toBe('ocean-sand-co');
  });

  it('truncates to 60 chars', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it('returns empty string for nothing-but-symbols', () => {
    expect(slugify('---')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('returns base slug when free', async () => {
    const result = await uniqueSlug('Aurora Wellness', async () => false);
    expect(result).toBe('aurora-wellness');
  });

  it('appends a suffix on collision', async () => {
    let calls = 0;
    const result = await uniqueSlug('Aurora Wellness', async (candidate) => {
      calls++;
      // First call (base slug) is taken; second call (with suffix) is free.
      return candidate === 'aurora-wellness';
    });
    expect(result).toMatch(/^aurora-wellness-[a-z0-9]{4}$/);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('throws after 5 failed suffixes', async () => {
    await expect(uniqueSlug('Aurora', async () => true)).rejects.toThrow(/unique slug/);
  });

  it('falls back to "merchant" when slugify returns empty', async () => {
    const result = await uniqueSlug('---', async () => false);
    expect(result).toBe('merchant');
  });
});
