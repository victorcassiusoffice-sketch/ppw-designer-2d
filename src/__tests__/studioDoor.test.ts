import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import middleware from '../../middleware';
import { isAppShellPath } from '../../server/brand';
import { FILE_FOLDERS, isFileFolderPath, opensWithoutStudioCode } from '../../server/studioPaths';
import { needsServerLoad } from '../lib/studioDocument';

const MISSING_FILES = ['/assets/no-such-file', '/assets/no-such-file.js', '/models/no-such-body', '/draco/none', '/showcase/none', '/lessons/none', '/brand/none', '/fonts/none'];
const APP_PAGES = ['/', '/home', '/designer', '/studio', '/studio/sales', '/demo', '/embed/designer', '/pitch/developers', '/products/42', '/cart', '/my-designs'];

describe('a missing file is never the app page', () => {
  it('keeps every file folder out of the app shell', () => {
    for (const path of MISSING_FILES) {
      expect(isFileFolderPath(path)).toBe(true);
      expect(isAppShellPath(path)).toBe(false);
    }
    for (const path of APP_PAGES) expect(isAppShellPath(path)).toBe(true);
  });

  it('does not rewrite a missing file to the One Live Build shell', async () => {
    for (const path of ['/assets/no-such-file', '/lessons/none', '/models/none']) {
      const response = await middleware(new Request(`https://onelivebuild.com${path}`));
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('leaves the file folders out of the app fallback in vercel.json', () => {
    const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string; destination: string }[] };
    const fallback = config.rewrites[config.rewrites.length - 1];
    expect(fallback.destination).toBe('/index.html');
    const matches = new RegExp(`^${fallback.source}$`);
    for (const path of MISSING_FILES) expect(matches.test(path)).toBe(false);
    for (const path of APP_PAGES) expect(matches.test(path)).toBe(true);
    // Every file folder in the list is excluded, and only those.
    for (const folder of FILE_FOLDERS) expect(fallback.source).toContain(folder.slice(1));
  });
});

describe('studio pages open only through the door', () => {
  it('loads a studio page from the server when the tab started on an open page', () => {
    for (const path of ['/', '/home', '/designer', '/studio', '/studio/sales', '/cart', '/my-designs', '/admin/merchants']) {
      expect(opensWithoutStudioCode(path)).toBe(false);
      expect(needsServerLoad(path, false)).toBe(true);
    }
  });
  it('moves freely between open pages', () => {
    for (const path of ['/demo', '/embed/designer', '/pitch/developers', '/pitch/eco-city', '/products/42']) expect(needsServerLoad(path, false)).toBe(false);
  });
  it('never reloads a tab the server already let through', () => {
    for (const path of [...APP_PAGES, '/admin/merchants']) expect(needsServerLoad(path, true)).toBe(false);
  });
});
