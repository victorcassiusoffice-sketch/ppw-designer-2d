import { randomBytes } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import middleware from '../../middleware';
import { ACCESS_COOKIE } from '../../server/accessGate';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminCookieValue, MIN_PBKDF2_ITERATIONS, passwordMatches, readAdminConfig, readAdminSession, type AdminConfig } from '../../server/adminAuth';
import { adminDestination, handleOlbSite, LOCKOUT_SECONDS, MAX_WRONG_TRIES, WRONG_TRY_DELAY_MS, type OlbSiteDependencies } from '../../server/olbSite';

// The set-up script is a Node tool outside the TypeScript project (same pattern as
// plumbingEntryDelivery.test.ts).
const scriptPath = '../../tools/set-admin-pass.mjs';
const script = await import(scriptPath);

// A throwaway password made for this run only: never a real one, never written anywhere.
const PASSWORD = `t-${randomBytes(12).toString('hex')}`;
const USERS = 'Admin.One@Example.com, second@example.org';
let env: { OLB_ADMIN_USERS: string; OLB_ADMIN_PASS_HASH: string; OLB_ADMIN_SECRET: string };
let config: Extract<AdminConfig, { ok: true }>;

beforeAll(() => {
  env = { OLB_ADMIN_USERS: USERS, OLB_ADMIN_PASS_HASH: script.makePasswordHash(PASSWORD, { rounds: MIN_PBKDF2_ITERATIONS }), OLB_ADMIN_SECRET: script.makeSecret() };
  const parsed = readAdminConfig(env);
  if (!parsed.ok) throw new Error('test config should parse');
  config = parsed;
});
afterEach(() => { vi.unstubAllEnvs(); });

/** In-memory copy of the gate storage's commands, with expiry, so the lockout can be timed. */
function storage(clock: { now: number }) {
  const rows = new Map<string, { value: string; expires: number }>();
  const live = (key: string) => { const row = rows.get(key); return row && row.expires > clock.now ? row : undefined; };
  const command = vi.fn(async (args: (string | number)[]) => {
    const [op, key] = args as [string, string];
    expect(key.startsWith('ppw:studio-access:')).toBe(true);
    if (op === 'GET') return live(key)?.value ?? null;
    if (op === 'SET') { if (live(key)) return null; rows.set(key, { value: String(args[2]), expires: clock.now + Number(args[4]) * 1000 }); return 'OK'; }
    if (op === 'INCR') { const row = live(key); const value = String(Number(row?.value ?? 0) + 1); rows.set(key, { value, expires: row?.expires ?? clock.now + 660_000 }); return Number(value); }
    if (op === 'EXPIRE') { const row = live(key); if (!row) return 0; row.expires = clock.now + Number(args[2]) * 1000; return 1; }
    throw new Error(`unexpected ${op}`);
  });
  return { rows, command };
}

function setup(overrides: Partial<OlbSiteDependencies> = {}) {
  const clock = { now: 1_800_000_000_000 };
  const { rows, command } = storage(clock);
  const sleep = vi.fn(async () => {});
  const deps: OlbSiteDependencies = { admin: config, command, now: () => clock.now, clientIp: '203.0.113.7', namespace: 'test', sleep, ...overrides };
  return { clock, rows, command, sleep, deps };
}

