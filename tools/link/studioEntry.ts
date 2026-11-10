import type { Plugin } from 'vite';

/** Keep the original public graph byte-identical. Studio sections exist only in
 * the isolated /designer build; access control remains the existing middleware. */
export function studioEntry(privateBuild: boolean): Plugin {
  return {
    name:'trade-link-private-entry', apply:'build', enforce:'pre',
    transform(source, id) {
      if (privateBuild) return;
      const path=id.replace(/\\/g,'/');
      // The two collaboration seams must vanish even as import edges in public
      // builds. Do not transform unrelated files or change their source maps.
      if (path.endsWith('/src/components/RoomCanvas.tsx') || path.endsWith('/src/components/RoomView3D.tsx')) {
        const lines=source.split(/\r?\n/);
        const marked=lines.filter(line=>line.includes('@studio-hook'));
        if(!marked.length)return;
        if(marked.length!==2 || !marked.some(line=>line.trimStart().startsWith('import ')))throw new Error('Expected one private import and one render hook: '+path);
        return lines.filter(line=>!line.includes('@studio-hook')).join('\n');
      }
      if (!path.endsWith('/src/components/ProjectWorkspace.tsx')) return;
      const marker = /^[ \t]*\/\/ @studio-only\r?\n[\s\S]*?^[ \t]*\/\/ @end-studio-only\r?\n/gm;
      const publicSource = source.replace(marker, '');
      if (/@(?:end-)?studio-only/.test(publicSource)) throw new Error('Unbalanced studio-only entry markers');
      return publicSource;
    },
  };
}
