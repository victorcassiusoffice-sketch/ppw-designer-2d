import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  applyChanges,
  EditConflict,
  EditSchema,
  PoseSchema,
  ProfileSchema,
  sharedProperty,
  type Build,
} from '../../../src/sharedBuild/contract.js';
import { neonRoomStore, type Member, type RoomStore } from '../../_db/liveBuildStore.js';
import { hostedBlobBuildStore } from '../../_db/blobLiveBuildStore.js';
import { studioAccess, crossSiteWrite } from '../studioAccess.js';
import { isShowcaseDeployment, rejectShowcaseTransaction } from '../showcaseSafety.js';
import { validateSnapshotMeasurements } from '../designSnapshotValidation.js';
import { sharedSpecOrigins } from '../sharedSpecs.js';

type Req = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status(n: number): unknown;
  json(v: unknown): void;
  setHeader(k: string, v: string): void;
};
export interface Dependencies {
  store(): RoomStore;
  allowHost(req: Req): Promise<boolean>;
  allowOrigin?(origin: string): boolean;
  now(): number;
}
const defaults: Dependencies = {
  store: neonRoomStore,
  allowHost: async (req) => (await studioAccess(req.headers)) === 'open',
  now: Date.now,
};
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
const token = () => randomBytes(24).toString('base64url');
const match = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const capability =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/i;
const Join = ProfileSchema.extend({ code: z.string().max(80) });
const Create = ProfileSchema.extend({ model: z.unknown() });
const Sync = z.object({ revision: z.number().int().min(0), pose: PoseSchema.nullable() }).strict();
const allowedAvatars = new Set(['female-a', 'female-b', 'male-a', 'male-b', 'nadia']);
function checked(value: unknown): Build {
  const build = sharedProperty(value),
    failure = validateSnapshotMeasurements(build);
  if (failure) throw Error('Invalid measured build.');
  return build;
}
export async function handleLiveBuild(
  parts: string[],
  req: Req,
  res: Res,
  read: () => Promise<unknown>,
  dep: Dependencies = defaults,
) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization, Origin');
  const fail = (code: number, message: string) => {
    res.status(code);
    res.json({ error: message });
  };
  const method = req.method ?? 'GET',
    route = parts.join('/');
  const hosted = dep === defaults,
    preview = hosted && process.env.VERCEL_ENV === 'preview';
  const privateStore = hosted ? hostedBlobBuildStore() : null;
  // An immutable preview has its own expiring room namespace. Production
  // invitations and studio data are never opened by the rehearsal deployment.
  const rehearsal =
    preview && !!privateStore && !/^(true|1)$/i.test(process.env.DEMO_ONLY?.trim() ?? '');
  const readOnly = isShowcaseDeployment() && !rehearsal;
  async function storeFor(id?: string): Promise<RoomStore | null> {
    if (!hosted) return dep.store();
    if (id) return id[14] === '8' ? privateStore : preview ? null : dep.store();
    const candidates = preview ? [privateStore] : [privateStore, () => dep.store()];
    for (const candidate of candidates) {
      try {
        const s = typeof candidate === 'function' ? candidate() : candidate;
        if (s && (await s.available())) return s;
      } catch {
        /* Try the other configured room store. */
      }
    }
    return null;
  }
  if (method === 'GET' && route === 'status') {
    let available = false;
    try {
      const s = await storeFor();
      available = hosted ? !!s : !!s && (await s.available());
    } catch {
      /* Private storage failure. */
    }
    res.status(200);
    res.json({ available, writable: available && !readOnly });
    return;
  }
  if (parts.length !== 1 || !['host', 'join', 'sync', 'edit', 'leave'].includes(route)) {
    fail(404, 'Build session not found.');
    return;
  }
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    fail(405, 'Use a build session request.');
    return;
  }
  if (readOnly && rejectShowcaseTransaction(res)) return;
  const origin = req.headers?.origin;
  if (
    crossSiteWrite(req.method, req.headers) ||
    (origin &&
      (Array.isArray(origin) ||
        !(dep.allowOrigin?.(origin) ?? sharedSpecOrigins().includes(origin))))
  ) {
    fail(403, 'Request origin is unavailable.');
    return;
  }
  const n = req.headers?.['content-length'];
  if (n && (!/^\d+$/.test(String(n)) || Number(n) > 780000)) {
    fail(413, 'Build request too large.');
    return;
  }
  try {
    if (route === 'host' && !(await dep.allowHost(req))) {
      fail(403, 'Open the studio to host a build.');
      return;
    }
    const raw = await read();
    if (Buffer.byteLength(JSON.stringify(raw) ?? '', 'utf8') > 780000) {
      fail(413, 'Build request too large.');
      return;
    }
    const now = dep.now();
    if (route === 'host' || route === 'join') {
      const input = route === 'host' ? Create.parse(raw) : Join.parse(raw);
      if (!allowedAvatars.has(input.avatar)) {
        fail(400, 'Choose a listed character.');
        return;
      }
      const requested =
        route === 'join' ? capability.exec((input as z.infer<typeof Join>).code)?.[1] : undefined;
      if (route === 'join' && !requested) {
        fail(404, 'Build invitation unavailable.');
        return;
      }
      const store = await storeFor(requested);
      if (!store) {
        fail(
          route === 'join' ? 404 : 503,
          route === 'join'
            ? 'Build invitation unavailable.'
            : 'Shared build storage is unavailable.',
        );
        return;
      }
      const generated = randomUUID();
      const roomKey =
        requested ??
        (store.scopedSessions ? generated.slice(0, 14) + '8' + generated.slice(15) : generated);
      if (!roomKey) {
        fail(404, 'Build invitation unavailable.');
        return;
      }
      const memberSecret = token(),
        member: Member = {
          room: roomKey,
          id: randomUUID(),
          trade: input.trade,
          avatar: input.avatar,
          hash: digest(memberSecret),
          pose: null,
          seen: now,
        };
      let invite: string | undefined;
      if (route === 'host') {
        const secret = token(),
          model = checked((input as z.infer<typeof Create>).model);
        await store.create(
          { id: roomKey, revision: 1, model, inviteHash: digest(secret) },
          'live-host:' + member.id,
          member,
        );
        invite = roomKey + '.' + secret;
      } else {
        const room = await store.room(roomKey),
          grant = capability.exec((input as z.infer<typeof Join>).code);
        if (!room || !grant || !match(room.inviteHash, digest(grant[2]))) {
          fail(404, 'Build invitation unavailable.');
          return;
        }
        if (!(await store.join(member))) {
          fail(409, 'The build has reached its participant limit.');
          return;
        }
      }
      res.status(201);
      res.json({
        roomId: roomKey,
        actorId: member.id,
        session: (store.scopedSessions ? roomKey + '.' : '') + member.id + '.' + memberSecret,
        ...(invite ? { invite } : {}),
        ...(await store.state(roomKey, 0)),
      });
      return;
    }
    const auth = req.headers?.authorization;
    const partsOfToken =
      typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).split('.') : [];
    const hint = partsOfToken.length === 3 ? partsOfToken.shift() : undefined;
    const bearer = capability.exec(partsOfToken.join('.'));
    const validHint =
      !hint || /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hint);
    const store = bearer && validHint ? await storeFor(hint ?? bearer[1]) : null;
    const member = store && bearer ? await store.member(bearer[1], hint) : null;
    if (
      !store ||
      !bearer ||
      !member ||
      (hint && member.room !== hint) ||
      !match(member.hash, digest(bearer[2]))
    ) {
      fail(401, 'Join the build again.');
      return;
    }
    if (route === 'leave') {
      await store.leave(member.id, member.room);
      res.status(200);
      res.json({ left: true });
      return;
    }
    if (route === 'sync') {
      const sync = Sync.parse(raw);
      let state;
      if (store.sync) state = await store.sync(member, sync.pose, now, sync.revision);
      else {
        await store.pose(member, sync.pose, now);
        state = await store.state(member.room, sync.revision);
      }
      if (!state) {
        fail(404, 'Build session unavailable.');
        return;
      }
      res.status(200);
      res.json(state);
      return;
    }
    const edit = EditSchema.parse(raw),
      hash = digest(JSON.stringify(edit));
    for (let retry = 0; retry < 4; retry++) {
      const receipt = await store.receipt(member.room, edit.requestId);
      if (receipt) {
        if (receipt.actor !== member.id || receipt.hash !== hash) {
          fail(409, 'The edit reference was already used.');
          return;
        }
        res.status(200);
        res.json(await store.state(member.room, 0));
        return;
      }
      const room = await store.room(member.room);
      if (!room) {
        fail(404, 'Build session unavailable.');
        return;
      }
      if (edit.revision > room.revision) {
        fail(409, 'Refresh the shared build.');
        return;
      }
      const model = checked(applyChanges(room.model, edit.changes));
      if (await store.write(room, model, member.id, edit.requestId, hash)) {
        res.status(200);
        res.json(await store.state(member.room, 0));
        return;
      }
    }
    fail(409, 'The build changed during this edit. Refresh and retry.');
  } catch (error) {
    if (error instanceof EditConflict) {
      fail(409, error.message);
      return;
    }
    if (
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      (error instanceof Error && /^(Invalid |An edge|The loop|The edges)/.test(error.message))
    ) {
      fail(400, 'Invalid build or edit.');
      return;
    }
    // Log only the operation and a known error class. Room IDs, request
    // bodies, credentials and provider error messages never enter logs.
    const category = error instanceof Error ? error.constructor.name : '';
    console.warn('Shared build storage:', route, /^(Blob[A-Za-z]+|TypeError|SyntaxError)$/.test(category) ? category : 'storage');
    fail(503, 'Shared build storage is unavailable. Your local design is still available.');
  }
}
