/** The studio session the door hands out after the code: an opaque cookie, stored only as a
 * hash, scoped to one environment and one hostname. No imports, so the middleware and the
 * API functions read sessions the same way. */

export const ACCESS_COOKIE = '__Host-ppw-studio';

const encoder = new TextEncoder();

export async function sha256Hex(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), (v) => v.toString(16).padStart(2, '0')).join('');
}

export function studioNamespace(environment: string, host: string): string {
  return `ppw:studio-access:v1:${environment}:${host}`;
}

/** The session token from a Cookie header, or null when absent or not in our shape. */
export function readStudioToken(cookieHeader: string | null | undefined): string | null {
  const value = (cookieHeader ?? '').split(';').map((v) => v.trim()).find((v) => v.startsWith(`${ACCESS_COOKIE}=`))?.slice(ACCESS_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function studioSessionKey(namespace: string, token: string): Promise<string> {
  return `${namespace}:session:${await sha256Hex(token)}`;
}
