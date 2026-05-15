import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAudit,
  setAuditWriter,
  resetAuditWriter,
  createInMemoryAuditWriter,
} from '../lib/auditLog';
import { ADMIN_EMAIL_ALLOWLIST } from '../lib/adminAllowlist';
import {
  ADMIN_EMAIL_ALLOWLIST as CLIENT_ALLOWLIST,
} from '../../src/lib/adminAllowlist';

describe('auditLog.recordAudit', () => {
  let writer: ReturnType<typeof createInMemoryAuditWriter>;

  beforeEach(() => {
    writer = createInMemoryAuditWriter();
    setAuditWriter(writer);
  });

  it('writes an entry with the supplied fields', async () => {
    const out = await recordAudit(
      'victor@ppwellness.co',
      'merchant.approve',
      'merchant',
      '42',
      null,
      { slug: 'aurora' },
    );
    expect(out.ok).toBe(true);
    expect(writer.entries).toHaveLength(1);
    expect(writer.entries[0]).toMatchObject({
      actorEmail: 'victor@ppwellness.co',
      action: 'merchant.approve',
      targetType: 'merchant',
      targetId: '42',
      reason: null,
      payload: { slug: 'aurora' },
    });
  });

  it('supports an optional reason field', async () => {
    await recordAudit(
      'victor@ppwellness.co',
      'merchant.reject',
      'merchant',
      '7',
      'Catalogue does not match brand standards.',
    );
    expect(writer.entries[0].reason).toBe('Catalogue does not match brand standards.');
  });

  it('returns ok: false (and does not throw) when the writer fails', async () => {
    setAuditWriter({
      record: async () => ({ ok: false, error: 'sim failure' }),
    });
    const out = await recordAudit('a@b', 'x', 't', '1');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('sim failure');
  });

  it('resetAuditWriter restores the prod writer (no throw)', () => {
    expect(() => resetAuditWriter()).not.toThrow();
  });
});

describe('admin allowlist parity', () => {
  it('server and client allowlists contain the same emails', () => {
    expect([...ADMIN_EMAIL_ALLOWLIST].sort()).toEqual([...CLIENT_ALLOWLIST].sort());
  });

  it('server allowlist contains exactly Vic\'s two emails', () => {
    expect(ADMIN_EMAIL_ALLOWLIST).toContain('victorcassius.office@gmail.com');
    expect(ADMIN_EMAIL_ALLOWLIST).toContain('victor@ppwellness.co');
    expect(ADMIN_EMAIL_ALLOWLIST.length).toBe(2);
  });
});
