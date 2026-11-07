import { ipAddress, next, rewrite } from '@vercel/functions';
import { handleAccess } from './server/accessGate';
import { neonCommand } from './server/accessStorage';
import { readAdminConfig, readAdminSession } from './server/adminAuth';
import { brandFor, isAppShellPath } from './server/brand';
import { handleOlbSite, isLandingSite } from './server/olbSite';

// This protects pages AND app assets before the CDN. Existing machine APIs keep
// their own authentication (webhooks, scheduled jobs, merchant sessions and MCP).
export const config = { matcher: '/((?!api/|_vercel/).*)', runtime: 'edge' };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default async function middleware(request: Request): Promise<Response> {
  const environment = process.env.VERCEL_ENV ?? 'development';
  const url = new URL(request.url);
  const command = neonCommand({
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
  });
  const clientIp = ipAddress(request) ?? 'unknown';
  // onelivebuild.com: the public landing, the type decks and /admin come first.
  // Every other host goes straight to the gate, as before.
  const admin = isLandingSite(url, environment)
    ? readAdminConfig({
        OLB_ADMIN_USERS: process.env.OLB_ADMIN_USERS,
        OLB_ADMIN_PASS_HASH: process.env.OLB_ADMIN_PASS_HASH,
        OLB_ADMIN_SECRET: process.env.OLB_ADMIN_SECRET,
      })
    : null;
  if (admin) {
    const site = await handleOlbSite(request, { admin, command, now: Date.now, clientIp, namespace: environment, sleep });
    if (site) return site;
  }
  const signedInConfig = admin?.ok ? admin : null;
  const response = await handleAccess(request, {
    command,
    now: Date.now,
    clientIp,
    namespace: environment,
    codeHash: process.env.DESIGNER_ACCESS_CODE_SHA256,
    // The admin cookie opens what the studio code opens (onelivebuild.com only).
    signedIn: signedInConfig
      ? async () => (await readAdminSession(request.headers.get('cookie'), signedInConfig, url.host, Date.now())) !== null
      : undefined,
  });
  if (response) return response;
  // One Live Build hosts get the One Live Build shell (icons, card, data-brand="olb").
  // Same app bundle; files (/assets/…, /brand/…) are never rewritten.
  if (brandFor(url, environment) === 'olb' && isAppShellPath(url.pathname)) return rewrite(new URL('/olb.html', url));
  return next();
}
