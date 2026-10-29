// Preparation is the default. Execution is deliberately explicit and writes only
// to the chat's outputs/world-finish/round-2 directory, never either repository.
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const round = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(round, '../../..');
const output = path.join(root, 'outputs/world-finish/round-2');
const args = new Set(process.argv.slice(2));
const heads = {
  base: '56d852d1f2f5d7342b9e02194964d6b998c795c7',
  walk: 'd78064f9f57ed6e060d9782036b4a8b7a7e95451',
  site: 'b3727b1d20fff6be3ac448dfe8bf11e9261ad500',
};
const printDir = 'site-print-b3727b1-20261029';
const siteDir = 'site-g-b3727b1-20261029';
const siteRepo = path.resolve(root, '../../2026-09-23/c/work/ppw-designer-site');
const preferredBudget = 3_000_000;
const hardBudget = 5_000_000;
const json = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const read = (p) => json(path.join(round, p));
const slash = (p) => p.replaceAll('\\', '/');
const relative = (p) => slash(path.relative(root, p));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const status = (value) => value === true ? 'PASS' : value === false ? 'FAIL' : 'UNRESOLVED';
const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
const ms = (value) => number(value, 1);
const esc = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.map(esc).join(' | ')} |`),
].join('\n');
async function files(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Refusing symlink: ${full}`);
    if (entry.isDirectory()) result.push(...await files(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function target(name) {
  const full = path.resolve(output, name);
  assert(full.startsWith(output + path.sep), `Output outside fixed package: ${name}`);
  return full;
}

if (!args.has('--execute')) {
  console.log(JSON.stringify({
    mode: 'PREPARATION ONLY — no copies, hashing, or output creation',
    output, expectedHeads: heads,
    finalExecution: 'node work/world-finish/round2/package-round2.mjs --execute --walk-final-reviewed',
    requires: [
      'Parent has reviewed the updated Walk compact, including native-touch phone failure and input profile.',
      'Visible rules have completed. Existing output directory must not exist.',
      'Parent has released CPU/browser lease for final hashing and gzip packaging.',
    ],
    includes: ['every timing pair', 'exact raw 40 loads gzip', 'all formal frame intervals gzip',
      'all Round2 Walk input/functional samples', 'compact profile attribution',
      'all eight visually inspected final PDF pages and both PDFs', 'latest Site seven cases',
      'corrected build/Lighthouse attribution', 'renderer and footer proof',
      'static and visible rules', 'raw failure/trace SHA-256 inventory'],
    budget: { preferredBytes: preferredBudget, hardBytes: hardBudget },
  }, null, 2));
  process.exit(0);
}
assert(args.has('--walk-final-reviewed'), 'Stop: updated Walk compact needs parent review; no package has been written.');
try { await fs.access(output); throw new Error(`Output exists; preserve it and choose a new approved package revision: ${output}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

// Read/validate final identity before writing anything. Failures in the measured
// gates remain valid evidence and do not prevent packaging; stale heads do.
const summary = await read('results/r2-candidate/summary.json');
const network = await read('results/r2-candidate/network-audit.json');
const loads = await read('results/r2-candidate/load-all.json');
const builds = await read('build-attribution-corrected.json');
const lighthouse = await read('lighthouse-classification-corrected.json');
const startup = await read('startup-analysis.json');
const walk = await read('R2-WALK-INPUT-FRAMES-FUNCTIONAL.json');
const site = await read(`${siteDir}/preview-smoke.json`);
const print = await read(`${printDir}/visual-review.json`);
const rules = await read('rules-audit.json');
const visibleRules = await read('results/r2-rules/visible-rules.json');
const renderer = await read('renderer-checks.json');
assert(summary.baseCommit === heads.base && builds.baseHead === heads.base, 'Baseline SHA mismatch.');
assert(loads.rows.length === 40, 'Expected all 40 formal loads, with no discarded samples.');
for (const branch of ['walk', 'site']) {
  assert(summary.bundles[branch].candidateCommit === heads[branch], `${branch} timing head mismatch.`);
  assert(builds.branches[branch].sourceHead === heads[branch], `${branch} build head mismatch.`);
  assert(lighthouse.branches[branch].head === heads[branch], `${branch} Lighthouse head mismatch.`);
  assert(summary.timings[branch].rows.length === 2 && summary.timings[branch].rows.every((x) => x.pairs.length === 5), `${branch} timing pairs incomplete.`);
}
assert(walk.commit === heads.walk && site.expectedSha === heads.site && print.sourceHead === heads.site, 'Functional/print SHA mismatch.');
assert(site.rows.length === 7 && print.inspectedPages.length === 8, 'Site coverage or all-page inspection is incomplete.');
assert(visibleRules.rows.length === 4 && visibleRules.rows.reduce((n, row) => n + row.screens.length, 0) === 8, 'Expected eight visible-rules screens.');
assert(!/^No new profile has run/.test(walk.diagnostic?.status ?? ''), 'Walk compact is still the pre-diagnostic version.');

const sources = new Map();
const packaged = [];
const failures = [];
async function remember(file, role, packagedAs = null) {
  const key = path.resolve(file);
  let entry = sources.get(key);
  if (!entry) {
    const stat = await fs.stat(key);
    entry = { path: relative(key), bytes: stat.size, sha256: await hashFile(key), roles: [], packagedAs: [] };
    sources.set(key, entry);
  }
  if (!entry.roles.includes(role)) entry.roles.push(role);
  if (packagedAs && !entry.packagedAs.includes(packagedAs)) entry.packagedAs.push(packagedAs);
  return entry;
}
async function write(name, data) {
  const file = target(name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data, { flag: 'wx' });
  const bytes = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
  packaged.push({ path: slash(name), bytes, sha256: createHash('sha256').update(data).digest('hex') });
}
async function copy(source, name, role) {
  const full = path.isAbsolute(source) ? source : path.join(round, source);
  await remember(full, role, name);
  await write(name, await fs.readFile(full));
}
async function gzip(source, name, role) {
  const full = path.isAbsolute(source) ? source : path.join(round, source);
  await remember(full, role, name);
  await write(name, gzipSync(await fs.readFile(full), { level: 9, mtime: 0 }));
}
async function writeJSON(name, value) { await write(name, JSON.stringify(value, null, 2) + '\n'); }

await fs.mkdir(output, { recursive: false });
for (const [source, name, role] of [
  ['results/r2-candidate/summary.json', 'timings-and-static.json', 'All timing pairs and early closure inventory'],
  ['build-attribution-corrected.json', 'build-attribution.json', 'Correct final emitted build attribution'],
  ['lighthouse-classification-corrected.json', 'lighthouse-classification.json', 'Final exact-head Lighthouse classification'],
  ['startup-analysis.json', 'startup-analysis.json', 'All formal startup rows; responseStart is not pure server latency'],
  ['renderer-checks.json', 'renderer-checks.json', 'All renderer attempts and final interpretation'],
  ['rules-audit.json', 'rules-static.json', 'Static rule audit'],
  ['results/r2-rules/visible-rules.json', 'rules-visible.json', 'Eight final visible screens'],
  ['R2-WALK-INPUT-FRAMES-FUNCTIONAL.json', 'walk/compact.json', 'Updated exact-head Walk functional/performance/diagnostic interpretation'],
  ['R2-WALK-INPUT-FRAMES-FUNCTIONAL.md', 'walk/REVIEW.md', 'Updated Walk human review'],
  [`${siteDir}/preview-smoke.json`, 'site/preview-smoke.json', 'Final seven Site cases; production guard is a simulation'],
  ['footer-tests/r2-footer-corrected-v1/walk/verified.json', 'footer/walk-verified.json', 'Final footer verification'],
  ['footer-tests/r2-footer-corrected-v1/site/verified.json', 'footer/site-verified.json', 'Final footer verification'],
]) await copy(source, name, role);

await gzip('results/r2-candidate/load-all.json', 'raw40loads.json.gz', 'Exact raw formal 40 loads; every slow/error row retained');
await gzip('results/r2-candidate/network-audit.json', 'network-audit.json.gz', 'Exact network audit including every compared pair and source request row');
await writeJSON('network-summary.json', {
  at: network.at, baseCommit: network.baseCommit, label: network.label, buildLabel: network.buildLabel, method: network.method,
  branches: Object.fromEntries(Object.entries(network.branches).map(([name, x]) => [name, {
    perPair: x.perPair, newRequestNames: x.newRequestNames, missingRequestNames: x.missingRequestNames,
    newRequestNamesAgainstCustom: x.newRequestNamesAgainstCustom,
    featureRequestsBeforePicture: x.featureRequestsBeforePicture,
    observedStaticRawDelta: x.observedStaticRawDelta, observedStaticGzipDelta: x.observedStaticGzipDelta,
    allSameOlbShell: x.allSameOlbShell, noNewRequestsEveryPair: x.noNewRequestsEveryPair,
  }])),
});
for (const name of ['base', 'walk', 'site']) {
  await gzip(`builds/r2-final-corrected/${name}/audit.json`, `builds/${name}-audit.json.gz`, 'Exact final build output and rendered-module evidence');
}

// All original input/functional samples and complete frame records are retained,
// including failed phone attempts. Large CPU/trace artifacts stay in scratch with
// streamed SHA-256/size entries; compact attribution and sample summaries travel.
const resultDirectories = (await fs.readdir(path.join(round, 'results'), { withFileTypes: true }))
  .filter((x) => x.isDirectory() && x.name.startsWith('r2-walk-')).map((x) => x.name).sort();
for (const directory of resultDirectories) {
  for (const file of await files(path.join(round, 'results', directory))) {
    const basename = path.basename(file);
    const name = `walk/raw/${directory}/${basename}.gz`;
    const isLargeTrace = /(?:trace|cpu-profile)\.(?:json|zip|gz)$/.test(basename);
    const isJsonSample = basename.endsWith('.json') && !isLargeTrace;
    if (isJsonSample) await gzip(file, name, 'Complete Round2 Walk input/functional/frame/profile-summary sample');
    else await remember(file, isLargeTrace ? 'Raw trace/profile retained in scratch; compact attribution packaged' : 'Original Walk evidence retained in scratch');
  }
}
assert([...sources.values()].some((x) => x.path.endsWith('r2-walk-functional-phone-v1/walk-functional-walk.json')), 'Original failed phone sample is missing.');
assert([...sources.values()].some((x) => x.path.endsWith('r2-walk-functional-phone-touch-v2/walk-functional-walk.json')), 'Native-touch failed phone sample is missing.');
assert([...sources.values()].some((x) => x.path.endsWith('r2-walk-frames-v2/walk-framerate-walk.json')), 'All frame intervals are missing.');

// Accepted normal-source PDFs and all eight inspected renderings. The G harness
// also printed reports, but those duplicate exports do not replace this proof.
for (const file of await files(path.join(round, printDir))) {
  await copy(file, `site/print/${path.basename(file)}`, 'Accepted final PDF proof; all eight pages visually inspected');
}
for (const name of ['live-laptop.jpg', 'live-phone.jpg', 'loading-laptop.jpg', 'loading-phone.jpg']) {
  await copy(`${siteDir}/${name}`, `site/${name}`, 'Final Site UI evidence at exact published head');
}

// Preserve failure metadata and raw artifacts in scratch. Small raw diagnostic
// JSON/logs travel compressed; no corrected run overwrites an earlier failure.
const failureGroups = [
  { dir: 'site-print-0e55d0d-20261029', outcome: 'FAIL: fixed bottom footer overlaps body on all eight pages. Both failed PDFs and all eight renderings remain in scratch.' },
  { dir: 'site-print-diagnostic-20261029', outcome: 'Labelled CSS experiments: fixed-top also failed; named margin box passed. Zero-height containing-block hypothesis was not confirmed. Final normal-source PDF proof is separate.' },
  { dir: 'renderer-baseline', outcome: 'Harness configuration error, not an application result.' },
  { dir: 'renderer-baseline-v2', outcome: 'Unpinned Node DNS/health failure, not an application result.' },
  { dir: 'renderer-baseline-v3', outcome: 'Exact baseline reproduces two intermediate 450x225 allocations.' },
  { dir: 'renderer-candidate-walk-v1', outcome: 'Preserved oracle failures plus blocked automatic vercel.live POST; no login or transmitted write.' },
  { dir: 'renderer-candidate-walk-v2', outcome: 'Preserved fractional-density viewport oracle failure; corrected assertion follows actual installed Three behavior.' },
  { dir: 'pitch-contrast/r2-footer-v1', outcome: 'Inherited Ocean/Slate footer contrast failure; later generated CSS and browser proof correct it.' },
  { dir: 'verification/walk-warmrestore-20261029T062308Z', outcome: 'Initial full suite failure in generated OLB stylesheet reproducibility; generator and focused tests subsequently completed.' },
];
for (const item of failureGroups) {
  const entries = [];
  for (const file of await files(path.join(round, item.dir))) {
    entries.push((await remember(file, item.outcome)).path);
    if (/\.(json|md|log)$/.test(file)) {
      await gzip(file, `failures/${slash(path.relative(round, file))}.gz`, item.outcome);
    }
  }
  failures.push({ source: relative(path.join(round, item.dir)), outcome: item.outcome, files: entries });
}
for (const file of ['build-attribution.json', 'lighthouse-classification.json', 'verification-notes.md']) {
  await gzip(file, `failures/historical-${file}.gz`, 'Historical Round2 evidence; superseded attribution is explicitly retained, not presented as current');
}

// Diagnostic evidence has its own heads and instrumentation. It is never used
// to replace the formal 40-load campaign or claim a physical phone measurement.
for (const directory of ['plumbing/r2-plumbing-v1', 'startup-paint/r2-paint-v1', 'hosting-probe/r2-hosting-v1']) {
  for (const file of await files(path.join(round, directory))) {
    if (/\.(json|md|log)$/.test(file)) await gzip(file, `diagnostics/${slash(path.relative(round, file))}.gz`, 'Separate diagnostic with original head, errors, writes and caveats');
    else await remember(file, 'Diagnostic visual artifact retained in scratch');
  }
}
for (const branch of ['walk', 'site']) {
  const directory = path.join(round, `lighthouse-corrected-${branch}`);
  for (const file of await files(directory)) {
    await remember(file, 'Full exact-head Lighthouse source retained in scratch; classification packaged');
  }
}

// Preserve verification provenance: older full-suite evidence is labelled by its
// original head. Do not silently promote it to final-head CI or blanket lint pass.
for (const file of await files(path.join(round, 'verification'))) {
  if (/\.(json|log|md)$/.test(file)) {
    const name = `verification/${slash(path.relative(path.join(round, 'verification'), file))}.gz`;
    if (!packaged.some((x) => x.path === name)) await gzip(file, name, 'Verification output retains exact original SHA and exit status');
  }
}

// Include the small harnesses used for final Site proof, not dependencies or any
// source implementation. Copying from a repository is read-only.
for (const [file, name] of [
  ['work/site-qa/finish-preview.mjs', 'harness/site-seven-cases.mjs'],
  ['scripts/qa/site-print.mjs', 'harness/site-print.mjs'],
  ['scripts/qa/site-print-pdf.mjs', 'harness/site-print-pdf.mjs'],
]) await copy(path.join(siteRepo, file), name, 'Final Site evidence harness');
await copy(fileURLToPath(import.meta.url), 'harness/package-round2.mjs', 'Package assembly source; fixed output guard');

const candidateStartup = startup.rows.filter((row) => row.target === 'walk' || row.target === 'site');
const pairedRows = Object.entries(summary.timings).flatMap(([branch, value]) => value.rows.map((row) => [
  branch, row.device, ms(row.medians.baseWallMs), ms(row.medians.previewWallMs),
  ms(row.medians.baseCanvasMs), ms(row.medians.previewCanvasMs),
  number((row.wallRatio - 1) * 100, 2) + '%', status(row.gates.absoluteWall), status(row.gates.pairedWall),
]));
const pairTables = Object.entries(summary.timings).flatMap(([branch, value]) => value.rows.map((row) => [
  `### ${branch} / ${row.device}: every retained pair`, '',
  table(['Run', 'Base wall ms', 'Preview wall ms', 'Custom wall ms', 'Base canvas ms', 'Preview canvas ms', 'Custom canvas ms', 'Preview loader DOM ms', 'Preview FCP ms', 'Failures'], row.pairs.map((p) => [
    p.run, ms(p.baseWallMs), ms(p.previewWallMs), ms(p.customWallMs), ms(p.baseCanvasMs), ms(p.previewCanvasMs),
    ms(p.customCanvasMs), ms(p.previewLoadingSeenMs), ms(p.previewFcpMs), p.failures.length ? JSON.stringify(p.failures) : 'none',
  ])), '',
].join('\n'))).join('\n');
const inputRows = walk.input.flatMap((row) => row.keyboard.map((mode) => [
  row.device, mode.mode, mode.values.map((x) => number(x, 1)).join(', '), number(mode.max, 1), `${mode.below50}/${mode.count}`,
]));
const frameRows = walk.frames.map((row) => [
  row.device, row.mode, row.count, ms(row.activeMs), ms(row.pausedMs), number(row.fps, 2), number(row.low1, 2),
  ms(row.maxIntervalMs), status(row.strictFpsPass), status(row.completeUnpausedWindow),
]);
const bundleRows = [
  ['Base52', builds.baseline.count, builds.baseline.raw, builds.baseline.gzip, 0, 0, 'baseline'],
  ...Object.entries(builds.branches).map(([name, x]) => [name, x.count, x.raw, x.gzip, x.rawDelta, x.gzipDelta, status(x.gzipDelta <= 1024)]),
];
const remainingLhRows = Object.entries(lighthouse.branches).flatMap(([branch, x]) => x.remaining.map((r) => [branch, r.route, r.id, r.actual, r.expected, r.reason]));
const gateRows = [
  ['Exact-head formal health', status(loads.healthStable), 'All 40 raw loads and before/after health retained.'],
  ['Absolute laptop first picture <3s', 'FAIL', 'Walk 4299ms; Site 4838ms median wall observation.'],
  ['Absolute phone first picture <5s', 'PASS', 'Walk 4149ms; Site 3710ms median wall observation.'],
  ['Same-host median within 10% baseline', 'PASS', 'All four branch/device medians pass. Individual slower pairs are retained; the gate does not require every pair to improve.'],
  ['Visible loading within 1s every run', 'FAIL', 'DOM visibility alone is insufficient; nine of twenty candidates have FCP within 1s.'],
  ['Early gzip numerical ceiling <=1024 bytes', 'PASS', 'Walk +489, Site +940. Separate semantic attribution still applies.'],
  ['No new pre-picture request names', status(Object.values(network.branches).every((x) => x.noNewRequestsEveryPair && x.featureRequestsBeforePicture.length === 0)), 'Ten pairs per branch; 36 requests in each baseline/candidate window.'],
  ['Walk chooser <1s', status(walk.gates.chooserUnder1Second), 'Decoded-frame and DOM observations kept separately.'],
  ['Laptop input <50ms every sample', status(walk.gates.laptopInputUnder50), 'Original outlier and later diagnostic remain, with every input sample.'],
  ['Strict measured Walk FPS windows', status(walk.gates.strictFps), 'Four full unpaused 40s windows; 1% lows and every interval retained.'],
  ['Walk desktop functional', status(walk.gates.desktopFunctional), 'Exact captured functional sample.'],
  ['Walk phone functional / door', status(walk.gates.phoneFunctional), 'Original phone v1 and native one-pointer v2 remain. A later diagnostic does not erase a failed formal sample.'],
  ['Site G/E coverage', status(site.passed), 'Seven cases; production guard is a labelled healthcheck simulation.'],
  ['Site A4 banner on every page', status(print.automatedPassed && print.visualPassed), 'Eight inspected pages, both PDFs, no overlap.'],
  ['Static rules', status(rules.every((x) => x.pass)), 'Exact-head protected-file/settings/dependency audit.'],
  ['Visible rules', status(visibleRules.passed), 'Eight screens across both heads and viewports.'],
  ['Lighthouse all error assertions', 'FAIL', 'Seven inherited errors per branch remain; no new errors; thresholds unchanged.'],
];
const report = `# World Finish — Round 2 evidence\n\nThis round is **not all green**. Laptop first-picture, loading-paint, strict input-latency, phone door functionality and inherited Lighthouse gates remain failed or unresolved as shown below. Failed and slow samples are preserved. This package does not authorize a production merge or deployment.\n\nBase52: \`${heads.base}\`. Walk: \`${heads.walk}\`. Site: \`${heads.site}\`. Final evidence uses these source heads; diagnostics and older verification retain their own original heads.\n\n## Gate status\n\n${table(['Gate', 'Result', 'Evidence / limits'], gateRows)}\n\n## Formal first-picture campaign\n\nFive fresh pairs per branch/device share the same ten baseline and ten custom-host observations, giving forty unique loads total. Raw observations are in \`raw40loads.json.gz\`; no loads are excluded. Same-host preview comparison governs the relative gate. The custom host is a separately recorded operational reference, not the same-host baseline. Wall observation and browser canvas mark remain distinct. Instrumented diagnostics never replace these values.\n\n${table(['Branch', 'Device', 'Base wall median ms', 'Preview wall median ms', 'Base canvas median ms', 'Preview canvas median ms', 'Wall change', 'Absolute gate', 'Relative gate'], pairedRows)}\n\n${pairTables}\n## Loading and network\n\nOf twenty candidate loads, ${candidateStartup.filter((x) => x.loadingFcpWithinOneSecond).length} had FCP within one second and ${candidateStartup.filter((x) => x.loadingDomWithinOneSecond).length} had a visible loading DOM within one second. Six responseStart observations were later than one second. responseStart includes connection/TLS and other pre-response work; this is **not pure server latency**. FCP proves a content paint, not which content; separate screencast evidence establishes that the HTML loader can paint before React. \`startup-analysis.json\` retains every row and these limits.\n\n${table(['Branch', 'Compared pairs', 'New request names', 'Early feature requests', 'Gate'], Object.entries(network.branches).map(([name, x]) => [name, x.perPair.length, x.newRequestNames.length, x.featureRequestsBeforePicture.length, status(x.noNewRequestsEveryPair)]))}\n\nFull request details remain in \`network-audit.json.gz\`. Formal and final Site campaigns have zero attempted writes. An earlier renderer diagnostic intercepted an automatic \`vercel.live/login/validate\` POST; it was blocked, not transmitted, and remains recorded. A separate twelve-case hosting probe did not reproduce it. This package does not silently filter that event into a universal zero-write claim.\n\n## Corrected emitted build\n\n${table(['Build', 'Early files', 'Raw bytes', 'Gzip bytes', 'Raw delta', 'Gzip delta', 'Numerical gate'], bundleRows)}\n\nThese are final Vite emitted assets, after preload/finalizer transforms, not the earlier generateBundle snapshot. The <=1024-byte numerical gate is distinct from the semantic lazy-seam rule. Walk's original beauty-shader warm-up growth was removed; naturalSceneRenderer matches Base52. Existing camera/frame ownership and Site frozen-polygon, modal and persistence adapters are identified in the module attribution, not represented as a bare import or zero bytes. Canonical Site geometry/validation, MapLibre, worker and providers remain deferred. Rendered module lengths are not gzip contributions.\n\nHTML deltas and finalizer bytes are separately retained in \`build-attribution.json\`. Isolated plumbing stayed late, and the build proof retains all original non-HTML asset hashes with no public source maps. The raw corrected build audits are included under \`builds/\`.\n\nDeferred gzip sizes: Walk animation 14,768 + controls 764 + launcher 12,167 + runtime 26,883 = **54,582 JS bytes**, plus 1,755 CSS. Site Entry 14,795, hydration 5,289, map 299,328, worker 151,615 JS; Entry CSS 2,490 and map CSS 10,181. These replace Round1 values.\n\n## Walk input, frames and functional failures\n\n${table(['Device', 'View', 'Every keyboard latency ms', 'Maximum ms', 'Samples <50ms'], inputRows)}\n\nAll native touch event-to-handler and handler-to-render arrays are retained in \`walk/compact.json\` and the complete raw input JSON. Input ends at the first changed-position render submission, not photon latency. Round2 removed Round1's 1000ms post-ready and 400ms view-switch waits; no warm-up delay was added to hide first-use stalls. The separate CPU diagnostic is explanatory and does not replace the failed original sample.\n\n${table(['Device', 'View', 'Frames', 'Active ms', 'Paused ms', 'FPS', '1% low', 'Max interval ms', 'FPS gate', 'Full unpaused window'], frameRows)}\n\nEvery raw interval, unpainted tail and pause window is in the compressed \`walk/raw/r2-walk-frames-v2/walk-framerate-walk.json.gz\`. Historical HUD/RAF summaries remain separate and are not substituted for the strict full-window figures.\n\nPhone v1 failed its movement assertion; the subsequent native one-pointer run reached the door but its Open tap did not yield the expected Close prompt. Both full samples remain. The updated diagnostic interpretation and any later checks are in \`walk/REVIEW.md\` and \`walk/compact.json\`; they do not erase either failure or warrant a blanket phone pass. All full CPU/trace files stay in scratch, with SHA-256 and byte sizes in the source manifest; compact attribution and profile sample summaries are included.\n\n## Site live/offline and A4 proof\n\nSeven final Site cases passed: delayed first-chunk modal focus/inert/Escape at both sizes; live map, explicit Tamarin search (five actual results), drawing, corner editing, keyboard Undo, remove Undo, clear Undo and visible attribution at both sizes; offline three-area source/unavailable reports, survey/traverse and print lifecycle at both sizes; and one labelled production-environment guard simulation. Live provider responses were not substituted. The production simulation substitutes only healthcheck JSON and is not a production-deployment test. User-drawn example plots are not surveyed or verified parcels.\n\nAll seven rows have zero JavaScript/console/HTTP errors and zero attempted, blocked or transmitted writes. Desktop is 1280x800; phone is 390x844 touch emulation on a laptop, not a physical phone. Existing Stage2 calculation/provider/license proof is carried explicitly; this round did not re-run every prior provider/math scenario.\n\nDedicated final same-head print proof is in \`site/print/\`: two actual PDFs, four A4 pages each, all eight rendered PNGs and \`visual-review.json\`. Every page has the complete canonical disclaimer in the named-page bottom margin. Minimum body/footer gap is **${number(print.minimumBodyFooterGapMm, 3)}mm**; there is no overlap/clipping. Screen layout stayed unchanged and the existing end-of-report flow banner is retained. PDF font-bounding-box warnings are recorded; all rendered pages were inspected and no missing visible glyph was found. The initial \`print-check.json\` says visual review pending; the separate completed visual-review file supplies the final inspection record. The seven-case harness's duplicate PDFs do not replace this accepted detailed proof.\n\nEarlier fixed-bottom and fixed-top attempts failed and remain in scratch with compact failure evidence. The zero-height containing-block theory was not confirmed. An injected CSS experiment established the margin-box approach; the final normal-source published PDF run independently passed.\n\n## Renderer, footer, Lighthouse and rules\n\nRenderer evidence retains all seven attempts, including configuration/DNS failures, the baseline duplicate allocations and oracle corrections. Final normal previews passed both sizes: first drawing-buffer allocation uses final dimensions/DPR; orbit causes no allocation; quality/resize behavior remains correct with no GL errors. These functional checks are separate from formal timings. Original diagnostic head labels remain in \`renderer-checks.json\`.\n\nFooter correction has exact published-head \`footer/*-verified.json\` evidence for visible contrast/navigation. The inherited Ocean/Slate contrast failure and initial generated-CSS reproducibility failure remain in the failure inventory. Generated OLB CSS was regenerated and focused existing checks passed.\n\nLighthouse: ${lighthouse.baseline.errorCount} baseline errors; each candidate removes fifteen and retains seven, with no new error assertions and unchanged settings. Remaining errors are not called green.\n\n${table(['Branch', 'Route', 'Assertion', 'Actual', 'Expected', 'Classification'], remainingLhRows)}\n\nThe static rule audit preserves protected-file, original-test, routing, API-path, dependency/lockfile and ancestor checks. Visible rules pass all eight screens with their actual fields/links retained, including the allowed Calendly URL. No production merge, manual deployment, login, key or new environment was performed for these checks.\n\n## Verification provenance and evidence budget\n\nRaw local verification logs are compressed under \`verification/\`, labelled by their tested heads. The Site full suite at 0e55d0d passed 420 files / 4472 tests and all three type configurations, plus six PDF-oracle checks. Its full lint failed with six errors / thirteen warnings: five tracked legacy errors and one preserved untracked QA scratch error. Later print changes have focused regressions; final CI status belongs to the exact run IDs in the parent handoff and is not inferred from an older local suite. No blanket lint-pass claim is made.\n\n\`SOURCE-MANIFEST.json\` records source paths, sizes and SHA-256, including failed raw artifacts and full traces retained outside the package. \`FAILURES.json\` records diagnostic outcomes. No source or repository docs are mutated by this packager; all earlier scratch is retained. This package prefers under3MB and enforces under5MB, with a final file/size manifest. The parent must check the combined retained repository-doc budget before replacing current evidence.\n`;
const evidenceIndex = `\n## Evidence links\n\n${table(['Evidence', 'File'], [
  ['Every formal timing pair and static closure', '[timings-and-static.json](timings-and-static.json)'],
  ['Exact forty raw loads', '[raw40loads.json.gz](raw40loads.json.gz)'],
  ['Every network pair and full request rows', '[network-audit.json.gz](network-audit.json.gz)'],
  ['Corrected emitted build attribution', '[build-attribution.json](build-attribution.json)'],
  ['Exact-head Lighthouse classification', '[lighthouse-classification.json](lighthouse-classification.json)'],
  ['Renderer attempts and final interpretation', '[renderer-checks.json](renderer-checks.json)'],
  ['Static and visible rules', '[static](rules-static.json), [visible](rules-visible.json)'],
  ['Walk final findings', '[compact.json](walk/compact.json), [review](walk/REVIEW.md)'],
  ['Every strict frame interval', '[raw frame windows](walk/raw/r2-walk-frames-v2/walk-framerate-walk.json.gz)'],
  ['Every formal input sample', '[raw input samples](walk/raw/r2-walk-input-v3/walk-performance-walk.json.gz)'],
  ['Both failed phone samples', '[original v1](walk/raw/r2-walk-functional-phone-v1/walk-functional-walk.json.gz), [native-touch v2](walk/raw/r2-walk-functional-phone-touch-v2/walk-functional-walk.json.gz)'],
  ['Input-stall attribution', '[profile attribution](walk/raw/r2-walk-input-stall-profile-v2/input-stall-attribution.json.gz)'],
  ['Final Site seven cases', '[preview-smoke.json](site/preview-smoke.json)'],
  ['Inspected A4 PDFs', '[laptop](site/print/report-laptop-a4.pdf), [phone](site/print/report-phone-a4.pdf)'],
  ['Completed all-page print review', '[visual-review.json](site/print/visual-review.json), [visual notes](site/print/VISUAL-REVIEW.md)'],
  ...['laptop', 'phone'].flatMap((device) => [1, 2, 3, 4].map((page) => [`Inspected ${device} page ${page}`, `[page ${page}](site/print/page-${device}-${page}.png)`])),
  ['Failure inventory and retained raw hashes', '[FAILURES.json](FAILURES.json), [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json)'],
  ['Exact package files and sizes', '[PACKAGE-MANIFEST.json](PACKAGE-MANIFEST.json)'],
])}\n`;
await write('REPORT.md', report + evidenceIndex);
await writeJSON('FAILURES.json', {
  note: 'These failures remain evidence. Corrected runs never overwrite earlier raw files. Walk input and functional failures are fully included under walk/raw.',
  groups: failures,
  walkGates: walk.gates,
  finalTimingGates: Object.fromEntries(Object.entries(summary.timings).map(([name, x]) => [name, x.rows.map((row) => ({ device: row.device, gates: row.gates }))])),
  lighthouse: Object.fromEntries(Object.entries(lighthouse.branches).map(([name, x]) => [name, { remainingErrorCount: x.remainingErrorCount, newErrors: x.newErrors }])),
});
await writeJSON('SOURCE-MANIFEST.json', {
  createdAt: new Date().toISOString(), root, expectedHeads: heads,
  preservation: 'All source paths remain in scratch unchanged. Hashes are streamed; large traces are not copied into the compact package.',
  sources: [...sources.values()].sort((a, b) => a.path.localeCompare(b.path)),
});
const totalBeforeManifest = packaged.reduce((n, x) => n + x.bytes, 0);
const manifest = {
  createdAt: new Date().toISOString(), expectedHeads: heads, output,
  bytesExcludingThisManifest: totalBeforeManifest,
  preferredBudgetBytes: preferredBudget, hardBudgetBytes: hardBudget,
  note: 'The manifest excludes its own bytes/hash to avoid recursion. Total package bytes are printed and checked after it is written.',
  files: packaged.toSorted((a, b) => a.path.localeCompare(b.path)),
};
await writeJSON('PACKAGE-MANIFEST.json', manifest);
const total = packaged.reduce((n, x) => n + x.bytes, 0);
console.log(JSON.stringify({ output, fileCount: packaged.length, totalBytes: total, preferredBudgetPassed: total < preferredBudget, hardBudgetPassed: total < hardBudget }, null, 2));
assert(total < hardBudget, 'Package exceeds5MB. Files are preserved for review; no evidence was deleted to force a pass.');
if (total >= preferredBudget) process.exitCode = 2;
