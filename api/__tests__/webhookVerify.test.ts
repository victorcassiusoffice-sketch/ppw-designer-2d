/**
 * OMS Wave 4.5 — tests for the centralised webhook signature verifier.
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifySharedSecretHmac } from '../_lib/webhookVerify';

const SECRET = 'a'.repeat(64);

function sign(body: string, secret: string = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifySharedSecretHmac', () => {
  it('accepts a correctly signed body', () => {
    const body = '{"hello":"world"}';
    const sig = sign(body);
    expect(verifySharedSecretHmac(body, sig, SECRET)).toEqual({ ok: true });
  });

  it('accepts a sha256= prefixed signature', () => {
    const body = '{"x":1}';
    const sig = `sha256=${sign(body)}`;
    expect(verifySharedSecretHmac(body, sig, SECRET)).toEqual({ ok: true });
  });

  it('is case-insensitive on the hex digits', () => {
    const body = '{}';
    const sig = sign(body).toUpperCase();
    expect(verifySharedSecretHmac(body, sig, SECRET)).toEqual({ ok: true });
  });

  it('rejects when the signature is missing', () => {
    const result = verifySharedSecretHmac('{}', undefined, SECRET);
    expect(result).toEqual({ ok: false, reason: 'missing-signature' });
  });

  it('rejects when the secret is missing', () => {
    const result = verifySharedSecretHmac('{}', sign('{}'), '');
    expect(result).toEqual({ ok: false, reason: 'no-secret' });
  });

  it('rejects a mismatched signature', () => {
    const result = verifySharedSecretHmac('{}', 'a'.repeat(64), SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('mismatch');
  });

  it('rejects a signature of wrong length', () => {
    const result = verifySharedSecretHmac('{}', 'abc', SECRET);
    expect(result).toEqual({ ok: false, reason: 'length-mismatch' });
  });

  it('rejects when the body has been tampered with', () => {
    const body = '{"amount":100}';
    const sig = sign(body);
    expect(verifySharedSecretHmac('{"amount":1000}', sig, SECRET).ok).toBe(false);
  });
});
