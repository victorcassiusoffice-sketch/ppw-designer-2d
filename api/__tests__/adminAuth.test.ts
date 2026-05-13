import { describe, it, expect, vi } from 'vitest';
import { authoriseAdminRequest, VIC_EMAIL_ALLOWLIST } from '../lib/adminAuth';

describe('authoriseAdminRequest', () => {
  it('rejects when Authorization header is missing', async () => {
    const out = await authoriseAdminRequest({}, {
      verify: async () => null,
      lookupAdmin: async () => null,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(401);
  });

  it('rejects malformed Authorization header', async () => {
    const out = await authoriseAdminRequest(
      { authorization: 'NotBearer xyz' },
      { verify: async () => null, lookupAdmin: async () => null },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(401);
  });

  it('rejects when verify throws', async () => {
    const out = await authoriseAdminRequest(
      { authorization: 'Bearer bad-token' },
      {
        verify: async () => {
          throw new Error('JWKS lookup failed');
        },
        lookupAdmin: async () => null,
      },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(401);
      expect(out.error).toMatch(/JWKS/);
    }
  });

  it('rejects when verify returns null sub', async () => {
    const out = await authoriseAdminRequest(
      { authorization: 'Bearer t' },
      { verify: async () => ({}), lookupAdmin: async () => null },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(401);
  });

  it('allows Vic via email allowlist (source=allowlist)', async () => {
    const out = await authoriseAdminRequest(
      { authorization: 'Bearer t' },
      {
        verify: async () => ({ sub: 'user_xyz', email: 'victorcassius.office@gmail.com' }),
        lookupAdmin: async () => null,
      },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.admin.email).toBe('victorcassius.office@gmail.com');
    expect(out.admin.source).toBe('allowlist');
    expect(out.admin.role).toBe('super_admin');
  });

  it('allows victor@ppwellness.co (second allowlist entry)', async () => {
    const out = await authoriseAdminRequest(
      { authorization: 'Bearer t' },
      {
        verify: async () => ({ sub: 'user_2', email: 'VICTOR@ppwellness.co' }),
        lookupAdmin: async () => null,
      },
    );
    expect(out.ok).toBe(true);
  });

  it('falls back to DB lookup when email is not on allowlist', async () => {
    const lookup = vi.fn().mockResolvedValue({ role: 'reviewer' as const });
    const out = await authoriseAdminRequest(
      { authorization: 'Bearer t' },
      {
        verify: async () => ({ sub: 'user_db', email: 'newadmin@example.com' }),
        lookupAdmin: lookup,
      },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.admin.source).toBe('db');
    expect(out.admin.role).toBe('reviewer');
    expect(lookup).toHaveBeenCalledWith('user_db');
  });

  it('returns 403 for an authenticated-but-unauthorised user', async () => {
    const out = await authoriseAdminRequest(
      { authorization: 'Bearer t' },
      {
        verify: async () => ({ sub: 'user_rando', email: 'random@elsewhere.com' }),
        lookupAdmin: async () => null,
      },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(403);
  });

  it('VIC_EMAIL_ALLOWLIST contains the two expected emails', () => {
    expect(VIC_EMAIL_ALLOWLIST.has('victorcassius.office@gmail.com')).toBe(true);
    expect(VIC_EMAIL_ALLOWLIST.has('victor@ppwellness.co')).toBe(true);
  });
});
