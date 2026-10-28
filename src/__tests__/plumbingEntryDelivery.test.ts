// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import hero from '../pages/sales/plumbingHero.json';

// This Node build helper deliberately sits outside the browser TS project.
const helperPath = '../../tools/build-plumbing-entry.mjs';
const { startupAssets, plumbingAssets, rewriteEntryHtml, checkPrimaryHashes, isolatedBuildConfig } = await import(helperPath);
const isolated = { scripts: ['/assets/plumbing/entry.js'], preloads: ['/assets/plumbing/entry.js', '/assets/plumbing/react.js'], styles: ['/assets/plumbing/entry.css'] };
const html = `<!doctype html><html data-brand="olb"><head><meta charset="UTF-8"><link rel="manifest" href="/brand/olb/site.webmanifest"><style>#designer-startup{display:none}</style><script id="existing">window.existing=true</script><script type="module" crossorigin src="/assets/react.js"></script><script type="module" crossorigin src="/assets/main.js"></script><link rel="modulepreload" crossorigin href="/assets/shared.js"><link rel="stylesheet" crossorigin href="/assets/main.css"><link rel="stylesheet" crossorigin href="/assets/theme.css"></head><body><div id="designer-startup">Loading 3D</div><div id="root"></div></body></html>`;

function generated() {
  const result = rewriteEntryHtml(html, isolated, hero).html as string;
  const head = result.match(/<script>([\s\S]*?)<\/script>/)![1];
  const module = result.match(/<script type="module">([\s\S]*?)<\/script>/)![1];
  return { result, head, module };
}
function deliver(url: string) {
  const location = new URL(url, 'https://example.test');
  new Function('location', 'document', generated().head)(location, document);
  return location;
}
function start(location: URL, load: (src: string) => Promise<void>): Promise<void> {
  // Replace only the native import boundary, leaving the emitted readiness and
  // ordering code intact. The browser smoke also executes real modules.
  const code = generated().module.replace('import(src)', 'load(src)');
  return new Function('location', 'document', 'load', `return ${code}`)(location, document, load);
}
beforeEach(() => { document.head.replaceChildren(); document.body.innerHTML = '<div id="root"></div>'; });
afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); });

