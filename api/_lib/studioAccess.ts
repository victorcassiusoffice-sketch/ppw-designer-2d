/**
 * Saved designs hold customers' emails and plans, so only the studio reads or changes them:
 * a browser with the studio session the door hands out after the code, or with the
 * One Live Build sign-in. Same session store, key and host scope as the door (middleware.ts).
 */
import { neonCommand } from '../../server/accessStorage.js';
import { readAdminConfig, readAdminSession } from '../../server/adminAuth.js';
import { readStudioToken, studioNamespace, studioSessionKey } from '../../server/studioSession.js';

type Headers = Record<string, string | string[] | undefined>;
type Command = (args: (string | number)[]) => Promise<unknown>;

export type StudioAccess = 'open' | 'closed' | 'unavailable';

export interface StudioAccessDependencies {
  env?: Record<string, string | undefined>;
  command?: Command;
  now?: () => number;
}

function header(headers: Headers | undefined, name: string): string | null {
  const value = headers?.[name];
  if (typeof value === 'string') return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

/** The host the browser asked for (the session is scoped to it). */
export function requestHost(headers: Headers | undefined): string {
  return (header(headers, 'host') ?? header(headers, 'x-forwarded-host') ?? '').split(',')[0].trim().toLowerCase();
}

export async function studioAccess(headers: Headers | undefined, deps: StudioAccessDependencies = {}): Promise<StudioAccess> {
  const env = deps.env ?? process.env;
  const host = requestHost(headers);
  if (!host) return 'closed';
  const cookies = header(headers, 'cookie');
  const admin = readAdminConfig({
    OLB_ADMIN_USERS: env.OLB_ADMIN_USERS,
    OLB_ADMIN_PASS_HASH: env.OLB_ADMIN_PASS_HASH,
    OLB_ADMIN_SECRET: env.OLB_ADMIN_SECRET,
  });
  if (admin.ok && (await readAdminSession(cookies, admin, host, (deps.now ?? Date.now)())) !== null) return 'open';
  const token = readStudioToken(cookies);
  if (!token) return 'closed';
  try {
    const command = deps.command ?? neonCommand(env);
    const key = await studioSessionKey(studioNamespace(env.VERCEL_ENV ?? 'development', host), token);
    return (await command(['GET', key])) === 'unlocked' ? 'open' : 'closed';
  } catch {
    return 'unavailable';
  }
}

/** A change sent from another site (the session cookie travels cross-site) is refused. */
export function crossSiteWrite(method: string | undefined, headers: Headers | undefined): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  const origin = header(headers, 'origin');
  if (!origin) return false;
  try {
    return new URL(origin).host.toLowerCase() !== requestHost(headers);
  } catch {
    return true;
  }
}
