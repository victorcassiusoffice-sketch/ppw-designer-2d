// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { OutputBundle, OutputChunk } from 'rollup';
import { firstPictureAssets, firstPicturePreloadScript } from '../../tools/firstPicturePreload';

function chunk(name: string, imports: string[] = [], dynamicImports: string[] = [], css: string[] = []) {
  return { type: 'chunk', name, fileName: `assets/${name}-hash.js`, imports, dynamicImports,
    viteMetadata: { importedCss: new Set(css) } } as unknown as OutputChunk;
}

afterEach(() => document.head.replaceChildren());

describe('HTML first-picture delivery', () => {
  it('includes existing static imports and styles, excluding deferred World and other route code', () => {
    const chunks = [chunk('App', ['assets/shared-hash.js'], ['assets/SiteWorkspace-hash.js'], ['assets/App-hash.css']),
      chunk('ThreeStage', ['assets/shared-hash.js'], ['assets/WalkMode-hash.js']), chunk('shared'),
      chunk('SiteWorkspace'), chunk('WalkMode'), chunk('CartPage')];
    const bundle = Object.fromEntries(chunks.map(c => [c.fileName, c])) as OutputBundle;
    expect(firstPictureAssets(bundle)).toEqual({ scripts: ['assets/App-hash.js', 'assets/shared-hash.js', 'assets/ThreeStage-hash.js'], styles: ['assets/App-hash.css'] });
  });

  it.each(['/demo', '/demo?view=3d&pitch=1', '/demo/', '/embed/designer?scene=paint'])('preloads the actual designer dependencies on %s', (url) => {
    const target = new URL(url, 'https://example.test');
    const script = firstPicturePreloadScript({ scripts: ['assets/App-final.js', 'assets/ThreeStage-final.js'], styles: ['assets/App-final.css'] });
    new Function('location', 'document', script)(target, document);
    const links = [...document.head.querySelectorAll('link')];
    expect(links.map(l => [l.getAttribute('href'), l.rel, l.as ?? '', l.crossOrigin])).toEqual([
      ['/assets/App-final.js', 'modulepreload', '', ''], ['/assets/ThreeStage-final.js', 'modulepreload', '', ''], ['/assets/App-final.css', 'preload', 'style', ''],
    ]);
  });

  it.each(['/demo?view=2d', '/embed/designer?view=2d', '/', '/products', '/pitch/plumbing', '/studio', '/designer', '/demonstration?view=3d'])('does not fetch designer code on %s', (url) => {
    new Function('location', 'document', firstPicturePreloadScript({ scripts: ['assets/App-final.js'], styles: [] }))(new URL(url, 'https://example.test'), document);
    expect(document.head.querySelector('link')).toBeNull();
  });
});
