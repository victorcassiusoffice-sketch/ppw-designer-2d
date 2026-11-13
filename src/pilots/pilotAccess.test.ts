// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { handlePilots } from '../../api/_lib/pilots';
import { pilotStore } from '../../api/_db/pilotStore';
import { blankPilot } from './example';
import type { Pilot, Photo } from './contract';
const db = new PGlite(),
  store = pilotStore(
    async (text, args) => (await db.query<Record<string, unknown>>(text, args)).rows,
  ),
  files = new Map<string, Buffer>();
beforeAll(async () => {
  await db.exec(readFileSync('api/_db/migrations/0033_pilots.sql', 'utf8'));
}, 20000);
afterAll(() => db.close());
type Resp = {
  slug: string;
  revision: number;
  join: string;
  pilot: Pilot;
  photo: Photo;
  pilots: { slug: string }[];
  error: string;
};
const call = async (
  parts: string[],
  method = 'GET',
  owner = '',
  cookie = '',
  data?: unknown,
  limit = false,
) => {
  const res = {
    code: 0,
    body: {} as Resp,
    jpeg: undefined as Buffer | undefined,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(n: number) {
      this.code = n;
      return this;
    },
    json(v: unknown) {
      this.body = v as Resp;
    },
    end(b?: Buffer | string) {
      this.jpeg = typeof b === 'string' ? Buffer.from(b) : b;
    },
  };
  await handlePilots(
    parts,
    { method, headers: { host: 'local.test', cookie } },
    res,
    async () => data,
    {
      db: () => store,
      owner: async () => owner,
      limited: async () => limit,
      files: {
        save: async (k, b) => {
          files.set(k, b);
        },
        read: async (k) => files.get(k) ?? null,
        discard: async (k) => {
          files.delete(k);
        },
      },
    },
  );
  return res;
};
async function create(owner: string) {
  const p = blankPilot('shared-' + randomUUID(), 'Test plot', 'Living walls');
  const { slug, name, lane, state, summary, steps } = p;
  expect(
    (
      await call([], 'POST', owner, '', {
        slug,
        name,
        lane,
        state,
        summary,
        steps,
        lead: { name: 'Lead', organisation: 'Example Lab' },
      })
    ).code,
  ).toBe(200);
  return slug;
}
it('keeps invitations, files, authorship and revisions scoped to a single pilot', async () => {
  const slug = await create('A'),
    other = await create('B');
  expect((await call([slug], 'GET', 'B')).code).toBe(403);
  expect((await call([])).code).toBe(403);
  const write = (path: string, method: string, owner: string, cookie: string, data: unknown) =>
    call([slug, ...path.split('/').filter(Boolean)], method, owner, cookie, data);
  const site = {
    id: 'wall',
    name: 'Test wall',
    kind: 'test rack',
    place: 'Blue Bay',
    state: 'concept',
    lat: -20.4,
    lon: 57.7,
  };
  expect(
    (
      await write('items', 'POST', 'A', '', {
        revision: 1,
        kind: 'site',
        id: 'wall',
        payload: site,
      })
    ).code,
  ).toBe(200);
  const invite = await write('members', 'POST', 'A', '', {
    revision: 2,
    name: 'Tester',
    organisation: 'Example Lab',
    role: 'tester',
  });
  expect(invite.code).toBe(200);
  const token = invite.body.join.split('#join=')[1];
  expect((await call([other, 'join'], 'POST', '', '', { invite: token })).code).toBe(403);
  expect((await call([slug, 'join'], 'POST', '', '', { invite: token }, true)).code).toBe(429);
  const join = await write('join', 'POST', '', '', { invite: token });
  expect(join.code).toBe(200);
  const cookie = join.headers['Set-Cookie'].split(';')[0];
  expect(join.headers['Set-Cookie']).toContain('HttpOnly; Secure; SameSite=Strict');
  expect((await write('join', 'POST', '', '', { invite: token })).code).toBe(403);
  expect((await call([], 'GET', '', cookie)).body.pilots.map((x) => x.slug)).toEqual([slug]);
  expect((await call([other], 'GET', '', cookie)).code).toBe(403);
  const member = await call([slug], 'GET', '', cookie);
  expect(member.body.revision).toBe(4);
  const note = { id: 'note-test', member: 'lead', date: '2026-11-13', text: 'Field observation' };
  expect(
    (
      await write('items', 'POST', '', cookie, {
        revision: 3,
        id: note.id,
        kind: 'note',
        payload: note,
      })
    ).code,
  ).toBe(409);
  expect(
    (
      await write('items', 'POST', '', cookie, {
        revision: 4,
        id: note.id,
        kind: 'note',
        payload: note,
      })
    ).code,
  ).toBe(200);
  expect((await call([slug], 'GET', 'A')).body.pilot.notes[0].member).not.toBe('lead');
  const photo = {
    id: 'upload',
    site: 'wall',
    date: '2026-11-13',
    member: 'lead',
    caption: 'Study',
    kind: 'photo',
    hidden: false,
  };
  const b = await sharp({ create: { width: 60, height: 40, channels: 3, background: '#667766' } })
    .jpeg()
    .toBuffer();
  const upload = { revision: 5, photo, mime: 'image/jpeg', data: b.toString('base64') };
  expect((await write('photos', 'POST', '', cookie, { ...upload, data: 'AAAA' })).code).toBe(400);
  expect((await call([slug, 'photos'], 'POST', '', cookie, upload, true)).code).toBe(429);
  const saved = await write('photos', 'POST', '', cookie, upload);
  expect(saved.code).toBe(200);
  const ph = saved.body.photo;
  expect(files.size).toBe(1);
  expect((await call([slug, 'photos', ph.id], 'GET', '', cookie)).jpeg).toEqual(b);
  expect(
    (
      await write('items/' + ph.id, 'PATCH', '', cookie, {
        revision: 6,
        id: ph.id,
        kind: 'photo',
        payload: { ...ph, hidden: true },
      })
    ).code,
  ).toBe(403);
  expect(
    (
      await write('items/' + ph.id, 'PATCH', 'A', '', {
        revision: 6,
        id: ph.id,
        kind: 'photo',
        payload: { ...ph, hidden: true },
      })
    ).code,
  ).toBe(200);
  const reloaded = await call([slug], 'GET', '', cookie);
  expect(reloaded.body.pilot.photos).toHaveLength(0);
  expect(reloaded.body.pilot.notes).toHaveLength(1);
  expect((await call([slug, 'photos', ph.id], 'GET', '', cookie)).code).toBe(403);
  expect((await call([slug, 'photos', ph.id], 'GET', 'A')).jpeg).toEqual(b);
  const v = await write('members', 'POST', 'A', '', {
    revision: 7,
    name: 'Observer',
    organisation: 'Example Lab',
    role: 'viewer',
  });
  const j = await write('join', 'POST', '', '', { invite: v.body.join.split('#join=')[1] });
  const viewer = j.headers['Set-Cookie'].split(';')[0];
  expect((await call([slug], 'GET', '', viewer)).code).toBe(200);
  expect(
    (
      await write('items', 'POST', '', viewer, {
        revision: 9,
        id: 'forbidden',
        kind: 'note',
        payload: note,
      })
    ).code,
  ).toBe(403);
  await db.exec(
    "UPDATE pilot_members SET cookie_expires=now()-interval '1 day' WHERE role='tester'",
  );
  expect((await call([slug], 'GET', '', cookie)).code).toBe(403);
}, 30000);
