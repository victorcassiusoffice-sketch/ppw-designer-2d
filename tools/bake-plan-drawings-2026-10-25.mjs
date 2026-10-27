/** Offline projection of existing measured planning bodies. No API, merchant
 * photography, paid generation, new geometry or runtime drawing dependency. */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5176';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local dev server only');
const products = JSON.parse(readFileSync('src/demo/courts/products.json', 'utf8')).products;
const out = 'public/products/catalog-plans'; mkdirSync(out, { recursive: true });
const reportPath = 'docs/qa-sims-fix-round-2-2026-10-25/catalogue-and-baskets'; mkdirSync(reportPath, { recursive: true });
const sourceFiles = ['src/designer/planModel.ts', 'src/lib/topdown/modelSnapshot.ts', 'src/components/three/furniturePreview.ts', 'src/components/three/furnitureSurface.ts', 'src/components/three/furnitureOcclusion.ts'];
const sourceHash = createHash('sha256').update(sourceFiles.map(file => readFileSync(file, 'utf8')).join('\n')).digest('hex');
const manifest = {}, report = { sourceFiles, sourceHash, rendered: [], skipped: [], errors: [], blocked: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin || !['GET', 'HEAD'].includes(route.request().method())) { report.blocked.push(url.href); return route.abort(); }
    if (url.pathname === '/__plan-bake.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local plan projections</title>' });
    await route.continue();
  });
  await page.goto(`${base}/__plan-bake.html`);
  for (const product of products) {
    const image = await page.evaluate(async product => {
      const { planModelSnapshot } = await import('/src/lib/topdown/modelSnapshot.ts');
      const canvas = await planModelSnapshot(product);
      return canvas ? { png: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height } : null;
    }, product);
    if (!image) { report.skipped.push(product.id); continue; }
    const hash = createHash('sha256').update(sourceHash).update(JSON.stringify({ id: product.id, dimensions: product.dimensions_cm, front: product.front_edge })).digest('hex').slice(0, 16);
    const url = `/products/catalog-plans/${product.id}-${hash}.png`;
    writeFileSync(`public${url}`, Buffer.from(image.png.split(',')[1], 'base64'));
    manifest[product.id] = { url, sku: product.sku, dimensions: product.dimensions_cm, width: image.width, height: image.height, hash, source: 'Existing dimensioned planning model; overhead Drawing, not supplier photography' };
    report.rendered.push({ id: product.id, url, width: image.width, height: image.height });
  }
  writeFileSync('src/data/catalogPlanDrawings.json', JSON.stringify(manifest, null, 2) + '\n');
} finally { await browser.close(); writeFileSync(`${reportPath}/plan-drawings.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ rendered: report.rendered.length, skipped: report.skipped, errors: report.errors, blocked: report.blocked }));
if (report.errors.length || report.blocked.length || report.skipped.length) process.exitCode = 1;
