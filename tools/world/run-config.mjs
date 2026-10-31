// World measurement harness: shared configuration.
// Ported 31 Oct 2026 from GPT's Codex folder (work/world-finish/round4) so the
// Finish loop no longer depends on that folder. Paths come from the environment;
// results go to a scratch directory, never into the repository.
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
/** The repository that holds this tools/world folder (whichever World branch is checked out). */
export const REPO_ROOT = path.resolve(ROOT, '../..');
export const BASE_COMMIT = process.env.WORLD_BASE_COMMIT || '56d852d1f2f5d7342b9e02194964d6b998c795c7';
/** Controlled-build checkouts: base = PR #52 head, walk/site = the two World branches. */
export const REPOS = {
  base: process.env.WORLD_REPO_BASE || '',
  walk: process.env.WORLD_REPO_WALK || REPO_ROOT,
  site: process.env.WORLD_REPO_SITE || REPO_ROOT,
};
export const TARGETS = {
  base: process.env.WORLD_TARGET_BASE || 'https://ppw-designer-2d-git-gpt-olb-fix-round-3-2026-10-27-victor-ppw.vercel.app',
  walk: process.env.WORLD_TARGET_WALK || 'https://ppw-designer-2d-git-gpt-olb-walk-mode-2026-10-27-victor-ppw.vercel.app',
  site: process.env.WORLD_TARGET_SITE || 'https://ppw-designer-2d-git-gpt-olb-site-map-2026-10-27-victor-ppw.vercel.app',
  prod: process.env.WORLD_TARGET_PROD || 'https://onelivebuild.com',
  localwalk: process.env.WORLD_TARGET_LOCALWALK || 'http://127.0.0.1:5183',
  localsite: process.env.WORLD_TARGET_LOCALSITE || 'http://127.0.0.1:5184',
};
/** Vercel edges 64.29.17.x never answer from this laptop; every *.vercel.app host is pinned here. */
export const PIN_IP = process.env.WORLD_PIN_IP || '216.198.79.3';
const configArgument = process.argv.find(a => a.startsWith('--config='));
if (configArgument) {
  const overrides = JSON.parse(readFileSync(path.resolve(configArgument.slice(9)), 'utf8'));
  Object.assign(REPOS, overrides.repos || {}); Object.assign(TARGETS, overrides.targets || {});
}
export const LABEL = process.argv.find(a => a.startsWith('--label='))?.slice(8) || new Date().toISOString().replace(/[:.]/g, '-');
if (!/^[a-zA-Z0-9._-]+$/.test(LABEL)) throw Error('Use a simple --label=name; no paths.');
export const RESULTS_ROOT = process.env.WORLD_RESULTS_DIR || path.join(os.tmpdir(), 'world-results');
export const OUTPUT = path.join(RESULTS_ROOT, LABEL);
const lockPath = path.join(RESULTS_ROOT, 'performance-active.json');
let acquired = false;
/** One browser or controlled build at a time: formal timing must never overlap other heavy work. */
export function acquireRun(kind) {
  if (acquired) return;
  mkdirSync(path.dirname(lockPath), { recursive: true });
  try { writeFileSync(lockPath, JSON.stringify({ pid: process.pid, kind, label: LABEL, at: new Date().toISOString(), argv: process.argv }, null, 2), { flag: 'wx' }); }
  catch (error) {
    if (existsSync(lockPath)) throw Error('Performance run already locked; inspect the owner before removing a stale lock: ' + readFileSync(lockPath, 'utf8'));
    throw error;
  }
  acquired = true;
  process.once('exit', () => { try { const lock = JSON.parse(readFileSync(lockPath, 'utf8')); if (lock.pid === process.pid) unlinkSync(lockPath); } catch { /* another owner */ } });
}
