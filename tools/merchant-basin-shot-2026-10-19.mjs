/** Local or preview Designer evidence for the reviewed exact-SKU basin. No orders. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
const compiled = process.argv.includes('--compiled');
const hostname = new URL(base).hostname;
const live = !['127.0.0.1', 'localhost'].includes(hostname);
if (live && !(compiled && hostname.endsWith('-victor-ppw.vercel.app'))) throw new Error('Local or reviewed project preview only');
const routePath = live ? '/demo' : '/designer';
const out = live ? 'docs/qa-merchant-basin-2026-10-20-live' : `docs/qa-merchant-basin-2026-10-19${compiled ? '-compiled' : ''}`;
mkdirSync(out, { recursive: true });
const productId = 'espace-durastyle-washbasin-800';
const entry = JSON.parse(readFileSync('src/data/productModels.json', 'utf8'))[productId];
const source = JSON.parse(readFileSync('src/data/merchantProductAssets.json', 'utf8')).find(asset => asset.id === productId);
const property = { id: live ? 'generic-demo-home' : 'basin-model-evidence', name: 'Measured basin · product verification', activeRoomId: 'bath', wallHeightM: 2.7,
  activeLevelId: 'ground', site: { widthM: 5, depthM: 4, originM: { x: -1, y: -1 } },
  rooms: [{ id: 'bath', name: 'Bathroom · 6 m²', polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }],
    placedItems: [{ instanceId: 'review-basin', productId, x: 1.1, y: .1, rotation: 0 }],
    wallPaint: [0, 1, 2, 3].map(edgeIndex => ({ edgeIndex, paintId: 'permoglaze-soft-feel', colourHex: '#D9D5C5', colourName: 'Warm ivory' })),
    openings: [{ id: 'door', kind: 'door', edgeIndex: 2, offsetM: 1, widthM: .9, flipHand: false, flipFacing: false }] }],
};
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
if (live && process.argv.includes('--map-edge')) args.push(`--host-resolver-rules=MAP ${hostname} 216.198.79.3`);
const browser = await chromium.launch({ headless: true, args });
const report = { base, routePath, productId, mappedEdge: live && process.argv.includes('--map-edge'), cases: [] };
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'phone', hasTouch: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(({ p, isDemo }) => {
      if (sessionStorage.getItem('merchant-basin-fixture')) return;
      localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { property: p, pxPerMetre: 140, showGrid: false } }));
      // /demo restores its named page, not the current draft. Seed that normal
      // saved-page contract too, so startup cannot replace the basin with Home.
      if (isDemo) localStorage.setItem('ppw_properties_v2', JSON.stringify({ version: 2, state: {
        currentId: 'basin-review-page', designs: { 'basin-review-page': {
          id: 'basin-review-page', name: p.name, savedAt: new Date().toISOString(), property: p,
          walls: [], floorZones: [], wallTreatments: {}, roomDimensions: { lengthM: 3, widthM: 2 }, placedItems: p.rooms[0].placedItems,
        } },
      } }));
      sessionStorage.setItem('merchant-basin-fixture', '1');
    }, { p: property, isDemo: live });
    const page = await context.newPage(); page.setDefaultTimeout(90000);
    const row = { name, errors: [], writes: [], screenshots: [] }; report.cases.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    const shot = async label => {
      await page.getByTestId('toast').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      const path = `${out}/${name}-${label}.png`; await page.screenshot({ path }); row.screenshots.push(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    };
    await page.goto(`${base}${routePath}?view=2d&pitch=1`, { waitUntil: 'networkidle' });
    await page.getByTestId('plan-drawing-viewport').waitFor();
    const assertFixture = async rotation => {
      const actual = await page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('ppw_property_v2')).state.property;
        return { id: p.id, name: p.name, rooms: p.rooms.length, items: p.rooms.flatMap(room => room.placedItems) };
      });
      expect(actual.id).toBe(property.id);
      expect(actual.name).toBe(property.name);
      expect(actual.rooms).toBe(1);
      expect(actual.items).toHaveLength(1);
      expect(actual.items[0].productId).toBe(productId);
      expect(actual.items[0].instanceId).toBe('review-basin');
      expect(actual.items[0].rotation).toBe(rotation);
      return actual;
    };
    row.initialFixture = await assertFixture(0);
    if (compiled) {
      // Browser fetch shares Chromium's optional DNS mapping; APIRequestContext
      // resolves separately and cannot validate a mapped preview reliably.
      row.assets = await page.evaluate(async paths => Promise.all(paths.map(async path => {
        const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
        return { path, status: response.status, bytes: (await response.arrayBuffer()).byteLength };
      })), [entry.url, source.topdown_image_url, source.photo_image_url]);
      for (const asset of row.assets) expect(asset.status, asset.path).toBe(200);
    } else {
      row.model = await page.evaluate(async id => {
      const [{ getProductById }, { productModelFor }, { planModelSolid }, { planModelSnapshot }, { loadProductBody }, { bodyObject }, THREE] = await Promise.all([
        import('/src/data/products.ts'), import('/src/data/productModels.ts'), import('/src/designer/planModel.ts'),
        import('/src/lib/topdown/modelSnapshot.ts'), import('/src/components/three/productBodyLoader.ts'),
        import('/src/components/three/productBody.ts'), import('/node_modules/.vite/deps/three.js'),
      ]);
      const product = getProductById(id), entry = productModelFor(product);
      if (!entry?.preferMesh) throw new Error('Reviewed mesh candidate is not registered');
      const template = await loadProductBody(entry.url);
      // Validate a fresh model projection even after the reviewed bitmap is
      // baked for instant production 2D display.
      const item = planModelSolid(product), image = await planModelSnapshot({ ...product, topdown_image_url: undefined });
      if (!image) throw new Error('Actual basin top-down photograph failed');
      const size = body => new THREE.Box3().setFromObject(body, true).getSize(new THREE.Vector3()).toArray();
      const zero = bodyObject(item, template);
      const quarter = bodyObject({ ...item, rotationDeg: 90, x1: item.widthM, y1: item.lengthM }, template);
      window.__basinPlanImage = image.toDataURL('image/png');
      return { sku: product.sku, dimensions_cm: product.dimensions_cm, source_url: product.source_url,
        photo: product.photo_image_url, model: entry, rawBounds: template.bbox.getSize(new THREE.Vector3()).toArray(),
        fittedMetres: size(zero), rotated90Metres: size(quarter), raster: { width: image.width, height: image.height },
        apiSkuResolves: productModelFor({ id: 'm-basin-test', sku: product.sku })?.url === entry.url };
    }, productId);
    expect(row.model.fittedMetres[0]).toBeCloseTo(.8, 4);
    expect(row.model.fittedMetres[1]).toBeCloseTo(.17, 4);
    expect(row.model.fittedMetres[2]).toBeCloseTo(.48, 4);
    expect(row.model.rotated90Metres[0]).toBeCloseTo(.48, 4);
    expect(row.model.rotated90Metres[2]).toBeCloseTo(.8, 4);
    expect(row.model.apiSkuResolves).toBe(true);
    expect(row.model.source_url).toBe('https://www.espacemaison.mu/products/washbasin-for-cabinet');
      writeFileSync(`${out}/${name}-basin-topdown.png`, Buffer.from((await page.evaluate(() => window.__basinPlanImage)).split(',')[1], 'base64'));
    }
    await shot('basin-2d');
    await page.getByRole('button', { name: '3D House', exact: true }).click();
    await page.getByTestId('wallpaint-3d-gl').waitFor();
    await page.getByTestId('loading-3d').waitFor({ state: 'hidden' });
    await page.waitForTimeout(2000);
    await shot('basin-3d');
    if (compiled) {
      const box = await page.getByTestId('wallpaint-3d-canvas').boundingBox();
      // There is one object in this measured fixture. Try only the observed
      // central object region, using real pointer events, never app internals.
      for (const [x, y] of [[.47, .50], [.50, .58], [.50, .53], [.47, .58], [.54, .58], [.50, .62], [.54, .50]]) {
        await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
        await page.waitForTimeout(150);
        if (await page.getByTestId('house-selection-strip').isVisible()) break;
      }
    } else {
      const screenPoint = await page.evaluate(() => window.__ppwRoomView3d.itemScreenPoint('review-basin'));
      if (!screenPoint) throw new Error('Basin is not projected in live 3D view');
      await page.mouse.click(screenPoint.x, screenPoint.y);
    }
    await expect(page.getByTestId('house-selection-strip')).toBeVisible();
    await expect(page.getByTestId('house-selection-strip')).toContainText('DuraStyle cabinet washbasin · 800 mm');
    row.selectedProductName = await page.getByTestId('house-selection-strip').innerText();
    await shot('basin-selected');
    await page.getByRole('button', { name: 'Product details', exact: true }).click();
    await shot('basin-product-details');
    await page.getByRole('button', { name: 'Clear selected item', exact: true }).click();
    await expect(page.getByTestId('house-selection-strip')).toHaveCount(0);
    // Load a quarter-turn saved fixture. Wall-attached products intentionally
    // do not expose free rotation handles in normal editing.
    await page.evaluate(({ p, isDemo }) => {
      p.rooms[0].placedItems[0] = { ...p.rooms[0].placedItems[0], rotation: 90, x: 1.1, y: .3 };
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { property: p, pxPerMetre: 140, showGrid: false } }));
      if (isDemo) {
        const saved = JSON.parse(localStorage.getItem('ppw_properties_v2'));
        saved.state.designs['basin-review-page'].property = p;
        saved.state.designs['basin-review-page'].placedItems = p.rooms[0].placedItems;
        localStorage.setItem('ppw_properties_v2', JSON.stringify(saved));
      }
    }, { p: property, isDemo: live });
    await page.goto(`${base}${routePath}?view=3d&pitch=1`, { waitUntil: 'networkidle' });
    if (await page.getByTestId('wallpaint-3d-gl').count() === 0) await page.getByRole('button', { name: '3D House', exact: true }).click();
    await page.getByTestId('wallpaint-3d-gl').waitFor();
    await page.getByTestId('loading-3d').waitFor({ state: 'hidden' });
    await page.waitForTimeout(1500);
    row.rotatedFixture = await assertFixture(90);
    await shot('basin-quarter-turn-fixture');
    expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
    await context.close(); console.log(JSON.stringify(row));
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
