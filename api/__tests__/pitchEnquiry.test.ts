import { beforeEach, describe, expect, it, vi } from 'vitest';
const effects = vi.hoisted(() => ({ values: vi.fn(), limit: vi.fn() }));
vi.mock('../_db/client.js', () => ({ schema: { leads: { id: 'id' } }, getDb: () => ({ insert: () => ({ values: effects.values }) }) }));
vi.mock('../_lib/rateLimit.js', () => ({ buildLimiter: () => ({ check: effects.limit }), getClientIp: () => 'test-ip' }));
import { checkPitchEnquiryLimit, handlePitchEnquiry, pitchEnquirySchema } from '../_lib/pitchEnquiry';

const valid = { audience: 'merchants', purpose: 'project', name: 'Jane Smith', email: ' JANE@EXAMPLE.COM ', message: 'Please discuss our product catalogue.', consent: true };
const response = () => {
  const res = { statusCode: 0, body: null as unknown, headers: {} as Record<string, string>, status(code: number) { res.statusCode = code; return res; }, setHeader(name: string, value: string) { res.headers[name] = value; }, json(body: unknown) { res.body = body; }, end() {} };
  return res;
};
const req = { method: 'POST', headers: { origin: 'https://designer.example', host: 'designer.example', 'content-type': 'application/json' } };
beforeEach(() => {
  vi.clearAllMocks(); effects.limit.mockResolvedValue({ success: true, remaining: 4, retryAfterSec: 0, limit: 5 });
  effects.values.mockReturnValue({ returning: async () => [{ id: 42 }] });
});

describe('pitch enquiries', () => {
  it('requires consent, valid contact, bounded text and an in-person location', () => {
    expect(pitchEnquirySchema.parse(valid).email).toBe('jane@example.com');
    for (const edit of [{ consent: false }, { email: 'not-email' }, { message: 'x'.repeat(2401) }, { name: 'X' }, { purpose: 'physical-meeting' }, { website: 'spam' }, { property: {} }]) expect(pitchEnquirySchema.safeParse({ ...valid, ...edit }).success).toBe(false);
    expect(pitchEnquirySchema.safeParse({ ...valid, purpose: 'physical-meeting', location: 'Port Louis' }).success).toBe(true);
  });
  it('stores a private business request and returns only its receipt, never contact data', async () => {
    const res = response();
    await handlePitchEnquiry(req, res, async () => ({ ...valid, purpose: 'physical-meeting', location: 'Ebene office', availability: 'Monday afternoon' }));
    expect(effects.values).toHaveBeenCalledWith(expect.objectContaining({ customerEmail: 'jane@example.com', source: 'pitch:merchants:physical-meeting', status: 'new', message: expect.stringContaining('Meeting requested, not confirmed.') }));
    expect(res.body).toEqual({ receipt: 'PPW-42', status: 'received' });
    expect(res.statusCode).toBe(201);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('does not claim success when the database is unavailable', async () => {
    effects.values.mockImplementation(() => { throw new Error('database credentials must not leak'); });
    const res = response(); await handlePitchEnquiry(req, res, async () => valid);
    expect(res.statusCode).toBe(503); expect(JSON.stringify(res.body)).not.toContain('credentials');
    expect(res.body).toMatchObject({ error: expect.stringContaining('could not be saved') });
  });
  it('rejects cross-origin traffic, GET and invalid bodies without storing anything', async () => {
    for (const [request, body, status] of [[{ ...req, headers: { ...req.headers, origin: 'https://other.example' } }, valid, 403], [{ ...req, method: 'GET' }, valid, 405], [req, null, 400], [{ ...req, headers: { ...req.headers, 'content-length': '20000' } }, valid, 413]] as const) {
      const res = response(); await handlePitchEnquiry(request, res, async () => body); expect(res.statusCode).toBe(status);
    }
    expect(effects.values).not.toHaveBeenCalled();
  });
  it('rate-limits before reading the body', async () => {
    effects.limit.mockResolvedValue({ success: false, retryAfterSec: 90, reason: 'limited' });
    const read = vi.fn(); const res = response(); await handlePitchEnquiry(req, res, read);
    expect(res.statusCode).toBe(429); expect(res.headers['Retry-After']).toBe('90'); expect(read).not.toHaveBeenCalled();
  });
  it('retains a bounded local limit when shared Redis is unavailable', async () => {
    effects.limit.mockResolvedValue({ success: true, reason: 'no-redis' });
    for (let n = 0; n < 5; n++) expect((await checkPitchEnquiryLimit('fallback-test-ip')).success).toBe(true);
    expect((await checkPitchEnquiryLimit('fallback-test-ip')).success).toBe(false);
  });
});
