import { describe, it, expect } from 'vitest';
import {
  signMerchantSession,
  verifyMerchantSession,
  buildMagicLinkUrl,
  DEFAULT_TTL_MS,
  type MerchantSessionPayload,
} from '../lib/merchantSession';
import {
  parseMagicLinkBody,
  buildMagicLinkEmail,
} from '../orders';

const SECRET = 'unit-test-secret-not-prod';

function freshPayload(overrides: Partial<MerchantSessionPayload> = {}): MerchantSessionPayload {
  return {
    slug: 'k1-sport',
    email: 'info@k1-sport.com',
    exp: Date.now() + DEFAULT_TTL_MS,
    ...overrides,
  };
}

describe('signMerchantSession / verifyMerchantSession', () => {
  it('round-trips a valid token', () => {
    const payload = freshPayload();
    const token = signMerchantSession(payload, SECRET);
    expect(token.includes('.')).toBe(true);
    const v = verifyMerchantSession(token, payload.slug, Date.now(), SECRET);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload).toEqual(payload);
    }
  });

  it('rejects an expired token', () => {
    const payload = freshPayload({ exp: Date.now() - 1 });
    const token = signMerchantSession(payload, SECRET);
    const v = verifyMerchantSession(token, payload.slug, Date.now(), SECRET);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('expired');
  });

  it('rejects a slug mismatch', () => {
    const payload = freshPayload({ slug: 'k1-sport' });
    const token = signMerchantSession(payload, SECRET);
    const v = verifyMerchantSession(token, 'someone-else', Date.now(), SECRET);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('slug_mismatch');
  });

  it('rejects a tampered payload', () => {
    const payload = freshPayload();
    const token = signMerchantSession(payload, SECRET);
    // Swap the base64url-encoded body for a different payload but keep the original signature.
    const [, sig] = token.split('.');
    const tamperedBody = Buffer.from(JSON.stringify({ ...payload, email: 'attacker@x.test' }), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const tampered = `${tamperedBody}.${sig}`;
    const v = verifyMerchantSession(tampered, payload.slug, Date.now(), SECRET);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('bad_signature');
  });

  it('rejects a token signed with a different secret', () => {
    const payload = freshPayload();
    const goodToken = signMerchantSession(payload, SECRET);
    const v = verifyMerchantSession(goodToken, payload.slug, Date.now(), 'other-secret');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('bad_signature');
  });

  it('rejects malformed tokens', () => {
    expect(verifyMerchantSession('', 'k1-sport', Date.now(), SECRET).ok).toBe(false);
    expect(verifyMerchantSession('notatoken', 'k1-sport', Date.now(), SECRET).ok).toBe(false);
    expect(verifyMerchantSession('only.one.dot.but.no.body', 'k1-sport', Date.now(), SECRET).ok).toBe(false);
    expect(verifyMerchantSession('.', 'k1-sport', Date.now(), SECRET).ok).toBe(false);
  });
});

describe('buildMagicLinkUrl', () => {
  it('composes the dashboard URL with the session param', () => {
    const url = buildMagicLinkUrl({
      origin: 'https://designer.ppwellness.co',
      slug: 'k1-sport',
      token: 'abc.def',
    });
    expect(url).toBe('https://designer.ppwellness.co/merchant/k1-sport?session=abc.def');
  });

  it('encodes a slug with special characters', () => {
    const url = buildMagicLinkUrl({
      origin: 'https://designer.ppwellness.co',
      slug: 'tricky slug/x',
      token: 't',
    });
    // URL encoding + path segment safety.
    expect(url).toContain('/merchant/tricky%20slug%2Fx');
    expect(url).toContain('session=t');
  });
});

describe('parseMagicLinkBody', () => {
  it('accepts a well-formed body', () => {
    const r = parseMagicLinkBody({ email: 'Info@K1-SPORT.com' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.email).toBe('info@k1-sport.com');
  });

  it('rejects missing or non-string email', () => {
    expect(parseMagicLinkBody({}).ok).toBe(false);
    expect(parseMagicLinkBody({ email: 42 }).ok).toBe(false);
    expect(parseMagicLinkBody(null).ok).toBe(false);
    expect(parseMagicLinkBody('string-body').ok).toBe(false);
  });

  it('rejects emails without @', () => {
    expect(parseMagicLinkBody({ email: 'no-at-sign.test' }).ok).toBe(false);
  });

  it('rejects emails over 254 chars (RFC 5321 limit)', () => {
    const long = 'a'.repeat(250) + '@x.test';
    expect(parseMagicLinkBody({ email: long }).ok).toBe(false);
  });
});

describe('buildMagicLinkEmail', () => {
  it('produces brand-themed HTML including the link + expiry', () => {
    const { subject, html } = buildMagicLinkEmail({
      slug: 'k1-sport',
      link: 'https://designer.ppwellness.co/merchant/k1-sport?session=abc.def',
      expiryDays: 30,
    });
    expect(subject).toContain('k1-sport');
    expect(html).toContain('https://designer.ppwellness.co/merchant/k1-sport?session=abc.def');
    expect(html).toContain('30 days');
    expect(html).toContain('#FFBB58'); // brand gold CTA
    expect(html).toContain('#232C3B'); // brand navy bg
  });

  it('strips angle brackets from the slug to prevent HTML injection', () => {
    const { html } = buildMagicLinkEmail({
      slug: '<script>alert(1)</script>',
      link: 'https://designer.ppwellness.co/merchant/x?session=t',
      expiryDays: 30,
    });
    expect(html).not.toContain('<script>');
  });
});
