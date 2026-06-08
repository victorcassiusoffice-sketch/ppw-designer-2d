/**
 * ESM extension guard (regression test for the 2026-06-03 capture-500 incident).
 *
 * ROOT CAUSE: `src/lib/paintCalculator.ts` imported `'../data/paintPalette'`
 * with NO `.js` extension. The frontend (Vite/Vitest) resolves extensionless
 * relative imports fine, so build + unit tests stayed green. But Vercel ships
 * serverless functions as native Node ESM, and Node ESM requires explicit
 * file extensions. Because `api/merchants-router.ts` transitively imports that
 * src file (via the paint-calc handler), the WHOLE function crashed at
 * module-load on Vercel — every route (capture PDF, calc, signup, calibrate,
 * upload) returned HTTP 500 FUNCTION_INVOCATION_FAILED in production.
 *
 * This test walks the dependency graph of every `src/**` module reachable
 * from an `api/**` function and asserts that EVERY relative value-import
 * carries an explicit `.js` extension — the exact invariant Node ESM needs.
 * If a future edit drops an extension on an api-reachable src file, this
 * fails locally instead of 500-ing in prod.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');

// Entry points: src/* modules imported as VALUES (not `import type`) by api/*.
// Keep in sync with `grep -rln "from '.*src/.*\.js'" api/`.
const API_REACHABLE_SRC_ENTRIES = [
  'src/lib/paintCalculator.ts',
  'src/lib/floorCalculator.ts',
  'src/lib/capture/types.ts',
];

/** Match relative import/export specifiers, skipping `import type ...`. */
const SPECIFIER_RE =
  /(?<!import\s+type\s)(?:import|export)\b[^'"]*?\bfrom\s*['"](\.[^'"]+)['"]/g;
/** Inline `import type { X } from '...'` — type-only, erased at compile. */
const TYPE_ONLY_RE = /\bimport\s+type\b/;

function resolveTsPath(fromFile: string, spec: string): string | null {
  const base = join(dirname(fromFile), spec.replace(/\.js$/, ''));
  for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(resolve(REPO_ROOT, cand))) return cand;
  }
  return null;
}

function collectGraph(entry: string, seen: Set<string>, violations: string[]): void {
  if (seen.has(entry)) return;
  seen.add(entry);
  const abs = resolve(REPO_ROOT, entry);
  if (!existsSync(abs)) return;
  const src = readFileSync(abs, 'utf8');
  for (const line of src.split('\n')) {
    SPECIFIER_RE.lastIndex = 0;
    const m = SPECIFIER_RE.exec(line);
    if (!m) continue;
    if (TYPE_ONLY_RE.test(line)) continue; // type-only import — erased
    const spec = m[1];
    if (!spec.endsWith('.js')) {
      violations.push(`${entry} → '${spec}' (missing .js extension)`);
      continue;
    }
    const next = resolveTsPath(entry, spec);
    if (next) collectGraph(next, seen, violations);
  }
}

describe('ESM extension guard (api-reachable src modules)', () => {
  it('every relative value-import in the api→src graph has an explicit .js extension', () => {
    const violations: string[] = [];
    const seen = new Set<string>();
    for (const entry of API_REACHABLE_SRC_ENTRIES) {
      collectGraph(entry, seen, violations);
    }
    expect(violations, `Node-ESM resolution would 500 on Vercel:\n${violations.join('\n')}`).toEqual([]);
  });
});
