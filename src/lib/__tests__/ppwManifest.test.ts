import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file));
const manifest = JSON.parse(read('public/brand/ppw/site.webmanifest').toString('utf8')) as {
  name: string; short_name: string; start_url: string; scope: string; display: string; theme_color: string; background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

describe('brand-correct application manifest', () => {
  it('links the PPW metadata only from the PPW shell, preserving the OLB shell manifest', () => {
    const ppw = read('index.html').toString('utf8');
    const olb = read('olb.html').toString('utf8');
    expect(ppw).toContain('rel="manifest" href="/brand/ppw/site.webmanifest"');
    expect(olb).toContain('rel="manifest" href="/brand/olb/site.webmanifest"');
    expect(olb).not.toContain('/brand/ppw/');
    expect(manifest.name).toContain('Peak Performance Wellness');
    expect(manifest.short_name).toBe('PPW Designer');
    expect(manifest.theme_color).toBe(ppw.match(/name="theme-color" content="([^"]+)"/)?.[1]);
    expect(manifest.background_color).toMatch(/^#[\da-f]{6}$/i);
    expect(manifest.display).toBe('standalone');
    const start = new URL(manifest.start_url, 'https://designer.example');
    expect(start.origin).toBe('https://designer.example');
    expect(start.pathname).toBe('/demo');
    expect(start.searchParams.get('pitch')).toBe('1');
    expect(start.searchParams.get('brand')).toBe('ppw');
    expect(start.pathname.startsWith(manifest.scope)).toBe(true);
  });

  it('provides actual opaque 192/512 PNG icons and an unclipped maskable brand mark', async () => {
    expect(manifest.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of manifest.icons) {
      const bytes = read(`public${icon.src}`);
      const metadata = await sharp(bytes).metadata();
      expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
      expect(metadata.format).toBe('png');
      expect(metadata.hasAlpha).toBe(false);
      expect(icon.type).toBe('image/png');
      expect(icon.purpose.split(' ')).toContain('any');
    }
    const maskable = manifest.icons.find(icon => icon.purpose.includes('maskable'))!;
    expect(maskable).toBeDefined();
    const { data, info } = await sharp(read(`public${maskable.src}`)).raw().toBuffer({ resolveWithObject: true });
    // All meaningful light logo pixels must fit the standard central80% circle.
    let furthestLogoPixel = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset] > 180 && data[offset + 1] > 180 && data[offset + 2] > 180) {
        furthestLogoPixel = Math.max(furthestLogoPixel, Math.hypot(x - info.width / 2, y - info.height / 2));
      }
    }
    expect(furthestLogoPixel).toBeGreaterThan(info.width * 0.2);
    expect(furthestLogoPixel).toBeLessThanOrEqual(info.width * 0.4);
  });
});
