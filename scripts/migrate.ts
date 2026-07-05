/**
 * scripts/migrate.ts — apply SQL files in `api/_db/migrations/` to Neon.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate.ts
 *   # or after Phase 1:
 *   npm run db:migrate     (defined in package.json — wraps tsx)
 *
 * W0.D.1 (V4-ME-1 CLOSED 2026-05-16) upgrade:
 *   • Walks migrations in lexicographic order (0000 sorts first).
 *   • Consults `schema_migrations` on every run and SKIPS any version
 *     whose row already exists (matched by filename stem).
 *   • For each new file: applies the SQL THEN inserts the tracking row.
 *     On SQL failure the tracking row is NOT inserted (apply fails loud,
 *     re-run safely retries).
 *   • First-run backfill: set `BACKFILL_EXISTING=1` to insert tracking
 *     rows for every file WITHOUT executing the SQL. Use this exactly
 *     once on a production DB that pre-dates the tracker.
 *
 * The 0000_schema_migrations.sql file itself uses CREATE TABLE IF NOT
 * EXISTS so the bootstrap apply is safe even when the table already
 * exists (BACKFILL path).
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'api', 'db', 'migrations');

const TRACKER_FILE = '0000_schema_migrations.sql';

function checksum(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

function versionFromFile(filename: string): string {
  // Drop the .sql suffix; keep the rest as the canonical version key.
  return filename.replace(/\.sql$/, '');
}

/**
 * V4 W0.D.3 — file-filter helper that excludes rollback siblings and
 * underscore-prefixed templates from auto-apply. Pure for unit-test.
 *
 *   `0010_catalog_filters.sql`             → applied
 *   `0010_catalog_filters_rollback.sql`    → SKIPPED (operator-invoked via psql)
 *   `_template_rollback.sql`               → SKIPPED (template, not a migration)
 *   `0000_schema_migrations.sql`           → applied (tracker bootstrap)
 *
 * See `PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md` for the
 * rollback drill that consumes the skipped files.
 */
export function isApplicableMigration(filename: string): boolean {
  if (!filename.endsWith('.sql')) return false;
  if (filename.startsWith('_')) return false;
  if (filename.endsWith('_rollback.sql')) return false;
  return true;
}

interface MigrateDriver {
  query: (sql: string, params: unknown[]) => Promise<unknown>;
}

async function ensureTracker(driver: MigrateDriver): Promise<void> {
  const body = readFileSync(join(MIG_DIR, TRACKER_FILE), 'utf8');
  await driver.query(body, []);
}

async function appliedVersions(driver: MigrateDriver): Promise<Set<string>> {
  try {
    const rows = (await driver.query('SELECT version FROM schema_migrations', [])) as
      | Array<{ version: string }>
      | { rows: Array<{ version: string }> };
    const list = Array.isArray(rows) ? rows : rows.rows;
    return new Set((list ?? []).map((r) => r.version));
  } catch (err) {
    // Table didn't exist yet (first run) — caller bootstraps via ensureTracker.
    if (err instanceof Error && /relation .* does not exist/i.test(err.message)) {
      return new Set();
    }
    throw err;
  }
}

async function recordApplied(
  driver: MigrateDriver,
  version: string,
  checksumHex: string,
): Promise<void> {
  await driver.query(
    'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
    [version, checksumHex],
  );
}

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Pull it from Vercel env vars or .env.local.');
    process.exit(1);
  }
  // OMS Wave 5.8 — refuse to touch prod unless explicitly authorised.
  if (url.includes('raspy-butterfly-74927202') && process.env.ALLOW_PROD_MIGRATIONS !== '1') {
    console.error(
      '[safety] DATABASE_URL appears to point at the production branch.\n' +
        '         Set ALLOW_PROD_MIGRATIONS=1 to override (intentional only).',
    );
    process.exit(2);
  }

  const sql = neon(url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driver = sql as any;
  if (typeof driver.query !== 'function') {
    throw new Error('Neon driver does not expose .query; use a newer @neondatabase/serverless.');
  }

  const files = readdirSync(MIG_DIR).filter(isApplicableMigration).sort();
  if (files.length === 0) {
    console.warn('No migration files found in', MIG_DIR);
    return;
  }

  // Bootstrap the tracker table first so we can consult it for the rest.
  await ensureTracker(driver);
  // Record the tracker file itself if not already present.
  const trackerBody = readFileSync(join(MIG_DIR, TRACKER_FILE), 'utf8');
  await recordApplied(driver, versionFromFile(TRACKER_FILE), checksum(trackerBody));

  const applied = await appliedVersions(driver);
  const backfill = process.env.BACKFILL_EXISTING === '1';

  for (const f of files) {
    const version = versionFromFile(f);
    if (f === TRACKER_FILE) continue; // already handled above
    if (applied.has(version)) {
      console.log(`-> skip ${f} (already applied)`);
      continue;
    }
    const body = readFileSync(join(MIG_DIR, f), 'utf8');
    const sum = checksum(body);
    if (backfill) {
      console.log(`-> backfill-mark ${f} (no SQL execution; ${body.length} bytes)`);
      await recordApplied(driver, version, sum);
      continue;
    }
    console.log(`-> applying ${f} (${body.length} bytes)`);
    await driver.query(body, []);
    await recordApplied(driver, version, sum);
    console.log(`   ok ${f}`);
  }
  console.log('migrations complete');
}

// Only auto-run when invoked as a CLI script. When imported (e.g. by the
// W0.D.3 file-filter unit test) the top-level side effect would otherwise
// call process.exit during test collection. Compare resolved paths so the
// guard works on both Windows + POSIX.
const invokedDirectly = (() => {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return fileURLToPath(import.meta.url) === arg;
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