function signIn(fields: Record<string, string>, init: { origin?: string; host?: string; contentType?: string } = {}) {
  const host = init.host ?? 'onelivebuild.com';
  return new Request(`https://${host}/admin`, {
    method: 'POST',
    headers: { origin: init.origin ?? `https://${host}`, 'content-type': init.contentType ?? 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
}

describe('admin settings (env), read fail-closed', () => {
  it('needs all three settings and names the missing ones without echoing values', () => {
    expect(readAdminConfig({})).toEqual({ ok: false, missing: ['OLB_ADMIN_USERS', 'OLB_ADMIN_PASS_HASH', 'OLB_ADMIN_SECRET'] });
    const result = readAdminConfig({ ...env, OLB_ADMIN_SECRET: 'short' });
    expect(result).toEqual({ ok: false, missing: ['OLB_ADMIN_SECRET'] });
    expect(JSON.stringify(result)).not.toContain('short');
  });
  it('refuses fewer than 200,000 rounds, a malformed hash or a non-email user', () => {
    expect(readAdminConfig({ ...env, OLB_ADMIN_PASS_HASH: script.makePasswordHash(PASSWORD, { rounds: 100_000 }) }).ok).toBe(false);
    expect(readAdminConfig({ ...env, OLB_ADMIN_PASS_HASH: 'sha256:abc' }).ok).toBe(false);
    expect(readAdminConfig({ ...env, OLB_ADMIN_USERS: 'victor' }).ok).toBe(false);
  });
  it('reads emails case-insensitively and trims them', () => {
    expect(config.users).toEqual(['admin.one@example.com', 'second@example.org']);
    expect(config.iterations).toBeGreaterThanOrEqual(200_000);
  });
  it('agrees with the set-up script on the hash: the right password matches, a wrong one does not', async () => {
    expect(env.OLB_ADMIN_PASS_HASH).toMatch(/^pbkdf2:200000:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(await passwordMatches(PASSWORD, config)).toBe(true);
    expect(await passwordMatches(`${PASSWORD}x`, config)).toBe(false);
    expect(await passwordMatches(PASSWORD.toUpperCase(), config)).toBe(false);
    // The script's default is stronger than the floor, and its salt is fresh each time.
    expect(script.PBKDF2_ROUNDS).toBeGreaterThanOrEqual(200_000);
    expect(script.makePasswordHash(PASSWORD)).not.toBe(script.makePasswordHash(PASSWORD));
  });
});

describe('/admin sign-in', () => {
  it('fails closed with a clear message when the settings are missing', async () => {
    const { deps, command } = setup({ admin: readAdminConfig({}) });
    for (const request of [new Request('https://onelivebuild.com/admin'), signIn({ email: 'admin.one@example.com', password: PASSWORD })]) {
      const response = (await handleOlbSite(request, deps))!;
      expect(response.status).toBe(503);
      expect(await response.text()).toContain('Sign-in is not set up yet.');
      expect(response.headers.has('set-cookie')).toBe(false);
    }
    expect(command).not.toHaveBeenCalled();
  });
  it('fails closed through the real middleware while the env is empty (the preview, until the script runs)', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    for (const key of ['OLB_ADMIN_USERS', 'OLB_ADMIN_PASS_HASH', 'OLB_ADMIN_SECRET']) vi.stubEnv(key, '');
    const response = await middleware(new Request('https://ppw-designer-2d-abc-victor-ppw.vercel.app/admin'));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('Sign-in is not set up yet.');
  });
  it('shows an email and password form with no script, never framed or cached', async () => {
    const { deps } = setup();
    const response = (await handleOlbSite(new Request('https://onelivebuild.com/admin?next=%2Fdesigner'), deps))!;
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<form method="post" action="/admin">');
    expect(html).toContain('name="email" type="email"');
    expect(html).toContain('name="password" type="password" autocomplete="current-password"');
    expect(html).toContain('<input type="hidden" name="next" value="/designer">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('—');
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('signs in with a listed email (any case) and the right password: 30-day signed cookie, no wait', async () => {
    const { deps, sleep } = setup();
    const response = (await handleOlbSite(signIn({ email: '  ADMIN.ONE@example.com ', password: PASSWORD }), deps))!;
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/home');
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toMatch(new RegExp(`^${ADMIN_COOKIE}=v1\\.\\d{10}\\.[A-Za-z0-9_-]+\\.[0-9a-f]{64}; Path=/; Max-Age=${ADMIN_SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax$`));
    expect(ADMIN_SESSION_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(cookie).not.toContain(PASSWORD);
    expect(sleep).not.toHaveBeenCalled();
    const value = cookie.split(';')[0].slice(ADMIN_COOKIE.length + 1);
    expect(await readAdminSession(`${ADMIN_COOKIE}=${value}`, config, 'onelivebuild.com', deps.now())).toBe('admin.one@example.com');
  });
  it('goes to the page asked for, never off the site and never back to /admin', async () => {
    expect(adminDestination(null)).toBe('/home');
    expect(adminDestination('/designer?view=3d')).toBe('/designer?view=3d');
    expect(adminDestination('/admin')).toBe('/home');
    expect(adminDestination('/admin/sign-out')).toBe('/home');
    expect(adminDestination('//evil.example')).toBe('/designer');
    expect(adminDestination('https://evil.example/')).toBe('/designer');
    const { deps } = setup();
    const response = (await handleOlbSite(signIn({ email: 'second@example.org', password: PASSWORD, next: '/studio' }), deps))!;
    expect(response.headers.get('location')).toBe('/studio');
  });
  it('refuses a wrong password or an unlisted email after a 1 second wait, with no cookie', async () => {
    for (const fields of [{ email: 'admin.one@example.com', password: `${PASSWORD}!` }, { email: 'someone@example.com', password: PASSWORD }]) {
      const { deps, sleep } = setup();
      const response = (await handleOlbSite(signIn(fields), deps))!;
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('That email or password is wrong.');
      expect(html).not.toContain(PASSWORD);
      expect(response.headers.has('set-cookie')).toBe(false);
      expect(sleep).toHaveBeenCalledTimes(1);
      expect(sleep).toHaveBeenCalledWith(WRONG_TRY_DELAY_MS);
      expect(WRONG_TRY_DELAY_MS).toBe(1000);
    }
  });
  it('locks one address out for 10 minutes after 10 wrong tries, even for the right password', async () => {
    const { deps, clock, rows } = setup();
    expect(MAX_WRONG_TRIES).toBe(10);
    expect(LOCKOUT_SECONDS).toBe(600);
    for (let i = 1; i < MAX_WRONG_TRIES; i++) {
      const wrong = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: `wrong-${i}` }), deps))!;
      expect(wrong.status).toBe(200);
      expect(wrong.headers.has('set-cookie')).toBe(false);
    }
    const tenth = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: 'wrong-10' }), deps))!;
    expect(tenth.status).toBe(429);
    expect(await tenth.text()).toContain('Too many tries. Try again in 10 minutes.');
    const locked = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }), deps))!;
    expect(locked.status).toBe(429);
    expect(locked.headers.has('set-cookie')).toBe(false);
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(0);
    // Another address is not locked.
    const other = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }), { ...deps, clientIp: '198.51.100.9' }))!;
    expect(other.status).toBe(303);
    // The raw address is never stored.
    expect([...rows.keys()].join(' ')).not.toContain('203.0.113.7');
    clock.now += 9 * 60_000;
    expect((await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }), deps))!.status).toBe(429);
    clock.now += 61_000;
    const after = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }), deps))!;
    expect(after.status).toBe(303);
    expect(after.headers.get('set-cookie')).toContain(`${ADMIN_COOKIE}=v1.`);
  });
  it('forgets earlier wrong tries after a good sign-in', async () => {
    const { deps, clock } = setup();
    for (let i = 0; i < 9; i++) await handleOlbSite(signIn({ email: 'admin.one@example.com', password: 'nope' }), deps);
    expect((await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }), deps))!.status).toBe(303);
    clock.now += 2000; // the count is set to end one second after the good sign-in
    const next = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: 'nope' }), deps))!;
    expect(next.status).toBe(200);
    expect(await next.text()).toContain('That email or password is wrong.');
  });
  it('fails closed when the lockout storage is down, even with the right password', async () => {
    const { deps, command } = setup();
    command.mockRejectedValue(new Error('storage down'));
    const response = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }), deps))!;
    expect(response.status).toBe(503);
    expect(response.headers.has('set-cookie')).toBe(false);
  });
  it('refuses a form from another site, a non-form body and an oversized body before any check', async () => {
    const { deps, command } = setup();
    const cross = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }, { origin: 'https://evil.example' }), deps))!;
    expect(cross.status).toBe(403);
    const json = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: PASSWORD }, { contentType: 'application/json' }), deps))!;
    expect(json.status).toBe(400);
    const big = (await handleOlbSite(signIn({ email: 'admin.one@example.com', password: 'x'.repeat(4000) }), deps))!;
    expect(big.status).toBe(400);
    const empty = (await handleOlbSite(signIn({ email: '', password: '' }), deps))!;
    expect(empty.status).toBe(400);
    expect(command).not.toHaveBeenCalled();
  });
});

