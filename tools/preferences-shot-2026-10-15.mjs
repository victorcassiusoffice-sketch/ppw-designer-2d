/** Read-only local language/theme visual QA. No form submits or API writes. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out = 'docs/qa-preferences-2026-10-15'; mkdirSync(out, { recursive: true });
const report = { at: new Date().toISOString(), bundle: readdirSync('dist/assets').find(file => /^App-[\w-]+\.js$/.test(file)), cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const screens = ['developers', 'merchants', 'construction', 'plumbing'].map(company => ({ name: company, route: `/pitch/${company}`, company }));
screens.push({ name: 'studio', route: '/studio' }, { name: 'city', route: '/designer?panel=city' });
try {
  for (const [device, viewport, locale, theme] of [
    ['desktop', { width: 1280, height: 900 }, 'en', 'ivory'],
    ['phone', { width: 390, height: 844 }, 'fr', 'ocean'],
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: device === 'phone', isMobile: device === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(({ locale, theme }) => {
      if (sessionStorage.getItem('qa-prefs-seeded')) return;
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('olb.ui-preferences.v1', JSON.stringify({ locale, theme }));
      sessionStorage.setItem('qa-prefs-seeded', '1');
    }, { locale, theme });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    let current;
    page.on('console', message => { if (message.type() === 'error') current?.consoleErrors.push(message.text()); });
    page.on('pageerror', error => current?.pageErrors.push(error.message));
    page.on('requestfailed', request => current?.failedRequests.push({ url: request.url(), reason: request.failure()?.errorText }));
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { current?.writes.push(route.request().url()); await route.abort(); } else await route.continue();
    });
    for (const screen of screens) {
      current = { screen: screen.name, device, locale, theme, screenshots: [], checks: [], defects: [], consoleErrors: [], pageErrors: [], failedRequests: [], writes: [] }; report.cases.push(current);
      try {
        await page.goto(base + screen.route, { waitUntil: 'networkidle' });
        await page.locator('.locale-theme-controls').first().waitFor();
        if (screen.name === 'city') {
          await page.locator('.city-workspace').waitFor();
          const starter = page.locator('.city-empty button').first();
          if (await starter.count()) await starter.click();
        }
        await page.waitForTimeout(500);
        const path = `${out}/${screen.name}-${device}-${locale}-${theme}.png`; await page.screenshot({ path, timeout: 60000 }); current.screenshots.push(path);
        const layout = await page.evaluate(() => ({
          lang: document.documentElement.lang, theme: document.documentElement.dataset.uiTheme,
          viewport: innerWidth, width: document.documentElement.scrollWidth,
          logos: [...document.querySelectorAll('.olb-lockup')].map(e => ({ src: e.getAttribute('src'), width: e.getBoundingClientRect().width })),
          clipped: [...document.querySelectorAll('.city-header button,.city-tools button,.pitch-header a,.sales-header a,.studio-header a,.c-top a')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.left < -1 || b.right > innerWidth + 1); }).map(e => e.textContent?.trim()),
          companyLinks: [...document.querySelectorAll('a[href*="panel=project"]')].map(e => e.getAttribute('href')),
        }));
        current.checks.push(layout);
        if (layout.width > layout.viewport + 1 || layout.clipped.length) current.defects.push('Horizontal overflow or clipped header control.');
        if (layout.lang !== locale || layout.theme !== theme) current.defects.push('Preference state did not apply.');
        if (screen.company && !layout.companyLinks.includes(`/demo?panel=project&company=${screen.company}`)) current.defects.push('Company dashboard link missing.');
        if (layout.logos.some(l => !l.src.includes(theme === 'ivory' ? 'olb-lockup.svg' : 'olb-lockup-reverse.svg'))) current.defects.push('Incorrect light/dark wordmark.');
        if (screen.name === 'studio') {
          const control = page.locator('.locale-theme-controls').first(); await control.locator('summary').click();
          const prefs = `${out}/preferences-${device}-${locale}-${theme}.png`; await page.screenshot({ path: prefs }); current.screenshots.push(prefs);
          await page.keyboard.press('Escape');
          if (await control.getAttribute('open') !== null) current.defects.push('Escape did not dismiss preferences.');
          for (const [nextLocale, nextTheme] of [['es', 'slate'], ['zh-CN', 'ivory']]) {
            await control.locator('summary').click();
            await control.locator('select').nth(0).selectOption(nextLocale);
            await control.locator('select').nth(1).selectOption(nextTheme);
            await page.keyboard.press('Escape'); await page.waitForTimeout(100);
            const variant = `${out}/studio-${device}-${nextLocale}-${nextTheme}.png`; await page.screenshot({ path: variant }); current.screenshots.push(variant);
            const state = await page.evaluate(() => ({ locale: document.documentElement.lang, theme: document.documentElement.dataset.uiTheme, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
            current.checks.push(state);
            if (state.locale !== nextLocale || state.theme !== nextTheme || state.overflow) current.defects.push(`Language/theme switch failed or overflowed: ${nextLocale}/${nextTheme}`);
          }
          await control.locator('summary').click();
          await control.locator('select').nth(0).selectOption(locale);
          await control.locator('select').nth(1).selectOption(theme);
          await page.keyboard.press('Escape');
        }
      } catch (error) { current.defects.push(String(error)); await page.screenshot({ path: `${out}/${screen.name}-${device}-error.png` }); }
    }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(c => c.defects.length || c.consoleErrors.length || c.pageErrors.length || c.writes.length)) process.exitCode = 1;
