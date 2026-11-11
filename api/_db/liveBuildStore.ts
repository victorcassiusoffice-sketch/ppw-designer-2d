import { neon } from '@neondatabase/serverless';
import type { Build, Player, Pose } from '../../src/sharedBuild/contract.js';

export interface Room {
  id: string;
  revision: number;
  model: Build;
  inviteHash: string;
}
export interface Member extends Player {
  room: string;
  hash: string;
}
export interface State {
  revision: number;
  model?: Build;
  players: Player[];
}
export interface RoomStore {
  available(): Promise<boolean>;
  create(room: Room, creator: string, member: Member): Promise<void>;
  room(id: string): Promise<Room | null>;
  join(member: Member): Promise<boolean>;
  member(id: string): Promise<Member | null>;
  state(id: string, since: number): Promise<State | null>;
  pose(member: Member, pose: Pose | null, now: number): Promise<void>;
  leave(id: string): Promise<void>;
  receipt(room: string, op: string): Promise<{ actor: string; hash: string } | null>;
  write(room: Room, model: Build, actor: string, requestId: string, hash: string): Promise<boolean>;
}
type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;
const roomType = 'olb-live-build-v1',
  playerType = 'olb-build-player-v1';
const roomDoc = (r: Room) =>
  JSON.stringify({ kind: roomType, model: r.model, inviteHash: r.inviteHash });
const memberDoc = (p: Member) =>
  JSON.stringify({
    kind: playerType,
    room: p.room,
    hash: p.hash,
    trade: p.trade,
    avatar: p.avatar,
    pose: p.pose,
    seen: p.seen,
  });
export function makeRoomStore(query: Query): RoomStore {
  return {
    async available() {
      const rows = await query(
        "SELECT to_regclass('public.olb_shared_projects') IS NOT NULL AND to_regclass('public.olb_shared_spec_revisions') IS NOT NULL AS ready",
        [],
      );
      return rows[0]?.ready === true;
    },
    async create(r, creator, m) {
      await query(
        `WITH newroom AS (INSERT INTO olb_shared_projects(id,owner_user_id,revision,document) VALUES($1::uuid,$2,1,$3::jsonb) RETURNING id)
        INSERT INTO olb_shared_projects(id,owner_user_id,revision,document) SELECT $4::uuid,'live:'||id::text,1,$5::jsonb FROM newroom`,
        [r.id, creator, roomDoc(r), m.id, memberDoc(m)],
      );
    },
    async room(id) {
      const rows = await query(
        `SELECT id,revision,document->'model' AS model,document->>'inviteHash' AS "inviteHash" FROM olb_shared_projects WHERE id=$1::uuid AND document->>'kind'=$2`,
        [id, roomType],
      );
      return (rows[0] as unknown as Room) ?? null;
    },
    async join(m) {
      // Lock the room while allocating a slot. Sessions that have been idle for a day no longer take a slot.
      const result = await query(
        `WITH room AS (SELECT id FROM olb_shared_projects WHERE id=$1::uuid AND document->>'kind'=$2 FOR UPDATE),
        written AS (INSERT INTO olb_shared_projects(id,owner_user_id,revision,document)
        SELECT $3::uuid,'live:'||room.id::text,1,$4::jsonb FROM room WHERE
        (SELECT count(*) FROM olb_shared_projects p WHERE p.owner_user_id='live:'||room.id::text AND p.updated_at>now()-interval '24 hours')<32 RETURNING id)
        SELECT id FROM written`,
        [m.room, roomType, m.id, memberDoc(m)],
      );
      return result.length === 1;
    },
    async member(id) {
      const rows = await query(
        `SELECT id,document FROM olb_shared_projects WHERE id=$1::uuid AND document->>'kind'=$2 AND updated_at>now()-interval '24 hours'`,
        [id, playerType],
      );
      if (!rows.length) return null;
      return { id, ...(rows[0].document as Omit<Member, 'id'>) };
    },
    async state(id, since) {
      const rows = await query(
        `SELECT p.revision,CASE WHEN p.revision<>$2 THEN p.document->'model' END AS model,
       coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'trade',a.document->'trade','avatar',a.document->'avatar','pose',a.document->'pose','seen',a.document->'seen'))
         FROM olb_shared_projects a WHERE a.owner_user_id='live:'||p.id::text AND a.document->>'kind'=$4 AND a.updated_at>now()-interval '15 seconds'),'[]'::jsonb) AS players
       FROM olb_shared_projects p WHERE p.id=$1::uuid AND p.document->>'kind'=$3`,
        [id, since, roomType, playerType],
      );
      if (!rows.length) return null;
      const row = rows[0];
      return {
        revision: Number(row.revision),
        players: row.players as Player[],
        ...(row.model ? { model: row.model as Build } : {}),
      };
    },
    async pose(m, pose, now) {
      await query(
        `UPDATE olb_shared_projects SET document=jsonb_set(jsonb_set(document,'{pose}',$2::jsonb),'{seen}',to_jsonb($3::bigint)),updated_at=now()
        WHERE id=$1::uuid AND document->>'kind'=$4`,
        [m.id, JSON.stringify(pose), now, playerType],
      );
    },
    async leave(id) {
      await query("DELETE FROM olb_shared_projects WHERE id=$1::uuid AND document->>'kind'=$2", [
        id,
        playerType,
      ]);
    },
    async receipt(room, op) {
      const rows = await query(
        'SELECT actor_user_id AS actor, request_hash AS hash FROM olb_shared_spec_revisions WHERE project_id=$1::uuid AND request_id=$2::uuid',
        [room, op],
      );
      return (rows[0] as { actor: string; hash: string }) ?? null;
    },
    async write(room, model, actor, op, hash) {
      const result = await query(
        `WITH changed AS (UPDATE olb_shared_projects p SET document=jsonb_set(p.document,'{model}',$3::jsonb),revision=p.revision+1,updated_at=now()
        WHERE p.id=$1::uuid AND p.revision=$2 AND p.document->>'kind'=$7 AND NOT EXISTS
        (SELECT 1 FROM olb_shared_spec_revisions h WHERE h.project_id=p.id AND h.request_id=$4::uuid) RETURNING p.id,p.revision,p.document)
        INSERT INTO olb_shared_spec_revisions(project_id,revision,actor_user_id,request_id,request_hash,operation,document)
        SELECT id,revision,$5,$4::uuid,$6,'build-edit',jsonb_build_object('model',document->'model') FROM changed RETURNING revision`,
        [room.id, room.revision, JSON.stringify(model), op, actor, hash, roomType],
      );
      return result.length === 1;
    },
  };
}
export function neonRoomStore(): RoomStore {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (!url) throw Error('Build storage unavailable.');
  const sql = neon(url);
  return makeRoomStore((text, params) => sql(text, params));
}
