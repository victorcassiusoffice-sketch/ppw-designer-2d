import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The pitch pages reference files under public/showcase. When one is missing
 * the developer page silently renders "App view unavailable" (that shipped once,
 * 2026-09-26, with two .png captures that never existed). Every referenced
 * asset must exist on disk, be a real WebP and stay within its byte budget.
 */
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const SOURCES = ['src/pages/pitch/PitchShell.tsx', 'src/pages/pitch/DeveloperPitchPage.tsx', 'src/pages/pitch/MerchantPitchPage.tsx', 'src/pages/studio/StudioPage.tsx'];
const BUDGET_BYTES: Record<string, number> = {
  '/showcase/designer-plan.webp': 400 * 1024,
  '/showcase/designer-3d.webp': 400 * 1024,
  '/showcase/developer-vision.webp': 300 * 1024,
  '/showcase/merchant-vision.webp': 300 * 1024,
};

function referencedShowcaseAssets(): string[] {
  const refs = new Set<string>();
  for (const source of SOURCES) {
    const text = readFileSync(path.join(root, source), 'utf8');
    for (const match of text.matchAll(/['"`](\/showcase\/[^'"`\s]+)['"`]/g)) refs.add(match[1]);
  }
  return [...refs].sort();
}

describe('pitch showcase assets', () => {
  const refs = referencedShowcaseAssets();

  it('references only the four WebP files and no PNG', () => {
    expect(refs).toEqual(Object.keys(BUDGET_BYTES).sort());
  });

  it.each(refs)('%s exists on disk as a WebP within budget', (ref) => {
    const file = path.join(root, 'public', ref);
    const size = statSync(file).size;
    const head = readFileSync(file).subarray(0, 12);
    expect(head.toString('latin1', 0, 4)).toBe('RIFF');
    expect(head.toString('latin1', 8, 12)).toBe('WEBP');
    expect(size).toBeGreaterThan(20 * 1024);
    expect(size).toBeLessThanOrEqual(BUDGET_BYTES[ref]);
  });
});
