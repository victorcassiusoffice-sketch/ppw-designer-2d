import type { Plugin } from 'vite';

/** Keep the original public graph byte-identical. Studio sections exist only in
 * the isolated /designer build; access control remains the existing middleware. */
export function studioEntry(privateBuild: boolean): Plugin {
  return {
    name:'trade-link-private-entry', apply:'build', enforce:'pre',
    transform(source, id) {
      if (privateBuild || !id.replace(/\\/g,'/').endsWith('/src/components/ProjectWorkspace.tsx')) return;
      const marker = /^[ \t]*\/\/ @studio-only\r?\n[\s\S]*?^[ \t]*\/\/ @end-studio-only\r?\n/gm;
      const publicSource = source.replace(marker, '');
      if (/@(?:end-)?studio-only/.test(publicSource)) throw new Error('Unbalanced studio-only entry markers');
      return publicSource;
    },
  };
}
