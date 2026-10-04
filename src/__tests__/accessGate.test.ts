import { describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE, digest, handleAccess, redisCommand, safeDestination, type AccessDependencies } from '../../server/accessGate';

function setup() {
  const data = new Map<string, unknown>();
  const command = vi.fn(async (args: (string | number)[]) => {
    const [op, key, value] = args;
    if (op === 'GET') return data.get(String(key)) ?? null;
    if (op === 'SET') { data.set(String(key), value); return 'OK'; }
    if (op === 'INCR') { const n = Number(data.get(String(key)) ?? 0) + 1; data.set(String(key), n); return n; }
    if (op === 'EXPIRE') return 1;
    throw new Error('Unexpected command');
  });
  const deps: AccessDependencies = { command, now: () => 1_700_000_000_000, clientIp: 'test-ip', namespace: 'test' };
  return { deps, command, data };
}
const post = (code = '2123', next = '/demo?view=3d') => new Request(`https://designer.example/access?next=${encodeURIComponent(next)}`, {
  method: 'POST', headers: { origin: 'https://designer.example', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code }),
});

describe('server-side studio access', () => {
  it.each(['/designer', '/demo?view=3d', '/studio', '/pitch/developers', '/index.html', '/assets/index.js'])('locks %s without loading the app or exposing the code', async (path) => {
    const { deps, command } = setup();
    const response = await handleAccess(new Request(`https://designer.example${path}`), deps);
    const html = await response!.text();
    expect(html).toContain('Studio access code');
    expect(html).not.toContain('2123');
    expect(html).not.toContain('<script');
    expect(response!.headers.get('cache-control')).toContain('no-store');
    expect(command).not.toHaveBeenCalled();
  });
  it('issues an opaque secure cookie only after the correct code and durable session storage', async () => {
    const { deps, data, command } = setup();
    const response = await handleAccess(post(), deps);
    expect(response!.status).toBe(303);
    expect(response!.headers.get('location')).toBe('/demo?view=3d');
    const cookie = response!.headers.get('set-cookie')!;
    expect(cookie).toMatch(/HttpOnly; Secure; SameSite=None; Partitioned/);
    expect(cookie).toContain('Max-Age=43200');
    const token = cookie.split(';')[0].split('=')[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect([...data.keys()].join(' ')).not.toContain(token);
    expect(command).toHaveBeenCalledWith(['SET', `ppw:studio-access:v1:test:designer.example:session:${await digest(token)}`, 'unlocked', 'EX', 43200, 'NX']);
    expect(await handleAccess(new Request('https://designer.example/demo', { headers: { cookie } }), deps)).toBeNull();
    // Copying a preview cookie to another host cannot unlock production.
    expect(await handleAccess(new Request('https://other.example/demo', { headers: { cookie } }), deps)).not.toBeNull();
  });
  it('rejects wrong codes, forged cookies and expired/missing sessions', async () => {
    const { deps } = setup();
    expect((await handleAccess(post('1234'), deps))!.status).toBe(401);
    const response = await handleAccess(new Request('https://designer.example/demo', { headers: { cookie: `${ACCESS_COOKIE}=${'f'.repeat(64)}` } }), deps);
    expect(await response!.text()).toContain('Studio access code');
    expect(response!.headers.has('set-cookie')).toBe(false);
  });
  it('rate-limits attempts using shared storage and does not disclose raw IPs', async () => {
    const { deps, data } = setup();
    for (let i = 0; i < 10; i++) expect((await handleAccess(post('1111'), deps))!.status).toBe(401);
    const response = await handleAccess(post(), deps);
    expect(response!.status).toBe(429);
    expect(Number(response!.headers.get('retry-after'))).toBeGreaterThan(0);
    expect([...data.keys()].join(' ')).not.toContain('test-ip');
  });
  it('fails closed on storage outages, including a correct code that cannot save its session', async () => {
    const { deps, command } = setup();
    command.mockRejectedValue(new Error('Redis unavailable'));
    expect((await handleAccess(post(), deps))!.status).toBe(503);
    const { deps: other, command: cmd } = setup();
    cmd.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(null);
    const response = await handleAccess(post(), other);
    expect(response!.status).toBe(503);
    expect(response!.headers.has('set-cookie')).toBe(false);
  });
  it('rejects cross-origin submission and does not accept GET codes or malformed form data', async () => {
    const { deps, command } = setup();
    const req = new Request(post());
    req.headers.set('origin', 'https://attacker.example');
    expect((await handleAccess(req, deps))!.status).toBe(403);
    expect((await handleAccess(new Request('https://designer.example/access?code=2123'), deps))!.headers.has('set-cookie')).toBe(false);
    expect(command).not.toHaveBeenCalled();
    const json = new Request(post());
    json.headers.set('content-type', 'application/json');
    expect((await handleAccess(json, deps))!.status).toBe(400);
  });
  it('blocks open redirects and preserves valid app deep links', () => {
    for (const path of ['//evil.example', '/\\evil.example', 'https://evil.example', '/access', '/api/orders', '/a\r\nb']) expect(safeDestination(path)).toBe('/designer');
    expect(safeDestination('/embed/designer?view=3d&panel=materials')).toBe('/embed/designer?view=3d&panel=materials');
  });
  it('escapes destination and error markup and supports narrow-screen numeric entry', async () => {
    const { deps } = setup();
    const response = await handleAccess(new Request('https://designer.example/demo?q=%22%3E%3Cscript%3E'), deps);
    const html = await response!.text();
    expect(html).not.toContain('<script>');
    expect(html).toContain('inputmode="numeric"');
    expect(html).toContain('viewport-fit=cover');
  });
  it('requires real private KV configuration', async () => {
    await expect(redisCommand({})(['GET', 'key'])).rejects.toThrow('not configured');
  });
});
