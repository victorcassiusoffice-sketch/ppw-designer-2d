import { randomUUID } from 'node:crypto';
import { get, put, del, BlobPreconditionFailedError } from '@vercel/blob';
import type { Build, Pose } from '../../src/sharedBuild/contract.js';
import type { Member, RoomStore, State } from './liveBuildStore.js';

const DAY = 86_400_000;
interface Receipt {
  id: string;
  actor: string;
  hash: string;
  revision: number;
  snapshot: string;
}
interface Head {
  revision: number;
  inviteHash: string;
  snapshot: string;
  expires?: number;
  last?: Receipt;
}
interface Admission extends Member {
  expires: number;
}
type Roster = Record<string, Admission>;
interface Stored<T> {
  value: T;
  etag: string;
}
export interface BuildObjects {
  read<T>(path: string): Promise<Stored<T> | null>;
  write(
    path: string,
    value: unknown,
    options?: { match?: string; overwrite?: boolean },
  ): Promise<boolean>;
  discard(path: string): Promise<void>;
}

const privateObjects: BuildObjects = {
  async read<T>(path: string) {
    const result = await get(path, { access: 'private', useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw Error('Private build object unavailable.');
    const value = (await new Response(result.stream).json()) as T;
    return { value, etag: result.blob.etag };
  },
  async write(path, value, options = {}) {
    try {
      await put(path, JSON.stringify(value), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: !!options.match || !!options.overwrite,
        ...(options.match ? { ifMatch: options.match } : {}),
        contentType: 'application/json',
      });
      return true;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) return false;
      throw e;
    }
  },
  async discard(path) {
    await del(path);
  },
};

