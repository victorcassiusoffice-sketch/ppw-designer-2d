// Semantic reading of the controlled-build audits: which modules the early
// App + ThreeStage closure holds. The feature itself (src/walk, src/site, the
// map library, the collision library) must be lazy; only the named seam modules
// (launch button, loading placeholder, canvas bridge) may be early, and each is
// reported with its rendered size so the byte ceiling can be read next to it.
// Usage: node tools/world/early-semantic.mjs --builds=<RESULTS_ROOT/builds/<label>> --out=<file.json>
import fs from 'node:fs';
const argument = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const builds = argument('builds'), out = argument('out');
if (!builds || !out) throw Error('Pass --builds=<folder with walk/ and site/> --out=<json>');
const BACKSLASH = String.fromCharCode(92);
const posix = id => id.split(BACKSLASH).join('/');
const SEAM = {
  walk: ['src/walk/WalkLauncher.tsx'],
  site: ['src/site/SiteLaunchButton.tsx', 'src/site/SiteLoading.tsx', 'src/components/canvasSiteBridge.ts'],
};
const HEAVY = /node_modules[/](maplibre-gl|three-mesh-bvh|@mapbox|pmtiles)[/]/;
const FEATURE = /(^|[/])src[/](walk|site)[/]/;
const result = { at: new Date().toISOString(), builds, branches: {} };
for (const name of ['walk', 'site']) {
  const audit = JSON.parse(fs.readFileSync(`${builds}/${name}/audit.json`, 'utf8'));
  const modules = audit.modules.map(m => ({ ...m, id: posix(m.id) }));
  const early = modules.filter(m => m.early);
  const tail = id => { const i = id.indexOf('/src/'); return i >= 0 ? id.slice(i + 1) : id; };
  const earlyFeature = early.filter(m => FEATURE.test(m.id) || m.id.includes('canvasSiteBridge'));
  const allowed = earlyFeature.filter(m => SEAM[name].includes(tail(m.id)));
  const forbidden = earlyFeature.filter(m => !SEAM[name].includes(tail(m.id)));
  const earlyHeavy = early.filter(m => HEAVY.test(m.id));
  const lazyFeature = modules.filter(m => !m.early && FEATURE.test(m.id));
  result.branches[name] = {
    sourceCommit: audit.sourceCommit, baseCommit: audit.baseCommit, label: audit.label,
    earlyModules: early.length, earlyFiles: audit.early.length,
    seamEarly: allowed.map(m => ({ module: tail(m.id), renderedLength: m.renderedLength, chunk: m.chunk })),
    forbiddenEarly: forbidden.map(m => ({ module: tail(m.id), renderedLength: m.renderedLength, chunk: m.chunk })),
    heavyEarly: earlyHeavy.map(m => m.id.slice(m.id.indexOf('node_modules'))),
    lazyFeatureModules: lazyFeature.length,
    lazyFeatureList: lazyFeature.map(m => tail(m.id)).sort(),
    pass: forbidden.length === 0 && earlyHeavy.length === 0 && lazyFeature.length > 0,
  };
}
result.pass = Object.values(result.branches).every(b => b.pass);
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: result.pass, walk: { seam: result.branches.walk.seamEarly, forbidden: result.branches.walk.forbiddenEarly, heavy: result.branches.walk.heavyEarly, lazy: result.branches.walk.lazyFeatureModules }, site: { seam: result.branches.site.seamEarly, forbidden: result.branches.site.forbiddenEarly, heavy: result.branches.site.heavyEarly, lazy: result.branches.site.lazyFeatureModules } }, null, 1));
