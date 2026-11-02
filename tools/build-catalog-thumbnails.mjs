/** Offline, deterministic image resizing. No network, model generation or source-image changes. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const publicRoot = resolve(root, 'public');
const target = resolve(publicRoot, 'products/thumbs');
const manifestPath = resolve(root, 'src/data/catalogImageThumbnails.json');
const config = { version: 1, edges: [128, 256], quality: 78, alphaQuality: 90, effort: 5, sharp: sharp.versions.sharp, webp: sharp.versions.webp };
const sources = ['src/data/products.json', 'src/demo/courts/products.json', 'src/data/catalogModelThumbnails.json', 'src/data/catalogPlanDrawings.json'];
const urls = new Set();
for (const source of sources) {
  const data = JSON.parse(readFileSync(resolve(root, source), 'utf8'));
  for (const row of data.products ?? Object.values(data)) {
    for (const key of ['image_url', 'photo_image_url', 'topdown_image_url', 'url']) {
      const url = row[key];
      if (typeof url === 'string' && /^\/products\//.test(url) && ['.png', '.webp', '.jpg', '.jpeg'].includes(extname(url).toLowerCase())) urls.add(url);
    }
  }
}
const auditOnly = process.argv.includes('--audit');
const checkOnly = process.argv.includes('--check');
if (!auditOnly && !checkOnly) mkdirSync(target, { recursive: true });
sharp.concurrency(1);
const manifest = {}, rows = [];
for (const url of [...urls].sort()) {
  const source = resolve(publicRoot, `.${url}`);
  if (relative(publicRoot, source).startsWith('..') || !existsSync(source)) throw new Error(`Missing or invalid local source: ${url}`);
  const bytes = readFileSync(source);
  const hash = createHash('sha256').update(bytes).update(JSON.stringify(config)).digest('hex').slice(0, 16);
  const entry = { small: `/products/thumbs/${hash}-128.webp`, large: `/products/thumbs/${hash}-256.webp` };
  const row = { source: url, before: bytes.length, variants: [] };
  if (!auditOnly) {
    for (const edge of config.edges) {
      const output = resolve(target, `${hash}-${edge}.webp`);
      if (!existsSync(output)) {
        if (checkOnly) throw new Error(`Missing cached thumbnail: ${output}`);
        await sharp(bytes).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: config.quality, alphaQuality: config.alphaQuality, effort: config.effort }).toFile(output);
      }
      const dimensions = await sharp(output).metadata();
      if (dimensions.format !== 'webp' || dimensions.width > edge || dimensions.height > edge) throw new Error(`Invalid thumbnail: ${output}`);
      row.variants.push({ edge, bytes: statSync(output).size, width: dimensions.width, height: dimensions.height });
    }
    manifest[url] = entry;
  }
  rows.push(row);
}
const serialized = `${JSON.stringify(manifest)}\n`;
if (checkOnly && readFileSync(manifestPath, 'utf8') !== serialized) throw new Error('Thumbnail manifest is stale; run this tool without --check');
if (!auditOnly && !checkOnly) writeFileSync(manifestPath, serialized);
const totals = subset => ({ images: subset.length, originalBytes: subset.reduce((sum, row) => sum + row.before, 0),
  smallBytes: subset.reduce((sum, row) => sum + (row.variants[0]?.bytes ?? 0), 0), largeBytes: subset.reduce((sum, row) => sum + (row.variants[1]?.bytes ?? 0), 0) });
const uniqueOutputs = [...new Set(Object.values(manifest).flatMap(entry => [entry.small, entry.large]))];
const generated = { files: uniqueOutputs.length, bytes: uniqueOutputs.reduce((sum, url) => sum + statSync(resolve(publicRoot, `.${url}`)).size, 0) };
const report = { config, mode: auditOnly ? 'audit' : checkOnly ? 'check' : 'generate', totals: totals(rows), courts: totals(rows.filter(row => row.source.includes('/catalog-plans/'))), groups: Object.fromEntries([...new Set(rows.map(row => row.source.split('/')[2]))].map(group => [group, totals(rows.filter(row => row.source.split('/')[2] === group))])), generated, rows };
const reportArg = process.argv.indexOf('--report');
if (reportArg >= 0) writeFileSync(resolve(process.argv[reportArg + 1]), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ mode: report.mode, totals: report.totals, courts: report.courts, groups: report.groups, generated, manifestBytes: auditOnly ? 0 : Buffer.byteLength(serialized) }, null, 2));
