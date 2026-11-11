// A local VITE_TEST_HOOKS=1 build exposes screen coordinates for the visible renderer.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [origin, out] = process.argv.slice(2);
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local pilot only');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const checks = {},
    errors = [];
  const log = (n) => {
    checks[n] = true;
    console.log(n);
  };
  p.on('pageerror', (e) => errors.push(e.message));
  p.setDefaultTimeout(10000);
  const wait = (f) => p.waitForFunction(f, undefined, { timeout: 12000 });
  try {
    await p.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
    await p.goto(origin + '/demo?view=3d&pitch=1');
    await p.waitForFunction(() => window.__ppwRoomView3d?.backend() === 'gl', undefined, {
      timeout: 60000,
    });
    await p.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('ppw_property_v2')),
        q = v.state.property,
        polygon = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 8 },
          { x: 0, y: 8 },
        ];
      Object.assign(q, {
        activeRoomId: 'qa-ground',
        activeLevelId: 'ground',
        levels: [
          { id: 'ground', name: 'Ground', index: 0 },
          { id: 'up', name: 'Upper', index: 1 },
        ],
        rooms: [
          { id: 'qa-ground', name: 'Ground room', polygon, placedItems: [], openings: [] },
          { id: 'qa-up', name: 'Upper room', polygon, placedItems: [], levelId: 'up' },
        ],
        stairs: [],
        walls: [
          {
            id: 'wall-qa',
            levelId: 'ground',
            a: { x: 2, y: 5 },
            b: { x: 7, y: 5 },
            thicknessM: 0.15,
          },
        ],
      });
      delete q.site;
      delete q.roof;
      delete q.garden;
      delete q.foundation;
      delete q.services;
      localStorage.setItem('ppw_property_v2', JSON.stringify(v));
    });
    await p.reload();
    await p.waitForFunction(
      () =>
        window.__ppwRoomView3d?.backend() === 'gl' &&
        window.__ppwRoomView3d?.floorScreenPoint(4, 4),
      undefined,
      { timeout: 45000 },
    );
    const state = () =>
      p.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
    const move = (q) => p.mouse.move(q.x, q.y, { steps: 5 });
    const menu = p.getByRole('dialog', { name: 'Build options' });
    await p.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('ppw_property_v2')),
        q = v.state.property;
      q.rooms = q.rooms.slice(0, 1);
      q.levels = q.levels.slice(0, 1);
      q.walls = [];
      q.rooms[0].openings = Array.from({ length: 4 }, (_, edgeIndex) => ({
        id: 'door-' + edgeIndex,
        kind: 'door',
        edgeIndex,
        offsetM: 4,
        widthM: 1,
        flipFacing: false,
        flipHand: false,
      }));
      q.rooms[0].placedItems = [
        [2, 2],
        [5, 2],
        [7, 3],
        [3, 5],
        [7, 6],
      ].map(([x, y], i) => ({
        instanceId: 'product-' + i,
        productId: 'courts-pendant-lamp-7254',
        x,
        y,
        rotation: 0,
      }));
      localStorage.setItem('ppw_property_v2', JSON.stringify(v));
    });
    await p.reload();
    await p.getByRole('button', { name: 'Open Walk mode', exact: true }).click({ timeout: 45000 });
    await p.getByRole('button', { name: 'Start walk', exact: true }).click();
    await p.getByRole('button', { name: 'Build from here', exact: true }).click({ timeout: 45000 });
    await p.getByLabel('Walk build tool', { exact: true }).selectOption('select');
    const candidates = async (k) =>
      p.evaluate((k) => {
        const b = window.__ppwRoomView3d,
          r = JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.rooms[0];
        return (k === 'opening' ? r.openings : r.placedItems)
          .map((item) => {
            const id = item.id || item.instanceId;
            return {
              id,
              q: k === 'opening' ? b.openingScreenPoint(id) : b.itemScreenPoint(id),
              x: item.x,
              y: item.y,
            };
          })
          .filter(
            ({ q }) =>
              q &&
              q.x > 12 &&
              q.y > 95 &&
              q.x < 1265 &&
              q.y < 740 &&
              document.elementFromPoint(q.x, q.y)?.closest('[data-testid="wallpaint-3d-canvas"]'),
          );
      }, k);
    const lamps = await candidates('item');
    for (const item of lamps) {
      await p.mouse.click(item.q.x, item.q.y, { button: 'right' });
      if (!(await menu.isVisible())) continue;
      const select = menu.getByRole('button', { name: /Select product/ });
      if (!(await select.count())) {
        await p.keyboard.press('Escape');
        continue;
      }
      await select.click();
      for (const [dx, dy] of [
        [35, 8],
        [-45, 7],
        [0, 25],
        [-25, -14],
      ]) {
        await move(item.q);
        await p.mouse.down();
        await move({ x: item.q.x + dx, y: item.q.y + dy });
        await p.mouse.up();
        const moved = (await state()).rooms[0].placedItems.find((x) => x.instanceId === item.id);
        if (Math.hypot(moved.x - item.x, moved.y - item.y) > 0.02) {
          log('move a placed light from the walking camera');
          break;
        }
      }
      if (checks['move a placed light from the walking camera']) break;
    }
    if (!checks['move a placed light from the walking camera'])
      throw Error('No verified light drag, visible lamp count ' + lamps.length);
    for (const d of await candidates('opening')) {
      await p.mouse.click(d.q.x, d.q.y, { button: 'right' });
      if (!(await menu.isVisible())) continue;
      const edit = menu.getByRole('button', { name: 'Edit opening' });
      if (!(await edit.count())) {
        await p.keyboard.press('Escape');
        continue;
      }
      await edit.click();
      const field = p.getByTestId('opening-selection-editor').getByLabel('Distance along wall');
      await field.fill('4.3');
      await field.press('Enter');
      await wait(() =>
        JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.rooms[0].openings.some(
          (o) => Math.abs(o.offsetM - 4.3) < 0.001,
        ),
      );
      log('move mounted door along its wall from the walking camera');
      break;
    }
    if (!checks['move mounted door along its wall from the walking camera'])
      throw Error('No visible door selected from this walking position');
    assert.deepEqual(errors, []);
  } catch (e) {
    console.error(e.message);
    checks.failure = e.message;
    await p.screenshot({ path: out + '.png' }).catch(() => {});
  } finally {
    fs.writeFileSync(out, JSON.stringify({ checks, errors }, null, 2));
    await b.close();
    process.exitCode = checks.failure || errors.length ? 1 : 0;
  }
})();