describe('the admin cookie', () => {
  it('is bound to its host, its email, the secret and 30 days', async () => {
    const now = 1_800_000_000_000;
    const value = await adminCookieValue('admin.one@example.com', config, 'onelivebuild.com', now);
    const header = `other=1; ${ADMIN_COOKIE}=${value}; x=y`;
    expect(await readAdminSession(header, config, 'onelivebuild.com', now)).toBe('admin.one@example.com');
    expect(await readAdminSession(header, config, 'ppw-designer-2d-abc-victor-ppw.vercel.app', now)).toBeNull();
    expect(await readAdminSession(header, config, 'onelivebuild.com', now + (ADMIN_SESSION_SECONDS + 1) * 1000)).toBeNull();
    const tampered = value.replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    expect(await readAdminSession(`${ADMIN_COOKIE}=${tampered}`, config, 'onelivebuild.com', now)).toBeNull();
    const other = value.replace(/^v1\.(\d+)\.[^.]+/, (_m, exp) => `v1.${exp}.${Buffer.from('second@example.org').toString('base64url')}`);
    expect(await readAdminSession(`${ADMIN_COOKIE}=${other}`, config, 'onelivebuild.com', now)).toBeNull();
    const rotated = readAdminConfig({ ...env, OLB_ADMIN_SECRET: script.makeSecret() });
    expect(await readAdminSession(header, rotated, 'onelivebuild.com', now)).toBeNull();
    const removed = readAdminConfig({ ...env, OLB_ADMIN_USERS: 'second@example.org' });
    expect(await readAdminSession(header, removed, 'onelivebuild.com', now)).toBeNull();
    expect(await readAdminSession(header, readAdminConfig({}), 'onelivebuild.com', now)).toBeNull();
  });
  it('opens the same pages as the studio code on onelivebuild.com, and nothing on designer.ppwellness.co', async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const value = await adminCookieValue('admin.one@example.com', config, 'onelivebuild.com', Date.now());
    const cookie = `${ADMIN_COOKIE}=${value}`;
    for (const path of ['/designer', '/home', '/studio', '/studio/merchants', '/admin/merchants']) {
      const signedIn = await middleware(new Request(`https://onelivebuild.com${path}`, { headers: { cookie } }));
      expect(signedIn.headers.get('x-middleware-rewrite')).toBe('https://onelivebuild.com/olb.html');
      const signedOut = await middleware(new Request(`https://onelivebuild.com${path}`));
      expect(await signedOut.text()).toContain('Passcode');
    }
    const entry = await middleware(new Request('https://onelivebuild.com/access?next=%2Fdesigner', { headers: { cookie } }));
    expect(entry.status).toBe(303);
    expect(entry.headers.get('location')).toBe('/designer');
    // Same cookie value on another host: the gate there never even looks at it.
    const ppw = await middleware(new Request('https://designer.ppwellness.co/designer', { headers: { cookie } }));
    expect(await ppw.text()).toContain('Studio access code');
  });
  it('shows the signed-in admin page with Sign out', async () => {
    const { deps } = setup();
    const value = await adminCookieValue('second@example.org', config, 'onelivebuild.com', deps.now());
    const response = (await handleOlbSite(new Request('https://onelivebuild.com/admin', { headers: { cookie: `${ADMIN_COOKIE}=${value}` } }), deps))!;
    const html = await response.text();
    expect(html).toContain('You are signed in');
    expect(html).toContain('Signed in as second@example.org.');
    expect(html).toContain('href="/home"');
    expect(html).toContain('<form method="post" action="/admin/sign-out"><button class="ghost" type="submit">Sign out</button></form>');
    expect(html).not.toContain(env.OLB_ADMIN_SECRET);
    expect(html).not.toContain(env.OLB_ADMIN_PASS_HASH);
  });
});

