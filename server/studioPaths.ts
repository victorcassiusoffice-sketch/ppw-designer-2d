/** Which addresses open without the studio code, and which folders hold only files.
 * No imports: the edge middleware, the API functions and the browser app read the same rules. */

/** Folders that hold only files (built scripts, models, pictures, clips, fonts). A file that
 * is not there is a 404, never the app page (vercel.json and server/brand.ts follow this list). */
export const FILE_FOLDERS: readonly string[] = ['/assets/', '/models/', '/draco/', '/showcase/', '/lessons/', '/brand/', '/fonts/'];

export function isFileFolderPath(pathname: string): boolean {
  return FILE_FOLDERS.some((folder) => pathname.startsWith(folder));
}

/** Public pitches, the demo and the embed. /studio and the designer shell stay gated. */
export function opensWithoutStudioCode(pathname: string): boolean {
  if (pathname === '/favicon.ico' || pathname === '/ppw-favicon.svg' || pathname === '/robots.txt') return true;
  // Logos, icons, the social card and the self-hosted fonts: the passcode page and
  // the open pages (/demo, /embed) draw them before anyone has entered the code.
  if (pathname.startsWith('/brand/')) return true;
  if (pathname.startsWith('/fonts/')) return true;
  if (pathname === '/demo' || pathname.startsWith('/demo/')) return true;
  if (pathname === '/embed' || pathname.startsWith('/embed/')) return true;
  if (pathname.startsWith('/pitch/')) return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname.startsWith('/models/')) return true;
  if (pathname.startsWith('/products/')) return true;
  if (pathname.startsWith('/draco/')) return true;
  if (pathname.startsWith('/showcase/')) return true;
  // The lesson clips and posters (silent, recorded from the app): the tool
  // cards show them on /demo and /embed too.
  if (pathname.startsWith('/lessons/')) return true;
  return false;
}
