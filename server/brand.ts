/** Which look a request gets. The app is the same everywhere; only the shell
 * (icons, card, title, data-brand) and the passcode page change.
 * - onelivebuild.com (+ www, shopbuild): One Live Build.
 * - Vercel previews: One Live Build by default, `?brand=ppw` for the old look.
 * - Everything else (designer.ppwellness.co, the vercel.app production alias): PPW. */
export type Brand = 'olb' | 'ppw';

export const OLB_HOSTS: ReadonlySet<string> = new Set(['onelivebuild.com', 'www.onelivebuild.com', 'shopbuild.onelivebuild.com']);

export function brandFor(url: URL, environment: string): Brand {
  if (OLB_HOSTS.has(url.hostname.toLowerCase())) return 'olb';
  if (environment === 'preview' && url.searchParams.get('brand') !== 'ppw') return 'olb';
  return 'ppw';
}

/** A page the single-page app answers (no file extension, or /index.html), not a file such as /assets/app.js. */
export function isAppShellPath(pathname: string): boolean {
  if (pathname === '/index.html') return true;
  return !pathname.slice(pathname.lastIndexOf('/') + 1).includes('.');
}
