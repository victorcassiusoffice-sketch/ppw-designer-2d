// Version 2: actual primary writes + the shipped isolated finalizer. Never
// overwrites Round 1 evidence or substitutes pre-finalization HTML bytes.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPOS as roots, BASE_COMMIT, LABEL, RESULTS_ROOT, acquireRun } from './run-config.mjs';

if (!process.argv.some(arg => arg.startsWith('--label='))) throw Error('Pass a new explicit --label=...; never reuse an earlier experiment.');
const HERE = path.dirname(fileURLToPath(import.meta.url));
acquireRun('controlled-build-finalized-v2');
const require = createRequire((roots.walk || roots.site) + '/package.json');
const { build } = await import(pathToFileURL(path.join(path.dirname(require.resolve('vite/package.json')), 'dist/node/index.js')).href);
process.env.VERCEL_ENV = 'preview';
process.env.VERCEL_GIT_COMMIT_SHA = BASE_COMMIT;

for (const name of (process.argv[2] || 'base,walk,site').split(',')) {
  const root = roots[name], out = path.join(RESULTS_ROOT, 'builds', LABEL, name);
  if (!root) throw Error('Unknown or unconfigured build target (set WORLD_REPO_BASE/WALK/SITE): ' + name);
  if (existsSync(out)) throw Error('Do not overwrite an earlier experiment: ' + out);
  const sourceCommit = name === 'base' ? BASE_COMMIT : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sourceStatus = name === 'base' ? 'Exact base extraction, separately verified' : execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim();
  const dependencyLockSha256 = createHash('sha256').update(readFileSync(path.join(root, 'package-lock.json'))).digest('hex');
  mkdirSync(out, { recursive: true }); process.chdir(root);
  const built = await build({ root, configFile: root + '/vite.config.ts', logLevel: 'error' });
  const primary = Array.isArray(built) ? built.flatMap(result => result.output) : built.output;
  let finalization = null, isolated = [];
  const helper = path.join(root, 'tools/build-plumbing-entry.mjs');
  if (existsSync(helper)) {
    const { buildPlumbingEntry } = await import(pathToFileURL(helper).href);
    const completed = await buildPlumbingEntry({ root });
    finalization = completed.proof; isolated = completed.output;
  }
  const dist = path.join(root, 'dist');
  const maps = readdirSync(dist, { recursive: true }).filter(file => file.endsWith('.map'));
  if (maps.length) throw Error('Public source maps in final artifacts: ' + maps.join(', '));
  const rows = [];
  for (const chunk of [...primary, ...isolated]) {
    const file = chunk.fileName;
    // Hidden private upload maps have already been removed by existing policy.
    if (file.endsWith('.map')) continue;
    const data = readFileSync(path.join(dist, file));
    const destination = path.join(out, file);
    mkdirSync(path.dirname(destination), { recursive: true }); writeFileSync(destination, data);
    rows.push({ file, bytes: data.length, gzipBytes: gzipSync(data).length, sha256: createHash('sha256').update(data).digest('hex'), type: chunk.type,
      imports: chunk.type === 'chunk' ? chunk.imports : [], dynamicImports: chunk.type === 'chunk' ? chunk.dynamicImports : [],
      modules: chunk.type === 'chunk' ? Object.entries(chunk.modules).map(([id, module]) => ({ id: id.replaceAll('\\', '/').replace(root.replaceAll('\\', '/') + '/', ''), renderedLength: module.renderedLength, renderedExports: module.renderedExports })) : [] });
  }
  const graph = new Map(rows.map(row => [row.file, row])), early = new Set();
  function visit(file) { if (early.has(file)) return; early.add(file); for (const dependency of graph.get(file)?.imports || []) visit(dependency); }
  const entries = rows.filter(row => !row.file.startsWith('assets/plumbing/') && /\/App-|\/ThreeStage-/.test(row.file) && row.file.endsWith('.js')).map(row => row.file);
  entries.forEach(visit);
  const result = { at: new Date().toISOString(), name, label: LABEL, sourceCommit, sourceStatus, dependencyLockSha256, baseCommit: BASE_COMMIT,
    buildEnvironment: process.env.VERCEL_ENV, methodVersion: 2,
    method: 'Real completed primary Vite output, then the exact npm-build isolated finalizer. All reported bytes/hashes read from final disk output. Returned Rollup graphs retain module attribution. Static gate remains original App + ThreeStage closure; selector HTML and pitch artifacts are separately reported. No new dependency/settings/env configuration; identical existing comparison variables. Actual browser trace separately verifies zero new first-picture requests, DOM loading and FCP.',
    finalization, publicMaps: maps, entries,
    early: [...early].sort().map(file => { const { modules, ...row } = graph.get(file); return row; }),
    modules: rows.flatMap(row => row.modules.map(module => ({ ...module, chunk: row.file, early: early.has(row.file) }))),
    assets: rows.map(({ modules, ...row }) => row) };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ name, label: LABEL, methodVersion: 2, earlyCount: result.early.length,
    earlyRaw: result.early.reduce((sum, row) => sum + row.bytes, 0), earlyGzip: result.early.reduce((sum, row) => sum + row.gzipBytes, 0),
    finalization: finalization && { primaryFilesVerified: finalization.primaryFilesVerified, originalNonHtmlHashesPreserved: finalization.originalNonHtmlHashesPreserved,
      html: Object.fromEntries(Object.entries(finalization.html).map(([file, value]) => [file, { rawDelta: value.rawDelta, gzipDelta: value.gzipDelta }])) } }));
}
