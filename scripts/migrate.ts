/**
 * scripts/migrate.ts — apply SQL files in `api/db/migrations/` to Neon.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate.ts
 *   # or after Phase 1:
 *   npm run db:migrate     (defined in package.json — wraps tsx)
 *
 * Each `.sql` file is applied verbatim. Files are run in lexicographic
 * order. The migrations are all guarded with IF NOT EXISTS / EXCEPTION
 * blocks so re-runs are safe — Phase 2 will add a real `migrations`
 * tracking table.
 *
 * Why not drizzle-kit migrate?
 *   - Avoids hard-coupling Phase 1 install to drizzle-kit's deeper
 *     toolchain (it's still installed as a devDep for Phase 2 work).
 *   - One file, one driver — easier to read, easier to debug from a
 *     vercel-functions shell.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'api', 'db', 'migrations');

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Pull it from Vercel env vars or .env.local.');
    process.exit(1);
  }
  const sql = neon(url);
  const files = readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    console.warn('No migration files found in', MIG_DIR);
    return;
  }
  for (const f of files) {
    const full = join(MIG_DIR, f);
    const body = readFileSync(full, 'utf8');
    // Neon HTTP driver accepts multi-statement strings via `sql.query`.
    // Note: this bypasses tagged-template safety; we trust our own files.
    console.log(`-> applying ${f} (${body.length} bytes)`);
    // The neon function supports an unsafe-multistatement form: pass an array of statements,
    // OR pass the body via the raw `.query` method.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const driver = sql as any;
    if (typeof driver.query === 'function') {
      await driver.query(body, []);
    } else {
      // Fallback: split on `;` carefully (NOT robust for plpgsql blocks).
      throw new Error('Neon driver does not expose .query; use a newer @neondatabase/serverless.');
    }
    console.log(`   ok ${f}`);
  }
  console.log('migrations complete');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
