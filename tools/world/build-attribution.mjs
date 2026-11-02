import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESULTS_ROOT } from './run-config.mjs';
const root = RESULTS_ROOT;
const buildLabel = process.argv.find(arg => arg.startsWith('--build-label='))?.slice(14) || 'r4-final';
const outputName = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'build-attribution.json';
if (!/^[a-zA-Z0-9._-]+\.json$/.test(outputName)) throw Error('Use a simple JSON output filename');
const outputPath = resolve(root, outputName);
if (existsSync(outputPath)) throw Error('Preserve the previous attribution; choose a new --output filename');
const read = name => JSON.parse(readFileSync(resolve(RESULTS_ROOT, `builds/${buildLabel}/${name}/audit.json`), 'utf8'));
const base = read('base');
const canonicalId = id => id.replace(/^\0/, '').replace(/^.*[\\/]node_modules[\\/]/, 'node_modules/').replaceAll('\\', '/');
const chunkName = file => file.replace(/-[\w-]{8}\.js$/, '.js');
const modules = audit => new Map(audit.modules.filter(module => module.early).map(module => [canonicalId(module.id), module]));
const baseModules = modules(base), baseChunks = new Map(base.early.map(chunk => [chunkName(chunk.file), chunk]));
const sum = (audit, key) => audit.early.reduce((total, row) => total + row[key], 0);
const output = { at: new Date().toISOString(), baseHead: base.sourceCommit, baseline: { count: base.early.length, raw: sum(base, 'bytes'), gzip: sum(base, 'gzipBytes') }, branches: {} };
for (const branch of ['walk', 'site']) {
  const audit = read(branch), currentModules = modules(audit);
  const moduleChanges = [...new Set([...baseModules.keys(), ...currentModules.keys()])].map(id => {
    const previous = baseModules.get(id), current = currentModules.get(id);
    return { id, beforeRendered: previous?.renderedLength ?? 0, afterRendered: current?.renderedLength ?? 0,
      renderedDelta: (current?.renderedLength ?? 0) - (previous?.renderedLength ?? 0), previousChunk: previous?.chunk ?? null, currentChunk: current?.chunk ?? null,
      beforeExports: previous?.renderedExports ?? [], afterExports: current?.renderedExports ?? [] };
  }).filter(row => row.renderedDelta || JSON.stringify([...row.beforeExports].sort()) !== JSON.stringify([...row.afterExports].sort()));
  const chunkChanges = audit.early.map(chunk => {
    const previous = baseChunks.get(chunkName(chunk.file));
    if (!previous) throw Error('Unmatched early chunk: ' + chunk.file);
    return { name: chunkName(chunk.file), previousFile: previous.file, currentFile: chunk.file,
      rawDelta: chunk.bytes - previous.bytes, gzipDelta: chunk.gzipBytes - previous.gzipBytes, sameHash: chunk.sha256 === previous.sha256 };
  }).filter(row => !row.sameHash);
  const html = ['index.html', 'olb.html'].map(file => {
    const before = base.assets.find(asset => asset.file === file), after = audit.assets.find(asset => asset.file === file);
    return { file, beforeRaw: before.bytes, afterRaw: after.bytes, rawDelta: after.bytes - before.bytes,
      beforeGzip: before.gzipBytes, afterGzip: after.gzipBytes, gzipDelta: after.gzipBytes - before.gzipBytes };
  });
  const latePlumbing = audit.modules.filter(module => /plumbingHero|plumbingMain|plumbingStartup/.test(module.id));
  if (latePlumbing.some(module => module.early)) throw Error('Plumbing entered early graph');
  output.branches[branch] = { sourceHead: audit.sourceCommit, sourceStatus: audit.sourceStatus, count: audit.early.length,
    raw: sum(audit, 'bytes'), gzip: sum(audit, 'gzipBytes'), rawDelta: sum(audit, 'bytes') - sum(base, 'bytes'), gzipDelta: sum(audit, 'gzipBytes') - sum(base, 'gzipBytes'),
    moduleChanges, chunkChanges, html, latePlumbing, finalization: audit.finalization };
}
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(output.branches).map(([branch, value]) => [branch, { rawDelta: value.rawDelta, gzipDelta: value.gzipDelta,
  moduleChanges: value.moduleChanges.map(row => ({ id: row.id, renderedDelta: row.renderedDelta, addedExports: row.afterExports.filter(name => !row.beforeExports.includes(name)), removedExports: row.beforeExports.filter(name => !row.afterExports.includes(name)) })),
  chunkChanges: value.chunkChanges, html: value.html }])), null, 2));
