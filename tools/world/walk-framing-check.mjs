import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [origin, out, expected] = process.argv.slice(2);
const host = new URL(origin).hostname;
const local = ['localhost', '127.0.0.1'].includes(host);
if (!local && !/^[a-f0-9]{40}$/.test(expected ?? '')) throw Error('Pass the deployed commit.');
const args = ['--use-angle=d3d11', '--ignore-gpu-blocklist'];
if (process.env.OLB_VERIFY_EDGE_IP)
  args.push('--host-resolver-rules=MAP ' + host + ' ' + process.env.OLB_VERIFY_EDGE_IP);
const browser = await chromium.launch({ args });
const rows = [];
await fs.mkdir(out, { recursive: true });
try {
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
    [313, 567],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 600,
      serviceWorkers: 'block',
    });
    const errors = [],
      writes = [];
    await ctx.route('**/*', (route) => {
      if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
      writes.push(route.request().method());
      return route.abort();
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', (err) => errors.push(err.message));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const status = async () =>
      JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
    const distance = (s) => Math.hypot(s.camera[0] - s.position[0], s.camera[2] - s.position[2]);
    async function start() {
      await button('Open Walk mode').click();
      await button('Start walk').click();
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="world-walk"]')?.getAttribute('data-status'),
      );
    }
    async function controls(value) {
      await button('Controls').click();
      await page.getByLabel('Third-person camera').selectOption(value);
      await button('Got it').click();
    }
    async function stable(min, max) {
      await page.waitForFunction(
        ([lo, hi]) => {
          const state = JSON.parse(
            document.querySelector('[data-testid="world-walk"]').dataset.status,
          );
          const d = Math.hypot(
            state.camera[0] - state.position[0],
            state.camera[2] - state.position[2],
          );
          return d >= lo && d <= hi;
        },
        [min, max],
        { timeout: 10000 },
      );
      return distance(await status());
    }
    try {
      if (!local) {
        const response = await page.goto(origin + '/api/healthcheck?proof=' + Date.now());
        assert.equal((await response.json()).commit, expected);
      }
      await page.goto(origin + '/demo?view=3d&pitch=1');
      await start();
      const indoor = await stable(2.7, 4.9);
      await page.screenshot({
        path: path.join(out, 'indoor-' + width + '.jpg'),
        type: 'jpeg',
        quality: 78,
      });
      await button('Exit walk').click();
      if (!(await button('Clear page').isVisible()) && (await button('Shortcuts').isVisible()))
        await button('Shortcuts').click();
      await button('Clear page').click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Clear page', exact: true })
        .click();
      if (!(await button('Open Walk mode').isVisible())) await button('3D House').click();
      await start();
      const wide = await stable(4.65, 5);
      await controls('close');
      const close = await stable(2.75, 3.05);
      await controls('far');
      const far = await stable(6.05, 6.4);
      await controls('wide');
      const before = await status();
      await page.keyboard.down('Shift');
      await page.keyboard.down('w');
      let running;
      try {
        await page.waitForFunction(
          () =>
            JSON.parse(document.querySelector('[data-testid="world-walk"]').dataset.status)
              .animation === 'run',
        );
        running = await status();
      } finally {
        await page.keyboard.up('w');
        await page.keyboard.up('Shift');
      }
      assert(
        Math.hypot(
          running.position[0] - before.position[0],
          running.position[2] - before.position[2],
        ) > 0.05,
      );
      await button('First person').click();
      await button('Third person').click();
      await stable(4.6, 5.7);
      if (width < 600) {
        const pad = page.getByRole('application', { name: 'Move relative to camera' }),
          box = await pad.boundingBox();
        assert(box);
        const cdp = await ctx.newCDPSession(page),
          initial = await status();
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1 }],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + box.width * 0.4, y, id: 1 }],
        });
        try {
          await page.waitForFunction(
            (p) => {
              const s = JSON.parse(
                document.querySelector('[data-testid="world-walk"]').dataset.status,
              );
              return Math.hypot(s.position[0] - p[0], s.position[2] - p[2]) > 0.15;
            },
            initial.position,
            { timeout: 5000 },
          );
        } finally {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
        await button('Controls').click();
        await page.getByLabel('One-hand steering').check();
        await button('Got it').click();
        assert(
          await page.getByRole('application', { name: 'Move and turn with one thumb' }).isVisible(),
        );
      }
      await controls('far');
      await button('Exit walk').click();
      await start();
      await stable(6.05, 6.4);
      await page.screenshot({
        path: path.join(out, 'open-land-' + width + '.jpg'),
        type: 'jpeg',
        quality: 78,
      });
      await button('Exit walk').click();
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      rows.push({
        width,
        indoor,
        wide,
        close,
        far,
        sprint: true,
        framingRemembered: true,
        touch: width < 600,
        errors,
        writes,
      });
      console.log(width, 'passed');
    } finally {
      await ctx.close();
    }
  }
  await fs.writeFile(
    path.join(out, 'framing.json'),
    JSON.stringify({ origin, expected, rows }, null, 2),
  );
} finally {
  await browser.close();
}
