import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { RESULTS_ROOT, REPOS, LABEL, BASE_COMMIT } from './run-config.mjs';
const buildLabel = process.argv.find(a => a.startsWith('--build-label='))?.slice(14) || LABEL;
const read = p => JSON.parse(fs.readFileSync(p, 'utf8')), resultDir = path.join(RESULTS_ROOT, LABEL);
const logical = f => f.replace(/-[A-Za-z0-9_-]{8}(?=\.(?:js|css)$)/, '');
const result = { at: new Date().toISOString(), baseCommit: BASE_COMMIT, label: LABEL, buildLabel,
 method: 'Every HTTP(S) request start through the canvas first-render mark, including unfinished responses and redirects; normalized hashes only for matching. Embedded data URLs are retained separately and never called API traffic. Base52 and both previews serve the OLB shell. Exact file bytes come from completed controlled builds/public files; API sizes remain measured response evidence.', branches: {} };
function stat(label, requestName) {
 if (!requestName.startsWith('<app>/')) return { type: 'external', file: null };
 const pathname = requestName.slice(5).split('?')[0];
 if (pathname.startsWith('/api/')) return { type: 'API', file: null, bytes: 'network evidence' };
 const wanted = pathname === '/demo' ? 'olb.html' : pathname.replace(/^\//, '');
 const auditPath = path.join(RESULTS_ROOT, 'builds', buildLabel, label, 'audit.json');
 const audit = fs.existsSync(auditPath) ? read(auditPath) : null;
 const entry = audit?.assets.find(r => logical(r.file) === wanted); if (entry) return { type: 'emitted', ...entry };
 if (!audit) return { type: 'pending-controlled-build', file: null, buildAudit: auditPath };
 const publicFile = path.join(REPOS[label], 'public', wanted);
 if (fs.existsSync(publicFile) && fs.statSync(publicFile).isFile()) { const bytes = fs.readFileSync(publicFile); return { type: 'public', file: 'public/' + wanted, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: createHash('sha256').update(bytes).digest('hex') }; }
 return { type: 'unmapped', file: null };
}
for (const branch of ['walk', 'site']) {
 const allPath = path.join(resultDir, 'load-all.json'), branchPath = path.join(resultDir, `load-${branch}.json`), source = fs.existsSync(allPath) ? allPath : branchPath;
 if (!fs.existsSync(source)) continue; const data = read(source); if (!data.branches.includes(branch)) continue;
 const rows = data.rows.filter(r => ['base', branch, 'prod'].includes(r.target)).map(r => {
  const all = (r.requests || []).filter(q => q.beforePicture), http = all.filter(q => /^https?:/.test(q.url));
  const name = q => { const u = new URL(q.url); return (u.origin === new URL(r.url).origin ? '<app>' : u.origin) + logical(u.pathname) + u.search; };
  return { target: r.target, device: r.device, run: r.run, fatal: r.fatal, firstPictureMs: r.canvasFirstPictureMs, brand: r.brand, httpRequestCount: http.length,
   names: [...new Set(http.map(name))].sort(), embeddedDataRequests: all.filter(q => q.url.startsWith('data:')), otherNonHttpRequests: all.filter(q => !/^https?:|^data:/.test(q.url)),
   featureRequests: http.filter(q => /\/(?:WalkLauncher|runtime|walk-animation|walk-controls|SiteEntry|SiteMap|hydration|maplibre-gl-worker)-|\/models\/world-characters\//.test(new URL(q.url).pathname)), requests: http };
 });
 const namesFor = target => [...new Set(rows.filter(r => r.target === target).flatMap(r => r.names))].sort();
 const bn = namesFor('base'), cn = namesFor(branch), pn = namesFor('prod');
 const perPair = rows.filter(r => r.target === branch).map(r => { const b = rows.find(b => b.target === 'base' && b.device === r.device && b.run === r.run); return { device: r.device, run: r.run, baseCount: b?.httpRequestCount, candidateCount: r.httpRequestCount, newNames: r.names.filter(n => !b?.names.includes(n)), missingNames: (b?.names || []).filter(n => !r.names.includes(n)) }; });
 const files = [...new Set([...bn, ...cn])].sort().map(name => { const b = stat('base', name), c = stat(branch, name); return { name, baseRequested: bn.includes(name), candidateRequested: cn.includes(name), base: b, candidate: c, rawDelta: typeof b.bytes === 'number' && typeof c.bytes === 'number' ? c.bytes - b.bytes : null, gzipDelta: typeof b.gzipBytes === 'number' && typeof c.gzipBytes === 'number' ? c.gzipBytes - b.gzipBytes : null }; });
 result.branches[branch] = { source, rows, perPair, newRequestNames: cn.filter(n => !bn.includes(n)), missingRequestNames: bn.filter(n => !cn.includes(n)), newRequestNamesAgainstCustom: cn.filter(n => !pn.includes(n)),
  featureRequestsBeforePicture: rows.filter(r => r.target === branch).flatMap(r => r.featureRequests), files,
  controlledBuildAvailable: files.every(r => ![r.base.type, r.candidate.type].includes('pending-controlled-build')),
  observedStaticRawDelta: files.some(r => [r.base.type, r.candidate.type].includes('pending-controlled-build')) ? null : files.reduce((s, r) => s + (r.rawDelta || 0), 0),
  observedStaticGzipDelta: files.some(r => [r.base.type, r.candidate.type].includes('pending-controlled-build')) ? null : files.reduce((s, r) => s + (r.gzipDelta || 0), 0),
  allSameOlbShell: rows.filter(r => r.target !== 'prod').every(r => r.brand === 'olb'), noNewRequestsEveryPair: perPair.length === 10 && perPair.every(r => r.newNames.length === 0) };
}
fs.writeFileSync(path.join(resultDir, 'network-audit.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.branches).map(([k, v]) => [k, { new: v.newRequestNames, featureRequests: v.featureRequestsBeforePicture.length, sameOlb: v.allSameOlbShell, noNewRequestsEveryPair: v.noNewRequestsEveryPair, perPair: v.perPair }])), null, 2));