describe('final HTML route delivery', () => {
  it.each(['/demo?view=3d&pitch=1', '/demo?view=2d', '/embed/designer?view=3d&pitch=1', '/', '/designer', '/studio', '/shop', '/admin', '/pitch/plumbing/private', '/pitch/plumbings'])('preserves original startup resources on %s', url => {
    const location = deliver(url);
    expect([...document.head.querySelectorAll('link')].map(link => link.getAttribute('href'))).toEqual([
      '/assets/react.js', '/assets/main.js', '/assets/shared.js', '/assets/main.css', '/assets/theme.css',
    ]);
    expect([...document.querySelectorAll('link')].find(link => link.as === 'image')).toBeUndefined();
    expect(location.href).toBe(new URL(url, 'https://example.test').href);
  });

  it.each(['/pitch/plumbing', '/pitch/plumbing/?brand=ppw'])('loads only the isolated entry and exact responsive hero on %s', url => {
    deliver(url);
    expect([...document.querySelectorAll('link[rel="modulepreload"]')].map(link => link.getAttribute('href'))).toEqual(isolated.preloads);
    expect([...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.getAttribute('href'))).toEqual(isolated.styles);
    const image = [...document.querySelectorAll('link')].find(link => link.as === 'image')!;
    expect(image.getAttribute('href')).toBe(hero.src);
    expect(image.imageSrcset).toBe(hero.srcSet);
    expect(image.imageSizes).toBe(hero.sizes);
    expect(image.fetchPriority).toBe('high');
    expect([...document.head.children].indexOf(image)).toBeLessThan([...document.head.children].indexOf(document.querySelector('link[rel="stylesheet"]')!));
  });

  it('does not request an invisible hero on a chapter permalink', () => {
    const url = '/pitch/plumbing?brand=ppw#Next%20step';
    expect(deliver(url).href).toBe(new URL(url, 'https://example.test').href);
    expect([...document.querySelectorAll('link')].find(link => link.as === 'image')).toBeUndefined();
  });

  it('retains brand/manifest/critical loading markup and removes parser-blocking stylesheet links', () => {
    const { result } = generated();
    expect(result).toContain('<html data-brand="olb">');
    expect(result).toContain('<link rel="manifest" href="/brand/olb/site.webmanifest">');
    expect(result).toContain('<style>#designer-startup{display:none}</style>');
    expect(result).toContain('<script id="existing">window.existing=true</script>');
    expect(result).toContain('<div id="designer-startup">Loading 3D</div>');
    expect(result).not.toMatch(/<link[^>]*rel="stylesheet"/);
    expect(result.indexOf('<meta charset=')).toBeLessThan(result.indexOf('<script>'));
    expect(result).not.toMatch(/<script[^>]*src=/);
  });

  it('waits for CSS, then imports original scripts in order with the root available', async () => {
    const location = deliver('/demo');
    const load = vi.fn(async (_src: string) => { expect(document.getElementById('root')).not.toBeNull(); });
    const boot = start(location, load);
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')];
    styles[0].dispatchEvent(new Event('load'));
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    styles[1].dispatchEvent(new Event('error'));
    await boot;
    expect(load.mock.calls.map(call => call[0])).toEqual(['/assets/react.js', '/assets/main.js']);
  });

  it.each(['load', 'error'])('does not deadlock when cached CSS %s happened before the deferred module', async event => {
    const location = deliver('/pitch/plumbing');
    document.querySelector('link[rel="stylesheet"]')!.dispatchEvent(new Event(event));
    const load = vi.fn(async (_src: string) => {});
    await start(location, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('/assets/plumbing/entry.js');
  });

  it('fails closed on startup attributes whose semantics are not supported', () => {
    expect(() => startupAssets(html.replace('type="module" crossorigin', 'type="module" nonce="abc" crossorigin'))).toThrow('Unsupported startup attribute');
    expect(() => startupAssets(html.replace('type="module" crossorigin', 'type="module" crossorigin="use-credentials"'))).toThrow('Credentialled');
  });
});

describe('isolated output contract', () => {
  it('follows only static pitch dependencies and rejects a primary dependency', () => {
    const entry = { type: 'chunk', isEntry: true, fileName: 'assets/plumbing/entry.js', imports: ['assets/plumbing/react.js'], dynamicImports: ['assets/plumbing/form.js'], viteMetadata: { importedCss: new Set(['assets/plumbing/entry.css']) } };
    const react = { type: 'chunk', fileName: 'assets/plumbing/react.js', imports: [] };
    expect(plumbingAssets([entry, react])).toEqual(isolated);
    expect(() => plumbingAssets([{ ...entry, imports: ['assets/main.js'] }, react])).toThrow('primary asset');
    expect(() => plumbingAssets([entry])).toThrow('Missing plumbing dependency');
  });

  it('retains private source-map policy and all existing plugins/defines', () => {
    const plugins = [{ name: 'sentry-upload-delete' }, { name: 'no-public-source-maps' }];
    const manualChunks = vi.fn();
    const base = { plugins, define: { __TEST_HOOKS__: 'false' }, build: { sourcemap: 'hidden', rollupOptions: { external: ['canvg'], output: { manualChunks } } } };
    const result = isolatedBuildConfig(base, '/project');
    expect(result.plugins).toBe(plugins);
    expect(result.define).toBe(base.define);
    expect(result.build.sourcemap).toBe('hidden');
    expect(result.build.emptyOutDir).toBe(false);
    expect(result.publicDir).toBe(false);
    expect(result.build.rollupOptions.external).toBe(base.build.rollupOptions.external);
    expect(result.build.rollupOptions.output.manualChunks).toBe(manualChunks);
    expect(result.build.rollupOptions.output.entryFileNames).toBe('assets/plumbing/[name]-[hash].js');
  });

  it('rejects changed/deleted primary files or unexpected emissions, allowing only explicit HTML finalization', () => {
    const before = new Map([['assets/main.js', 'original'], ['olb.html', 'old']]);
    expect(() => checkPrimaryHashes(before, new Map([...before, ['assets/plumbing/entry.js', 'new']]))).not.toThrow();
    expect(() => checkPrimaryHashes(before, new Map([['assets/main.js', 'changed'], ['olb.html', 'old']]))).toThrow('changed primary');
    expect(() => checkPrimaryHashes(before, new Map([['assets/main.js', 'original']]), ['olb.html'])).toThrow('removed primary');
    expect(() => checkPrimaryHashes(before, new Map([...before, ['pitch/index.html', 'new']]))).toThrow('outside its prefix');
    expect(() => checkPrimaryHashes(before, new Map([['assets/main.js', 'original'], ['olb.html', 'new']]), ['olb.html'])).not.toThrow();
  });
});
