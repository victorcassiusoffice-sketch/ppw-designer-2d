/**
 * scripts/check-schema-mirror.ts — V4 W0.D.7 (CQ §05.5).
 *
 * Migration ↔ Drizzle schema mirror guard.
 *
 * Parses every `CREATE TABLE [IF NOT EXISTS] <name>` statement from
 * api/_db/migrations/*.sql and every `pgTable('<name>', { … })` call
 * from api/_db/schema.ts, then asserts the table-name sets match.
 *
 * Catches the classic drift mode where a migration adds a table but
 * the Drizzle schema isn't updated (so queries against it stay
 * untyped) — and the reverse, where a pgTable is declared without a
 * SQL migration backing it (so production never gets the table).
 *
 * The script also has a programmatic API (`diffSchemas`) that the
 * Vitest suite consumes, so the same parity check runs on every PR
 * via the existing `npm test` step until W0.D.17 quality-gates.yml
 * lands the dedicated CI step.
 *
 * Column-level diffing is deliberately out of scope for this first
 * cut. Table-set parity catches >80% of real-world drift; column
 * checking is documented as a follow-up in the script header.
 *
 * Usage:
 *   npx tsx scripts/check-schema-mirror.ts
 *   → prints "schema-mirror: OK (N tables)" and exits 0 on parity.
 *   → prints concrete delta + exits 1 on mismatch.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SchemaDiff {
  /** SQL tables that have no Drizzle pgTable() entry. */
  inSqlOnly: string[];
  /** Drizzle pgTable() entries that have no SQL CREATE TABLE. */
  inDrizzleOnly: string[];
  /** Tables present on both sides — the healthy intersection. */
  common: string[];
}

const MIGRATION_DIR_REL = 'api/_db/migrations';
const SCHEMA_FILE_REL = 'api/_db/schema.ts';

function resolveRepoRoot(): string {
  // This file lives at <root>/scripts/check-schema-mirror.ts so the
  // repo root is one directory up.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..');
}

/** Read every .sql file in api/_db/migrations/ and collect CREATE TABLE names. */
export function loadSqlTables(root = resolveRepoRoot()): string[] {
  const dir = join(root, MIGRATION_DIR_REL);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const found = new Set<string>();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|(\w+))/gi;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const name = (m[1] ?? m[2]).toLowerCase();
      found.add(name);
    }
  }
  return [...found].sort();
}

/** Read api/_db/schema.ts and collect the first string argument of each pgTable() call. */
export function loadDrizzleTables(root = resolveRepoRoot()): string[] {
  const src = readFileSync(join(root, SCHEMA_FILE_REL), 'utf8');
  const found = new Set<string>();
  // pgTable( newline? whitespace? quote+name+quote
  const re = /pgTable\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    found.add(m[1].toLowerCase());
  }
  return [...found].sort();
}

/** Compute the symmetric difference between the SQL and Drizzle table sets. */
export function diffSchemas(
  sqlTables: readonly string[],
  drizzleTables: readonly string[],
): SchemaDiff {
  const sqlSet = new Set(sqlTables);
  const drizzleSet = new Set(drizzleTables);
  const inSqlOnly: string[] = [];
  const inDrizzleOnly: string[] = [];
  const common: string[] = [];
  for (const t of sqlSet) {
    if (drizzleSet.has(t)) common.push(t);
    else inSqlOnly.push(t);
  }
  for (const t of drizzleSet) {
    if (!sqlSet.has(t)) inDrizzleOnly.push(t);
  }
  inSqlOnly.sort();
  inDrizzleOnly.sort();
  common.sort();
  return { inSqlOnly, inDrizzleOnly, common };
}

function formatDiff(diff: SchemaDiff): string {
  const lines: string[] = [];
  lines.push(`schema-mirror diff`);
  lines.push(`  common (${diff.common.length}): ${diff.common.join(', ') || '(none)'}`);
  if (diff.inSqlOnly.length > 0) {
    lines.push(`  in SQL migrations but missing from Drizzle schema (${diff.inSqlOnly.length}):`);
    for (const t of diff.inSqlOnly) lines.push(`    - ${t}`);
  }
  if (diff.inDrizzleOnly.length > 0) {
    lines.push(`  in Drizzle schema but missing from SQL migrations (${diff.inDrizzleOnly.length}):`);
    for (const t of diff.inDrizzleOnly) lines.push(`    - ${t}`);
  }
  return lines.join('\n');
}

/** CLI entry — only invoked when running via `tsx scripts/check-schema-mirror.ts`. */
function main(): void {
  const sql = loadSqlTables();
  const drizzle = loadDrizzleTables();
  const diff = diffSchemas(sql, drizzle);
  if (diff.inSqlOnly.length === 0 && diff.inDrizzleOnly.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`schema-mirror: OK (${diff.common.length} tables)`);
    process.exit(0);
  }
  // eslint-disable-next-line no-console
  console.error(formatDiff(diff));
  process.exit(1);
}

// Run main() only when invoked directly (not when imported by the Vitest suite).
const invokedAsScript = (() => {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();
if (invokedAsScript) main();
