import { describe, expect, it } from 'vitest';
import { blobBuildStore, type BuildObjects } from '../_db/blobLiveBuildStore';
import type { Member } from '../_db/liveBuildStore';
function memoryObjects(): BuildObjects {
  const entries = new Map<string, { value: unknown; etag: string }>();
  let rev = 0;
  return {
    async read<T>(p: string) {
      const x = entries.get(p);
      return x ? { value: structuredClone(x.value) as T, etag: x.etag } : null;
    },
    async write(p, value, o) {
      const old = entries.get(p);
      if (o?.match && old?.etag !== o.match) return false;
      if (old && !o?.match && !o?.overwrite) throw Error('Object already exists');
      entries.set(p, { etag: String(++rev), value: structuredClone(value) });
      return true;
    },
    async discard(p) {
      entries.delete(p);
    },
  };
}
const now = 100000000,
  roomId = 'demo';
const user = (id: string): Member => ({
  id,
  room: roomId,
  hash: 'test-hash',
  seen: now,
  pose: null,
  trade: 'Builder',
  avatar: 'female-a',
});
const room = { id: roomId, inviteHash: 'digest', revision: 1, model: { name: 'Start' } };
describe('private object-backed build rooms', () => {
  it('serializes concurrent revisions, archives committed receipts and isolates staging', async () => {
    const objects = memoryObjects(),
      newStore = () => blobBuildStore(objects, 'production', false, () => now);
    const a = newStore(),
      b = newStore();
    await a.create(room, 'owner', user('a'));
    await b.join(user('b'));
    const first = await Promise.all([
      a.write(room, { name: 'West' }, 'a', 'west', 'x'),
      b.write(room, { name: 'East' }, 'b', 'east', 'y'),
    ]);
    expect(first.filter(Boolean)).toHaveLength(1);
    const winning = first[0] ? 'west' : 'east';
    const existing = (await b.room(roomId))!;
    expect(existing.revision).toBe(2);
    expect(await a.receipt(roomId, winning)).toMatchObject({ actor: first[0] ? 'a' : 'b' });
    expect(await a.write(existing, { name: 'Both' }, 'a', 'next', 'z')).toBe(true);
    expect(await newStore().receipt(roomId, winning)).toBeTruthy();
    expect(await newStore().state(roomId, 1)).toMatchObject({
      revision: 3,
      model: { name: 'Both' },
    });
    expect(await a.state(roomId, 3)).not.toHaveProperty('model');
    expect(await blobBuildStore(objects, 'preview', true).room(roomId)).toBeNull();
  });
  it('bounds membership, verifies expiry and returns only public presence', async () => {
    let time = now;
    const data = memoryObjects(),
      open = () => blobBuildStore(data, 'staging', true, () => time);
    await open().create(room, 'host', user('a'));
    for (let i = 0; i < 31; i++) expect(await open().join(user('p' + i))).toBe(true);
    expect(await open().join(user('overflow'))).toBe(false);
    const state = await open().sync!(user('a'), null, time, 1);
    expect(state!.players.length).toBe(32);
    expect(state!.players[0]).not.toHaveProperty('hash');
    expect(state!.players[0]).not.toHaveProperty('expires');
    await open().leave('a', roomId);
    expect(await open().member('a', roomId)).toBeNull();
    expect(await open().member('p1', 'wrong-room')).toBeNull();
    time += 86400001;
    expect(await open().room(roomId)).toBeNull();
    expect(await open().member('p1', roomId)).toBeNull();
  });
});
