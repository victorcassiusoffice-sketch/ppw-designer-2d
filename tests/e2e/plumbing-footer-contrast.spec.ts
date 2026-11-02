import { expect, test, type Locator } from '@playwright/test';

// Exercise the real, combined brand/theme cascade. A source-string or JSDOM
// check cannot catch the inherited white-on-ivory footer button.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP *.vercel.app 216.198.79.3'] } });

async function contrast(button: Locator) {
  return button.evaluate(element => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.map(Number);
      if (channels.length > 3 && channels[3] !== 1) throw Error('Expected an opaque button surface');
      const linear = channels.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const ink = luminance(style.color), surface = luminance(style.backgroundColor);
    return { color: style.color, background: style.backgroundColor,
      ratio: (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05),
      outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });
    for (const brand of ['olb', 'ppw']) test(`${brand}: Next and Start again remain readable and operable in every theme`, async ({ page }, info) => {
      const writes: string[] = [], errors: string[] = [], measurements: unknown[] = [];
      await page.route('**/*', route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
          writes.push(route.request().url()); return route.abort();
        }
        return route.continue();
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/api/healthcheck');
      await info.attach('health.json', { body: await page.locator('body').innerText(), contentType: 'application/json' });
      await page.goto(`/pitch/plumbing?brand=${brand}`);
      const button = page.locator('.sales-footer button');
      await expect(button).toBeVisible();
      for (const theme of ['ivory', 'ocean', 'slate']) {
        await page.locator('details.locale-theme-controls > summary').click();
        await page.locator(`.theme-skin-card--${theme}`).click();
        await expect(page.locator('html')).toHaveAttribute('data-ui-theme', theme);
        await page.locator('.locale-theme-controls__heading button').click();
        await page.locator('[role="tab"]').first().click();
        for (const state of ['rest', 'hover', 'focus'] as const) {
          if (state === 'rest') await page.mouse.move(0, 0);
          if (state === 'hover') await button.hover();
          if (state === 'focus') { await page.mouse.move(0, 0); await button.focus(); }
          const reading = await contrast(button);
          measurements.push({ theme, state, ...reading });
          expect(reading.ratio, `${theme}/${state} text contrast`).toBeGreaterThanOrEqual(4.5);
        }
        await button.press('Enter');
        await expect(page.locator('#sales-tab-1')).toHaveAttribute('aria-selected', 'true');
        await page.locator('[role="tab"]').last().click();
        await expect(button).toHaveText('Start again →');
        await button.hover();
        const last = await contrast(button);
        measurements.push({ theme, state: 'last-chapter-hover', ...last });
        expect(last.ratio).toBeGreaterThanOrEqual(4.5);
        await button.click();
        await expect(page.locator('#sales-tab-0')).toHaveAttribute('aria-selected', 'true');
        await info.attach(`${theme}-footer.png`, { body: await button.screenshot(), contentType: 'image/png' });
      }
      await info.attach('contrast.json', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
