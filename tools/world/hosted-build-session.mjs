// Two independent players join an explicitly supplied disposable release room.
// Pass the invitation on stdin. Reports contain checks and counts only.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [origin, expected, report] = process.argv.slice(2);
const url = new URL(origin);
if (
  url.protocol !== 'https:' ||
  url.origin !== origin ||
  !/^[a-f0-9]{40}$/.test(expected) ||
  !report
)
  throw Error('Supply the HTTPS origin, full commit and report path.');
if (
  !['onelivebuild.com', 'designer.ppwellness.co'].includes(url.hostname) &&
  !/^ppw-designer-2d-[a-z0-9]+-victor-ppw\.vercel\.app$/.test(url.hostname)
)
  throw Error('Use a Designer release host.');
let code = '';
for await (const data of process.stdin) code += data;
code = code.trim();
if (!/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{32}$/.test(code))
  throw Error('Provide the disposable build invitation on stdin.');
const browser = await chromium.launch({
  args: [
    '--use-angle=d3d11',
    '--ignore-gpu-blocklist',
    ...(process.env.OLB_VERIFY_EDGE_IP
      ? ['--host-resolver-rules=MAP ' + url.hostname + ' ' + process.env.OLB_VERIFY_EDGE_IP]
      : []),
  ],
});
const checks = {},
  errors = [],
  network = {},
  pages = [];
let step = 'verify release';
const panel = (p) => p.getByTestId('shared-build-panel');
const state = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
const open = async (width) => {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 800 },
    hasTouch: width === 390,
  });
  const p = await context.newPage();
  pages.push(p);
  p.setDefaultTimeout(25000);
  await p.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
  await context.route('**/*', (route) => {
    const q = route.request(),
      u = new URL(q.url());
    if (
      ['GET', 'HEAD'].includes(q.method()) ||
      (u.origin === origin &&
        u.pathname.startsWith('/api/shared-projects/live/') &&
        q.method() === 'POST')
    )
      return route.continue();
    return route.abort();
  });
  p.on('pageerror', () => errors.push('page error'));
  p.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/shared-projects/live/')) {
      const k = path.split('/').pop() + ' ' + r.status();
      network[k] = (network[k] ?? 0) + 1;
    }
  });
  await p.goto(origin + '/api/healthcheck?verification=' + Date.now());
  assert.equal(JSON.parse(await p.locator('body').innerText()).commit, expected);
  await p.goto(origin + '/demo?view=3d&pitch=1');
  await p
    .locator('.world-walk-dock')
    .getByRole('button', { name: 'Shared build', exact: true })
    .click({ timeout: 60000 });
  return p;
};
async function join(p, job, avatar) {
  const ui = panel(p);
  await ui.getByLabel('Job').selectOption(job);
  await ui.getByLabel('Character').selectOption(avatar);
  await ui.getByLabel('Build access code').fill(code);
  await ui.getByRole('button', { name: 'Join build', exact: true }).click();
  await ui
    .getByRole('button', { name: 'Leave shared build', exact: true })
    .waitFor({ timeout: 45000 });
  assert.equal((await state(p)).name, 'Release verification');
}
async function draw(p, name, x) {
  await p.locator('.world-walk-dock').getByTestId('open-component-tools').click();
  const ui = p.getByTestId('boundary-editor');
  await ui.getByRole('button', { name: 'XYZ coordinates' }).click();
  await ui.getByLabel('Name', { exact: true }).fill(name);
  for (const v of [
    [x, 0, 0],
    [x + 1, 0, 0],
    [x + 1, 1, 0],
  ]) {
    for (const [i, axis] of Array.from('XYZ').entries())
      await ui.getByLabel(axis + ' metres', { exact: true }).fill(String(v[i]));
    await ui.getByRole('button', { name: 'Add vertex', exact: true }).click();
  }
  await ui.getByRole('button', { name: 'Close loop' }).click();
  await ui.getByText('Face added', { exact: true }).waitFor();
  await ui.getByRole('button', { name: 'Close component editor' }).click();
}
try {
  const first = await open(1280),
    second = await open(390);
  step = 'join two guests';
  await Promise.all([join(first, 'Architect', 'male-a'), join(second, 'Electrical', 'nadia')]);
  code = '';
  await Promise.all([
    panel(first)
      .getByText(/Electrical.*Nadia/i)
      .waitFor({ timeout: 45000 }),
    panel(second)
      .getByText(/Architect/i)
      .last()
      .waitFor({ timeout: 45000 }),
  ]);
  checks.twoInvitedPlayers = true;
  for (const p of pages) await p.getByRole('button', { name: 'Close shared build panel' }).click();
  step = 'concurrent edits';
  await Promise.all([
    draw(first, 'West verification face', 1),
    draw(second, 'East verification face', 4),
  ]);
  const both = (p) =>
    p.waitForFunction(
      () => {
        const parts =
          JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.boundaryComponents ??
          [];
        return ['West verification face', 'East verification face'].every((n) =>
          parts.some((s) => s.name === n),
        );
      },
      undefined,
      { timeout: 60000 },
    );
  await Promise.all(pages.map(both));
  checks.bothEditsOnBothClients = true;
  assert.ok(network['edit 200'] >= 2);
  step = 'reload and walk';
  await second.reload();
  await both(second);
  checks.reconnected = true;
  for (const p of pages) {
    await p.getByRole('button', { name: 'Open Walk mode', exact: true }).click();
    await p.getByRole('button', { name: 'Start walk', exact: true }).click();
  }
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () =>
          Number(document.querySelector('canvas[data-shared-players]')?.dataset.sharedPlayers) > 0,
        undefined,
        { timeout: 60000 },
      ),
    ),
  );
  checks.remoteAvatars = true;
  assert.deepEqual(errors, []);
} catch {
  checks.failedStep = step;
  process.exitCode = 1;
} finally {
  await browser.close();
  const result = { origin, commit: expected, checks, errors, network };
  await fs.writeFile(report, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
