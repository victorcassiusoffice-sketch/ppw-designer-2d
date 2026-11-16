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

it('keeps linked invoices, periods, pay, audit and file access within the acting seats', async () => {
  const slug = await create('ledger-owner');
  const callOwner = (path: string[], method = 'GET', body?: unknown) =>
    call([slug, ...path], method, 'ledger-owner', '', body);
  const rev = async () => (await callOwner([])).body.revision;
  const seats = new Map<string, { id: string; cookie: string }>();
  async function createSeat(name: string, role: string) {
    const i = await callOwner(['members'], 'POST', {
      revision: await rev(),
      name,
      role,
      organisation: 'Trial',
      ...(role === 'checker' ? { endDate: '2099-01-01' } : {}),
    });
    expect(i.code).toBe(200);
    const join = await call([slug, 'join'], 'POST', '', '', {
      invite: i.body.join.split('#join=')[1],
    });
    const cookie = join.headers['Set-Cookie'].split(';')[0],
      id = (await call([slug], 'GET', '', cookie)).body.memberId;
    seats.set(name, { id, cookie });
    return id;
  }
  const lead = await createSeat('Lead', 'lead'),
    supplier = await createSeat('Supplier', 'technology supplier'),
    viewer = await createSeat('Viewer', 'viewer'),
    partner = await createSeat('Partner', 'tester'),
    coordinator = await createSeat('Coordinator', 'coordinator');
  await createSeat('Checker', 'checker');
  const api = (name: string, path: string[], method = 'GET', v?: unknown) =>
    name === 'Owner'
      ? callOwner(path, method, v)
      : call([slug, ...path], method, '', seats.get(name)!.cookie, v);
  const write = async (name: string, row: Record<string, unknown>, status = 200, extra = {}) => {
    const r = await api(name, [name === 'Supplier' ? 'my-finance' : 'ledger'], 'POST', {
      revision: await rev(),
      row: { ...row, version: 2 },
      ...extra,
    });
    expect(r.code, JSON.stringify(r.body)).toBe(status);
  };
  expect(
    (await callOwner(['money'], 'POST', { revision: await rev(), currency: 'EUR' })).code,
  ).toBe(200);
  await write('Owner', {
    id: 'ledger-settings',
    type: 'settings',
    timeZone: 'Indian/Mauritius',
    accountsCurrency: 'USD',
  });
  for (const [user, inv, part] of [
    [supplier, true, false],
    [partner, false, true],
  ] as const)
    await write('Owner', {
      type: 'member_marks',
      id: 'marks-' + user,
      memberId: user,
      invoices: inv,
      staff: false,
      partner: part,
    });
  const line = {
    type: 'budget_line',
    id: 'budget-trial',
    number: '4.1',
    heading: 'works',
    label: 'Restricted line',
    kind: 'ordinary',
    costType: 'supply',
    unit: 'piece',
    units: '2.5',
    unitValue: 101,
    direct: true,
    flags: [],
    note: '',
  };
  await write('Owner', line);
  const activity = (await callOwner([])).body.pilot.steps[0].id;
  const cost = {
    id: 'cost-private',
    type: 'cost_row',
    costType: 'supply',
    vehicle: false,
    line: line.id,
    whose: 'lead',
    paidBy: 'lead',
    thirdParty: 'Trial',
    ownerSupplies: false,
    description1: 'Material',
    description2: 'Trial delivery',
    documentKind: 'invoice',
    documentRef: 'Trial reference',
    documentDate: '2026-03-02',
    accountingRef: 'Trial entry',
    means: 'transfer',
    activity,
    amount: 250,
    tax: 0,
    taxNotRecoverable: false,
    currency: 'EUR',
    commitDate: '2026-03-01',
    activityDate: '2026-03-02',
    funding: 'in the budget',
    finalReport: false,
    note: 'Private note',
    state: 'committed',
    proofs: [],
  };
  await write('Owner', cost);
  await write('Owner', { ...cost, ownerSupplies: true }, 403);
  await write('Lead', { ...cost, ownerSupplies: true });
  await write('Owner', { ...line, unitValue: 111 }, 403);
  const inv = {
    type: 'invoice',
    id: 'invoice-trial',
    number: 'Trial 1',
    sender: supplier,
    date: '2026-03-02',
    amount: 200,
    tax: 0,
    currency: 'EUR',
    state: 'received',
  };
  await write('Supplier', inv);
  const assigned = { ...inv, line: line.id, costId: cost.id };
  await write('Lead', assigned);
  await write('Owner', { ...assigned, state: 'approved' }, 403);
  await write('Coordinator', { ...assigned, state: 'approved' }, 403);
  await write('Lead', { ...assigned, state: 'approved' });
  await write('Lead', { ...assigned, state: 'paid', paymentDate: '2026-03-05' });
  const hist = await api('Supplier', ['history', inv.id]);
  expect(hist.code).toBe(200);
  for (const word of [line.id, cost.id, 'Private note', 'Restricted line'])
    expect(JSON.stringify(hist.body)).not.toContain(word);
  const p = {
    id: 'period-one',
    type: 'period',
    number: 1,
    start: '2026-03-01',
    end: '2026-03-31',
    due: '2026-04-15',
    final: true,
  };
  const reportFile = await api('Lead', ['files'], 'POST', {
    revision: await rev(),
    file: { title: 'Period copy', kind: 'report', source: 'money' },
    data: Buffer.from('%PDF-1.4\n%%EOF').toString('base64'),
  });
  expect(reportFile.code).toBe(200);
  await write('Owner', p);
  await write('Coordinator', { ...p, sent: '2026-04-01', file: reportFile.body.file.id }, 403);
  await write('Lead', { ...p, sent: '2026-04-01', file: reportFile.body.file.id });
  await write('Owner', { ...cost, state: 'paid' }, 403);
  await write('Lead', {
    id: 'result-one',
    type: 'row_entry',
    kind: 'funder result',
    costId: cost.id,
    date: '2026-04-03',
    eligible: 188,
  });
  const exposure = await api('Viewer', ['me']);
  expect(JSON.stringify(exposure.body)).not.toContain(cost.id);
  expect(JSON.stringify(exposure.body)).not.toContain('member_marks');
  for (const n of ['Viewer', 'Checker', 'Partner', 'Supplier'])
    expect((await api(n, ['ledger'])).code).toBe(403);
  const pay = {
    id: 'pay-' + coordinator,
    type: 'pay_row',
    memberId: coordinator,
    role: 'coordinator',
    from: line.id,
    agreed: 250,
    state: 'agreed',
    note: '',
  };
  expect(
    (await api('Coordinator', ['money'], 'POST', { revision: await rev(), row: pay })).code,
  ).toBe(403);
  expect((await api('Lead', ['money'], 'POST', { revision: await rev(), row: pay })).code).toBe(
    200,
  );
  expect(
    (
      await api('Owner', ['money'], 'POST', {
        revision: await rev(),
        row: { ...pay, id: 'pay-' + viewer, memberId: viewer, role: 'viewer' },
      })
    ).code,
  ).toBe(403);
  expect((await api('Lead', ['me'])).body).toHaveProperty('links');
  expect((await api('Owner', [])).body).not.toHaveProperty('links');
  const pCost = { ...cost, id: 'partner-cost', whose: partner };
  await write('Owner', pCost);
  const own = await api('Partner', ['me']);
  expect(JSON.stringify(own.body)).toContain('Material');
  expect(JSON.stringify(own.body)).not.toContain(line.id);
  const changed = await callOwner(['members', supplier], 'PATCH', {
    revision: await rev(),
    role: 'host',
  });
  expect(changed.code).toBe(200);
  expect(
    (await store.marks(
      {
        id: String(
          (await db.query<{ id: string }>('select id from pilots where slug=$1', [slug])).rows[0]
            .id,
        ),
      } as Parameters<typeof store.marks>[0],
      supplier,
    )) as { invoices: boolean },
  ).toMatchObject({ invoices: false });
  expect(lead).not.toBe(viewer);
});
