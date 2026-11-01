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

/** Pitch decks served from the deck site through the rewrites in vercel.json (onelivebuild.com/pitch/stretchtek/).
 * Each is a whole page of its own, not a route of this app, so the shell rewrite leaves it alone. */
export const HOSTED_DECK_PATHS: readonly string[] = ['/pitch/stretchtek'];

export function isHostedDeckPath(pathname: string): boolean {
  return HOSTED_DECK_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

/** A page the single-page app answers (no file extension, or /index.html), not a file such as /assets/app.js. */
export function isAppShellPath(pathname: string): boolean {
  if (pathname === '/index.html') return true;
  if (isHostedDeckPath(pathname)) return false;
  return !pathname.slice(pathname.lastIndexOf('/') + 1).includes('.');
}
