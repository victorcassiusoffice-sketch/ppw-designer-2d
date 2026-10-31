import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_ROOT, LABEL, BASE_COMMIT } from './run-config.mjs';
const buildLabel = process.argv.find(a => a.startsWith('--build-label='))?.slice(14) || LABEL;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const resultDir = path.join(RESULTS_ROOT, LABEL);
const median = values => { if (!values.length || values.some(x => !Number.isFinite(x))) return null; const a = [...values].sort((a, b) => a - b); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const logical = f => f.replace(/-[A-Za-z0-9_-]{8}(?=\.(?:js|css)$)/, '');
const result = { at: new Date().toISOString(), label: LABEL, buildLabel, baseCommit: BASE_COMMIT, bundles: {}, timings: {} };
const basePath = path.join(RESULTS_ROOT, 'builds', buildLabel, 'base/audit.json');
const base = fs.existsSync(basePath) ? read(basePath) : null;
for (const branch of ['walk', 'site']) {
 const candidatePath = path.join(RESULTS_ROOT, 'builds', buildLabel, branch, 'audit.json');
 if (base && fs.existsSync(candidatePath)) {
  const current = read(candidatePath), bm = new Map(base.early.map(r => [logical(r.file), r])), cm = new Map(current.early.map(r => [logical(r.file), r]));
  const files = [...new Set([...bm.keys(), ...cm.keys()])].sort().map(name => { const b = bm.get(name), c = cm.get(name); return { name, base: b || null, candidate: c || null, rawDelta: (c?.bytes || 0) - (b?.bytes || 0), gzipDelta: (c?.gzipBytes || 0) - (b?.gzipBytes || 0) }; });
  const earlyGzipDelta = files.reduce((s, r) => s + r.gzipDelta, 0);
  result.bundles[branch] = { baseCommit: base.sourceCommit, candidateCommit: current.sourceCommit, baseCount: base.early.length, candidateCount: current.early.length, files,
   earlyRawDelta: files.reduce((s, r) => s + r.rawDelta, 0), earlyGzipDelta, numericCeilingBytes: 1024, insideCeilingWithoutAliasException: earlyGzipDelta <= 1024,
   aliasReview: files.filter(r => /vendor-three/.test(r.name)).map(r => ({ name: r.name, rawDelta: r.rawDelta, gzipDelta: r.gzipDelta, note: 'Only alias-only growth is exempt; source/module export review required. Do not automatically exempt other Three changes.' })),
   newEarlyChunks: files.filter(r => !r.base).map(r => r.name), missingEarlyChunks: files.filter(r => !r.candidate).map(r => r.name),
   earlyFeatureModules: current.modules.filter(r => r.early && /\/(?:site|walk)\//.test(r.id)),
   semanticGate: 'Numeric size alone is insufficient: inspect changes to confirm the allowed seam and that feature implementation waits for canvas render.' };
 }
 const allPath = path.join(resultDir, 'load-all.json'), branchPath = path.join(resultDir, `load-${branch}.json`);
 const loadPath = fs.existsSync(allPath) ? allPath : branchPath;
 if (!fs.existsSync(loadPath)) continue;
 const data = read(loadPath);
 if (!data.branches.includes(branch)) continue;
 const rows = [];
 for (const device of ['desktop', 'phone']) {
  const pairs = [];
  for (let run = 1; run <= data.runs; run++) {
   const same = data.rows.filter(r => r.device === device && r.run === run), b = same.find(r => r.target === 'base'), c = same.find(r => r.target === branch), p = same.find(r => r.target === 'prod');
   pairs.push({ run, baseWallMs: b?.first3dMs ?? null, previewWallMs: c?.first3dMs ?? null, customWallMs: p?.first3dMs ?? null,
    baseCanvasMs: b?.canvasFirstPictureMs ?? null, previewCanvasMs: c?.canvasFirstPictureMs ?? null, customCanvasMs: p?.canvasFirstPictureMs ?? null,
    previewLoadingSeenMs: c?.timeline?.loadingSeen ?? null, previewHtmlLoadingSeenMs: c?.timeline?.htmlLoadingSeen ?? null, previewReactLoadingSeenMs: c?.timeline?.reactLoadingSeen ?? null,
    baseFcpMs: b?.paints?.find(x => x.name === 'first-contentful-paint')?.startTime ?? null,
    previewFcpMs: c?.paints?.find(x => x.name === 'first-contentful-paint')?.startTime ?? null,
    customFcpMs: p?.paints?.find(x => x.name === 'first-contentful-paint')?.startTime ?? null,
    startedAt: { base: b?.startedAt, candidate: c?.startedAt, custom: p?.startedAt },
    failures: [['base', b], [branch, c], ['prod', p]].flatMap(([target, row]) => !row ? [{ target, error: 'missing row' }] : row.fatal ? [{ target, error: row.fatal }] : []) });
  }
  const medians = Object.fromEntries(['baseWallMs', 'previewWallMs', 'customWallMs', 'baseCanvasMs', 'previewCanvasMs', 'customCanvasMs'].map(key => [key, median(pairs.map(r => r[key]))]));
  const complete = data.runs === 5 && pairs.length === 5 && pairs.every(p => !p.failures.length) && data.healthStable === true;
  const absoluteLimitMs = device === 'desktop' ? 3000 : 5000;
  const gates = { absoluteWall: complete && medians.previewWallMs !== null && medians.previewWallMs < absoluteLimitMs,
   absoluteCanvas: complete && medians.previewCanvasMs !== null && medians.previewCanvasMs < absoluteLimitMs,
   pairedWall: complete && medians.previewWallMs !== null && medians.baseWallMs !== null && medians.previewWallMs <= medians.baseWallMs * 1.1,
   pairedCanvas: complete && medians.previewCanvasMs !== null && medians.baseCanvasMs !== null && medians.previewCanvasMs <= medians.baseCanvasMs * 1.1,
   loadingWithinOneSecondEveryRun: complete && pairs.every(p => Number.isFinite(p.previewLoadingSeenMs) && p.previewLoadingSeenMs <= 1000),
   loadingPaintWithinOneSecondEveryRun: complete && pairs.every(p => Number.isFinite(p.previewFcpMs) && p.previewFcpMs <= 1000 && Number.isFinite(p.previewLoadingSeenMs) && p.previewLoadingSeenMs <= 1000) };
  rows.push({ device, complete, pairs, medians, absoluteLimitMs, wallRatio: medians.baseWallMs ? medians.previewWallMs / medians.baseWallMs : null,
   canvasRatio: medians.baseCanvasMs ? medians.previewCanvasMs / medians.baseCanvasMs : null, gates, allTimingGatesPass: Object.values(gates).every(Boolean) });
 }
 result.timings[branch] = { source: loadPath, method: data.method, healthBefore: data.healthBefore, healthAfter: data.healthAfter, healthStable: data.healthStable, rows };
}
fs.mkdirSync(resultDir, { recursive: true });
fs.writeFileSync(path.join(resultDir, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ bundles: Object.fromEntries(Object.entries(result.bundles).map(([k, v]) => [k, { raw: v.earlyRawDelta, gzip: v.earlyGzipDelta, insideCeilingWithoutAliasException: v.insideCeilingWithoutAliasException }])), timings: Object.fromEntries(Object.entries(result.timings).map(([k, v]) => [k, v.rows.map(({ pairs, ...r }) => r)])) }, null, 2));
