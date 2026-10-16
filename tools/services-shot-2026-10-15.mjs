/** Local production-preview QA. Disposable project; no API mutations or publishing.
 * node tools/services-shot-2026-10-15.mjs [http://127.0.0.1:5173]
 * Editor drawing/connection interactions are covered by the companion services editor QA.
 */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Local preview only.');
const out = 'docs/services-qa-2026-10-15';
mkdirSync(out, { recursive: true });
const dimensions = [
  ['toilet', 0.4, 0.7, 0.78, 0],
  ['sink', 0.6, 0.48, 0.85, 0],
  ['mains-tap', 0.12, 0.16, 0.6, 0],
  ['electrical-board', 0.4, 0.12, 0.6, 1.1],
  ['sewer-connection', 0.6, 0.6, 0.6, -0.6],
  ['air-conditioner', 0.8, 0.22, 0.3, 2.1],
  ['outdoor-ac', 0.8, 0.35, 0.6, 0],
  ['air-grille', 0.3, 0.1, 0.3, 2.1],
  ['extractor-fan', 0.159, 0.1, 0.16, 2.1],
  ['sprinkler', 0.08, 0.08, 0.08, 2.5],
  ['fire-extinguisher', 0.18, 0.18, 0.55, 0.2],
  ['security-camera', 0.0907, 0.2385, 0.0907, 2.2],
  ['network-switch', 0.171, 0.098, 0.027, 1.4],
];
const systems = [
  ['cold-water', 'hpl-aquasafe-upvc-20', 20, 0.3],
  ['hot-water', 'espace-cpvc-20', 20, 0.6],
  ['waste', 'hpl-aquadrain-sewer-110', 110, -0.25],
  ['electrical', 'hpl-aquaduct-ldpe-20', 20, 1],
  ['ventilation', 'vortice-round-duct-100', 100, 2.3],
  ['refrigerant', 'daikin-copper-9.52', 9.52, 2],
  ['fire-water', 'wheatland-sch10-1', 25.4, 2.5],
  ['data', 'belden-2412-cat6', 5.69, 1.6],
];
const fixtures = dimensions.map(([kind, widthM, depthM, heightM, elevationM], i) => ({
  id: `qa-${kind}`,
  levelId: 'ground',
  kind,
  x: 1 + (i % 5) * 1.45,
  y: 1 + Math.floor(i / 5) * 1.8,
  widthM,
  depthM,
  heightM,
  elevationM,
  rotation: 0,
}));
const services = {
  version: 1,
  fixtures,
  runs: systems.map(([system, materialId, diameterMm, elevation], i) => ({
    id: `qa-route-${system}`,
    levelId: 'ground',
    system,
    materialId,
    diameterMm,
    startElevationM: -0.3,
    endElevationM: elevation,
    points: [
      { x: 0.4 + i * 0.4, y: 0.3, elevationM: -0.3 },
      { x: 0.4 + i * 0.4, y: 0.3, elevationM: elevation },
      { x: 0.4 + i * 0.4, y: 5.5, elevationM: elevation },
    ],
  })),
  junctions: [],
};
const rebar = {
  enabled: false,
  diameterMm: 10,
  spacingMm: 200,
  layers: 1,
  coverMm: 50,
  stockLengthM: 6,
  lapLengthM: 0,
  wastePct: 5,
};
const property = {
  id: 'generic-demo-home',
  name: 'Demo',
  activeRoomId: 'qa-ground',
  wallHeightM: 2.7,
  levels: [
    { id: 'ground', name: 'Ground floor', index: 0, heightM: 3 },
    { id: 'upper', name: 'First floor', index: 1, heightM: 3 },
    { id: 'roof', name: 'Roof', index: 2, kind: 'roof' },
  ],
  rooms: [
    {
      id: 'qa-ground',
      name: 'Services study',
      polygon: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 6 },
        { x: 0, y: 6 },
      ],
      placedItems: [],
    },
    {
      id: 'qa-upper',
      name: 'Upper floor',
      levelId: 'upper',
      polygon: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 6 },
        { x: 0, y: 6 },
      ],
      placedItems: [],
    },
  ],
  services,
  foundation: {
    version: 1,
    enabled: true,
    elements: [
      {
        id: 'qa-footing',
        name: 'Measured footing',
        kind: 'strip',
        x: 0,
        y: 0,
        lengthM: 8,
        widthM: 0.5,
        depthM: 0.3,
        topElevationM: -0.7,
        rebar,
        excavation: { depthM: 1, topElevationM: 0, marginM: 0.15, stage: 'excavated' },
      },
    ],
    bores: [
      {
        id: 'qa-bore',
        name: 'Circular excavation',
        x: 5,
        y: 3,
        diameterM: 1,
        depthM: 2,
        topElevationM: 0,
      },
    ],
  },
};
const report = {
  base,
  at: new Date().toISOString(),
  bundle: readdirSync('dist/assets').find((x) => /^App-[\w-]+\.js$/.test(x)),
  seed: '13 distinct schematic fixture kinds, eight measured systems, vertical risers, two floors, measured rectangular and circular excavation. No real project or customer data.',
  cases: [],
};
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      hasTouch: name === 'phone',
      isMobile: name === 'phone',
      deviceScaleFactor: 1,
    });
    await context.addInitScript((p) => {
      if (sessionStorage.getItem('qa-services-seeded')) return;
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem(
        'olb.ui-preferences.v1',
        JSON.stringify({ locale: 'en', theme: 'ivory' }),
      );
      localStorage.setItem(
        'ppw_property_v2',
        JSON.stringify({ version: 2, state: { property: p, pxPerMetre: 70, showGrid: true } }),
      );
      localStorage.setItem(
        'ppw_properties_v2',
        JSON.stringify({
          version: 2,
          state: {
            currentId: 'qa-saved',
            designs: {
              'qa-saved': {
                id: 'qa-saved',
                name: 'Demo · Home',
                savedAt: '2026-10-15T00:00:00Z',
                property: p,
                roomDimensions: { lengthM: 8, widthM: 6 },
                placedItems: [],
                walls: [],
                floorZones: [],
                wallTreatments: {},
              },
            },
          },
        }),
      );
      sessionStorage.setItem('qa-services-seeded', '1');
    }, property);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const result = {
      name,
      viewport,
      screenshots: [],
      checks: [],
      defects: [],
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      httpErrors: [],
      writes: [],
    };
    report.cases.push(result);
    page.on('console', (m) => {
      if (m.type() === 'error') result.consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => result.pageErrors.push(e.message));
    page.on('requestfailed', (r) =>
      result.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }),
    );
    page.on('response', (r) => {
      if (r.status() >= 400) result.httpErrors.push({ url: r.url(), status: r.status() });
    });
    await page.route('**/api/**', async (route) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        result.writes.push(route.request().url());
        await route.abort();
      } else await route.continue();
    });
    const snapshot = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
    const savedLayers = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('olb-discipline-visibility-v1')).state.visible,
      );
    const shot = async (label) => {
      await page.waitForTimeout(350);
      const path = `${out}/${name}-${label}.png`;
      await page.screenshot({ path, timeout: 60000 });
      result.screenshots.push(path);
      const bounds = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        clipped: [
          ...document.querySelectorAll(
            '.discipline-popover,.house-tutorial,.foundation-header button,.foundation-header select',
          ),
        ]
          .map((e) => ({
            text: e.getAttribute('aria-label') || e.textContent.slice(0, 50),
            box: e.getBoundingClientRect(),
          }))
          .filter(
            (x) =>
              x.box.width > 0 &&
              (x.box.left < -1 ||
                x.box.right > innerWidth + 1 ||
                x.box.top < -1 ||
                x.box.bottom > innerHeight + 1),
          )
          .map((x) => x.text),
      }));
      const priceFree = !/(?:£\s*\d|\d[\d,.]*\s*MUR)/.test(await page.locator('body').innerText());
      result.checks.push({ screen: label, ...bounds, priceFree });
      if (bounds.overflow || bounds.clipped.length || !priceFree)
        result.defects.push({ screen: label, ...bounds, priceFree });
    };
    const openLayers = async () => {
      const house = page.getByTestId('wallpaint-3d-overlay');
      const root = (await house.isVisible()) ? house : page.getByTestId('plan-navigation');
      if (!(await root.getByTestId('discipline-toggle').isVisible()))
        await page.getByRole('button', { name: 'Site & tools', exact: true }).click();
      const trigger = root.getByTestId('discipline-toggle');
      if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
      await page.getByTestId('discipline-options').waitFor();
    };
    const closeLayers = async () => {
      const wasHouse = await page.getByTestId('wallpaint-3d-overlay').isVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.discipline-popover')).toHaveCount(0);
      if (wasHouse) await expect(page.getByTestId('wallpaint-3d-overlay')).toBeVisible();
    };
    const only = async (key) => {
      await openLayers();
      await page.locator(`[data-only-discipline="${key}"]`).click();
      expect(
        Object.entries(await savedLayers())
          .filter(([, v]) => v)
          .map(([k]) => k),
      ).toEqual([key]);
      await closeLayers();
    };
    const showAll = async () => {
      await openLayers();
      await page.locator('.discipline-show-all').click();
      await closeLayers();
      expect(Object.values(await savedLayers()).every(Boolean)).toBe(true);
    };
    const pixelDelta = async (a, b) =>
      page.evaluate(
        async ([aa, bb]) => {
          const decode = async (str) => {
            const image = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${str}`)).blob(),
            );
            const c = document.createElement('canvas');
            c.width = image.width;
            c.height = image.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(image, 0, 0);
            return {
              w: c.width,
              h: c.height,
              data: ctx.getImageData(0, 0, c.width, c.height).data,
            };
          };
          const a = await decode(aa),
            b = await decode(bb);
          if (a.w !== b.w || a.h !== b.h) return 1;
          let changed = 0;
          for (let i = 0; i < a.data.length; i += 4)
            if (
              Math.max(
                Math.abs(a.data[i] - b.data[i]),
                Math.abs(a.data[i + 1] - b.data[i + 1]),
                Math.abs(a.data[i + 2] - b.data[i + 2]),
              ) > 20
            )
              changed++;
          return changed / (a.w * a.h);
        },
        [a.toString('base64'), b.toString('base64')],
      );
    const phase = async (label, fn) => {
      try {
        await fn();
      } catch (e) {
        result.defects.push({ phase: label, error: String(e) });
        try {
          await shot(`${label}-failure`);
        } catch {
          /* preserve original failure */
        }
      }
    };
    await phase('plan', async () => {
      await page.goto(`${base}/demo?view=2d&pitch=1`, { waitUntil: 'networkidle' });
      await page.locator('.konvajs-content canvas').first().waitFor();
      expect((await snapshot()).services.fixtures).toHaveLength(13);
      expect((await snapshot()).services.runs).toHaveLength(8);
      const canonical = (await snapshot()).services;
      await shot('plan-all-services');
      await openLayers();
      expect(await page.locator('[data-discipline]').count()).toBe(10);
      await shot('plan-layers');
      await closeLayers();
      for (const key of ['plumbing', 'hvac', 'fire', 'security']) {
        await only(key);
        await shot(`plan-only-${key}`);
        expect((await snapshot()).services).toEqual(canonical);
      }
      await showAll();
      result.checks.push(
        'All 13 fixture kinds and eight systems retained; only/show-all filters do not mutate canonical service inputs.',
      );
    });
    await phase('house', async () => {
      await showAll();
      await page.getByRole('button', { name: '3D House', exact: true }).click();
      await page.getByTestId('wallpaint-3d-gl').waitFor();
      await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForTimeout(1000);
      await shot('house-all-services');
      await openLayers();
      const layerStyle = await page.locator('.house-camera-row').evaluate((el) => ({
        overflow: getComputedStyle(el).overflow,
        designerAncestor: !!el.closest('.designer-app'),
      }));
      result.checks.push({ action: 'House layer menu clipping', ...layerStyle });
      expect(layerStyle.overflow).toBe('visible');
      await shot('house-layers');
      await closeLayers();
      const canonical = (await snapshot()).services;
      for (const key of ['plumbing', 'hvac', 'fire', 'security']) {
        await only(key);
        await shot(`house-only-${key}`);
        expect((await snapshot()).services).toEqual(canonical);
      }
      await showAll();
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await page.getByTestId('view3d-pan').click();
      const box = await page.getByTestId('wallpaint-3d-canvas').boundingBox();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5 + 25, box.y + box.height * 0.5 + 14, {
        steps: 5,
      });
      await page.mouse.up();
      await page.waitForTimeout(1100);
      const before = await page.getByTestId('wallpaint-3d-gl').screenshot();
      await shot('house-camera-before');
      await only('hvac');
      await showAll();
      await page.waitForTimeout(1100);
      const after = await page.getByTestId('wallpaint-3d-gl').screenshot(),
        delta = await pixelDelta(before, after);
      result.checks.push({
        action: 'Zoom/pan then isolate HVAC and restore all',
        changedPixelFraction: delta,
        tolerance: 0.003,
      });
      expect(delta).toBeLessThan(0.003);
      await shot('house-camera-restored');
      expect((await snapshot()).services).toEqual(canonical);
      await page.getByLabel('View floor', { exact: true }).selectOption('upper');
      await shot('house-upper-floor');
      await page.getByLabel('View floor', { exact: true }).selectOption('ground');
      await shot('house-ground-return');
    });
    await phase('tutorial', async () => {
      // Re-enter plan; the same persisted seed must survive demo navigation.
      await page.goto(`${base}/demo?view=2d&pitch=1`, { waitUntil: 'networkidle' });
      await page.locator('.konvajs-content canvas').first().waitFor();
      await page.getByRole('button', { name: 'Site & tools', exact: true }).click();
      await page.getByRole('button', { name: 'House build guide', exact: true }).click();
      await page.getByRole('dialog', { name: 'House build guide', exact: true }).waitFor();
      await shot('guide-start');
      await page.locator('.house-tutorial select').selectOption('2');
      await shot('guide-excavation');
      await page.getByRole('button', { name: 'Open this tool', exact: false }).click();
      await expect(page.locator('.house-tutorial-resume')).toBeVisible();
      await page.getByRole('dialog', { name: 'Foundation design', exact: true }).waitFor();
      await shot('foundation-plan');
      await page.locator('[data-foundation-id="qa-bore"]').click();
      await page.getByLabel('Hole diameter m', { exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByLabel('Hole diameter m', { exact: true })).toHaveValue('1');
      await expect(page.getByLabel('Hole depth m', { exact: true })).toHaveValue('2');
      await shot('foundation-bore-dimensions');
      const foundationCanvas = await page
        .getByLabel('Scaled foundation plan', { exact: true })
        .boundingBox();
      result.checks.push({
        action: 'Foundation drawing remains usable with dimensions open',
        height: foundationCanvas.height,
      });
      expect(foundationCanvas.height).toBeGreaterThanOrEqual(239);
      const totalsFit = await page.locator('.foundation-totals').evaluate((el) => {
        const totals = el.getBoundingClientRect();
        const drawing = el.closest('.foundation-drawing').getBoundingClientRect();
        return {
          bottom: totals.bottom,
          drawingBottom: drawing.bottom,
          fits: totals.bottom <= drawing.bottom + 1,
        };
      });
      result.checks.push({
        action: 'Foundation summary rows fit within their drawing pane',
        ...totalsFit,
      });
      expect(totalsFit.fits).toBe(true);
      await page.getByRole('button', { name: '3D foundation', exact: true }).click();
      await page.getByTestId('wallpaint-3d-gl').waitFor();
      await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForTimeout(800);
      await shot('foundation-3d');
      await page.getByRole('button', { name: /Resume house guide/ }).click();
      await page.getByRole('button', { name: 'Close guide', exact: true }).click();
      await expect(page.locator('.house-tutorial,.house-tutorial-resume')).toHaveCount(0);
      result.checks.push(
        'Guide launch minimises the checklist so foundation tool remains interactive; Close guide dismisses it.',
      );
    });
    await context.close();
    writeFileSync(`${out}/main-report.json`, JSON.stringify(report, null, 2));
  }
} finally {
  await browser.close();
}
report.pass = report.cases.every(
  (c) => !c.defects.length && !c.consoleErrors.length && !c.pageErrors.length && !c.writes.length,
);
writeFileSync(`${out}/main-report.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      bundle: report.bundle,
      pass: report.pass,
      cases: report.cases.map((c) => ({
        viewport: c.name,
        screenshots: c.screenshots.length,
        defects: c.defects,
        consoleErrors: c.consoleErrors,
        pageErrors: c.pageErrors,
        failedRequests: c.failedRequests,
        writes: c.writes,
      })),
    },
    null,
    2,
  ),
);
if (!report.pass) process.exitCode = 1;
