/**
 * scripts/check-phase-a.ts — V4 W0.D.14 (QA §12.1).
 *
 * Phase A user-testing gate enforcement.
 *
 * Scans plan files for `[x]` ticks on Phase-A-binding micro IDs and
 * asserts that the corresponding evidence file exists at
 * `<evidenceRoot>/<micro-id>.md` (or `.customer.md` / `.merchant.md`
 * for hybrid micros). Lines carrying the inline marker
 * `<!-- phase-a-exempt -->` are skipped — backend / infra / docs /
 * cron-enable micros use the marker rather than producing evidence.
 *
 * Library shape (testable in isolation):
 *   • PHASE_A_PATTERNS  — RegExp list of micro-ID patterns
 *   • parsePlanLines    — extract `[ ]/[x]/[~]/[?]/[-]` rows + ID
 *   • findPhaseAViolations — given lines + an evidence resolver,
 *     returns the violating entries with a human-readable reason.
 *
 * CLI:
 *   npx tsx scripts/check-phase-a.ts \
 *     --plans path1.md,path2.md \
 *     --evidence ./phase-a-evidence
 *
 * Or via env:
 *   PPW_PLAN_FILES=path1.md,path2.md \
 *   PPW_PHASE_A_EVIDENCE=./phase-a-evidence \
 *   npx tsx scripts/check-phase-a.ts
 *
 * When no plan paths are configured, the script logs and exits 0
 * (CI-safe default: nothing to enforce yet). Local devs running
 * against the second-brain set PPW_PLAN_FILES + PPW_PHASE_A_EVIDENCE
 * to point at the actual plans and `06-Roadmap/user-testing/phase-a/`.
 *
 * The CI wiring decision (mirror plans into PPW-Code vs read from
 * second-brain at PR time vs run as a local pre-push hook) is
 * SEPARATE from this library — surfaced as V-decision V4-QA-2 if it
 * needs to escalate. The library itself is stable + tested.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phase A binds these micro-ID prefixes. Lines whose ID matches one
 * of these AND is ticked `[x]` need an evidence file unless they
 * carry the `<!-- phase-a-exempt -->` marker.
 *
 * Patterns mirror V4-UNIFIED-PLAN.md "Phase A gate enforcement" §:
 *   M1.B.*, M1.C.*, M9.A.*, M9.B.*, M4.A.*, M4.B.*,
 *   W0.5.A.*, W0.5.B.*, W2.*, W4.B.*, W4.G.*, W5.*
 *
 * Cross-A customer/merchant rows are handled by an explicit ID list
 * (Cross-A is broad — most rows are operational/infra and shouldn't
 * trip Phase A).
 */
export const PHASE_A_PATTERNS: readonly RegExp[] = [
  /^M1\.B\./,
  /^M1\.C\./,
  /^M9\.A\./,
  /^M9\.B\./,
  /^M4\.A\./,
  /^M4\.B\./,
  /^W0\.5\.A\./,
  /^W0\.5\.B\./,
  /^W2\./,
  /^W4\.B\./,
  /^W4\.G\./,
  /^W5\./,
];

/** Cross-A IDs that bind Phase A — narrow allowlist. */
export const CROSS_A_PHASE_A_IDS: ReadonlySet<string> = new Set<string>([
  // Currently empty — populate when a customer/merchant-touching Cross-A row exists.
]);

export type TickStatus = 'open' | 'partial' | 'done' | 'unneeded' | 'vic-blocked';

export interface PlanLineEntry {
  /** 1-based line number in the source file. */
  lineNumber: number;
  /** Raw source line for context. */
  raw: string;
  /** Parsed micro ID (e.g. 'M9.A.1', 'W0.5.B.7'). */
  microId: string;
  /** Tick status — done = `[x]`. */
  status: TickStatus;
  /** True if the line carries `<!-- phase-a-exempt -->`. */
  exempt: boolean;
}

function statusFromMark(mark: string): TickStatus {
  switch (mark) {
    case 'x':
      return 'done';
    case '~':
      return 'partial';
    case '-':
      return 'unneeded';
    case '?':
      return 'vic-blocked';
    default:
      return 'open';
  }
}

/**
 * Parse a plan file's lines into structured entries. Matches the two
 * tick formats in the plans:
 *   - `[x]` **M9.A.1** — …
 *   - `[x] M9.A.1` (V3.1-PLAN.md flat list style)
 * Lines without a recognisable micro ID are dropped.
 */
export function parsePlanLines(content: string): PlanLineEntry[] {
  const entries: PlanLineEntry[] = [];
  const lines = content.split(/\r?\n/);
  // Strict pattern: opening `[ ]`/`[x]`/`[~]`/`[?]`/`[-]` (optional backtick) then a micro ID.
  // Supports `**M9.A.1**` (V4 plan) and bare `M9.A.1` (V3.1 plan).
  const re = /^[\s>-]*[*-]?\s*`?\[([ x~?\-])\]`?\s*\*{0,2}([A-Z][A-Z0-9]*(?:\.[A-Z0-9]+)+)\*{0,2}/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = re.exec(line);
    if (!m) continue;
    const status = statusFromMark(m[1]);
    const microId = m[2];
    const exempt = /<!--\s*phase-a-exempt\s*-->/.test(line);
    entries.push({
      lineNumber: i + 1,
      raw: line,
      microId,
      status,
      exempt,
    });
  }
  return entries;
}

