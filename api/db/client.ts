/**
 * Drizzle client factory — wires the Neon HTTP driver to the schema.
 *
 * Why a factory instead of a module-level singleton:
 *   - Serverless cold-start: instantiation is cheap, but `process.env`
 *     reads at module-load time bake the URL into the cached module
 *     across invocations. A factory keeps the env read late so tests
 *     can stub it deterministically.
 *   - Tests inject their own SQL function via `setDbForTests` instead
 *     of touching `process.env`.
 *
 * Connection string comes from `DATABASE_URL` (Neon-injected). The
 * @neondatabase/serverless `neon()` driver speaks HTTP not WebSocket,
 * so it works inside Vercel Node serverless functions without the
 * `wss://` proxy that the standard `pg` client needs.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | null = null;

/**
 * Get (or lazily build) the Drizzle client. Throws if DATABASE_URL is
 * missing — endpoints should catch this and return a 500 without
 * leaking which env var is unset.
 */
export function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error('DATABASE_URL is not configured');
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

/**
 * Test hook: inject a pre-built client (or `null` to clear) instead of
 * going through `getDb()`. Vitest tests use this to swap in an
 * in-memory store or a mocked Neon query function.
 */
export function setDbForTests(db: Db | null): void {
  _db = db;
}

/**
 * Test hook: build a Drizzle instance against a fake neon query
 * function. Mostly used to validate that schema imports resolve and
 * query builders compile, not for round-trip integration.
 */
export function buildDbWithSql(sql: NeonQueryFunction<false, false>): Db {
  return drizzle(sql, { schema });
}

export { schema };