export function blobBuildStore(
  objects: BuildObjects,
  namespace: string,
  temporary: boolean,
  clock = Date.now,
): RoomStore {
  const prefix = 'live-build/v1/' + namespace + '/';
  const path = (room: string, name: string) => prefix + room + '/' + name;
  const head = async (room: string) => {
    const h = await objects.read<Head>(path(room, 'head.json'));
    return h && (!h.value.expires || h.value.expires > clock()) ? h : null;
  };
  let cachedRoster: { room: string; data: Stored<Roster> } | undefined;
  async function roster(room: string, fresh = false) {
    if (!fresh && cachedRoster?.room === room) return cachedRoster.data;
    const data = await objects.read<Roster>(path(room, 'players.json'));
    cachedRoster = data ? { room, data } : undefined;
    return data;
  }
  async function changePlayers(room: string, change: (members: Roster) => Roster | null) {
    for (let i = 0; i < 8; i++) {
      const existing = await roster(room, i > 0);
      if (!existing) return null;
      const next = change(existing.value);
      if (!next) return null;
      if (next === existing.value) return next;
      if (await objects.write(path(room, 'players.json'), next, { match: existing.etag })) {
        cachedRoster = undefined;
        return next;
      }
    }
    throw Error('Participant update busy. Retry.');
  }
  async function snapshot(room: string, h: Head) {
    const doc = await objects.read<Build>(path(room, 'snapshots/' + h.snapshot + '.json'));
    if (!doc) throw Error('Build snapshot unavailable.');
    return doc.value;
  }
  async function state(room: string, since: number, members?: Roster): Promise<State | null> {
    const [h, all] = await Promise.all([head(room), members ?? roster(room).then((r) => r?.value)]);
    if (!h || !all) return null;
    const now = clock(),
      players = Object.values(all)
        .filter((p) => p.expires > now && p.seen > now - 15000)
        .map(({ id, trade, avatar, seen, pose }) => ({ id, trade, avatar, seen, pose }));
    return {
      revision: h.value.revision,
      players,
      ...(h.value.revision !== since ? { model: await snapshot(room, h.value) } : {}),
    };
  }
  async function sync(m: Member, pose: Pose | null, now: number, since: number) {
    const all = await changePlayers(m.room, (members) => {
      const current = members[m.id];
      if (!current || current.expires <= now) return null;
      if (now - current.seen < 5000 && JSON.stringify(current.pose) === JSON.stringify(pose))
        return members;
      return { ...members, [m.id]: { ...current, seen: now, pose } };
    });
    return all ? state(m.room, since, all) : null;
  }
  return {
    scopedSessions: true,
    async available() {
      await objects.read(prefix + 'readiness.json');
      return true;
    },
    async create(r, _creator, m) {
      const file = randomUUID(),
        snap = path(r.id, 'snapshots/' + file + '.json'),
        players = path(r.id, 'players.json');
      const expires = temporary ? clock() + DAY : undefined;
      await objects.write(snap, r.model);
      await objects.write(players, {
        [m.id]: { ...m, expires: Math.min(m.seen + DAY, expires ?? Infinity) },
      });
      await objects.write(path(r.id, 'head.json'), {
        revision: 1,
        snapshot: file,
        inviteHash: r.inviteHash,
        expires,
      });
    },
    async room(id) {
      const h = await head(id);
      if (!h) return null;
      return {
        id,
        revision: h.value.revision,
        inviteHash: h.value.inviteHash,
        model: await snapshot(id, h.value),
      };
    },
    async join(m) {
      const h = await head(m.room);
      if (!h) return false;
      return !!(await changePlayers(m.room, (players) => {
        const active = Object.fromEntries(
          Object.entries(players).filter(([, p]) => p.expires > m.seen),
        );
        if (Object.keys(active).length >= 32) return null;
        active[m.id] = { ...m, expires: Math.min(m.seen + DAY, h.value.expires ?? Infinity) };
        return active;
      }));
    },
    async member(id, room) {
      if (!room) return null;
      const m = (await roster(room))?.value[id];
      return m && m.room === room && m.expires > clock() ? m : null;
    },
    state,
    sync,
    async pose(m, p, now) {
      await sync(m, p, now, -1);
    },
    async leave(id, room) {
      if (room)
        await changePlayers(room, (players) => {
          if (!players[id]) return players;
          const next = { ...players };
          delete next[id];
          return next;
        });
    },
    async receipt(id, op) {
      const h = await head(id);
      if (!h) return null;
      if (h.value.last?.id === op) return h.value.last;
      return (await objects.read<Receipt>(path(id, 'receipts/' + op + '.json')))?.value ?? null;
    },
    async write(room, model, actor, id, hash) {
      const h = await head(room.id);
      if (!h || h.value.revision !== room.revision) return false;
      if (
        h.value.last?.id === id ||
        (await objects.read(path(room.id, 'receipts/' + id + '.json')))
      )
        return false;
      // Publish a complete immutable snapshot with one ETag-guarded pointer update.
      // Archive the previous committed receipt before replacing it. A retry after
      // any interruption can always find the receipt at the head or in the archive.
      const previous = h.value.last;
      if (previous)
        await objects.write(path(room.id, 'receipts/' + previous.id + '.json'), previous, {
          overwrite: true,
        });
      const file = randomUUID(),
        location = path(room.id, 'snapshots/' + file + '.json');
      await objects.write(location, model);
      const revision = room.revision + 1,
        last = { id, actor, hash, revision, snapshot: file };
      const written = await objects.write(
        path(room.id, 'head.json'),
        { ...h.value, revision, snapshot: file, last },
        { match: h.etag },
      );
      if (!written) await objects.discard(location);
      return written;
    },
  };
}

export function hostedBlobBuildStore(): RoomStore | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) return null;
  const preview = process.env.VERCEL_ENV === 'preview';
  const scope = preview
    ? process.env.VERCEL_URL
    : process.env.VERCEL_ENV === 'production'
      ? 'production'
      : 'development';
  if (!scope || !/^[A-Za-z0-9.-]+$/.test(scope)) return null;
  return blobBuildStore(privateObjects, scope, preview);
}
