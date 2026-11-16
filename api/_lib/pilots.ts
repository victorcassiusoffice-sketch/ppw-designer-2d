import {
  managerDues,
  copyHeadingTree,
  ledgerRoute,
  personalFinance,
  financeHistory,
  seatMarks,
  allowedPayInput,
} from './pilotLedger.js';
import { dueList, ownWork, validateSample, scheduleEnd } from '../../src/pilots/running.js';
import { pilotFiles } from './pilotFiles.js';
import { rightsFor, ruleSchema, kindSection } from '../../src/pilots/access.js';
import { day } from '../../src/pilots/contract.js';
import { money, currency, managesMoney, readsMoney, type Budget } from '../../src/pilots/money.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { get, put, del } from '@vercel/blob';
import { hostedPilots, type Actor, type Access } from '../_db/pilotStore.js';
import {
  pilotSchema,
  memberSchema,
  photoSchema,
  id,
  exampleSlug,
} from '../../src/pilots/contract.js';
import {
  validators,
  itemWrite,
  revision,
  kindsToCollection,
  type ItemKind,
} from '../../src/pilots/sharedContract.js';
import { crossSiteWrite, studioAccess, requestHost } from './studioAccess.js';
import { readAdminConfig, readAdminSession } from '../../server/adminAuth.js';
import { readStudioToken } from '../../server/studioSession.js';
import { getClientIp } from './rateLimit.js';
import type { MinReq, MinRes } from './sentry.js';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  secret = () => randomBytes(32).toString('base64url');
const tokenSchema = z.string().regex(/^[a-zA-Z0-9_-]{43}$/);
function legacyMoney(payload: unknown) {
  const { version, audit, ...row } = payload as Record<string, unknown>;
  return money.parse(row);
}
function token(req: MinReq, slug: string) {
  const raw = String(req.headers.cookie ?? '');
  const val = raw
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('olb_pm_' + slug + '='))
    ?.split('=')[1];
  return val && tokenSchema.safeParse(val).success ? hash(val) : '';
}
async function ownerId(req: MinReq) {
  if ((await studioAccess(req.headers)) !== 'open') return '';
  const cfg = readAdminConfig({
      OLB_ADMIN_USERS: process.env.OLB_ADMIN_USERS,
      OLB_ADMIN_PASS_HASH: process.env.OLB_ADMIN_PASS_HASH,
      OLB_ADMIN_SECRET: process.env.OLB_ADMIN_SECRET,
    }),
    cookie = String(req.headers.cookie ?? ''),
    host = requestHost(req.headers);
  const email = cfg.ok ? await readAdminSession(cookie, cfg, host, Date.now()) : null;
  if (email) return hash('admin:' + email);
  const s = readStudioToken(cookie);
  return s ? hash('studio-workspace:' + (process.env.VERCEL_ENV || 'development')) : '';
}
const blobPath = (p: string, s: string, id: string) => 'pilots/' + p + '/' + s + '/' + id + '.jpg';
type PhotoIo = {
  save: (path: string, b: Buffer, mime?: string) => Promise<void>;
  read: (path: string) => Promise<Buffer | null>;
  discard: (path: string) => Promise<void>;
};
const blob: PhotoIo = {
  async save(path, b, mime = 'image/jpeg') {
    await put(path, b, {
      access: 'private',
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: mime,
    });
  },
  async read(path) {
    const f = await get(path, { access: 'private', useCache: false });
    return f?.statusCode === 200 ? Buffer.from(await new Response(f.stream).arrayBuffer()) : null;
  },
  async discard(path) {
    await del(path);
  },
};
function cleanJpeg(bytes: Buffer) {
  if (
    bytes.length < 4 ||
    bytes.length >= 400000 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes[bytes.length - 2] !== 255 ||
    bytes[bytes.length - 1] !== 217
  )
    return false;
  let i = 2,
    frame = false;
  while (i + 4 <= bytes.length) {
    if (bytes[i++] !== 255) return false;
    let m = bytes[i++];
    while (m === 255) m = bytes[i++];
    if (m === 218) return frame;
    if (m === 225 || m === 237 || m === 254) return false;
    if (i + 2 > bytes.length) return false;
    const len = bytes.readUInt16BE(i);
    if (len < 2 || i + len > bytes.length) return false;
    if ([192, 193, 194].includes(m)) {
      if (len < 8) return false;
      const h = bytes.readUInt16BE(i + 3),
        w = bytes.readUInt16BE(i + 5);
      if (Math.min(h, w) < 1 || Math.max(h, w) > 1600) return false;
      frame = true;
    }
    i += len;
  }
  return false;
}
const header = pilotSchema.pick({ slug: true, name: true, lane: true, state: true, summary: true });
const newPilot = header.extend({
  lead: memberSchema.pick({ name: true, organisation: true }),
  steps: validators.step
    .array()
    .length(6)
    .refine((xs) => new Set(xs.map((x) => x.id)).size === 6),
});
type Dependencies = {
  db: () => ReturnType<typeof hostedPilots>;
  owner: (req: MinReq) => Promise<string>;
  files: PhotoIo;
  evidenceQuota?: number;
  limited: (kind: 'join' | 'photos', req: MinReq) => Promise<boolean>;
};
const defaultDeps: Dependencies = {
  db: hostedPilots,
  owner: ownerId,
  files: blob,
  evidenceQuota: 0,
  limited: async (kind, req) => {
    // Use the same durable Neon store as the private record. Preview isolation
    // is checked before the counter can write, even for an unclaimed link.
    return !(await hostedPilots().allowAttempt(
      kind,
      hash(getClientIp(req)),
      kind === 'join' ? 15 : 40,
    ));
  },
};
export async function handlePilots(
  parts: string[],
  req: MinReq,
  res: MinRes,
  body: () => Promise<unknown>,
  deps = defaultDeps,
) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  const fail = (status: number, error: string) => res.status(status).json({ error });
  const forbidden = () => fail(403, 'Ask the owner for your link.');
  const conflict = () => fail(409, 'The pilot changed. Reload and try again.');
  const ok = (x: unknown) => res.status(200).json(x);
  try {
    if (crossSiteWrite(req.method, req.headers)) return forbidden();
    const [slug, action, key] = parts;
    if (parts.length > 3 || (slug && !id.safeParse(slug).success) || slug === exampleSlug)
      return forbidden();
    const method = req.method;
    // This redirect receives the existing API-scoped HttpOnly cookies. A studio
    // visitor still sees the same door; only actual members reach their index.
    if (slug === 'member-index' && !action && method === 'GET') {
      const slugs = String(req.headers.cookie ?? '')
        .split(';')
        .map((c) => /^olb_pm_(shared-[a-f0-9-]{36})=/.exec(c.trim())?.[1])
        .filter((s): s is string => !!s)
        .slice(0, 100);
      let dest = '/access?next=%2Fpilots';
      for (const s of slugs)
        if (await deps.db().access(s, { owner: '', member: token(req, s) })) {
          dest = '/pilots/shared';
          break;
        }
      res.setHeader('Location', dest);
      return res.status(303).end();
    }
    if (slug && action === 'join' && !key && method === 'POST') {
      if (await deps.limited('join', req)) return fail(429, 'Try again later.');
      const { invite } = z
          .object({ invite: tokenSchema })
          .strict()
          .parse(await body()),
        c = secret();
      if (!(await deps.db().join(slug, hash(invite), hash(c)))) return forbidden();
      res.setHeader(
        'Set-Cookie',
        'olb_pm_' +
          slug +
          '=' +
          c +
          '; Path=/api/pilots; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000',
      );
      return ok({ joined: true });
    }
    const owner = await deps.owner(req),
      member = slug ? token(req, slug) : '',
      actor: Actor = { owner, member };
    const memberList =
      !slug && method === 'GET' && /\bolb_pm_/.test(String(req.headers.cookie ?? ''));
    if (!owner && !member && !memberList) return forbidden();
    const db = deps.db();
    if (!slug) {
      if (method === 'GET') {
        const memberSlugs = String(req.headers.cookie ?? '')
          .split(';')
          .map((x) => /^olb_pm_([a-z0-9-]{1,80})=/.exec(x.trim())?.[1])
          .filter((x): x is string => !!x)
          .slice(0, 100);
        const rows = owner ? await db.list({ owner, member: '' }) : [];
        for (const s of memberSlugs) {
          const access = await db.access(s, { owner: '', member: token(req, s) });
          if (access)
            rows.push({ slug: s, name: access.name, lane: access.lane, state: access.state });
        }
        if (!owner && !rows.length) return forbidden();
        const sites = owner ? await db.programme(owner) : [];
        return ok({
          owner: !!owner,
          sites,
          pilots: [...new Map(rows.map((r) => [r.slug, r])).values()],
        });
      }
      if (!owner || method !== 'POST') return forbidden();
      const p = newPilot.parse(await body());
      if (!/^shared-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.slug))
        return fail(400, 'Invalid shared pilot address.');
      const result = await db.create(randomUUID(), owner, p, p.lead, p.steps);
      return result ? ok({ slug: p.slug, revision: 1 }) : conflict();
    }
    if (!owner && !member) return forbidden();
    const p = await db.access(slug, actor);
    if (!p) return forbidden();
    const isOwner = !!owner && p.owner_id === owner,
      by = isOwner ? 'lead' : p.member_id!;
    const rights = rightsFor(p.role_rules, isOwner, p.role);
    if (!isOwner && p.role === 'checker' && method !== 'GET') return forbidden();
    if (action === 'checker-log' && !key && method === 'GET')
      return managesMoney(isOwner, p.role)
        ? ok({ entries: (await db.checkerLog(p)).map((r) => r.payload) })
        : forbidden();
    if (action === 'csv' && key && method === 'GET') {
      if (
        !readsMoney(isOwner, p.role) ||
        !['costs', 'internal', 'rates', 'pay', 'hours', 'pending', 'assets', 'sources'].includes(
          key,
        )
      )
        return forbidden();
      if (!isOwner) await db.checkerRead(p, 'csv/' + key, []);
      return ok({ allowed: true });
    }
    if (action === 'copy-tree' && !key && method === 'POST' && isOwner)
      return (await copyHeadingTree(db, p, isOwner, await body()))
        ? ok({ saved: true })
        : forbidden();
    if (action === 'ledger' || action === 'my-finance')
      return await ledgerRoute(db, p, isOwner, by, action === 'my-finance', key, method, body, res);
    if (action === 'files')
      return await pilotFiles(
        db,
        p,
        isOwner,
        by,
        deps.files,
        deps.evidenceQuota ?? 0,
        method,
        key,
        body,
        res,
      );
    if (action === 'rules' && !key && method === 'PUT' && isOwner) {
      const v = z
        .object({ revision, rules: ruleSchema })
        .strict()
        .parse(await body());
      return (await db.rules(p, v.revision, v.rules)) ? ok({ saved: true }) : conflict();
    }
    if (!isOwner && ['viewer', 'checker'].includes(p.role ?? '') && method !== 'GET')
      return forbidden();
    if (action === 'me' && !key && method === 'GET') {
      // Even a studio owner must present this pilot's personal member cookie.
      if (!member || !p.member_id || !p.role || !p.first_name || !p.expires) return forbidden();
      const personal = rightsFor(p.role_rules, false, p.role);
      const rows = (await db.dashboard(p, p.member_id)).filter((row) => {
        const section = kindSection[String(row.kind)];
        return !section || personal[section] !== 'none';
      });
      const steps = rows
        .filter((r) => r.kind === 'step')
        .reverse()
        .map((r) => validators.step.parse(r.payload))
        .filter((s) => s.state !== 'done');
      const role = p.role.toLowerCase(),
        next =
          steps.find((s) =>
            (' ' + (s.note ?? '').toLowerCase().replace(/[^a-z]+/g, ' ') + ' ').includes(
              ' ' + role + ' ',
            ),
          ) ?? steps[0];
      const activity = rows.flatMap((r) => {
        if (r.kind === 'photo') {
          const ph = validators.photo.parse(r.payload);
          return [{ kind: 'photo', id: ph.id, date: ph.date, label: ph.caption || 'Wall photo' }];
        }
        if (r.kind === 'note') {
          const n = validators.note.parse(r.payload);
          return [{ kind: 'note', id: n.id, date: n.date, label: n.text }];
        }
        if (r.kind === 'reading') {
          const n = validators.reading.parse(r.payload);
          return [
            { kind: 'reading', id: n.id, date: n.month, label: n.cover + '% · ' + n.condition },
          ];
        }
        if (r.kind === 'log') {
          const n = validators.log.parse(r.payload);
          return [
            {
              kind: 'log',
              id: n.id,
              date: n.date,
              label: n.type + ' · ' + n.quantity + ' ' + n.unit,
            },
          ];
        }
        return [];
      });
      const { showPay, ...personalMoney } = await personalFinance(db, p, p.member_id, p.role);
      const financial = rows.filter((r) => r.kind === 'money').map((r) => legacyMoney(r.payload));
      const own = financial.find((r) => r.type === 'pay_row' && r.memberId === p.member_id),
        unit = financial.find((r) => r.type === 'budget_line' && r.id === 'book-currency');
      return ok({
        ...ownWork(
          (await record(db, p, false, p.member_id)).pilot,
          p.role,
          p.member_id,
          new Date().toLocaleDateString('en-CA', { timeZone: 'Indian/Mauritius' }),
        ),
        pilot: p.name,
        name: p.first_name,
        role: p.role,
        nearExpiry: Date.parse(p.expires) - Date.now() <= 5 * 86400000,
        ...(Object.keys(personalMoney).length ? { finance: personalMoney } : {}),
        ...(!isOwner && p.role === 'lead'
          ? { links: (await db.links(p)).map((r) => r.payload) }
          : {}),
        next: next ?? null,
        activity,
        pay:
          showPay && own?.type === 'pay_row' && unit?.type === 'budget_line'
            ? { agreed: own.agreed, currency: unit.currency, state: own.state }
            : null,
      });
    }
    if (action === 'money' && !key) {
      if (!(method === 'GET' ? readsMoney(isOwner, p.role) : managesMoney(isOwner, p.role)))
        return forbidden();
      const rows = (await db.money(p)).map((r) => legacyMoney(r.payload));
      if (!isOwner && method === 'GET')
        await db.checkerRead(
          p,
          'money',
          rows.map((r) => r.id),
        );
      const setting = rows.find(
        (x): x is Budget => x.type === 'budget_line' && x.id === 'book-currency',
      );
      if (method === 'GET')
        return ok({
          revision: p.revision,
          currency: setting?.currency ?? null,
          rows: rows.filter((x) => x !== setting),
        });
      if (method !== 'POST') return forbidden();
      const value = await body();
      if (
        typeof value === 'object' &&
        value &&
        'row' in value &&
        typeof value.row === 'object' &&
        value.row &&
        'version' in value.row
      )
        return await ledgerRoute(
          db,
          p,
          isOwner,
          by,
          false,
          undefined,
          'POST',
          async () => value,
          res,
        );
      const select = z.object({ revision, currency }).strict().safeParse(value);
      if (select.success) {
        if (!isOwner || setting) return forbidden();
        const row: Budget = {
          id: 'book-currency',
          type: 'budget_line',
          currency: select.data.currency,
          label: 'Currency',
          category: 'other',
          planned: 0,
          committed: 0,
          spent: 0,
          state: 'planned',
          note: '',
        };
        return (await db.saveItem(
          p,
          select.data.revision,
          'money',
          row.id,
          row,
          by,
          false,
          false,
          true,
        ))
          ? ok({ saved: true })
          : conflict();
      }
      const v = z
        .object({ revision, row: money, hide: z.boolean().optional() })
        .strict()
        .parse(value);
      if (!setting) return fail(400, 'Choose a currency first.');
      const row = v.row,
        prior = await db.item(p, row.id);
      if (
        row.id === 'book-currency' ||
        (prior &&
          (prior.hidden || prior.kind !== 'money' || legacyMoney(prior.payload).type !== row.type))
      )
        return forbidden();
      if (row.type === 'budget_line') return fail(400, 'Save the line with units and a cost type.');
      {
        const member = await db.memberRole(p, row.memberId),
          line = await db.item(p, row.from);
        if (
          !member ||
          member.role !== row.role ||
          !allowedPayInput(
            row.role,
            row.memberId,
            by,
            isOwner,
            p.role,
            await seatMarks(db, p, row.memberId),
          ) ||
          row.id !== 'pay-' + row.memberId ||
          row.from === setting.id ||
          line?.kind !== 'money' ||
          line.hidden ||
          (line?.payload as { type?: string } | undefined)?.type !== 'budget_line'
        )
          return forbidden();
      }
      if (v.hide && !prior) return forbidden();
      const at = new Date().toISOString(),
        stamp = { seat: isOwner ? 'owner' : by, link: isOwner ? null : p.link_id, at },
        logId = randomUUID();
      const pay = { ...row, version: 2, audit: { typedBy: stamp } };
      return (await db.ledgerCommit(
        p,
        v.revision,
        [
          { id: row.id, payload: pay, hidden: !!v.hide },
          {
            id: logId,
            hidden: false,
            payload: {
              id: logId,
              type: 'change_log',
              version: 2,
              record: row.id,
              at,
              who: stamp,
              before: prior?.payload ?? null,
              after: pay,
              reason: '',
              fields: Object.keys(row),
            },
          },
        ],
        by,
      ))
        ? ok({ saved: true })
        : conflict();
    }
    if (!action && method === 'GET') {
      const doc = await record(db, p, isOwner, by);
      return ok({
        ...doc,
        ...(managesMoney(isOwner, p.role) ? { moneyDue: await managerDues(db, p) } : {}),
        ...(isOwner || p.role === 'lead'
          ? {
              due: dueList(
                doc.pilot,
                new Date().toLocaleDateString('en-CA', { timeZone: 'Indian/Mauritius' }),
              ),
            }
          : {}),
      });
    }
    if (action === 'history' && key && method === 'GET') {
      const target = await db.item(p, id.parse(key));
      if (target?.kind === 'money' || key.startsWith('own-')) {
        const entries = await financeHistory(db, p, isOwner, key);
        if (entries && !isOwner) await db.checkerRead(p, 'history', [key]);
        return entries ? ok({ entries }) : forbidden();
      }
      const current = await db.item(p, id.parse(key)),
        section = kindSection[String(current?.kind)];
      if (
        !current ||
        current.hidden ||
        !section ||
        rights[section] === 'none' ||
        !Object.prototype.hasOwnProperty.call(validators, String(current.kind))
      )
        return forbidden();
      const full = await record(db, p, isOwner, by);
      return ok({
        entries: (await db.history(p, key)).map((r) => ({
          at: r.created,
          entry: safeEntry(
            String(current.kind),
            r.entry as Record<string, unknown>,
            rights,
            full.pilot.readingTypes ?? [],
          ),
        })),
      });
    }
    if (!action && method === 'PUT' && isOwner) {
      const v = header
        .pick({ name: true, state: true, summary: true })
        .extend({ revision })
        .parse(await body());
      return (await db.change(p, v.revision, v)) ? ok({ revision: v.revision + 1 }) : conflict();
    }
    if (action === 'members' && key && method === 'PATCH' && isOwner) {
      const v = memberSchema
        .pick({ role: true })
        .extend({ revision, endDate: day.optional() })
        .strict()
        .refine((m) => (m.role === 'checker' ? !!m.endDate : !m.endDate))
        .parse(await body());
      const code = secret();
      return (await db.changeRole(
        p,
        v.revision,
        id.parse(key),
        v.role,
        v.endDate ?? null,
        hash(code),
      ))
        ? ok({ join: '/pilots/' + slug + '#join=' + code })
        : conflict();
    }
    if (action === 'members' && key && method === 'POST' && isOwner) {
      const v = z
          .object({ revision })
          .strict()
          .parse(await body()),
        code = secret();
      const updated = await db.renew(p, v.revision, id.parse(key), hash(code));
      return updated ? ok({ join: '/pilots/' + slug + '#join=' + code }) : conflict();
    }
    if (action === 'members' && !key && method === 'POST' && isOwner) {
      const v = memberSchema
          .pick({ name: true, role: true, organisation: true })
          .extend({ revision, endDate: day.optional() })
          .strict()
          .refine((m) => (m.role === 'checker' ? !!m.endDate : !m.endDate))
          .parse(await body()),
        code = secret();
      const result = await db.invite(p, v.revision, { ...v, id: randomUUID() }, hash(code));
      return result
        ? ok({ revision: result.revision, join: '/pilots/' + slug + '#join=' + code })
        : conflict();
    }
    if (action === 'photos' && key && method === 'GET') {
      if (rights.notes === 'none' || !id.safeParse(key).success) return forbidden();
      const item = await db.item(p, key);
      if (!item || item.kind !== 'photo' || (item.hidden && !isOwner)) return forbidden();
      const ph = photoSchema.parse(item.payload),
        b = await deps.files.read(blobPath(p.id, ph.site, ph.id));
      if (!b) return fail(404, 'Photo unavailable.');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      (res.status(200) as unknown as { end: (b: Buffer) => void }).end(b);
      return;
    }
    if (!isOwner && p.role === 'viewer') return forbidden();
    if (action === 'photos' && !key && method === 'POST') {
      if (rights.notes !== 'add') return forbidden();
      if (deps.evidenceQuota === 0)
        return fail(400, 'File storage is off. Add an outside link to the paper.');
      if (await deps.limited('photos', req)) return fail(429, 'Try again later.');
      const v = z
          .object({
            revision,
            photo: photoSchema,
            mime: z.literal('image/jpeg'),
            data: z.string().max(533336),
          })
          .strict()
          .parse(await body()),
        b = Buffer.from(v.data, 'base64');
      if (!cleanJpeg(b)) return fail(400, 'Choose a resized JPEG under 400 KB.');
      const site = await db.item(p, v.photo.site);
      if (site?.kind !== 'site' || site.hidden) return forbidden();
      if (p.revision !== v.revision) return conflict();
      const ph = { ...v.photo, id: randomUUID(), member: by, hidden: false },
        path = blobPath(p.id, ph.site, ph.id);
      await deps.files.save(path, b);
      const saved = await db.saveItem(p, v.revision, 'photo', ph.id, ph, by, false, false);
      if (!saved) {
        await deps.files.discard(path);
        return conflict();
      }
      return ok({ revision: saved.revision, photo: ph });
    }
    if (action !== 'items' || !['POST', 'PATCH'].includes(method ?? '')) return forbidden();
    const itemBody = await body();
    if (
      typeof itemBody === 'object' &&
      itemBody !== null &&
      'kind' in itemBody &&
      itemBody.kind === 'money'
    ) {
      const proposed = z
        .object({
          revision,
          id,
          kind: z.literal('money'),
          payload: z.object({ id }).passthrough(),
          hidden: z.boolean().optional(),
          reason: z.string().max(300).optional(),
        })
        .strict()
        .parse(itemBody);
      if ((key && key !== proposed.id) || proposed.id !== proposed.payload.id) return forbidden();
      return await ledgerRoute(
        db,
        p,
        isOwner,
        by,
        false,
        undefined,
        'POST',
        async () => ({
          revision: proposed.revision,
          row: proposed.payload,
          hide: proposed.hidden,
          reason: proposed.reason,
        }),
        res,
      );
    }
    const v = itemWrite.parse(itemBody),
      patch = method === 'PATCH';
    if (patch ? key !== v.id : !!key) return forbidden();
    const section = kindSection[v.kind];
    const existing = await db.item(p, v.id);
    const oldPaper =
      v.kind === 'paper' && existing?.kind === 'paper'
        ? validators.paper.parse(existing.payload)
        : null;
    const assignedPaper =
      !!oldPaper &&
      rights.papers !== 'none' &&
      (oldPaper.ownerMember ? oldPaper.ownerMember === by : oldPaper.ownerRole === p.role);
    if (!isOwner && ['camera', 'schedule', 'readingType', 'baseline'].includes(v.kind))
      return forbidden();
    if (!isOwner && (!section || (rights[section] !== 'add' && !assignedPaper))) return forbidden();
    const payload = validators[v.kind].parse(v.payload);
    const itemId = 'id' in payload ? payload.id : 'cam-' + payload.site;
    if (itemId !== v.id) return forbidden();
    if (Buffer.byteLength(JSON.stringify(payload)) > 12500)
      return fail(400, 'Use fewer fields or shorter notes.');
    if (v.kind === 'paper') {
      const paper = validators.paper.parse(payload);
      if (paper.ownerMember && (paper.ownerRole || !(await db.memberRole(p, paper.ownerMember))))
        return forbidden();
      if (
        !isOwner &&
        (paper.ownerRole !== oldPaper?.ownerRole || paper.ownerMember !== oldPaper?.ownerMember)
      )
        return forbidden();
    }
    if (v.kind === 'step') {
      const step = validators.step.parse(payload);
      if (step.startMonth && step.endMonth && step.startMonth > step.endMonth)
        return fail(400, 'The end month must follow the start month.');
    }
    if (v.kind === 'schedule') {
      const s = validators.schedule.parse(payload);
      if (s.end !== scheduleEnd(s.start, s.months)) return fail(400, 'Check the end date.');
    }
    if (v.kind === 'readingType')
      for (const t of validators.readingType.parse(payload).targets) {
        const site = await db.item(p, t.site);
        if (site?.kind !== 'site' || site.hidden) return forbidden();
      }
    if (v.kind === 'sample') {
      const sample = validators.sample.parse(payload),
        row = await db.item(p, sample.typeId);
      if (row?.kind !== 'readingType' || row.hidden) return forbidden();
      const t = validators.readingType.parse(row.payload);
      if (!validateSample(sample, t)) return fail(400, 'Check the reading fields and range.');
      for (const f of t.fields.filter((f) => f.kind === 'photo')) {
        const photo = await db.item(p, String(sample.values[f.id]));
        if (
          rights.notes === 'none' ||
          photo?.kind !== 'photo' ||
          photo.hidden ||
          photoSchema.parse(photo.payload).site !==
            t.targets.find((x) => x.id === sample.targetId)?.site
        )
          return forbidden();
      }
    }
    if (v.kind === 'log') {
      const log = validators.log.parse(payload);
      if (log.ticket) {
        const file = await db.item(p, log.ticket);
        const proof = file?.payload as { money?: boolean; kind?: string } | undefined;
        if (
          rights.papers === 'none' ||
          file?.kind !== 'file' ||
          file.hidden ||
          proof?.money ||
          proof?.kind !== 'ticket'
        )
          return forbidden();
      }
    }
    if (
      patch &&
      (!existing ||
        existing.kind !== v.kind ||
        (!isOwner && !assignedPaper && existing.created_by !== by))
    )
      return forbidden();
    if (v.kind === 'photo') {
      if (!patch || !existing || (!isOwner && (v.hidden || photoSchema.parse(payload).hidden)))
        return forbidden();
      const old = photoSchema.parse(existing.payload),
        next = photoSchema.parse(payload);
      if (next.id !== old.id || next.site !== old.site) return forbidden();
      Object.assign(payload, old, { caption: next.caption, hidden: v.hidden ?? next.hidden });
    }
    if ('site' in payload) {
      const site = await db.item(p, payload.site);
      if (!site || site.kind !== 'site' || site.hidden) return forbidden();
    }
    if ('member' in payload && v.kind !== 'photo') payload.member = by;
    if ('photo' in payload && payload.photo) {
      const ph = await db.item(p, payload.photo);
      if (
        rights.notes === 'none' ||
        !ph ||
        ph.kind !== 'photo' ||
        ph.hidden ||
        ('site' in payload && photoSchema.parse(ph.payload).site !== payload.site)
      )
        return forbidden();
    }
    const result = await db.saveItem(
      p,
      v.revision,
      v.kind,
      v.id,
      payload,
      by,
      patch,
      v.hidden ?? ('hidden' in payload && payload.hidden),
      false,
      assignedPaper,
    );
    return result ? ok(result) : conflict();
  } catch (error) {
    if (error instanceof z.ZodError) return fail(400, 'Check the fields and try again.');
    return fail(503, 'Pilot storage is temporarily unavailable.');
  }
}
function safeEntry(
  kind: string,
  entry: Record<string, unknown>,
  rights: ReturnType<typeof rightsFor>,
  types: NonNullable<import('../../src/pilots/contract.js').Pilot['readingTypes']>,
) {
  const out = { ...entry };
  if (rights.notes === 'none') {
    delete out.photo;
    if (kind === 'sample') {
      const t = types.find((t) => t.id === entry.typeId),
        values = { ...(entry.values as Record<string, unknown>) };
      if (!t) return { ...out, values: {} };
      for (const f of t.fields.filter((f) => f.kind === 'photo')) delete values[f.id];
      out.values = values;
    }
  }
  if (rights.papers === 'none') delete out.ticket;
  return out;
}
async function record(db: ReturnType<typeof hostedPilots>, p: Access, owner: boolean, by: string) {
  const doc = await db.document(p, owner);
  const { items, revision: rev, ...rest } = doc;
  const value: Record<string, unknown> = { ...rest };
  const rights = rightsFor(p.role_rules, owner, p.role);
  if (rights.team === 'none') value.members = [];
  const editable: string[] = [];
  for (const [kind, key] of Object.entries(kindsToCollection)) {
    const group = (
      items as { kind: ItemKind; payload: Record<string, unknown>; author: string }[]
    ).filter(
      (i) => i.kind === kind && (!kindSection[kind] || rights[kindSection[kind]!] !== 'none'),
    );
    const types =
      kind === 'sample'
        ? (items as { kind: string; payload: unknown }[])
            .filter((r) => r.kind === 'readingType')
            .map((r) => validators.readingType.parse(r.payload))
        : [];
    value[key] = group.map((i) => safeEntry(kind, i.payload, rights, types));
    for (const i of group)
      if (
        owner ||
        (kind === 'paper' &&
          !['checker', 'viewer'].includes(p.role ?? '') &&
          (i.payload.ownerMember
            ? i.payload.ownerMember === by
            : i.payload.ownerRole === p.role)) ||
        (kindSection[kind] && rights[kindSection[kind]!] === 'add' && i.author === by)
      )
        editable.push(String(i.payload.id ?? 'cam-' + i.payload.site));
  }
  return {
    pilot: pilotSchema.parse(value),
    revision: rev,
    owner,
    memberId: by,
    role: owner ? 'lead' : p.role,
    editable,
    rights,
    ...(owner ? { rules: p.role_rules } : {}),
  };
}
