import { expect, test, type Locator } from '@playwright/test';

test.use({ launchOptions: { args: ['--host-resolver-rules=MAP *.vercel.app 216.198.79.3'] } });

// Include transparent ancestor surfaces and the retained PPW ivory gradient.
// The new dark surfaces and enquiry status backgrounds are opaque.
type TextPseudo = '::before' | '::placeholder' | null;
async function contrast(locator: Locator, pseudo: TextPseudo = null) {
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
      const measure = async (element: Locator, label: string, pseudo: TextPseudo = null) => {
        const reading = await contrast(element, pseudo);
        readings.push({ label, ...reading });
        if (pseudo === '::before') {
          expect(reading.content, label).not.toMatch(/^(none|normal)$/);
          expect(reading.display, label).not.toBe('none');
        }
        expect(reading.ratio, label).toBeGreaterThanOrEqual(4.5);
      };
      const measureText = async (label: string) => {
        const text = page.locator('.sales-content :is(h1, h2, h3, p, span, strong, em, a, summary, label, li, figcaption, button)');
        expect(await text.count()).toBeGreaterThan(0);
        for (let index = 0; index < await text.count(); index++) {
          const node = text.nth(index);
          if (!await node.isVisible() || await node.evaluate(element => !!element.closest('[aria-hidden="true"]'))) continue;
          if (!await node.evaluate(element => Array.from(element.childNodes).some(child => child.nodeType === 3 && child.textContent?.trim()))) continue;
          await measure(node, `${label}/text/${index}`);
        }
      };
      const measurePlaceholders = async (label: string, count: number) => {
        const fields = page.locator('.pitch-enquiry :is(input, textarea)[placeholder]');
        await expect(fields).toHaveCount(count);
        for (let index = 0; index < count; index++) {
          await expect(fields.nth(index)).toBeVisible();
          await expect(fields.nth(index)).toHaveValue('');
          await measure(fields.nth(index), `${label}/placeholder/${index}`, '::placeholder');
        }
      };
      const capture = async (name: string) => {
        // Functional capture readiness only: never used as first-picture timing.
        // A missing image fails this run; no retry or replacement screenshot.
        await expect.poll(() => page.locator('.sales-plumbing img').evaluateAll(images =>
          images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)),
        { timeout: 15000 }).toBe(true);
        await page.locator('.sales-plumbing img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
        await info.attach(name, { body: await page.locator('.sales-plumbing').screenshot(), contentType: 'image/png' });
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
          const skip = page.locator('.sales-skip');
          await skip.focus();
          await expect(skip).toBeFocused();
          await measure(skip, `${theme}/skip-link/focus`);
          await info.attach(`${theme}-skip-focus.png`, { body: await skip.screenshot(), contentType: 'image/png' });
          await skip.press('Enter');
          await expect(page.locator('#sales-content')).toBeFocused();
          for (const chapter of [0, 1, 2, 3, 4, 5]) {
            await page.locator('[role="tab"]').nth(chapter).click();
            const tabNumbers = page.locator('.sales-tabs button span');
            await expect(tabNumbers).toHaveCount(6);
            for (let index = 0; index < 6; index++) await measure(tabNumbers.nth(index), `${theme}/chapter-${chapter + 1}/tab-number/${index}`);
            if (chapter === 2) {
              await expect(page.locator('.sales-surface .sales-status')).toHaveCount(3);
              await page.locator('.sales-details summary').click();
              await expect(page.locator('.sales-links a')).toHaveCount(2);
            }
            if (chapter === 4) await expect(page.locator('.sales-surface .sales-number')).toHaveCount(4);
            if (chapter === 5) await expect(page.locator('form.pitch-enquiry')).toBeVisible();
            await measureText(`${theme}/chapter-${chapter + 1}`);
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
            await capture(`${theme}-chapter-${chapter + 1}.png`);
            if (chapter === 5) {
              await measurePlaceholders(`${theme}/project`, 5);
              const purposes = page.locator('.pitch-enquiry .pitch-segment button');
              await expect(purposes).toHaveCount(3);
              for (const index of [1, 2]) {
                await purposes.nth(index).click();
                await expect(purposes.nth(index)).toHaveAttribute('aria-pressed', 'true');
                await measureText(`${theme}/form-purpose-${index}`);
                await measurePlaceholders(`${theme}/form-purpose-${index}`, index === 2 ? 7 : 5);
              }
              await capture(`${theme}-physical-meeting.png`);
              await purposes.first().click();
            }
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
