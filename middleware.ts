import { ipAddress, next } from '@vercel/functions';
import { handleAccess } from './server/accessGate';
import { neonCommand } from './server/accessStorage';

// This protects pages AND app assets before the CDN. Existing machine APIs keep
// their own authentication (webhooks, scheduled jobs, merchant sessions and MCP).
export const config = { matcher: '/((?!api/|_vercel/).*)', runtime: 'edge' };

export default async function middleware(request: Request): Promise<Response> {
  const response = await handleAccess(request, {
    command: neonCommand({
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
      POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
    }),
    now: Date.now,
    clientIp: ipAddress(request) ?? 'unknown',
    namespace: process.env.VERCEL_ENV ?? 'development',
    codeHash: process.env.DESIGNER_ACCESS_CODE_SHA256,
  });
  return response ?? next();
}
