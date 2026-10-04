import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAccessStorageCommand, neonCommand, type AccessStorageSql } from '../../server/accessStorage';

const driver = vi.hoisted(() => ({ create: vi.fn(), query: vi.fn(), transaction: vi.fn() }));
vi.mock('@neondatabase/serverless', () => ({ neon: driver.create }));

const key = 'ppw:studio-access:v1:preview:studio.example:attempts:hashed-ip:123';
function setup() {
  const database = { query: vi.fn<AccessStorageSql['query']>(), transaction: vi.fn<AccessStorageSql['transaction']>() };
  database.transaction.mockResolvedValue();
  return { database, command: createAccessStorageCommand(database) };
}

describe('isolated Neon studio access storage', () => {
  it('returns only live records and treats absent or expired sessions as missing', async () => {
    const { database, command } = setup();
    database.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ record_value: 'unlocked' }]);
    expect(await command(['GET', key])).toBeNull();
    expect(await command(['GET', key])).toBe('unlocked');
    expect(database.query.mock.calls[0][0]).toContain('expires_at > now()');
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('uses one atomic upsert to increment a bucket and gives new buckets an expiry immediately', async () => {
    const { database, command } = setup();
    database.query.mockResolvedValue([{ record_value: '11' }]);
    expect(await command(['INCR', key])).toBe(11);
    expect(database.query).toHaveBeenCalledTimes(1);
    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (record_key) DO UPDATE');
    expect(sql).toContain('records.record_value::bigint + 1');
    expect(sql).toContain("interval '660 seconds'");
    expect(sql).toContain("CASE WHEN records.expires_at <= now() THEN '1'");
    expect(sql).toContain('ELSE records.expires_at END');
    expect(values).toEqual([key]);
  });

  it('sets sessions only when missing or expired and preserves the NX result', async () => {
    const { database, command } = setup();
    database.query.mockResolvedValueOnce([{ record_value: 'unlocked' }]).mockResolvedValueOnce([]);
    expect(await command(['SET', key, 'unlocked', 'EX', 43200, 'NX'])).toBe('OK');
    expect(await command(['SET', key, 'unlocked', 'EX', 43200, 'NX'])).toBeNull();
    expect(database.query.mock.calls[0][0]).toContain('WHERE records.expires_at <= now()');
    expect(database.query.mock.calls[0][1]).toEqual([key, 'unlocked', 43200]);
  });

  it('updates expiry only for live records and reports missing keys as zero', async () => {
    const { database, command } = setup();
    database.query.mockResolvedValueOnce([{ record_key: key }]).mockResolvedValueOnce([]);
    expect(await command(['EXPIRE', key, 660])).toBe(1);
    expect(await command(['EXPIRE', key, 660])).toBe(0);
    expect(database.query.mock.calls[0][0]).toContain('record_key = $1 AND expires_at > now()');
    expect(database.query.mock.calls[0][1]).toEqual([key, 660]);
  });

  it('cleans a bounded number of other expired records without waiting on active row locks', async () => {
    const { database, command } = setup();
    database.query.mockResolvedValue([{ record_value: '1' }]);
    await command(['INCR', key]);
    const [sql] = database.query.mock.calls[0];
    expect(sql).toContain('expires_at <= now() AND record_key <> $1');
    expect(sql).toContain('LIMIT 64 FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('DELETE FROM public.studio_access_records');
    expect(sql).not.toMatch(/\b(?:merchants|agent_sessions|orders|audit_log)\b/);
  });

  it('binds keys and values as parameters, including SQL metacharacters', async () => {
    const { database, command } = setup();
    database.query.mockResolvedValue([{ record_value: 'unlocked' }]);
    const hostileKey = `${key}'; DROP TABLE merchants;--`;
    const hostileValue = "unlocked'); DELETE FROM orders;--";
    await command(['SET', hostileKey, hostileValue, 'EX', 43200, 'NX']);
    const [sql, values] = database.query.mock.calls[0];
    expect(sql).not.toContain(hostileKey);
    expect(sql).not.toContain(hostileValue);
    expect(values).toEqual([hostileKey, hostileValue, 43200]);
  });

  it.each([
    ['GET', 'merchant:secret'], ['GET', `${key}\u0000`], ['GET', key, 'extra'],
    ['SET', key, 'unlocked', 'EX', 0, 'NX'], ['SET', key, 'unlocked', 'EX', 43201, 'NX'],
    ['SET', key, 'unlocked', 'EX', 1, 'XX'], ['EXPIRE', key, 1.5], ['DELETE', key],
  ])('rejects invalid commands without any SQL: %j', async (...args) => {
    const { database, command } = setup();
    await expect(command(args as (string | number)[])).rejects.toThrow();
    expect(database.query).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('rejects corrupt count or session data rather than granting access', async () => {
    const { database, command } = setup();
    database.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ record_value: '-1' }]).mockResolvedValueOnce([{ record_value: 1 }]);
    await expect(command(['INCR', key])).rejects.toThrow('Invalid studio access count');
    await expect(command(['INCR', key])).rejects.toThrow('Invalid studio access count');
    await expect(command(['GET', key])).rejects.toThrow('Invalid studio access record');
  });

  it('bootstraps only a missing dedicated table in one serialized additive transaction and retries once', async () => {
    const { database, command } = setup();
    database.query.mockRejectedValueOnce({ code: '42P01' }).mockResolvedValueOnce([{ record_value: '1' }]);
    expect(await command(['INCR', key])).toBe(1);
    expect(database.transaction).toHaveBeenCalledTimes(1);
    const statements = database.transaction.mock.calls[0][0].map((statement) => statement.text);
    expect(statements[0]).toContain("lock_timeout = '3s'");
    expect(statements[1]).toBe('SELECT pg_advisory_xact_lock(21231005)');
    expect(statements[2]).toContain('CREATE TABLE IF NOT EXISTS public.studio_access_records');
    expect(statements[3]).toContain('CREATE INDEX IF NOT EXISTS studio_access_records_expiry_idx');
    expect(statements.join('\n')).not.toMatch(/\b(?:ALTER|DROP|TRUNCATE|GRANT|CREATE DATABASE)\b/);
    expect(database.query).toHaveBeenCalledTimes(2);
    // The manual migration and lazy initializer have the same table/index shape.
    const migration = readFileSync(new URL('../../api/_db/migrations/0030_studio_access_records.sql', import.meta.url), 'utf8');
    for (const statement of statements) expect(migration.replace(/\s+/g, ' ')).toContain(statement.replace(/\s+/g, ' '));
  });

  it('shares in-flight table creation between concurrent requests in this instance', async () => {
    const { database, command } = setup();
    let complete!: () => void;
    database.transaction.mockReturnValue(new Promise<void>((resolve) => { complete = resolve; }));
    database.query.mockRejectedValueOnce({ code: '42P01' }).mockRejectedValueOnce({ code: '42P01' })
      .mockResolvedValueOnce([{ record_value: '1' }]).mockResolvedValueOnce([{ record_value: '2' }]);
    const a = command(['INCR', key]);
    const b = command(['INCR', key]);
    await Promise.resolve();
    expect(database.transaction).toHaveBeenCalledTimes(1);
    complete();
    expect(await Promise.all([a, b])).toEqual([1, 2]);
  });

  it.each(['42501', '08006', '57014'])('never initializes or retries unrelated database failure %s', async (code) => {
    const { database, command } = setup();
    database.query.mockRejectedValue({ code });
    await expect(command(['INCR', key])).rejects.toEqual({ code });
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('fails closed if creation fails and lets a later request retry initialization', async () => {
    const { database, command } = setup();
    database.query.mockRejectedValue({ code: '42P01' });
    database.transaction.mockRejectedValueOnce({ code: '42501' });
    await expect(command(['INCR', key])).rejects.toEqual({ code: '42501' });
    database.query.mockRejectedValueOnce({ code: '42P01' }).mockResolvedValueOnce([{ record_value: '1' }]);
    expect(await command(['INCR', key])).toBe(1);
    expect(database.transaction).toHaveBeenCalledTimes(2);
  });
});

describe('Neon adapter configuration', () => {
  it('does not initialize the driver or connect until a storage command is requested', async () => {
    driver.create.mockReset();
    const command = neonCommand({});
    expect(driver.create).not.toHaveBeenCalled();
    await expect(command(['GET', key])).rejects.toThrow('not configured');
    expect(driver.create).not.toHaveBeenCalled();
  });

  it.each(['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_DATABASE_URL', 'POSTGRES_PRISMA_URL'])('supports existing database alias %s with a bounded fetch', async (name) => {
    driver.query.mockReset().mockResolvedValue([{ record_value: 'unlocked' }]);
    driver.create.mockReset().mockReturnValue(Object.assign(driver.query, { transaction: driver.transaction }));
    const command = neonCommand({ [name]: ' postgres://test-placeholder ' });
    expect(await command(['GET', key])).toBe('unlocked');
    expect(driver.create).toHaveBeenCalledWith('postgres://test-placeholder');
    expect(driver.query.mock.calls[0][2].fetchOptions.signal).toBeInstanceOf(AbortSignal);
    await command(['GET', key]);
    expect(driver.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the established alias priority and skips whitespace-only settings', async () => {
    driver.query.mockReset().mockResolvedValue([]);
    driver.create.mockReset().mockReturnValue(Object.assign(driver.query, { transaction: driver.transaction }));
    await neonCommand({ DATABASE_URL: '  ', POSTGRES_URL: 'postgres://preferred', POSTGRES_DATABASE_URL: 'postgres://other' })(['GET', key]);
    expect(driver.create).toHaveBeenCalledWith('postgres://preferred');
  });
});
