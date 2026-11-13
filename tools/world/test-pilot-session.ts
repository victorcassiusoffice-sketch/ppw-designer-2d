/** Two independent cookie jars, deployed UI bundle or local Vite, and the actual SQL/API.
 * Only loopback is accepted. No hosted credentials, database or Blob store are used. */
import { chromium, type BrowserContext } from 'playwright';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { handlePilots } from '../../api/_lib/pilots';
import { pilotStore } from '../../api/_db/pilotStore';
const origin = process.argv[2] ?? 'http://localhost:4213',
  out = process.argv[3];
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname) || !out)
  throw Error('Supply a loopback UI origin and evidence directory');
mkdirSync(out, { recursive: true });
const db = new PGlite(),
  blobs = new Map<string, Buffer>();
await db.exec(readFileSync('api/_db/migrations/0033_pilots.sql', 'utf8'));
const repository = pilotStore(
  async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows,
);
const browser = await chromium.launch();
const errors: string[] = [];
const checkpoints: string[] = [];
async function context(owner: boolean, width: number, height: number) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: width < 500,
    serviceWorkers: 'block',
  });
  await ctx.route('**/api/pilots**', async (route) => {
    const req = route.request(),
      parts = new URL(req.url()).pathname.split('/').filter(Boolean).slice(2);
    const headers: Record<string, string> = {};
    let status = 200,
      body: string | Buffer = '';
    const response = {
      setHeader(k: string, v: string) {
        headers[k] = v;
      },
      status(code: number) {
        status = code;
        return this;
      },
      json(v: unknown) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(v);
      },
      end(v?: string | Buffer) {
        body = v ?? '';
      },
    };
    const cookie = (await ctx.cookies(req.url())).map((c) => c.name + '=' + c.value).join('; ');
    await handlePilots(
      parts,
      { method: req.method(), headers: { host: new URL(origin).host, cookie } },
      response,
      async () => req.postDataJSON(),
      {
        owner: async () => (owner ? 'test-studio' : ''),
        db: () => repository,
        limited: async () => false,
        files: {
          save: async (k, b) => {
            blobs.set(k, b);
          },
          read: async (k) => blobs.get(k) ?? null,
          discard: async (k) => {
            blobs.delete(k);
          },
        },
      },
    );
    await route.fulfill({ status, headers, body });
  });
  ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  return ctx;
}
async function api(ctx: BrowserContext, url: string) {
  const page = await ctx.newPage();
  const response = await page.goto(origin + url);
  await page.close();
  return response!.status();
}
try {
  const owner = await context(true, 1280, 800),
    member = await context(false, 390, 844),
    stranger = await context(false, 313, 567);
  const host = await owner.newPage(),
    guest = await member.newPage();
  const create = async (name: string) => {
    await host.goto(origin + '/pilots');
    await host.getByText('New shared pilot', { exact: true }).click();
    await host.getByLabel('Shared pilot name').fill(name);
    await host.getByLabel('Pilot lane').fill('Living walls');
    await host.getByLabel('Lead first name').fill('Lead');
    await host.getByLabel('Lead organisation').fill('Example Lab');
    await host.getByRole('button', { name: 'Create shared pilot' }).click();
    await host.getByRole('heading', { name, exact: true }).first().waitFor();
    return new URL(host.url()).pathname;
  };
  const second = await create('Second test plot'),
    first = await create('Shared test plot');
  await host.getByText('Add site', { exact: true }).click();
  await host.getByLabel('Site name').fill('Test wall');
  await host.getByLabel('Place', { exact: true }).fill('Blue Bay');
  await host.getByLabel('Latitude').fill('-20.4');
  await host.getByLabel('Longitude').fill('57.7');
  await host.getByRole('button', { name: 'Save site' }).click();
  await host.locator('#sites').getByRole('heading', { name: 'Test wall' }).waitFor();
  await host.getByText('Invite a member', { exact: true }).click();
  await host.getByLabel('First name', { exact: true }).fill('Tester');
  await host.getByLabel('Organisation', { exact: true }).fill('Example Lab');
  await host.getByLabel('Role', { exact: true }).selectOption('tester');
  await host.getByRole('button', { name: 'Make join link' }).click();
  const invite = await host.getByLabel('Join address').inputValue();
  await host.getByRole('button', { name: 'Dismiss address' }).click();
  await guest.goto(invite);
  await guest.getByRole('heading', { name: 'Shared test plot', exact: true }).first().waitFor();
  assert(!guest.url().includes('join='));
  assert.equal(await guest.getByText('Invite a member', { exact: true }).count(), 0);
  checkpoints.push('Member entered by one-use link; address cleared; owner controls hidden.');
  await guest
    .locator('#notes')
    .getByLabel('Note', { exact: true })
    .fill('Member field observation');
  await guest.getByRole('button', { name: 'Add note', exact: true }).click();
  await guest.locator('#notes').getByText('Member field observation', { exact: true }).waitFor();
  await guest.getByText('Add photos', { exact: true }).click();
  await guest.getByLabel('Caption', { exact: true }).fill('Shared wall study');
  const im = await sharp({
    create: { width: 900, height: 600, background: '#79976f', channels: 3 },
  })
    .jpeg()
    .toBuffer();
  await guest
    .getByLabel('Pictures')
    .setInputFiles({ name: 'wall.jpg', mimeType: 'image/jpeg', buffer: im });
  await guest.getByRole('button', { name: 'Save photos' }).click();
  await guest.getByText('1 added to the wall.').waitFor();
  await guest.reload();
  await guest.locator('#wall img[alt="Shared wall study"]').waitFor({ state: 'attached' });
  await guest.locator('#notes').getByText('Member field observation', { exact: true }).waitFor();
  await guest.locator('#wall img').first().scrollIntoViewIfNeeded();
  await guest.screenshot({ path: join(out, 'member-wall.jpg') });
  checkpoints.push('Member uploaded a JPEG and a note; both survived reload.');
  const ss = await stranger.newPage();
  await ss.goto(origin + first);
  await ss.getByText('Ask the owner for your link.', { exact: true }).waitFor();
  assert.equal(await api(stranger, '/api' + first), 403);
  assert.equal(await api(member, '/api' + second), 403);
  checkpoints.push('Stranger and wrong-pilot member received 403; no listing.');
  await host.reload();
  await host.locator('#wall').getByRole('button', { name: 'Hide photo' }).waitFor();
  await host.locator('#wall').getByRole('button', { name: 'Hide photo' }).click();
  await host.locator('#wall img[alt="Shared wall study"]').waitFor({ state: 'detached' });
  await guest.bringToFront();
  await guest
    .locator('#wall img[alt="Shared wall study"]')
    .waitFor({ state: 'detached', timeout: 18000 });
  await guest.reload();
  await guest.locator('#notes').getByText('Member field observation', { exact: true }).waitFor();
  assert.equal(await guest.locator('#wall img').count(), 0);
  await host.locator('#sites').scrollIntoViewIfNeeded();
  await host.screenshot({ path: join(out, 'owner-pilot.jpg') });
  checkpoints.push('Owner hid photo; member wall updated and stayed hidden after reload.');
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, 'two-profile.json'),
    JSON.stringify(
      { isolated: true, checkpoints, pageErrors: errors, realPhotoBlobs: blobs.size },
      null,
      2,
    ),
  );
  console.log(checkpoints.join('\n'));
} finally {
  await browser.close();
  await db.close();
}
