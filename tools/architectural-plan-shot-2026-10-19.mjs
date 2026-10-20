/** Actual editable plans at desktop and phone widths; geometry is unchanged by presentation. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local capture only');
const out = 'docs/qa-architectural-plan-2026-10-19'; mkdirSync(out, { recursive: true });
const property = { id: 'merchant-furniture-evidence', name: 'Living room + garden lounge', activeRoomId: 'living', wallHeightM: 2.7,
  activeLevelId: 'ground', site: { widthM: 10, depthM: 8, originM: { x: -2, y: -2 } },
  rooms: [{ id: 'living', name: 'Living room · 24 m²', polygon: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }],
    placedItems: [
      { instanceId: 'comfy', productId: 'courts-comfy-3-seater-dove', x: .45, y: .25, rotation: 0 },
      { instanceId: 'seville', productId: 'espace-seville-garden-sofa', x: 4.35, y: .35, rotation: 0 },
      { instanceId: 'coffee', productId: 'courts-perera-coffee-table', x: 1.0, y: 1.7, rotation: 0 },
    ],
    wallPaint: [0, 1, 2, 3].map(edgeIndex => ({ edgeIndex, paintId: 'permoglaze-soft-feel', colourHex: '#D9D5C5', colourName: 'Warm ivory' })),
    openings: [{ id: 'window', kind: 'window', edgeIndex: 0, offsetM: 4, widthM: 1.6, heightM: 1.5, sillM: .8, flipHand: false, flipFacing: false },
      { id: 'door', kind: 'door', edgeIndex: 3, offsetM: 1.3, widthM: .9, flipHand: false, flipFacing: false }] }],
};
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { base, cases: [] };
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'phone', hasTouch: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(p => {
      if (sessionStorage.getItem('merchant-furniture-fixture')) return;
      localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { property: p, pxPerMetre: 85, showGrid: false } }));
      sessionStorage.setItem('merchant-furniture-fixture', '1');
    }, property);
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    const row = { name, errors: [], writes: [], screenshots: [] }; report.cases.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') row.errors.push(msg.text()); });
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    const waitForPlanModels = async () => {
      const started = Date.now();
      await page.waitForFunction(() => {
        const stage = window.Konva?.stages?.find(stage => stage.container()?.isConnected);
        const art = stage?.find('.item-art') ?? [];
        return art.length > 0 && art.every(node => node.hasName('item-model-plan'));
      }, null, { timeout: 120000 });
      row.modelReadyMs = [...(row.modelReadyMs ?? []), Date.now() - started];
    };
    const shot = async label => {
      await page.getByTestId('toast').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const path = `${out}/${name}-${label}.png`; await page.screenshot({ path }); row.screenshots.push(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    };
    await page.goto(`${base}/designer?view=2d&pitch=1`, { waitUntil: 'networkidle' });
    await page.getByTestId('plan-drawing-viewport').waitFor();
    await waitForPlanModels();
    await shot('house-2d');
    await page.getByRole('button', { name: '3D House', exact: true }).click();
    await page.getByTestId('wallpaint-3d-gl').waitFor();
    await page.getByTestId('loading-3d').waitFor({ state: 'hidden' });
    await shot('house-3d');
    const viewport3d = page.getByTestId('wallpaint-3d-canvas');
    const rect = await viewport3d.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.wheel(0, -175);
    await shot('products');
    await page.goto(`${base}/demo?view=2d&pitch=1`, { waitUntil: 'networkidle' });
    await page.getByTestId('plan-drawing-viewport').waitFor();
    await waitForPlanModels();
    await page.waitForTimeout(1800);
    await shot('whole-home-2d');
    const geometry = await page.evaluate(() => {
      const raw = localStorage.getItem('ppw_property_v2');
      return raw ? JSON.parse(raw).state.property : null;
    });
    const plan = page.getByTestId('plan-drawing-viewport');
    const planRect = await plan.boundingBox();
    await page.mouse.move(planRect.x + planRect.width / 2, planRect.y + planRect.height / 2);
    await page.mouse.wheel(0, -140);
    await shot('whole-home-detail-2d');
    const afterGeometry = await page.evaluate(() => {
      const raw = localStorage.getItem('ppw_property_v2');
      return raw ? JSON.parse(raw).state.property : null;
    });
    expect(afterGeometry).toEqual(geometry);
    expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
    await context.close(); console.log(JSON.stringify(row));
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
