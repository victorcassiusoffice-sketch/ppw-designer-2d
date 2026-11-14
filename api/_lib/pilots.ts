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
import { buildLimiter, getClientIp } from './rateLimit.js';
import type { MinReq, MinRes } from './sentry.js';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  secret = () => randomBytes(32).toString('base64url');
const joins = buildLimiter('pilot-join', 15, 600),
  uploads = buildLimiter('pilot-upload', 40, 600);
const tokenSchema = z.string().regex(/^[a-zA-Z0-9_-]{43}$/);
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
  save: (path: string, b: Buffer) => Promise<void>;
  read: (path: string) => Promise<Buffer | null>;
  discard: (path: string) => Promise<void>;
};
const blob: PhotoIo = {
  async save(path, b) {
    await put(path, b, {
      access: 'private',
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: 'image/jpeg',
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
  limited: (kind: 'join' | 'photos', req: MinReq) => Promise<boolean>;
};
const defaultDeps: Dependencies = {
  db: hostedPilots,
  owner: ownerId,
  files: blob,
  limited: async (kind, req) => {
    const v = await (kind === 'join' ? joins : uploads).check(getClientIp(req));
    return !v.success || !!v.reason;
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
        return ok({ owner: !!owner, pilots: [...new Map(rows.map((r) => [r.slug, r])).values()] });
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
    if (!action && method === 'GET') return ok(await record(db, p, isOwner, by));
    if (!action && method === 'PUT' && isOwner) {
      const v = header
        .pick({ name: true, state: true, summary: true })
        .extend({ revision })
        .parse(await body());
      return (await db.change(p, v.revision, v)) ? ok({ revision: v.revision + 1 }) : conflict();
    }
    if (action === 'members' && !key && method === 'POST' && isOwner) {
      const v = memberSchema
          .pick({ name: true, role: true, organisation: true })
          .extend({ revision })
          .parse(await body()),
        code = secret();
      const result = await db.invite(p, v.revision, { ...v, id: randomUUID() }, hash(code));
      return result
        ? ok({ revision: result.revision, join: '/pilots/' + slug + '#join=' + code })
        : conflict();
    }
    if (action === 'photos' && key && method === 'GET') {
      if (!id.safeParse(key).success) return forbidden();
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
    const v = itemWrite.parse(await body()),
      patch = method === 'PATCH';
    if (patch ? key !== v.id : !!key) return forbidden();
    if (!isOwner && !['photo', 'note', 'reading', 'log'].includes(v.kind)) return forbidden();
    const payload = validators[v.kind].parse(v.payload);
    const itemId = 'id' in payload ? payload.id : 'cam-' + payload.site;
    if (itemId !== v.id) return forbidden();
    const existing = await db.item(p, v.id);
    if (
      patch &&
      (!existing || existing.kind !== v.kind || (!isOwner && existing.created_by !== by))
    )
      return forbidden();
    if (v.kind === 'photo') {
      if (!patch || !isOwner || !existing) return forbidden();
      const old = photoSchema.parse(existing.payload),
        next = photoSchema.parse(payload);
      if (next.id !== old.id || next.site !== old.site) return forbidden();
      Object.assign(payload, old, { hidden: v.hidden ?? next.hidden });
    }
    if ('site' in payload) {
      const site = await db.item(p, payload.site);
      if (!site || site.kind !== 'site' || site.hidden) return forbidden();
    }
    if ('member' in payload && v.kind !== 'photo') payload.member = by;
    if ('photo' in payload && payload.photo) {
      const ph = await db.item(p, payload.photo);
      if (
        !ph ||
        ph.kind !== 'photo' ||
        ph.hidden ||
        photoSchema.parse(ph.payload).site !== payload.site
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
    );
    return result ? ok(result) : conflict();
  } catch (error) {
    if (error instanceof z.ZodError) return fail(400, 'Check the fields and try again.');
    return fail(503, 'Pilot storage is temporarily unavailable.');
  }
}
async function record(db: ReturnType<typeof hostedPilots>, p: Access, owner: boolean, by: string) {
  const doc = await db.document(p, owner);
  const { items, revision: rev, ...rest } = doc;
  const value: Record<string, unknown> = { ...rest };
  const editable: string[] = [];
  for (const [kind, key] of Object.entries(kindsToCollection)) {
    const group = (
      items as { kind: ItemKind; payload: Record<string, unknown>; author: string }[]
    ).filter((i) => i.kind === kind);
    value[key] = group.map((i) => i.payload);
    for (const i of group)
      if (owner || i.author === by) editable.push(String(i.payload.id ?? 'cam-' + i.payload.site));
  }
  return {
    pilot: pilotSchema.parse(value),
    revision: rev,
    owner,
    memberId: by,
    role: owner ? 'lead' : p.role,
    editable,
  };
}
