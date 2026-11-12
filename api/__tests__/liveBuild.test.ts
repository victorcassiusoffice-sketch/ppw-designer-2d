import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { handleLiveBuild, type Dependencies } from '../_lib/sharedBuild/handler';
import { makeRoomStore } from '../_db/liveBuildStore';
import { buildChanges, applyChanges, sharedProperty } from '../../src/sharedBuild/contract';

const initial = {
  id: 'example',
  name: 'House',
  walls: [],
  rooms: [
    {
      id: 'room',
      name: 'Room',
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
      ],
      openings: [],
      placedItems: [],
    },
  ],
};
const user = { trade: 'Builder', avatar: 'female-a' };
describe('private multiplayer construction through the database adapter', () => {
  let db: PGlite, dep: Dependencies;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync('api/_db/migrations/0032_shared_project_specs.sql', 'utf8'));
    const store = makeRoomStore(
      async (s, args) => (await db.query<Record<string, unknown>>(s, args)).rows,
    );
    dep = { store: () => store, allowHost: async () => true, now: Date.now };
  }, 30000);
  afterAll(async () => {
    await db.close();
  });
  async function call(
    route: string,
    body: unknown,
    session?: string,
    overrides: Partial<Dependencies> = {},
  ) {
    let status = 0;
    let result: Record<string, unknown> = {};
    await handleLiveBuild(
      [route],
      {
        method: 'POST',
        headers: {
          ...(session ? { authorization: 'Bearer ' + session } : {}),
          host: 'localhost:5173',
          origin: 'http://localhost:5173',
        },
      },
      {
        setHeader() {},
        status(n) {
          status = n;
        },
        json(v) {
          result = v as Record<string, unknown>;
        },
      },
      async () => body,
      { ...dep, ...overrides },
    );
    return { status, result };
  }
  it('hosts a fresh empty plot and joins it before anyone has placed a door', async () => {
    const room = { id: 'ground', name: 'Main Room', polygon: [], placedItems: [] };
    const model = { id: 'empty', name: 'New plot', rooms: [room] };
    const host = await call('host', { ...user, model });
    expect(host.status).toBe(201);
    const guest = await call('join', { ...user, code: host.result.invite });
    expect(guest.status).toBe(201);
    expect(guest.result.model).toMatchObject({ rooms: [{ ...room, openings: [] }] });
    expect(room).not.toHaveProperty('openings');
    expect(() => sharedProperty({ ...model, rooms: [{ ...room, openings: null }] })).toThrow('Invalid room');
  });

  it('requires a studio host, issues independent capabilities, and never returns another session in presence', async () => {
    expect(
      (await call('host', { ...user, model: initial }, undefined, { allowHost: async () => false }))
        .status,
    ).toBe(403);
    const hosted = await call('host', { ...user, model: initial });
    expect(hosted.status).toBe(201);
    const guest = await call('join', {
      trade: 'Electrical',
      avatar: 'nadia',
      code: hosted.result.invite,
    });
    expect(guest.status).toBe(201);
    const sync = await call(
      'sync',
      { revision: 0, pose: { x: 1, y: 2, z: 0, yaw: 0, moving: true } },
      guest.result.session as string,
    );
    expect(sync.status).toBe(200);
    expect(JSON.stringify(sync.result)).not.toContain(guest.result.session);
    const state = await call('sync', { revision: 1, pose: null }, hosted.result.session as string);
    expect(state.result.model).toBeUndefined();
    expect(state.result.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trade: 'Electrical',
          avatar: 'nadia',
          pose: expect.objectContaining({ x: 1 }),
        }),
      ]),
    );
    await call('leave', {}, guest.result.session as string);
    expect(
      (await call('sync', { revision: 0, pose: null }, guest.result.session as string)).status,
    ).toBe(401);
  });
  it('merges independent concurrent edits, rejects an overlapping write, and replays a retried operation once', async () => {
    const hosted = await call('host', { ...user, model: initial }),
      guest = await call('join', { ...user, code: hosted.result.invite });
    const before = sharedProperty(initial),
      wall = { id: 'wall', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.15 };
    const op = (after: typeof before) => ({
      revision: 1,
      requestId: randomUUID(),
      changes: buildChanges(before, after),
    });
    const walls = op({ ...before, walls: [wall] }),
      rename = op({ ...before, name: 'Site A' });
    const [resA, resB] = await Promise.all([
      call('edit', walls, hosted.result.session as string),
      call('edit', rename, guest.result.session as string),
    ]);
    expect([resA.status, resB.status]).toEqual([200, 200]);
    const replay = await call('edit', walls, hosted.result.session as string);
    expect(replay.result.revision).toBe(3);
    expect(replay.result.model).toMatchObject({ name: 'Site A', walls: [wall] });
    const collision = await call(
      'edit',
      op({ ...before, name: 'Site B' }),
      hosted.result.session as string,
    );
    expect(collision.status).toBe(409);
    const denied = await call('edit', walls, undefined);
    expect(denied.status).toBe(401);
  });
  it('separates participants in two builds and preserves every edit on an invalid batch', async () => {
    const one = await call('host', { ...user, model: initial }),
      two = await call('host', { ...user, model: { ...initial, id: 'another' } });
    const read = await call('sync', { revision: 0, pose: null }, two.result.session as string);
    expect(read.result.model).toMatchObject({ id: 'another' });
    expect(JSON.stringify(read.result.players)).not.toContain(one.result.actorId);
    const model = sharedProperty(initial);
    expect(() =>
      applyChanges(model, [
        { path: ['name'], before: 'House', after: 'Other', had: true, has: true },
        {
          path: ['rooms', { id: 'missing' }, 'name'],
          before: 'old',
          after: 'new',
          had: true,
          has: true,
        },
      ]),
    ).toThrow();
    expect(model.name).toBe('House');
  });
});
