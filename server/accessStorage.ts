import { neon } from '@neondatabase/serverless';

/** This table belongs only to the presentation gate. Merchant/session/order
 * tables and their authentication are never read or written by this adapter. */
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS public.studio_access_records (
  record_key varchar(512) PRIMARY KEY,
  record_value text NOT NULL,
  expires_at timestamptz NOT NULL
)`;
const CREATE_EXPIRY_INDEX = `CREATE INDEX IF NOT EXISTS studio_access_records_expiry_idx
  ON public.studio_access_records (expires_at)`;

type Statement = { text: string; values?: (string | number)[] };
type Row = Record<string, unknown>;
export type AccessStorageSql = {
  query: (text: string, values: (string | number)[]) => Promise<Row[]>;
  transaction: (statements: Statement[]) => Promise<void>;
};
export type AccessStorageCommand = (args: (string | number)[]) => Promise<unknown>;

// Retire at most 64 expired records per write. SKIP LOCKED avoids unrelated
// concurrent sign-ins waiting for cleanup, and the current key is excluded so
// its atomic upsert, rather than cleanup, decides whether it has expired.
const CLEANUP = `WITH expired AS (
  SELECT record_key FROM public.studio_access_records
  WHERE expires_at <= now() AND record_key <> $1
  ORDER BY expires_at LIMIT 64 FOR UPDATE SKIP LOCKED
), removed AS (
  DELETE FROM public.studio_access_records AS records
  USING expired WHERE records.record_key = expired.record_key
  RETURNING records.record_key
)
`;

const GET = `SELECT record_value FROM public.studio_access_records
  WHERE record_key = $1 AND expires_at > now()`;
const SET = CLEANUP + `INSERT INTO public.studio_access_records AS records
  (record_key, record_value, expires_at) VALUES ($1, $2, now() + $3 * interval '1 second')
  ON CONFLICT (record_key) DO UPDATE SET
    record_value = EXCLUDED.record_value, expires_at = EXCLUDED.expires_at
  WHERE records.expires_at <= now()
  RETURNING record_value`;
const INCR = CLEANUP + `INSERT INTO public.studio_access_records AS records
  (record_key, record_value, expires_at) VALUES ($1, '1', now() + interval '660 seconds')
  ON CONFLICT (record_key) DO UPDATE SET
    record_value = CASE WHEN records.expires_at <= now() THEN '1'
      ELSE LEAST(records.record_value::bigint + 1, 2147483647)::text END,
    expires_at = CASE WHEN records.expires_at <= now() THEN EXCLUDED.expires_at
      ELSE records.expires_at END
  RETURNING record_value`;
const EXPIRE = CLEANUP + `UPDATE public.studio_access_records
  SET expires_at = now() + $2 * interval '1 second'
  WHERE record_key = $1 AND expires_at > now()
  RETURNING record_key`;

function keyFrom(args: (string | number)[]): string {
  const key = args[1];
  if (typeof key !== 'string' || !key.startsWith('ppw:studio-access:') || key.length > 512 || [...key].some((character) => character.charCodeAt(0) < 32)) {
    throw new Error('Invalid studio access storage key');
  }
  return key;
}
function ttlFrom(value: string | number): number {
  const ttl = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 43_200) throw new Error('Invalid studio access expiry');
  return ttl;
}

/** Only fixed SQL is used; every key/value/expiry is a bound parameter. The
 * single INSERT .. ON CONFLICT statement locks the bucket row while counting,
 * so ten simultaneous attempts cannot all observe the same old count. */
export function createAccessStorageCommand(database: AccessStorageSql): AccessStorageCommand {
  let initializing: Promise<void> | null = null;
  const execute = async (text: string, values: (string | number)[]) => {
    try { return await database.query(text, values); }
    catch (error) {
      // Bootstrap only our absent table, never recover permission/connection or
      // other SQL failures by granting access. A transaction advisory lock also
      // serializes first requests from separate Edge instances.
      if ((error as { code?: unknown })?.code !== '42P01') throw error;
      if (!initializing) {
        initializing = database.transaction([
          { text: "SET LOCAL lock_timeout = '3s'" },
          { text: 'SELECT pg_advisory_xact_lock(21231005)' },
          { text: CREATE_TABLE },
          { text: CREATE_EXPIRY_INDEX },
        ]).finally(() => { initializing = null; });
      }
      await initializing;
      return database.query(text, values);
    }
  };

  return async (args) => {
    const key = keyFrom(args);
    switch (args[0]) {
      case 'GET': {
        if (args.length !== 2) throw new Error('Invalid studio access command');
        const rows = await execute(GET, [key]);
        if (!rows.length) return null;
        if (typeof rows[0].record_value !== 'string') throw new Error('Invalid studio access record');
        return rows[0].record_value;
      }
      case 'SET': {
        if (args.length !== 6 || args[3] !== 'EX' || args[5] !== 'NX' || typeof args[2] !== 'string' || args[2].length > 1024) {
          throw new Error('Invalid studio access command');
        }
        const rows = await execute(SET, [key, args[2], ttlFrom(args[4])]);
        return rows.length === 1 ? 'OK' : null;
      }
      case 'INCR': {
        if (args.length !== 2) throw new Error('Invalid studio access command');
        const rows = await execute(INCR, [key]);
        const count = Number(rows[0]?.record_value);
        if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid studio access count');
        return count;
      }
      case 'EXPIRE': {
        if (args.length !== 3) throw new Error('Invalid studio access command');
        return (await execute(EXPIRE, [key, ttlFrom(args[2])])).length ? 1 : 0;
      }
      default: throw new Error('Unsupported studio access command');
    }
  };
}

/** Same existing Neon environment aliases as api/_db/client.ts. Importing this
 * module or rendering the locked page never connects to or creates a database.
 * Lazy CREATE is additive and only occurs after an actual gate command reports
 * our table missing. A restricted DB role may instead apply migration 0030. */
export function neonCommand(env: Record<string, string | undefined>): AccessStorageCommand {
  let command: AccessStorageCommand | undefined;
  return async (args) => {
    if (!command) {
      const url = [env.DATABASE_URL, env.POSTGRES_URL, env.POSTGRES_DATABASE_URL, env.POSTGRES_PRISMA_URL]
        .map((value) => value?.trim()).find(Boolean);
      if (!url) throw new Error('Studio access database is not configured');
      const sql = neon(url);
      command = createAccessStorageCommand({
        query: async (text, values) => sql(text, values, { fetchOptions: { signal: AbortSignal.timeout(4000) } }),
        transaction: async (statements) => {
          await sql.transaction(statements.map(({ text, values }) => sql(text, values ?? [])), {
            fetchOptions: { signal: AbortSignal.timeout(4000) },
          });
        },
      });
    }
    return command(args);
  };
}