/** Does this micro ID bind Phase A? */
export function isPhaseABound(microId: string): boolean {
  if (CROSS_A_PHASE_A_IDS.has(microId)) return true;
  return PHASE_A_PATTERNS.some((re) => re.test(microId));
}

export type EvidenceResolver = (microId: string) => {
  /** Does at least one evidence file exist for this micro? */
  found: boolean;
  /** All matching paths that were checked (for diagnostics). */
  checked: string[];
};

export interface PhaseAViolation {
  microId: string;
  lineNumber: number;
  reason: string;
  checkedPaths: string[];
}

/**
 * Given parsed plan entries + a resolver that knows where evidence
 * files live, return every `[x]`+Phase-A-bound entry that lacks an
 * evidence file (and is not exempt).
 */
export function findPhaseAViolations(
  entries: readonly PlanLineEntry[],
  resolveEvidence: EvidenceResolver,
): PhaseAViolation[] {
  const violations: PhaseAViolation[] = [];
  for (const e of entries) {
    if (e.status !== 'done') continue; // only `[x]` ticks bind
    if (!isPhaseABound(e.microId)) continue;
    if (e.exempt) continue;
    const r = resolveEvidence(e.microId);
    if (r.found) continue;
    violations.push({
      microId: e.microId,
      lineNumber: e.lineNumber,
      reason: `Phase A evidence missing for ${e.microId}; add a record at one of: ${r.checked.join(', ')} (or add <!-- phase-a-exempt --> to the plan line).`,
      checkedPaths: r.checked,
    });
  }
  return violations;
}

/**
 * Default resolver: checks for `<micro-id>.md`, `<micro-id>.customer.md`,
 * `<micro-id>.merchant.md` in the given root directory. A micro
 * passes if AT LEAST ONE of these exists.
 */
export function fsEvidenceResolver(evidenceRoot: string): EvidenceResolver {
  return (microId) => {
    const candidates = [
      join(evidenceRoot, `${microId}.md`),
      join(evidenceRoot, `${microId}.customer.md`),
      join(evidenceRoot, `${microId}.merchant.md`),
    ];
    return {
      found: candidates.some((p) => existsSync(p)),
      checked: candidates,
    };
  };
}

interface CliArgs {
  plans: string[];
  evidence: string | null;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args = { plans: [] as string[], evidence: null as string | null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plans' && i + 1 < argv.length) {
      args.plans = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--evidence' && i + 1 < argv.length) {
      args.evidence = argv[++i];
    }
  }
  if (args.plans.length === 0 && process.env.PPW_PLAN_FILES) {
    args.plans = process.env.PPW_PLAN_FILES.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (args.evidence === null && process.env.PPW_PHASE_A_EVIDENCE) {
    args.evidence = process.env.PPW_PHASE_A_EVIDENCE;
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.plans.length === 0) {
    // CI-safe: nothing configured, nothing to enforce yet.
    // eslint-disable-next-line no-console
    console.log('check-phase-a: no plan files configured (set --plans or PPW_PLAN_FILES); skipping.');
    process.exit(0);
  }
  if (!args.evidence) {
    // eslint-disable-next-line no-console
    console.error('check-phase-a: --evidence (or PPW_PHASE_A_EVIDENCE) is required when --plans is set.');
    process.exit(2);
  }
  const resolver = fsEvidenceResolver(args.evidence);
  const allViolations: PhaseAViolation[] = [];
  for (const plan of args.plans) {
    if (!existsSync(plan)) {
      // eslint-disable-next-line no-console
      console.error(`check-phase-a: plan file not found: ${plan}`);
      process.exit(2);
    }
    const content = readFileSync(plan, 'utf8');
    const entries = parsePlanLines(content);
    const violations = findPhaseAViolations(entries, resolver);
    for (const v of violations) {
      allViolations.push({ ...v, reason: `${plan}:${v.lineNumber} — ${v.reason}` });
    }
  }
  if (allViolations.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`check-phase-a: OK (${args.plans.length} plan file(s) scanned, 0 violations).`);
    process.exit(0);
  }
  // eslint-disable-next-line no-console
  console.error(`check-phase-a: ${allViolations.length} violation(s)`);
  for (const v of allViolations) {
    // eslint-disable-next-line no-console
    console.error(`  - ${v.reason}`);
  }
  process.exit(1);
}

import { fileURLToPath } from 'node:url';
const invokedAsScript = (() => {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();
if (invokedAsScript) main();
