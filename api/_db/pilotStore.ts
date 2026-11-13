import { neon } from '@neondatabase/serverless';
export type Query = (sql: string, args: unknown[]) => Promise<Record<string, unknown>[]>;
export type Access = {
  id: string;
  slug: string;
  owner_id: string;
  revision: number;
  member_id: string | null;
  role: string | null;
  name: string;
  lane: string;
  state: string;
  summary: string;
};
export type Actor = { owner: string; member: string };
const membership =
  "m.pilot_id=p.id AND m.cookie_key_hash=$2 AND m.state='active' AND m.cookie_expires>now()";
export function pilotStore(query: Query) {
  const one = async (sql: string, args: unknown[]) => (await query(sql, args))[0];
  return {
    async list(a: Actor) {
      return query(
        `SELECT p.slug,p.name,p.lane,p.state FROM pilots p WHERE p.owner_id=$1 OR EXISTS(SELECT 1 FROM pilot_members m WHERE ${membership}) ORDER BY p.updated DESC`,
        [a.owner, a.member],
      );
    },
    async access(slug: string, a: Actor) {
      return (await one(
        `SELECT p.*,m.id AS member_id,m.role FROM pilots p LEFT JOIN pilot_members m ON ${membership} WHERE p.slug=$3 AND (p.owner_id=$1 OR m.id IS NOT NULL)`,
        [a.owner, a.member, slug],
      )) as Access | undefined;
    },
    async create(
      id: string,
      owner: string,
      p: { slug: string; name: string; lane: string; state: string; summary: string },
      team: unknown,
      steps: unknown,
    ) {
      return one(
        `WITH p AS (INSERT INTO pilots(id,slug,owner_id,name,lane,state,summary) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(slug) DO NOTHING RETURNING id), lead AS (INSERT INTO pilot_members(pilot_id,id,role,first_name,organisation,state) SELECT id,'lead','lead',$8,$9,'active' FROM p), timeline AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by) SELECT p.id,v->>'id','step',v,'lead' FROM p,jsonb_array_elements($10::jsonb) v) SELECT id FROM p`,
        [
          id,
          p.slug,
          owner,
          p.name,
          p.lane,
          p.state,
          p.summary,
          (team as { name: string }).name,
          (team as { organisation: string }).organisation,
          JSON.stringify(steps),
        ],
      );
    },
    async document(p: Access, owner: boolean) {
      const [d] = await query(
        `SELECT p.name,p.slug,p.lane,p.state,p.summary,p.revision,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',m.first_name,'organisation',m.organisation,'role',m.role,'state',m.state) ORDER BY m.created,m.id) FROM pilot_members m WHERE m.pilot_id=p.id),'[]') AS members,COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',i.kind,'payload',i.payload,'author',i.created_by) ORDER BY i.created,i.id) FROM pilot_items i WHERE i.pilot_id=p.id AND (NOT i.hidden OR ($2 AND i.kind='photo'))),'[]') AS items FROM pilots p WHERE p.id=$1`,
        [p.id, owner],
      );
      return d;
    },
    async join(slug: string, invite: string, cookie: string) {
      return one(
        `WITH joined AS (UPDATE pilot_members m SET cookie_key_hash=$3,cookie_expires=now()+interval '30 days',invite_hash=NULL,invite_expires=NULL,state='active',last_seen=now() FROM pilots p WHERE m.pilot_id=p.id AND p.slug=$1 AND m.invite_hash=$2 AND m.invite_expires>now() AND m.state='invited' RETURNING m.pilot_id) UPDATE pilots SET revision=revision+1, updated=now() FROM joined WHERE pilots.id=joined.pilot_id RETURNING pilots.id`,
        [slug, invite, cookie],
      );
    },
    async invite(
      p: Access,
      rev: number,
      m: { id: string; name: string; organisation: string; role: string },
      invite: string,
    ) {
      return one(
        `WITH bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND (SELECT count(*) FROM pilot_members WHERE pilot_id=$1)<150 RETURNING id,revision), added AS (INSERT INTO pilot_members(pilot_id,id,first_name,organisation,role,state,invite_hash,invite_expires) SELECT id,$3,$4,$5,$6,'invited',$7,now()+interval '7 days' FROM bump) SELECT revision FROM bump`,
        [p.id, rev, m.id, m.name, m.organisation, m.role, invite],
      );
    },
    async change(p: Access, rev: number, values: { name: string; state: string; summary: string }) {
      return one(
        'UPDATE pilots SET name=$3,state=$4,summary=$5,revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 RETURNING revision',
        [p.id, rev, values.name, values.state, values.summary],
      );
    },
    async item(p: Access, id: string) {
      return one(
        'SELECT kind,payload,created_by,hidden FROM pilot_items WHERE pilot_id=$1 AND id=$2',
        [p.id, id],
      );
    },
    async saveItem(
      p: Access,
      rev: number,
      kind: string,
      id: string,
      payload: unknown,
      by: string,
      patch: boolean,
      hidden: boolean,
    ) {
      const edit = patch
        ? 'UPDATE pilot_items i SET payload=$5::jsonb,hidden=$7,updated=now() FROM bump WHERE i.pilot_id=bump.id AND i.id=$4 AND i.kind=$3 AND ($8 OR i.created_by=$6) RETURNING i.id'
        : "INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by,hidden) SELECT id,$4,$3,$5::jsonb,$6,$7 FROM bump ON CONFLICT (pilot_id,id) DO UPDATE SET hidden=false,payload=EXCLUDED.payload,updated=now() WHERE pilot_items.hidden AND pilot_items.kind='camera' RETURNING id";
      return one(
        `WITH bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND ${patch ? 'EXISTS(SELECT 1 FROM pilot_items WHERE pilot_id=$1 AND id=$4 AND kind=$3 AND ($8 OR created_by=$6))' : "NOT EXISTS(SELECT 1 FROM pilot_items WHERE pilot_id=$1 AND id=$4 AND NOT (kind='camera' AND $3='camera' AND hidden)) AND (SELECT count(*) FROM pilot_items WHERE pilot_id=$1 AND kind=$3 AND (NOT hidden OR kind='photo')) < CASE $3 WHEN 'site' THEN 150 WHEN 'photo' THEN 200 WHEN 'step' THEN 100 WHEN 'paper' THEN 200 WHEN 'camera' THEN 150 ELSE 3000 END"} RETURNING id,revision), edited AS (${edit}) SELECT revision FROM bump`,
        [
          p.id,
          rev,
          kind,
          id,
          JSON.stringify(payload),
          by,
          hidden,
          ...(patch ? [by === 'lead'] : []),
        ],
      );
    },
  };
}
export function hostedPilots() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Error('Pilot store unavailable');
  const sql = neon(url);
  let ready = false;
  return pilotStore(async (text, args) => {
    // Preview and production may share Neon. A DBA marks only a separately verified preview database;
    // the migration never creates this marker. Do not even read pilot data until the marker matches.
    if (process.env.VERCEL_ENV === 'preview' && !ready) {
      const [row] = await sql(
        "SELECT obj_description(to_regclass('public.pilots'),'pg_class') AS marker",
        [],
      );
      const branch = process.env.VERCEL_GIT_COMMIT_REF;
      if (!branch || row?.marker !== 'olb-pilot-isolated:' + branch)
        throw Error('Verified preview database required');
      ready = true;
    }
    return sql(text, args);
  });
}
