// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
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
  await db.exec(readFileSync('api/_db/migrations/0034_pilot_access.sql', 'utf8'));
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
  file: { id: string; sha256: string };
  files: { id: string }[];
  memberId: string;
};
const call = async (
  parts: string[],
  method = 'GET',
  owner = '',
  cookie = '',
  data?: unknown,
  limit = false,
  quota = 1500000,
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
      evidenceQuota: quota,
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

it('enforces record and file rights across seats, requests, renewal and checker expiry', async () => {
  const slug = await create('owner'),
    other = await create('outside');
  const make = (path: string[], method: string, data?: unknown) =>
    call([slug, ...path], method, 'owner', '', data);
  const rev = async () => (await make([], 'GET')).body.revision;
  async function seat(role: string) {
    const joined = await make(['members'], 'POST', {
      revision: await rev(),
      role,
      name: 'Seat',
      organisation: 'Trial',
      ...(role === 'checker' ? { endDate: '2099-01-01' } : {}),
    });
    expect(joined.code).toBe(200);
    const invite = joined.body.join.split('#join=')[1];
    const signed = await call([slug, 'join'], 'POST', '', '', { invite });
    expect(signed.code).toBe(200);
    const cookie = signed.headers['Set-Cookie'].split(';')[0],
      record = await call([slug], 'GET', '', cookie);
    return { id: record.body.memberId, cookie };
  }
  const lead = await seat('lead'),
    checker = await seat('checker'),
    viewer = await seat('viewer'),
    supplier = await seat('technology supplier'),
    host = await seat('host');
  const access = (who: typeof lead, path: string[], method = 'GET', data?: unknown) =>
    call([slug, ...path], method, '', who.cookie, data);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
  const upload = async (kind: string, body = pdf, extra = {}) =>
    make(['files'], 'POST', {
      revision: await rev(),
      file: { kind, title: 'Trial evidence', ...extra },
      data: body.toString('base64'),
    });
  const evidence = await upload('ticket');
  expect(evidence.code).toBe(200);
  const id = evidence.body.file.id,
    proof = await upload('invoice'),
    money = proof.body.file.id;
  expect(evidence.body.file.sha256).toBe(createHash('sha256').update(pdf).digest('hex'));
  const downloaded = await access(checker, ['files', id]);
  expect(downloaded.jpeg).toEqual(pdf);
  expect(downloaded.headers['X-Content-Type-Options']).toBe('nosniff');
  expect(downloaded.headers['Content-Disposition']).toMatch(/^attachment/);
  expect((await access(lead, ['files', money])).code).toBe(200);
  for (const seat of [checker, host, supplier, viewer]) {
    expect((await access(seat, ['files', money])).code).toBe(403);
    expect(JSON.stringify((await access(seat, ['files'])).body)).not.toContain(money);
  }
  const papers = { id: 'paper-private', title: 'Confidential example', state: 'needed', note: '' };
  expect(
    (
      await make(['items'], 'POST', {
        revision: await rev(),
        kind: 'paper',
        id: papers.id,
        payload: papers,
      })
    ).code,
  ).toBe(200);
  expect((await access(viewer, [])).body.pilot.papers).toEqual([]);
  for (const path of [['items'], ['photos'], ['files'], ['members'], ['money']])
    expect((await access(checker, path, 'POST', {})).code).toBe(403);
  expect((await call([other], 'GET', '', checker.cookie)).code).toBe(403);
  expect(
    (await make(['rules'], 'PUT', { revision: await rev(), rules: { viewer: { money: 'read' } } }))
      .code,
  ).toBe(400);
  expect(
    (await make(['rules'], 'PUT', { revision: await rev(), rules: { checker: { notes: 'add' } } }))
      .code,
  ).toBe(400);
  expect(
    (
      await make(['rules'], 'PUT', {
        revision: await rev(),
        rules: { host: { papers: 'none', team: 'none' } },
      })
    ).code,
  ).toBe(200);
  expect((await access(host, [])).body.pilot.members).toEqual([]);
  expect((await access(host, ['files', id])).code).toBe(403);
  expect((await upload('permit', Buffer.from('hello'))).code).toBe(400);
  expect((await upload('permit', Buffer.alloc(1000001))).code).toBe(400);
  const tinyQuota = await call(
    [slug, 'files'],
    'POST',
    'owner',
    '',
    {
      revision: await rev(),
      file: { kind: 'other', title: 'Too much' },
      data: pdf.toString('base64'),
    },
    false,
    1,
  );
  expect(tinyQuota.code).toBe(400);
  expect(tinyQuota.body.error).toContain('limit');
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#555' } })
    .withMetadata({ density: 200 })
    .jpeg()
    .toBuffer();
  const file = await upload('other', image);
  expect(file.code).toBe(200);
  const cleaned = await make(['files', file.body.file.id], 'GET');
  expect((await sharp(cleaned.jpeg).metadata()).exif).toBeUndefined();
  expect((await make(['files', id], 'PATCH', { revision: await rev(), hidden: true })).code).toBe(
    200,
  );
  expect((await make(['files', id], 'GET')).code).toBe(403);
  const note = { id: 'seat-note', text: 'Contribution', date: '2026-11-15', member: lead.id };
  expect(
    (
      await access(lead, ['items'], 'POST', {
        revision: await rev(),
        kind: 'note',
        id: note.id,
        payload: note,
      })
    ).code,
  ).toBe(200);
  const renewed = await make(['members', lead.id], 'POST', { revision: await rev() });
  expect((await access(lead, [])).code).toBe(403);
  const j = await call([slug, 'join'], 'POST', '', '', {
    invite: renewed.body.join.split('#join=')[1],
  });
  expect(
    (await call([slug], 'GET', '', j.headers['Set-Cookie'].split(';')[0])).body.pilot.notes[0].id,
  ).toBe(note.id);
  await db.query(
    'UPDATE pilot_members SET checker_until=current_date-1 WHERE pilot_id=(SELECT id FROM pilots WHERE slug=$1) AND id=$2',
    [slug, checker.id],
  );
  for (const path of [[], ['me'], ['files'], ['files', id], ['files', money], ['money']])
    expect((await access(checker, path)).code).toBe(403);
});
