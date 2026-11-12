import { Redis } from '@upstash/redis';
import { buildChanges, type Build, type Pose } from '../../src/sharedBuild/contract.js';
import type { Member, Room, RoomStore, State } from './liveBuildStore.js';

const DAY = 86_400_000;
type Admission = Member & { expires: number };
// All three keys share a Redis cluster slot. Rehearsals expire after a day of inactivity.
const refresh =
  "if tonumber(ARGV[1])>0 then for i=1,#KEYS do redis.call('EXPIRE',KEYS[i],ARGV[1]) end end";
export function redisLiveBuildStore(
  redis: Redis,
  namespace: string,
  temporary: boolean,
): RoomStore {
  const keys = (room: string) => {
    const id = 'olb:live:v1:' + namespace + ':{' + room + '}';
    return [id + ':room', id + ':members', id + ':history'];
  };
  const ttl = temporary ? 86400 : 0;
  const run = <T>(script: string, room: string, args: unknown[]) =>
    redis.eval<unknown[], T>(script, keys(room), [ttl, ...args]);
  const admitted = (m: Member): Admission => ({ ...m, expires: m.seen + DAY });
  async function currentMember(id: string, room?: string) {
    if (!room) return null;
    const m = await redis.hget<Admission>(keys(room)[1], id);
    return m && m.room === room && m.expires > Date.now() ? m : null;
  }
  async function state(
    id: string,
    since: number,
    update?: { member: Member; pose: Pose | null; now: number },
  ): Promise<State | null> {
    // Never send an entire model at heartbeat frequency when the revision is unchanged.
    const result = await run<[number, string | null, string[]] | null>(
      `
      local rev=redis.call('HGET',KEYS[1],'revision'); if not rev then return nil end
      if ARGV[4]~='' then
        local raw=redis.call('HGET',KEYS[2],ARGV[4]); if not raw then return nil end
        local m=cjson.decode(raw); if m.expires<=tonumber(ARGV[3]) then return nil end
        m.seen=tonumber(ARGV[3]); m.pose=cjson.decode(ARGV[5]); redis.call('HSET',KEYS[2],ARGV[4],cjson.encode(m))
      end
      local players={}; for _,raw in ipairs(redis.call('HVALS',KEYS[2])) do
        local m=cjson.decode(raw); if m.seen>tonumber(ARGV[3])-15000 and m.expires>tonumber(ARGV[3]) then
          players[#players+1]=cjson.encode({id=m.id,trade=m.trade,avatar=m.avatar,pose=m.pose,seen=m.seen})
        end
      end
      local model=false; if tonumber(rev)~=tonumber(ARGV[2]) then model=redis.call('HGET',KEYS[1],'model') end
      return {tonumber(rev),model,players}`,
      id,
      [
        since,
        update?.now ?? Date.now(),
        update?.member.id ?? '',
        JSON.stringify(update?.pose ?? null),
      ],
    );
    if (!result) return null;
    const [rev, raw, players] = result;
    // The Redis client may already have decoded nested JSON replies.
    const decoded = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : (v as T));
    return {
      revision: Number(rev),
      players: players.map((p) => decoded<State['players'][number]>(p)),
      ...(raw ? { model: decoded<Build>(raw) } : {}),
    };
  }
  return {
    scopedSessions: true,
    async available() {
      return (await redis.ping()) === 'PONG';
    },
    async create(room, creator, member) {
      const created = await run<number>(
        `
        if redis.call('EXISTS',KEYS[1])~=0 then return 0 end
        redis.call('HSET',KEYS[1],'revision',1,'model',ARGV[2],'invite',ARGV[3],'creator',ARGV[4])
        redis.call('HSET',KEYS[2],ARGV[5],ARGV[6])
        redis.call('HSET',KEYS[3],'initial',ARGV[2]); ${refresh}; return 1`,
        room.id,
        [
          JSON.stringify(room.model),
          room.inviteHash,
          creator,
          member.id,
          JSON.stringify(admitted(member)),
        ],
      );
      if (created !== 1) throw Error('Room already exists.');
    },
    async room(id) {
      const row = await redis.hmget<{ revision: number; model: Build; invite: string }>(
        keys(id)[0],
        'revision',
        'model',
        'invite',
      );
      return row?.revision
        ? { id, revision: Number(row.revision), model: row.model, inviteHash: row.invite }
        : null;
    },
    async join(m) {
      return (
        (await run<number>(
          `
        if redis.call('EXISTS',KEYS[1])==0 then return 0 end
        for _,raw in ipairs(redis.call('HVALS',KEYS[2])) do local p=cjson.decode(raw)
          if p.expires<=tonumber(ARGV[2]) then redis.call('HDEL',KEYS[2],p.id) end
        end
        if redis.call('HLEN',KEYS[2])>=32 then return 0 end
        redis.call('HSET',KEYS[2],ARGV[3],ARGV[4]); ${refresh}; return 1`,
          m.room,
          [m.seen, m.id, JSON.stringify(admitted(m))],
        )) === 1
      );
    },
    member: currentMember,
    state,
    async sync(member, pose, now, since) {
      return state(member.room, since, { member, pose, now });
    },
    async pose(member, pose, now) {
      await state(member.room, 0, { member, pose, now });
    },
    async leave(id, room) {
      if (room) await redis.hdel(keys(room)[1], id);
    },
    async receipt(room, op) {
      return redis.hget<{ actor: string; hash: string }>(keys(room)[2], op);
    },
    async write(room: Room, model, actor, op, hash) {
      const receipt = {
        actor,
        hash,
        revision: room.revision + 1,
        changes: buildChanges(room.model, model),
      };
      return (
        (await run<number>(
          `
        if tonumber(redis.call('HGET',KEYS[1],'revision'))~=tonumber(ARGV[2]) or redis.call('HEXISTS',KEYS[3],ARGV[4])==1 then return 0 end
        redis.call('HSET',KEYS[1],'model',ARGV[3],'revision',tonumber(ARGV[2])+1)
        redis.call('HSET',KEYS[3],ARGV[4],ARGV[5]); ${refresh}; return 1`,
          room.id,
          [room.revision, JSON.stringify(model), op, JSON.stringify(receipt)],
        )) === 1
      );
    },
  };
}
export function hostedRedisBuildStore(): RoomStore | null {
  const url = process.env.KV_REST_API_URL?.trim(),
    token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  const preview = process.env.VERCEL_ENV === 'preview';
  const namespace = preview
    ? process.env.VERCEL_URL
    : process.env.VERCEL_ENV === 'production'
      ? 'production'
      : 'development';
  if (!namespace || !/^[a-zA-Z0-9.-]+$/.test(namespace)) return null;
  return redisLiveBuildStore(new Redis({ url, token, retry: false }), namespace, preview);
}
