import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const effects = vi.hoisted(() => ({ db: vi.fn(), email: vi.fn() }));
vi.mock('../_db/client.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../_db/client.js')>(),
  getDb: effects.db,
}));
vi.mock('../_lib/email/dispatch.js', () => ({
  dispatchDesignSavedEmail: effects.email,
  dispatchOrderConfirmedEmail: effects.email,
  dispatchMerchantOrderConfirmedEmail: effects.email,
}));
import orders from '../orders';
import { crossSiteWrite, requestHost, studioAccess } from '../_lib/studioAccess';
import { adminCookieValue, ADMIN_COOKIE, readAdminConfig } from '../../server/adminAuth';
import { ACCESS_COOKIE, studioNamespace, studioSessionKey } from '../../server/studioSession';

const TOKEN = 'a'.repeat(64);
const HOST = 'onelivebuild.com';
const ADMIN_ENV = {
  OLB_ADMIN_USERS: 'owner@example.com',
  OLB_ADMIN_PASS_HASH: `pbkdf2:200000:${'0'.repeat(32)}:${'b'.repeat(64)}`,
  OLB_ADMIN_SECRET: 's'.repeat(40),
};

async function store(environment = 'production', host = HOST) {
  const data = new Map<string, unknown>([[await studioSessionKey(studioNamespace(environment, host), TOKEN), 'unlocked']]);
  return vi.fn(async (args: (string | number)[]) => (args[0] === 'GET' ? data.get(String(args[1])) ?? null : null));
}

function response() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { res.headers[name] = value; },
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; },
    end() {},
  };
  return res;
}

describe('who may use saved designs', () => {
  it('closes without a session and never touches the store', async () => {
    const command = await store();
    expect(await studioAccess({ host: HOST }, { env: { VERCEL_ENV: 'production' }, command })).toBe('closed');
    expect(command).not.toHaveBeenCalled();
  });
  it('opens with the studio session the door handed out for this host', async () => {
    const command = await store();
    const headers = { host: HOST, cookie: `other=1; ${ACCESS_COOKIE}=${TOKEN}` };
    expect(await studioAccess(headers, { env: { VERCEL_ENV: 'production' }, command })).toBe('open');
  });
  it('stays closed for the same cookie on another host or environment', async () => {
    const command = await store();
    const cookie = `${ACCESS_COOKIE}=${TOKEN}`;
    expect(await studioAccess({ host: 'designer.ppwellness.co', cookie }, { env: { VERCEL_ENV: 'production' }, command })).toBe('closed');
    expect(await studioAccess({ host: HOST, cookie }, { env: { VERCEL_ENV: 'preview' }, command })).toBe('closed');
  });
  it('says unavailable when the store cannot be read', async () => {
    const command = vi.fn(async () => { throw new Error('down'); });
    expect(await studioAccess({ host: HOST, cookie: `${ACCESS_COOKIE}=${TOKEN}` }, { env: { VERCEL_ENV: 'production' }, command })).toBe('unavailable');
  });
  it('opens with the One Live Build sign-in for its own host only', async () => {
    const config = readAdminConfig(ADMIN_ENV);
    if (!config.ok) throw new Error('test config');
    const now = 1_800_000_000_000;
    const cookie = `${ADMIN_COOKIE}=${await adminCookieValue('owner@example.com', config, HOST, now)}`;
    const command = vi.fn();
    expect(await studioAccess({ host: HOST, cookie }, { env: { ...ADMIN_ENV, VERCEL_ENV: 'production' }, command, now: () => now })).toBe('open');
    expect(await studioAccess({ host: 'designer.ppwellness.co', cookie }, { env: { ...ADMIN_ENV, VERCEL_ENV: 'production' }, command, now: () => now })).toBe('closed');
    expect(command).not.toHaveBeenCalled();
  });
  it('refuses a change sent from another site', () => {
    expect(crossSiteWrite('GET', { host: HOST, origin: 'https://elsewhere.example' })).toBe(false);
    expect(crossSiteWrite('PUT', { host: HOST, origin: `https://${HOST}` })).toBe(false);
    expect(crossSiteWrite('POST', { host: HOST })).toBe(false);
    expect(crossSiteWrite('PUT', { host: HOST, origin: 'https://elsewhere.example' })).toBe(true);
    expect(crossSiteWrite('POST', { host: HOST, origin: 'not a url' })).toBe(true);
    expect(requestHost({ host: 'OneLiveBuild.com' })).toBe(HOST);
  });
});

describe('the saved-designs endpoints', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('DEMO_ONLY', 'false'); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it.each([
    ['GET', '/api/designs/42'],
    ['GET', '/api/designs?email=someone%40example.com'],
    ['PUT', '/api/designs/42'],
    ['POST', '/api/designs'],
  ])('%s %s without the studio answers 401 and reads nothing', async (method, url) => {
    const res = response();
    await orders({ method, url, headers: { host: HOST } } as never, res as never);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'STUDIO_ACCESS_REQUIRED' });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(effects.db).not.toHaveBeenCalled();
    expect(effects.email).not.toHaveBeenCalled();
  });
  it('refuses a cross-site change before anything else', async () => {
    const res = response();
    await orders({ method: 'PUT', url: '/api/designs/42', headers: { host: HOST, origin: 'https://elsewhere.example' } } as never, res as never);
    expect(res.statusCode).toBe(403);
    expect(effects.db).not.toHaveBeenCalled();
  });
});
