import { expect, test, type Locator } from '@playwright/test';

test.use({ launchOptions: { args: ['--host-resolver-rules=MAP *.vercel.app 216.198.79.3'] } });

// Include transparent ancestor surfaces and the retained PPW ivory gradient.
// The new dark surfaces and enquiry status backgrounds are opaque.
async function contrast(locator: Locator, pseudo: '::before' | null = null) {
  return locator.evaluate((element, pseudo) => {
    const rgba = (value: string): number[] => {
      const channels = value.match(/[\d.]+/g)!.map(Number);
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    };
    const composite = (front: number[], back: number[]) => [
      ...front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3])), 1,
    ];
    const luminance = (color: number[]) => {
      const linear = color.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
    let surfaces = [[255, 255, 255, 1]], gradients = 0;
    for (const node of ancestors) {
      const style = getComputedStyle(node);
      if (style.opacity !== '1') throw Error('Contrast model requires opaque elements');
      surfaces = surfaces.map(surface => composite(rgba(style.backgroundColor), surface));
      if (style.backgroundImage !== 'none') {
        if (!style.backgroundImage.startsWith('linear-gradient(')) throw Error('Unmodelled background image');
        const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(match => rgba(match[0]));
        if (!stops.length) throw Error('Missing gradient stops');
        surfaces = surfaces.flatMap(surface => stops.map(stop => composite(stop, surface)));
        gradients++;
      }
    }
    const style = getComputedStyle(element, pseudo);
    if (pseudo) {
      if (style.opacity !== '1' || style.backgroundImage !== 'none') throw Error('Unmodelled pseudo-element surface');
      surfaces = surfaces.map(surface => composite(rgba(style.backgroundColor), surface));
    }
    const ink = rgba(style.color);
    if (ink[3] !== 1) throw Error('Contrast model requires opaque text');
    const text = luminance(ink), backgrounds = surfaces.map(luminance);
    const low = Math.min(...backgrounds), high = Math.max(...backgrounds);
    const ratio = text >= low && text <= high ? 1 : Math.min(...backgrounds.map(background =>
      (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)));
    return { color: style.color, background: style.backgroundColor, gradients, ratio,
      fontSize: style.fontSize, fontWeight: style.fontWeight, content: style.content, display: style.display,
      outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  }, pseudo);
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });
    for (const brand of ['olb', 'ppw']) test(`${brand}: nested pitch text and actions stay readable in every theme`, async ({ page }, info) => {
      const writes: string[] = [], errors: string[] = [], fixtures: unknown[] = [], readings: unknown[] = [];
      let fixtureStatus: 200 | 503 = 503;
      await page.route('**/*', route => {
        const request = route.request();
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/pitch-enquiry') {
          fixtures.push({ status: fixtureStatus, transmitted: false });
          return route.fulfill({ status: fixtureStatus, contentType: 'application/json', body: JSON.stringify(
            fixtureStatus === 200 ? { status: 'received', receipt: 'PPW-123456' } : { error: 'Local contrast fixture' },
          ) });
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { writes.push(request.url()); return route.abort(); }
        return route.continue();
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/api/healthcheck');
      await info.attach('health.json', { body: await page.locator('body').innerText(), contentType: 'application/json' });
      await page.goto(`/pitch/plumbing?brand=${brand}`);
      const measure = async (element: Locator, label: string, pseudo: '::before' | null = null) => {
        const reading = await contrast(element, pseudo);
        readings.push({ label, ...reading });
        if (pseudo) {
          expect(reading.content, label).not.toMatch(/^(none|normal)$/);
          expect(reading.display, label).not.toBe('none');
        }
        expect(reading.ratio, label).toBeGreaterThanOrEqual(4.5);
      };
      try {
        for (const theme of ['ivory', 'ocean', 'slate']) {
          await page.locator('[role="tab"]').nth(2).click();
          await page.locator('details.locale-theme-controls > summary').click();
          await page.locator(`.theme-skin-card--${theme}`).click();
          await expect(page.locator('html')).toHaveAttribute('data-ui-theme', theme);
          const close = page.locator('.locale-theme-controls__heading button');
          for (const state of ['rest', 'hover', 'focus']) {
            await page.mouse.move(0, 0);
            if (state === 'hover') await close.hover();
            if (state === 'focus') await close.focus();
            await measure(close, `${theme}/close/${state}`);
          }
          await expect(close).toBeFocused();
          await close.press('Enter');
          await expect(page.locator('details.locale-theme-controls')).not.toHaveAttribute('open');
          await expect(page.locator('details.locale-theme-controls > summary')).toBeFocused();
          for (const chapter of [1, 2, 3, 4]) {
            await page.locator('[role="tab"]').nth(chapter).click();
            const commonText = page.locator('.sales-surface :is(h2, p, span, strong, a), .sales-content summary, .sales-content .sales-button');
            expect(await commonText.count()).toBeGreaterThan(0);
            if (chapter === 2) await expect(page.locator('.sales-surface .sales-status')).toHaveCount(3);
            if (chapter === 4) await expect(page.locator('.sales-surface .sales-number')).toHaveCount(4);
            for (let index = 0; index < await commonText.count(); index++) {
              const node = commonText.nth(index);
              await expect(node).toBeVisible();
              await measure(node, `${theme}/chapter-${chapter + 1}/card-text/${index}`);
            }
            if (chapter === 1) {
              const steps = page.locator('.sales-surface .sales-steps li');
              await expect(steps).toHaveCount(4);
              for (let index = 0; index < await steps.count(); index++) {
                await measure(steps.nth(index), `${theme}/step-counter/${index}`, '::before');
              }
            }
            const actions = page.locator('.sales-content .sales-button');
            for (let index = 0; index < await actions.count(); index++) {
              const action = actions.nth(index);
              for (const state of ['rest', 'hover', 'focus']) {
                await page.mouse.move(0, 0);
                if (state === 'hover') await action.hover();
                if (state === 'focus') await action.focus();
                await measure(action, `${theme}/chapter-${chapter + 1}/action-${index}/${state}`);
              }
            }
            await info.attach(`${theme}-chapter-${chapter + 1}.png`, { body: await page.locator('.sales-content').screenshot(), contentType: 'image/png' });
          }
          await page.locator('[role="tab"]').last().click();
          const form = page.locator('form.pitch-enquiry');
          await form.locator('[name="name"]').fill('Contrast Fixture');
          await form.locator('[name="email"]').fill('fixture@example.test');
          await form.locator('[name="message"]').fill('Local contrast test. No form request reaches the service.');
          await form.locator('[name="consent"]').check();
          for (const status of [503, 200] as const) {
            fixtureStatus = status;
            await form.locator('button[type="submit"]').click();
            const result = form.getByRole(status === 200 ? 'status' : 'alert');
            await expect(result).toBeVisible();
            await measure(result, `${theme}/status/${status}`);
            await info.attach(`${theme}-status-${status}.png`, { body: await result.screenshot(), contentType: 'image/png' });
          }
        }
        expect(fixtures).toHaveLength(6);
        expect(writes).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await info.attach('contrast.json', { body: JSON.stringify(readings, null, 2), contentType: 'application/json' });
        await info.attach('requests.json', { body: JSON.stringify({ fixtures, writes, errors }, null, 2), contentType: 'application/json' });
      }
    });
  });
}
