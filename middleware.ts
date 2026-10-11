import { ipAddress, next, rewrite } from '@vercel/functions';
import { handleAccess } from './server/accessGate';
import { neonCommand } from './server/accessStorage';
import { brandFor, isAppShellPath } from './server/brand';

// This protects pages AND app assets before the CDN. Existing machine APIs keep
// their own authentication (webhooks, scheduled jobs, merchant sessions and MCP).
export const config = { matcher: '/((?!api/|_vercel/).*)', runtime: 'edge' };

export default async function middleware(request: Request): Promise<Response> {
  const environment = process.env.VERCEL_ENV ?? 'development';
  const response = await handleAccess(request, {
    command: neonCommand({
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
      POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
    }),
    now: Date.now,
    clientIp: ipAddress(request) ?? 'unknown',
    namespace: environment,
    codeHash: process.env.DESIGNER_ACCESS_CODE_SHA256,
  });
  if (response) return response;
  // One Live Build hosts get the One Live Build shell (icons, card, data-brand="olb").
  // Same app bundle; files (/assets/…, /brand/…) are never rewritten.
  const url = new URL(request.url);
  if (brandFor(url, environment) === 'olb' && isAppShellPath(url.pathname)) return rewrite(new URL('/olb.html', url));
  return next();
}
