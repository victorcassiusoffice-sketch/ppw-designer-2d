import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const target = new URL(base);
const approvedPreview = target.protocol === 'https:' && /^ppw-designer-2d-[a-z0-9-]+\.vercel\.app$/i.test(target.hostname);
if (!['127.0.0.1', 'localhost', 'onelivebuild.com'].includes(target.hostname) && !approvedPreview) throw new Error('Unapproved QA target');
const out = process.argv[3] ?? 'docs/qa-sims-fix-round-3-2026-10-27/thumbnails';
mkdirSync(out, { recursive: true });
const report = { base, cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
try {
  for (const [device, viewport, dpr, view] of [['desktop', { width: 1280, height: 800 }, 1, '2d'], ['phone', { width: 390, height: 844 }, 2, '3d']]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: device === 'phone', hasTouch: device === 'phone' });
    await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const row = { device, dpr, view, checks: [], pictures: [], errors: [], writes: [], failures: [] }; report.cases.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
    await page.route('**/api/**', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); return route.abort(); } await route.continue(); });
    const readyImage = async locator => {
      await expect.poll(() => locator.evaluate(image => image.complete && image.naturalWidth > 0), { timeout: 20000 }).toBe(true);
      const info = await locator.evaluate(image => ({ src: image.getAttribute('src'), currentSrc: image.currentSrc, srcSet: image.getAttribute('srcset'), width: image.naturalWidth, height: image.naturalHeight }));
      return info;
    };
    try {
      await page.goto(`${base}/demo?view=${view}&pitch=1`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId(view === '2d' ? 'plan-drawing-viewport' : 'wallpaint-3d-gl').waitFor();
      if (view === '3d') await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 90000 });
      row.fontRangeCandidates = await page.evaluate(() => {
        const found = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const element = node.parentElement; if (!element || /^(SCRIPT|STYLE)$/.test(element.tagName)) continue;
          const chars = [...new Set([...node.textContent].filter(char => { const c = char.codePointAt(0); return (c >= 0x250 && c <= 0x2ff) || (c >= 0x370 && c <= 0x1dff) || (c >= 0x1f00 && c <= 0x1fff) || (c >= 0x2c00 && c <= 0xffff); }))];
          if (!chars.length) continue;
          const r = element.getBoundingClientRect(), style = getComputedStyle(element);
          found.push({ chars: chars.map(char => `${char} U+${char.codePointAt(0).toString(16)}`), tag: element.tagName, role: element.getAttribute('role'), testid: element.getAttribute('data-testid'), visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none', family: style.fontFamily, style: style.fontStyle });
        }
        return found.slice(0, 40);
      });
      if (view === '2d') await page.getByTestId('cart-pill').click();
      else await page.locator('button[aria-label="Products in this design"]:visible').first().click();
      const basket = view === '2d' ? page.getByTestId('cart-sheet') : page.locator('section[aria-label="Products and finishes in your design"]');
      const basketPicture = await readyImage(basket.locator('.basket-product-picture img').first());
      expect(basketPicture.currentSrc).toContain(`-${dpr === 1 ? 128 : 256}.webp`);
      expect(await basket.innerText()).not.toMatch(/Courts Mammouth|Espace Maison|\bMUR\b|\bRs\b|€|£|\$/i);
      row.pictures.push({ kind: 'basket', ...basketPicture }); row.checks.push('basket uses density-appropriate small drawing; demo text guard');
      if (view === '2d') await basket.getByRole('button', { name: 'Close', exact: true }).click();
      else await page.locator('button[aria-label="Products in this design"]:visible').first().click();
      if (view === '2d') await page.getByTestId('dock-catalog-open').click();
      else await page.getByTestId('house-mode-furnish').click();
      const catalog = page.getByTestId(device === 'phone' ? 'sims-bottom-toolbar' : 'sims-dock'), prefix = device === 'phone' ? 'sims' : 'dock';
      await catalog.getByRole('tab', { name: 'Categories', exact: true }).click();
      await page.getByTestId(`${prefix}-cat-all`).click();
      for (const [query, kind] of [['NordicTrack', 'photo'], ['Marco', 'plan']]) {
        await page.getByTestId(`${prefix}-search`).fill(query);
        const card = catalog.locator('[data-product-id]').first(); await card.waitFor();
        const image = card.locator('img').first(), info = await readyImage(image);
        expect(info.currentSrc).toContain(`-${dpr === 1 ? 128 : 256}.webp`);
        expect(info.srcSet).toContain(' 1x, '); expect(info.srcSet).toContain(' 2x');
        expect(await card.locator('[data-image-kind]').getAttribute('data-image-kind')).toBe(kind);
        if (kind === 'plan') expect(await card.innerText()).toContain('Drawing');
        else expect(await card.locator('.catalog-image-label').count()).toBe(0);
        row.pictures.push({ kind, ...info });
        await card.screenshot({ path: `${out}/${device}-${kind}.jpg`, type: 'jpeg', quality: 82, scale: 'css' });
      }
      await catalog.locator('button.catalog-tile-details').first().click();
      const detail = page.getByTestId('mobile-product-popup'); await detail.waitFor();
      const full = await readyImage(detail.locator('img').first());
      expect(full.currentSrc).toContain('/products/catalog-plans/'); expect(full.srcSet).toBeNull();
      row.pictures.push({ kind: 'explicit-detail', ...full });
      row.checks.push('actual photo and Drawing labels preserved; 1x/2x currentSrc selected; explicit detail keeps original');
      await detail.locator('img').first().screenshot({ path: `${out}/${device}-detail.jpg`, type: 'jpeg', quality: 82, scale: 'css' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
    } catch (error) { row.failures.push(String(error)); }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/browser.json`, `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(row => row.errors.length || row.writes.length || row.failures.length)) process.exitCode = 1;
