/** One Live Build admin sign-in for onelivebuild.com/admin.
 *
 * Nothing here knows the password. The server holds only:
 * - OLB_ADMIN_USERS: the emails that may sign in (comma list, any case),
 * - OLB_ADMIN_PASS_HASH: "pbkdf2:<iterations>:<salt hex>:<hash hex>" (PBKDF2-SHA256),
 * - OLB_ADMIN_SECRET: the key that signs the session cookie.
 * Victor sets all three with `node tools/set-admin-pass.mjs`. Any of them missing or malformed
 * means sign-in is off (fail closed).
 *
 * The cookie is signed for one host and one email and lasts 30 days. Changing OLB_ADMIN_SECRET
 * (running the script again) signs everyone out; removing an email from OLB_ADMIN_USERS signs
 * that person out. Web Crypto only, so it runs in the Edge middleware and in tests. */

export const ADMIN_COOKIE = '__Host-olb-admin';
export const ADMIN_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const MIN_PBKDF2_ITERATIONS = 200_000;
const MAX_PBKDF2_ITERATIONS = 5_000_000;
const encoder = new TextEncoder();

export type AdminEnv = {
  OLB_ADMIN_USERS?: string;
  OLB_ADMIN_PASS_HASH?: string;
  OLB_ADMIN_SECRET?: string;
};

export type AdminConfig =
  | { readonly ok: true; readonly users: readonly string[]; readonly iterations: number; readonly salt: Uint8Array<ArrayBuffer>; readonly hash: string; readonly secret: string }
  /** Names (never values) of the settings that are missing or malformed. */
  | { readonly ok: false; readonly missing: readonly string[] };

const EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Passwords are compared as typed, after Unicode NFC (the same letters typed on a
 * tablet or a PC give the same bytes). The set-up script does the same. */
export function normalizePassword(value: string): string {
  return value.normalize('NFC');
}

function parseUsers(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const users = raw.split(',').map(normalizeEmail).filter(Boolean);
  if (!users.length || users.some((user) => user.length > 254 || !EMAIL.test(user))) return null;
  return [...new Set(users)];
}

function fromHex(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function readAdminConfig(env: AdminEnv): AdminConfig {
  const missing: string[] = [];
  const users = parseUsers(env.OLB_ADMIN_USERS?.trim());
  if (!users) missing.push('OLB_ADMIN_USERS');
  const parts = /^pbkdf2:(\d{6,7}):([0-9a-f]{32,128}):([0-9a-f]{64})$/.exec(env.OLB_ADMIN_PASS_HASH?.trim() ?? '');
  const iterations = parts ? Number(parts[1]) : 0;
  const saltHex = parts?.[2] ?? '';
  if (!parts || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS || saltHex.length % 2 !== 0) missing.push('OLB_ADMIN_PASS_HASH');
  const secret = env.OLB_ADMIN_SECRET?.trim() ?? '';
  if (secret.length < 32 || secret.length > 512) missing.push('OLB_ADMIN_SECRET');
  if (missing.length || !users || !parts) return { ok: false, missing };
  return { ok: true, users, iterations, salt: fromHex(saltHex), hash: parts[3], secret };
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** PBKDF2-SHA256, 256 bits, compared in constant time. */
export async function passwordMatches(password: string, config: Extract<AdminConfig, { ok: true }>): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(normalizePassword(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: config.salt, iterations: config.iterations }, key, 256);
  return sameText(toHex(bits), config.hash);
}

const signingKeys = new Map<string, Promise<CryptoKey>>();
function signingKey(secret: string): Promise<CryptoKey> {
  let key = signingKeys.get(secret);
  if (!key) {
    if (signingKeys.size > 4) signingKeys.clear();
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    signingKeys.set(secret, key);
  }
  return key;
}

async function signature(secret: string, host: string, email: string, expires: number): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(`olb-admin|v1|${host.toLowerCase()}|${email}|${expires}`)));
}

function base64url(text: string): string {
  let binary = '';
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): string | null {
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** The cookie value: v1.<expires, unix seconds>.<email, base64url>.<HMAC-SHA256 hex>. */
export async function adminCookieValue(email: string, config: Extract<AdminConfig, { ok: true }>, host: string, nowMs: number): Promise<string> {
  const expires = Math.floor(nowMs / 1000) + ADMIN_SESSION_SECONDS;
  return `v1.${expires}.${base64url(email)}.${await signature(config.secret, host, email, expires)}`;
}

export function adminSetCookie(value: string): string {
  return `${ADMIN_COOKIE}=${value}; Path=/; Max-Age=${ADMIN_SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export const ADMIN_CLEAR_COOKIE = `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

function cookieFrom(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const item = part.trim();
    if (item.startsWith(`${name}=`)) return item.slice(name.length + 1);
  }
  return null;
}

/** The signed-in email, or null. Never throws. */
export async function readAdminSession(cookieHeader: string | null, config: AdminConfig, host: string, nowMs: number): Promise<string | null> {
  if (!config.ok) return null;
  const match = /^v1\.(\d{10})\.([A-Za-z0-9_-]{1,400})\.([0-9a-f]{64})$/.exec(cookieFrom(cookieHeader, ADMIN_COOKIE) ?? '');
  if (!match) return null;
  const expires = Number(match[1]);
  const now = Math.floor(nowMs / 1000);
  // Expired, or claiming more than 30 days (+5 minutes of clock drift): not ours.
  if (expires <= now || expires > now + ADMIN_SESSION_SECONDS + 300) return null;
  const email = fromBase64url(match[2]);
  if (!email || !config.users.includes(email)) return null;
  try {
    return sameText(await signature(config.secret, host, email, expires), match[3]) ? email : null;
  } catch {
    return null;
  }
}
