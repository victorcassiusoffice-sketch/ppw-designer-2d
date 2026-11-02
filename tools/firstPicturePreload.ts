import type { OutputBundle, OutputChunk } from 'rollup';
import type { Plugin } from 'vite';

type StyledChunk = OutputChunk & { viteMetadata?: { importedCss: Set<string> } };

/** Only the existing static designer closure, never a dynamic feature import. */
export function firstPictureAssets(bundle: OutputBundle): { scripts: string[]; styles: string[] } {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  const visit = (chunk: StyledChunk) => {
    if (scripts.has(chunk.fileName)) return;
    scripts.add(chunk.fileName);
    for (const css of chunk.viteMetadata?.importedCss ?? []) styles.add(css);
    for (const file of chunk.imports) {
      const dependency = bundle[file];
      if (dependency?.type === 'chunk') visit(dependency);
    }
  };
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === 'chunk' && (chunk.name === 'App' || chunk.name === 'ThreeStage')) visit(chunk);
  }
  return { scripts: [...scripts], styles: [...styles] };
}

export function firstPicturePreloadScript(assets: ReturnType<typeof firstPictureAssets>): string {
  const json = JSON.stringify(assets).replace(/</g, '\\u003c');
  // The HTML route gate matches demoRoute's default 3D behavior. It deliberately
  // excludes marketing, shop, studio, and explicit 2D visits. Preloading does not
  // evaluate the module; React still owns its normal loading/error lifecycle.
  return `if(/^\\/(?:demo|embed\\/designer)\\/*$/.test(location.pathname)&&new URLSearchParams(location.search).get('view')!=='2d'){const a=${json};for(const [k,files]of Object.entries(a))for(const f of files){const l=document.createElement('link');l.rel=k==='scripts'?'modulepreload':'preload';if(k==='styles')l.as='style';l.crossOrigin='';l.href='/'+f;document.head.append(l)}}`;
}

export function firstPicturePreload(): Plugin {
  return {
    name: 'preload-existing-first-picture-modules',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (!context.bundle) return;
        const assets = firstPictureAssets(context.bundle);
        if (!assets.scripts.length) throw new Error('First-picture entry chunks were not emitted.');
        return [{ tag: 'script', children: firstPicturePreloadScript(assets), injectTo: 'head' }];
      },
    },
  };
}
