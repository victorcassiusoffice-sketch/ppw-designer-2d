/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PlumbingPitchPage from './PlumbingPitchPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const imageBytes = (url: string) => readFileSync(resolve(process.cwd(), 'public', url.slice(1)));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  history.replaceState(null, '', '/pitch/plumbing');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<PlumbingPitchPage />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); history.replaceState(null, '', '/'); });

describe('plumbing capture delivery', () => {
  it('reserves the real hero aspect ratio and gives only the visible hero high priority', async () => {
    const hero = host.querySelector<HTMLImageElement>('.sales-shot img')!;
    const original = await sharp(imageBytes(hero.getAttribute('src')!)).metadata();
    expect([hero.width, hero.height]).toEqual([original.width, original.height]);
    expect(hero.getAttribute('fetchpriority')).toBe('high');
    expect(hero.loading).not.toBe('lazy');
    expect(host.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
  });

  it('offers real smaller captures with the original aspect ratio and a full-resolution fallback', async () => {
    const hero = host.querySelector<HTMLImageElement>('.sales-shot img')!;
    const originalBytes = imageBytes(hero.getAttribute('src')!);
    const original = await sharp(originalBytes).metadata();
    const candidates = hero.srcset.split(',').map(item => item.trim().split(/\s+/));
    expect(candidates).toHaveLength(4);
    for (const [url, descriptor] of candidates) {
      const bytes = imageBytes(url);
      const metadata = await sharp(bytes).metadata();
      expect(metadata.width).toBe(Number.parseInt(descriptor, 10));
      expect(metadata.width! / metadata.height!).toBeCloseTo(original.width! / original.height!, 2);
      if (metadata.width! < original.width!) {
        expect(metadata.format).toBe('webp');
        expect(bytes.length).toBeLessThan(originalBytes.length);
      }
    }
    expect(candidates[candidates.length - 1]).toEqual([hero.getAttribute('src'), '1280w']);
    expect(hero.sizes).toContain('(max-width: 700px)');
  });

  it('reserves the tool-preview aspect ratio without loading the interactive designer', async () => {
    const tools = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(node => node.textContent?.includes('Try the tools'))!;
    act(() => tools.click());
    const capture = host.querySelector<HTMLImageElement>('.sales-start-demo img')!;
    const original = await sharp(imageBytes(capture.getAttribute('src')!)).metadata();
    expect([capture.width, capture.height]).toEqual([original.width, original.height]);
    expect(capture.hasAttribute('fetchpriority')).toBe(false);
    expect(host.querySelector('iframe')).toBeNull();
  });
});
