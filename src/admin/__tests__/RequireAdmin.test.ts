/**
 * RequireAdmin gate tests — pure-logic.
 *
 * The component itself touches Clerk hooks + the DOM (not in this
 * vitest project's environment), so we test the extracted
 * `decideAdminGate()` function which encodes the actual access logic.
 */

import { describe, it, expect } from 'vitest';
import { decideAdminGate } from '../RequireAdmin';

describe('decideAdminGate', () => {
  it('returns loading when Clerk is not yet ready', () => {
    expect(decideAdminGate(false, false, null)).toEqual({ state: 'loading' });
  });

  it('returns signed-out when isSignedIn is false', () => {
    expect(decideAdminGate(true, false, null)).toEqual({ state: 'signed-out' });
  });

  it('returns signed-out when user is null even if isSignedIn is true', () => {
    expect(decideAdminGate(true, true, null)).toEqual({ state: 'signed-out' });
  });

  it('authorises via the email allowlist (primary email)', () => {
    const out = decideAdminGate(true, true, {
      primaryEmailAddress: { emailAddress: 'victor@ppwellness.co' },
    });
    expect(out.state).toBe('authorised');
    if (out.state === 'authorised') {
      expect(out.via).toBe('allowlist');
      expect(out.email).toBe('victor@ppwellness.co');
    }
  });

  it('authorises via the email allowlist (case-insensitive)', () => {
    const out = decideAdminGate(true, true, {
      primaryEmailAddress: { emailAddress: 'VICTORCASSIUS.OFFICE@gmail.com' },
    });
    expect(out.state).toBe('authorised');
  });

  it('falls back to emailAddresses[0] when primary is missing', () => {
    const out = decideAdminGate(true, true, {
      primaryEmailAddress: null,
      emailAddresses: [{ emailAddress: 'victor@ppwellness.co' }],
    });
    expect(out.state).toBe('authorised');
  });

  it('authorises non-allowlisted users via publicMetadata.role === "admin"', () => {
    const out = decideAdminGate(true, true, {
      primaryEmailAddress: { emailAddress: 'newadmin@example.com' },
      publicMetadata: { role: 'admin' },
    });
    expect(out.state).toBe('authorised');
    if (out.state === 'authorised') expect(out.via).toBe('metadata');
  });

  it('returns no-access for a signed-in user not on allowlist nor metadata-flagged', () => {
    const out = decideAdminGate(true, true, {
      primaryEmailAddress: { emailAddress: 'random@stranger.com' },
      publicMetadata: { role: 'merchant' },
    });
    expect(out.state).toBe('no-access');
    if (out.state === 'no-access') expect(out.email).toBe('random@stranger.com');
  });

  it('returns no-access for a signed-in user with no email at all', () => {
    const out = decideAdminGate(true, true, {});
    expect(out.state).toBe('no-access');
    if (out.state === 'no-access') expect(out.email).toBe(null);
  });
});