describe('/admin/sign-out', () => {
  it('clears the admin cookie and the studio code cookie on this browser', async () => {
    const { deps } = setup();
    const response = (await handleOlbSite(new Request('https://onelivebuild.com/admin/sign-out', { method: 'POST', headers: { origin: 'https://onelivebuild.com' } }), deps))!;
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin?signed-out=1');
    const cookies = response.headers.getSetCookie();
    expect(cookies).toContain(`${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    expect(cookies).toContain(`${ACCESS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`);
    const page = (await handleOlbSite(new Request('https://onelivebuild.com/admin?signed-out=1'), deps))!;
    expect(await page.text()).toContain('You are signed out.');
  });
  it('ignores a sign-out posted from another site, and a plain visit goes to /admin', async () => {
    const { deps } = setup();
    const cross = (await handleOlbSite(new Request('https://onelivebuild.com/admin/sign-out', { method: 'POST', headers: { origin: 'https://evil.example' } }), deps))!;
    expect(cross.status).toBe(403);
    expect(cross.headers.has('set-cookie')).toBe(false);
    const visit = (await handleOlbSite(new Request('https://onelivebuild.com/admin/sign-out'), deps))!;
    expect(visit.status).toBe(303);
    expect(visit.headers.get('location')).toBe('/admin');
  });
});

describe('set-up script checks', () => {
  it('validates emails and password length without needing Vercel', () => {
    expect(script.parseUsers(' A@Example.com,b@example.org ,a@example.com')).toEqual(['a@example.com', 'b@example.org']);
    expect(() => script.parseUsers('not-an-email')).toThrow('Not an email');
    expect(() => script.parseUsers('')).toThrow('No email');
    expect(script.checkPassword('short')).toContain('at least 8');
    expect(script.checkPassword('long enough')).toBeNull();
    expect(script.makeSecret()).toMatch(/^[0-9a-f]{64}$/);
  });
});
