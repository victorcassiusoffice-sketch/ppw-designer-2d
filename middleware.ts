import { ipAddress, next } from '@vercel/functions';
import { handleAccess, redisCommand } from './server/accessGate';

// This protects pages AND app assets before the CDN. Existing machine APIs keep
// their own authentication (webhooks, scheduled jobs, merchant sessions and MCP).
export const config = { matcher: '/((?!api/|_vercel/).*)', runtime: 'nodejs' };

export default async function middleware(request: Request): Promise<Response> {
  const response = await handleAccess(request, {
    command: redisCommand({
      KV_REST_API_URL: process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    }),
    now: Date.now,
    clientIp: ipAddress(request) ?? 'unknown',
    namespace: process.env.VERCEL_ENV ?? 'development',
    codeHash: process.env.DESIGNER_ACCESS_CODE_SHA256,
  });
  return response ?? next();
}
