import { expect, test, type Locator } from '@playwright/test';

async function inkContrast(button: Locator) {
  // Functional state proof, not a timing measurement. Let only this control's
  // actual CSS transitions complete; never inject styles or substitute colours.
  await button.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => undefined))));
  return button.evaluate(node => {
    const style = getComputedStyle(node);
    const channels = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const ink = channels(style.color), background = channels(style.backgroundColor);
    if ((ink[3] ?? 1) !== 1 || (background[3] ?? 1) !== 1) throw Error('Expected opaque control colours');
    const luminance = (color: number[]) => color.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const a = luminance(ink), b = luminance(background);
    return { color: style.color, background: style.backgroundColor,
      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      expanded: node.getAttribute('aria-expanded'), text: node.textContent,
      focused: document.activeElement === node, outline: style.outlineStyle };
  });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`plan toggle ${viewport.width}px`, () => {
    const phone = viewport.width === 390;
    test.use({ viewport, hasTouch: phone, isMobile: phone });
    test('keeps native disclosure, hover and keyboard text readable in each theme', async ({ page }, info) => {
      const writes: string[] = [], errors: string[] = [], readings: unknown[] = [];
      await page.route('**/*', route => {
        const request = route.request();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { writes.push(request.url()); return route.abort(); }
        return route.continue();
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto('/api/healthcheck');
      await info.attach('health.json', { body: await page.locator('body').innerText(), contentType: 'application/json' });
      await page.goto('/demo?view=2d&pitch=1');
      const toggle = page.getByTestId('canvas-chrome-toggle');
      await expect(toggle).toBeVisible();
      const activate = () => phone ? toggle.tap() : toggle.click();
      const measure = async (label: string) => {
        const reading = await inkContrast(toggle);
        readings.push({ label, ...reading });
        expect(reading.text).toMatch(/\d+ m²/);
        expect(reading.ratio, label).toBeGreaterThanOrEqual(4.5);
      };
      try {
        for (const theme of ['ivory', 'ocean', 'slate']) {
          await page.locator('details.locale-theme-controls > summary').click();
          await page.locator(`.theme-skin-card--${theme}`).click();
          await expect(page.locator('html')).toHaveAttribute('data-ui-theme', theme);
          await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
          if (await toggle.getAttribute('aria-expanded') === 'true') await activate();
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await measure(`${theme}/native-closed`);
          await activate();
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await measure(`${theme}/native-open`);
          await activate();
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await activate();
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await measure(`${theme}/native-reopened`);
          await info.attach(`${theme}-native-reopened.png`, { body: await toggle.screenshot(), contentType: 'image/png' });
          await toggle.hover();
          await measure(`${theme}/hover`);
          await toggle.focus();
          await toggle.press('Enter');
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await expect(toggle).toBeFocused();
          await measure(`${theme}/keyboard`);
          expect((await inkContrast(toggle)).outline).not.toBe('none');
        }
        expect(errors).toEqual([]);
        expect(writes).toEqual([]);
      } finally {
        await info.attach('control-readings.json', {
          body: JSON.stringify({ viewport, nativeTouch: phone, readings, errors, writes }, null, 2), contentType: 'application/json',
        });
      }
    });
  });
}
