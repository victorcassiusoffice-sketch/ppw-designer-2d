import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { RESULTS_ROOT, REPOS, BASE_COMMIT } from './run-config.mjs';
const git = (repo, args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const lines = value => value ? value.split(/\r?\n/) : [];
const size = directory => fs.readdirSync(directory, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(path.join(directory,e.name)) : fs.statSync(path.join(directory,e.name)).size), 0);
const testFile = name => /(?:^|\/)(?:__tests__|tests)\/|\.(?:test|spec)\.[^.]+$/.test(name);
const settings = name => /^(?:\.github\/workflows\/|(?:playwright|vitest|eslint|tsconfig)[^/]*\.)|(?:^|\/)(?:\.?lighthouse[^/]*|\.?lhci[^/]*|\.env[^/]*|.*migration.*)$/.test(name);
const protectedSource = name => /^src\/(?:designer\/|data\/|lib\/currency\.|store\/currencyStore\.)/.test(name) || /^src\/.*(?:[Ee]stimat|[Pp]ricing|[Cc]ost|[Cc]urrency|solarPanelPreview)/.test(name);
const baseline = { walk: '712b5b27706b8661c38f1e28a2a582826b7d7d05', site: '85d64cfcc50a38f9cc9eac66f2a2a7e0b08c2de9' };
const output = [];
for (const branch of ['walk','site']) {
  const repo = REPOS[branch], head = git(repo,['rev-parse','HEAD']);
  const modified = lines(git(repo,['diff','--name-only','--diff-filter=MDR',BASE_COMMIT,'HEAD']));
  const oldFiles = new Set(lines(git(repo,['ls-tree','-r','--name-only',BASE_COMMIT])));
  const protectedFiles = [...oldFiles].filter(name => protectedSource(name) || settings(name));
  const changedFiles = lines(git(repo,['diff','--name-status',BASE_COMMIT,'HEAD']));
  const beforePackage = JSON.parse(git(repo,['show',baseline[branch]+':package.json'])), afterPackage = JSON.parse(fs.readFileSync(path.join(repo,'package.json'),'utf8'));
  const dependencyFields = ['dependencies','devDependencies','peerDependencies','optionalDependencies','overrides','engines'];
  const dependencyChanges = dependencyFields.filter(k => JSON.stringify(beforePackage[k]) !== JSON.stringify(afterPackage[k]));
  const baseVercel = JSON.parse(git(repo,['show',BASE_COMMIT+':vercel.json'])), currentVercel = JSON.parse(fs.readFileSync(path.join(repo,'vercel.json'),'utf8'));
  const expectedVercel = structuredClone(baseVercel);
  if (branch === 'site') expectedVercel.rewrites.unshift({ source: '/api/site/(.*)', destination: '/api/orders' });
  const row = {
    branch, head, base: BASE_COMMIT, checkedAt: new Date().toISOString(),
    ancestorExit: spawnSync('git',['merge-base','--is-ancestor',BASE_COMMIT,'HEAD'],{cwd:repo}).status,
    unpublishedCommits: lines(git(repo,['log','--oneline',`origin/gpt/olb-${branch === 'walk' ? 'walk-mode' : 'site-map'}-2026-10-27..HEAD`])),
    protectedFileCount: protectedFiles.length,
    protectedImplementationAndSettingsDiff: modified.filter(name => protectedSource(name) || settings(name)),
    modifiedBaseTests: modified.filter(name => oldFiles.has(name) && testFile(name)),
    finishDependencyFieldsChanged: dependencyChanges,
    finishLockfileDiff: lines(git(repo,['diff','--name-only',baseline[branch],'HEAD','--','package-lock.json'])),
    apiDiff: changedFiles.filter(name => /^[AMD]\s+api\//.test(name)),
    routingMatchesBasePlusAuthorizedCatchall: JSON.stringify(currentVercel) === JSON.stringify(expectedVercel),
    routingNote: branch === 'site' ? 'The existing Stage2 addition routes /api/site/(.*) to existing /api/orders; all other Vercel configuration matches base.' : 'Vercel configuration matches base.',
    prohibitedNewPaths: changedFiles.filter(name => /^(?:A|M)\s+/.test(name) && /(?:\/migrations?\/|\/(?:\.env[^/]*)(?:$|\/))/.test(name)),
    worldEvidenceBytes: size(path.join(repo,'docs/world')), limitBytes: 5000000,
    workingChanges: lines(git(repo,['status','--short'])),
    interpretation: 'Protected source includes the full existing src/designer and src/data trees plus named estimator/currency panels and helpers. Existing tests/settings are compared to merged base; Finish dependency/lock changes are compared to the pre-Finish World head. Package build-script changes are reported through Git and are not dependency changes. Browser rules are a separate proof.'
  };
  row.pass = row.ancestorExit === 0 && !row.unpublishedCommits.length && !row.protectedImplementationAndSettingsDiff.length && !row.modifiedBaseTests.length && !dependencyChanges.length && !row.finishLockfileDiff.length && !row.prohibitedNewPaths.length && row.routingMatchesBasePlusAuthorizedCatchall && row.worldEvidenceBytes < row.limitBytes && row.apiDiff.every(n => /^[AM]\s+api\/_lib\//.test(n) || n === 'M\tapi/orders.ts');
  output.push(row);
}
const outputName = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'rules-audit.json';
if (!/^[\w.-]+\.json$/.test(outputName)) throw Error('Output must be a JSON basename');
fs.writeFileSync(path.join(RESULTS_ROOT,outputName),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
