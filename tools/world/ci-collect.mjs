// Exact-head CI and Lighthouse collection through the GitHub API (read only).
// For each branch head: every check run with its conclusion and URL, and the
// Lighthouse job log parsed for failed assertions (route, audit id, actual,
// expected) so the inherited six can be compared with the round-3 list.
// Usage: node tools/world/ci-collect.mjs --walk-head=<sha> --site-head=<sha> --label=<unique>
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { OUTPUT, LABEL } from './run-config.mjs';
const repo = 'victorcassiusoffice-sketch/ppw-designer-2d';
const heads = { walk: process.argv.find(a => a.startsWith('--walk-head='))?.slice(12), site: process.argv.find(a => a.startsWith('--site-head='))?.slice(12) };
for (const [name, sha] of Object.entries(heads)) if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw Error(`Pass --${name}-head=<40-hex sha>`);
mkdirSync(OUTPUT, { recursive: true });
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const api = route => JSON.parse(gh('api', route));
const INHERITED = ['csp-xss', 'total-byte-weight', 'unused-css-rules', 'valid-source-maps'];
const report = { at: new Date().toISOString(), label: LABEL, repo, branches: {} };
for (const [branch, sha] of Object.entries(heads)) {
  const checks = api(`repos/${repo}/commits/${sha}/check-runs?per_page=100`).check_runs.map(c => ({ name: c.name, status: c.status, conclusion: c.conclusion, startedAt: c.started_at, completedAt: c.completed_at, url: c.html_url, runId: c.html_url.match(/runs\/(\d+)/)?.[1] ?? null, jobId: c.html_url.match(/job\/(\d+)/)?.[1] ?? null }));
  const statuses = api(`repos/${repo}/commits/${sha}/status`).statuses.map(s => ({ context: s.context, state: s.state, url: s.target_url }));
  const entry = { head: sha, checks, statuses, lighthouse: null, fullSuite: null };
  const lighthouse = checks.find(c => /lighthouse/i.test(c.name));
  if (lighthouse?.jobId && lighthouse.status === 'completed') {
    let log = '';
    try { log = gh('api', `repos/${repo}/actions/jobs/${lighthouse.jobId}/logs`); } catch (error) { entry.lighthouse = { error: String(error).slice(0, 300) }; }
    if (log) {
      // GitHub prefixes every line with a timestamp; LHCI colours its output with ANSI codes.
      const ansi = /\x1b\[[0-9;]*m/g;
      const lines = log.split(/\r?\n/).map(l => l.replace(/^\S+\s/, '').replace(ansi, ''));
      const failures = [], warnings = [];
      let route = null;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const url = line.match(/result\(s\) for\s+(https?:\/\/\S+)/);
        if (url) route = url[1].replace(/^https?:\/\/localhost:\d+/, '');
        const block = lines.slice(i, i + 8);
        const expected = block.find(l => /^\s*expected:/.test(l))?.replace(/.*expected:\s*/, '').trim() ?? null;
        const found = block.find(l => /^\s*found:/.test(l))?.replace(/.*found:\s*/, '').trim() ?? null;
        const failure = line.match(/^\s*✘\s+(\S+)\s+failure for\s+(\S+)\s+assertion/);
        if (failure) failures.push({ route, audit: failure[1], assertion: failure[2], expected, found, line: line.trim().slice(0, 240) });
        const warning = line.match(/^\s*⚠️?\s+(\S+)\s+warning for\s+(\S+)\s+assertion/);
        if (warning) warnings.push({ route, audit: warning[1], assertion: warning[2], expected, found });
      }
      const ids = [...new Set(failures.map(f => f.audit))];
      entry.lighthouse = { jobId: lighthouse.jobId, url: lighthouse.url, conclusion: lighthouse.conclusion, failures, warnings, auditIds: ids, newIds: ids.filter(id => !INHERITED.includes(id)), count: failures.length, warningCount: warnings.length };
    }
  } else entry.lighthouse = { status: lighthouse?.status ?? 'absent', conclusion: lighthouse?.conclusion ?? null, url: lighthouse?.url ?? null };
  const vitest = checks.find(c => /vitest/i.test(c.name));
  if (vitest?.jobId && vitest.status === 'completed') {
    try {
      const log = gh('api', `repos/${repo}/actions/jobs/${vitest.jobId}/logs`).replace(/\x1b\[[0-9;]*m/g, '');
      const files = log.match(/Test Files\s+(\d+) passed \((\d+)\)/), tests = log.match(/Tests\s+(\d+) passed \((\d+)\)/);
      entry.fullSuite = { files: files ? Number(files[1]) : null, tests: tests ? Number(tests[1]) : null, conclusion: vitest.conclusion, url: vitest.url };
    } catch (error) { entry.fullSuite = { error: String(error).slice(0, 300) }; }
  }
  report.branches[branch] = entry;
  console.log(JSON.stringify({ branch, head: sha.slice(0, 7), checks: checks.map(c => `${c.name}:${c.status}/${c.conclusion}`), lighthouse: entry.lighthouse && { conclusion: entry.lighthouse.conclusion, count: entry.lighthouse.count, warningCount: entry.lighthouse.warningCount, failures: entry.lighthouse.failures?.map(f => `${f.route} ${f.audit} ${f.assertion} expected ${f.expected} found ${f.found}`), newIds: entry.lighthouse.newIds, status: entry.lighthouse.status }, fullSuite: entry.fullSuite }));
}
writeFileSync(path.join(OUTPUT, 'ci-status.json'), JSON.stringify(report, null, 2) + '\n');
