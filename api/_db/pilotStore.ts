import type { Evidence } from '../../src/pilots/evidence.js';
import type { Rules } from '../../src/pilots/access.js';
import { neon } from '@neondatabase/serverless';
export type Query = (sql: string, args: unknown[]) => Promise<Record<string, unknown>[]>;
export type Access = {
  id: string;
  slug: string;
  owner_id: string;
  revision: number;
  role_rules: Rules;
  link_id: string | null;
  member_id: string | null;
  first_name: string | null;
  expires: string | null;
  role: string | null;
  name: string;
  lane: string;
  state: string;
  summary: string;
};
export type Actor = { owner: string; member: string };
const membership =
  "m.pilot_id=p.id AND m.cookie_key_hash=$2 AND m.state='active' AND m.cookie_expires>now() AND (m.role<>'checker' OR m.checker_until >= (now() AT TIME ZONE 'Indian/Mauritius')::date)";
export function pilotStore(query: Query) {
  const one = async (sql: string, args: unknown[]) => (await query(sql, args))[0];
  return {
    async allowAttempt(kind: 'join' | 'photos', hashedIp: string, limit: number) {
      // Existing expiring counters; only this namespace can be incremented.
      // Fixed window from the first request; concurrent claims share one atomic count.
      const result = await one(
        `INSERT INTO public.studio_access_records AS r (record_key,record_value,expires_at)
        VALUES ($1,'1',now()+interval '10 minutes') ON CONFLICT(record_key) DO UPDATE SET
        record_value=CASE WHEN r.expires_at<=now() THEN '1' ELSE LEAST(r.record_value::int+1,100000)::text END,
        expires_at=CASE WHEN r.expires_at<=now() THEN EXCLUDED.expires_at ELSE r.expires_at END RETURNING record_value`,
        ['ppw:pilot-limit:' + kind + ':' + hashedIp],
      );
      const count = Number(result?.record_value);
      return Number.isInteger(count) && count > 0 && count <= limit;
    },
    async list(a: Actor) {
      return query(
        `SELECT p.slug,p.name,p.lane,p.state FROM pilots p WHERE p.owner_id=$1 OR EXISTS(SELECT 1 FROM pilot_members m WHERE ${membership}) ORDER BY p.updated DESC`,
        [a.owner, a.member],
      );
    },
    async dashboard(p: Access, member: string) {
      return query(
        "SELECT kind,payload,created FROM pilot_items WHERE pilot_id=$1 AND NOT hidden AND ((kind IN ('photo','note','reading','log') AND created_by=$2) OR kind='step' OR (kind='money' AND ((payload->>'type'='pay_row' AND payload->>'memberId'=$2) OR id='book-currency'))) ORDER BY created DESC,id DESC",
        [p.id, member],
      );
    },
    async files(p: Access) {
      return query(
        "SELECT payload FROM pilot_items WHERE pilot_id=$1 AND kind='file' AND NOT hidden ORDER BY created DESC",
        [p.id],
      );
    },
    async protectedProof(p: Access, id: string) {
      return !!(await one(
        `SELECT 1 FROM pilot_items i WHERE i.pilot_id=$1 AND i.kind='money' AND
        (i.payload->>'type' IN ('payment_row','approval','plan_version') OR i.payload->>'state' IN ('claimed','accepted') OR (
          i.payload->>'type' IN ('invoice','row_entry') AND EXISTS(SELECT 1 FROM pilot_items c WHERE c.pilot_id=i.pilot_id AND c.id=i.payload->>'costId' AND c.kind='money' AND c.payload->>'state' IN ('claimed','accepted')))) AND
        jsonb_path_exists(i.payload,'lax $.** ? (@ == $file)',jsonb_build_object('file',$2::text)) LIMIT 1`,
        [p.id, id],
      ));
    },
    async history(p: Access, id: string) {
      return query(
        "SELECT payload->'entry' AS entry,created FROM pilot_items WHERE pilot_id=$1 AND kind='history' AND payload->>'item'=$2 ORDER BY created DESC,id DESC",
        [p.id, id],
      );
    },
    async currentRevision(p: Access) {
      return Number((await one('SELECT revision FROM pilots WHERE id=$1', [p.id]))?.revision);
    },
    async reserveFile(p: Access, rev: number, f: Evidence, by: string, quota: number) {
      return one(
        `WITH bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND
        (SELECT COALESCE(sum(CASE WHEN kind='photo' THEN COALESCE((payload->>'size')::int,400000) ELSE (payload->>'size')::int END),0) FROM pilot_items WHERE pilot_id=$1 AND kind IN ('photo','file')) + $3::int <= $4::int RETURNING id,revision),
        reserved AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by,hidden) SELECT id,$5,'file',$6::jsonb,$7,true FROM bump) SELECT revision FROM bump`,
        [p.id, rev, f.size, quota, f.id, JSON.stringify(f), by],
      );
    },
    async publishFile(p: Access, id: string) {
      return one(
        `WITH done AS (UPDATE pilot_items SET hidden=false WHERE pilot_id=$1 AND id=$2 AND kind='file' AND hidden RETURNING pilot_id) UPDATE pilots SET revision=revision+1,updated=now() FROM done WHERE pilots.id=done.pilot_id RETURNING revision`,
        [p.id, id],
      );
    },
    async rules(p: Access, rev: number, rules: Rules) {
      return one(
        'UPDATE pilots SET role_rules=$3::jsonb,revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 RETURNING revision',
        [p.id, rev, JSON.stringify(rules)],
      );
    },
    async links(p: Access) {
      return query(
        "SELECT payload FROM pilot_items WHERE pilot_id=$1 AND kind='money' AND payload->>'type'='link_log' ORDER BY created DESC",
        [p.id],
      );
    },
    async ledger(p: Access) {
      return query(
        "SELECT payload,hidden FROM pilot_items WHERE pilot_id=$1 AND kind='money' AND NOT hidden AND payload->>'type' NOT IN ('change_log','checker_log','link_log') ORDER BY created,id",
        [p.id],
      );
    },
    async marks(p: Access, seat: string) {
      return (
        await one(
          "SELECT payload FROM pilot_items WHERE pilot_id=$1 AND kind='money' AND NOT hidden AND payload->>'type'='member_marks' AND payload->>'memberId'=$2",
          [p.id, seat],
        )
      )?.payload;
    },
    async financeBasis(p: Access, seat: string) {
      return query(
        `SELECT payload FROM pilot_items i WHERE i.pilot_id=$1 AND i.kind='money' AND NOT i.hidden AND
       (i.id='book-currency' OR i.payload->>'type' IN ('rate','payment_row','settings') OR (i.payload->>'type'='row_entry' AND EXISTS(SELECT 1 FROM pilot_items c WHERE c.pilot_id=$1 AND c.id=i.payload->>'costId' AND c.kind='money' AND c.payload->>'whose'=$2)))`,
        [p.id, seat],
      );
    },
    async ownFinance(p: Access, seat: string, invoices: boolean, partner: boolean, pay: boolean) {
      return query(
        `SELECT payload FROM pilot_items WHERE pilot_id=$1 AND kind='money' AND NOT hidden AND (
      ($3 AND payload->>'type'='invoice' AND payload->>'sender'=$2)
      OR ($4 AND ((payload->>'type'='cost_row' AND payload->>'whose'=$2 AND payload->>'costType'<>'staff') OR (payload->>'type'='transfer' AND payload->>'partner'=$2)))
      OR ($5 AND payload->>'type'='pay_row' AND payload->>'memberId'=$2)) ORDER BY created,id`,
        [p.id, seat, invoices, partner, pay],
      );
    },
    async financeHistory(p: Access, id: string) {
      return query(
        "SELECT payload FROM pilot_items WHERE pilot_id=$1 AND kind='money' AND NOT hidden AND payload->>'type'='change_log' AND payload->>'record'=$2 ORDER BY created DESC",
        [p.id, id],
      );
    },
    async moneyFileForSeat(
      p: Access,
      id: string,
      seat: string,
      invoices: boolean,
      partner: boolean,
    ) {
      return !!(await one(
        `SELECT 1 FROM pilot_items WHERE pilot_id=$1 AND kind='money' AND NOT hidden AND
      (($4 AND payload->>'type'='invoice' AND payload->>'sender'=$3 AND payload->>'state' NOT IN ('withdrawn','refused') AND $2::text IN (payload->>'file',payload->>'delivery',payload->>'integrity'))
      OR ($5 AND payload->>'type'='cost_row' AND payload->>'whose'=$3 AND EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'proofs') f WHERE f->>'file'=$2))) LIMIT 1`,
        [p.id, id, seat, invoices, partner],
      ));
    },
    async ledgerCommit(
      p: Access,
      rev: number,
      rows: { id: string; payload: unknown; hidden: boolean }[],
      by: string,
      fileIds: string[] = [],
    ) {
      return one(
        `WITH changes AS (SELECT * FROM jsonb_to_recordset($3::jsonb) AS v(id text,payload jsonb,hidden boolean)),
      bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND NOT EXISTS(
        SELECT 1 FROM changes c JOIN pilot_items i ON i.pilot_id=$1 AND i.id=c.id WHERE i.kind<>'money'
      ) RETURNING id,revision), saved AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by,hidden)
        SELECT bump.id,c.id,'money',c.payload,$4,c.hidden FROM bump CROSS JOIN changes c ON CONFLICT(pilot_id,id) DO UPDATE SET payload=EXCLUDED.payload,hidden=EXCLUDED.hidden,updated=now()),
      marked AS (UPDATE pilot_items SET payload=jsonb_set(payload,'{money}','true'::jsonb),updated=now() FROM bump WHERE pilot_id=bump.id AND kind='file' AND pilot_items.id=ANY($5::text[])) SELECT revision FROM bump`,
        [p.id, rev, JSON.stringify(rows), by, fileIds],
      );
    },
    async memberRole(p: Access, id: string) {
      return one('SELECT role FROM pilot_members WHERE pilot_id=$1 AND id=$2', [p.id, id]);
    },
    async money(p: Access) {
      return query(
        "SELECT payload FROM pilot_items WHERE pilot_id=$1 AND kind='money' AND (payload->>'type'='pay_row' OR (payload->>'type'='budget_line' AND NOT (payload ? 'version'))) AND NOT hidden ORDER BY created,id",
        [p.id],
      );
    },
    async programme(owner: string) {
      return query(
        "SELECT p.slug,p.name,i.payload FROM pilots p JOIN pilot_items i ON i.pilot_id=p.id AND i.kind='site' AND NOT i.hidden WHERE p.owner_id=$1 ORDER BY p.created,i.created",
        [owner],
      );
    },
    async access(slug: string, a: Actor) {
      return (await one(
        `SELECT p.*,m.id AS member_id,m.role,m.first_name,m.link_id,m.cookie_expires AS expires FROM pilots p LEFT JOIN pilot_members m ON ${membership} WHERE p.slug=$3 AND (p.owner_id=$1 OR m.id IS NOT NULL)`,
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
        `SELECT p.name,p.slug,p.lane,p.state,p.summary,p.revision,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',m.first_name,'organisation',m.organisation,'role',m.role,'state',m.state) ORDER BY m.created,m.id) FROM pilot_members m WHERE m.pilot_id=p.id),'[]') AS members,COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',i.kind,'payload',i.payload,'author',i.created_by) ORDER BY i.created,i.id) FROM pilot_items i WHERE i.pilot_id=p.id AND i.kind NOT IN ('money','file','history') AND (NOT i.hidden OR ($2 AND i.kind='photo'))),'[]') AS items FROM pilots p WHERE p.id=$1`,
        [p.id, owner],
      );
      return d;
    },
    async join(slug: string, invite: string, cookie: string) {
      return one(
        `WITH joined AS (UPDATE pilot_members m SET cookie_key_hash=$3,cookie_expires=now()+interval '30 days',invite_hash=NULL,invite_expires=NULL,state='active',last_seen=now() FROM pilots p WHERE m.pilot_id=p.id AND p.slug=$1 AND m.invite_hash=$2 AND m.invite_expires>now() AND (m.role<>'checker' OR m.checker_until >= (now() AT TIME ZONE 'Indian/Mauritius')::date) AND m.state IN ('invited','active') RETURNING m.pilot_id,m.link_id), used AS (UPDATE pilot_items i SET payload=jsonb_set(i.payload,'{firstUse}',to_jsonb(now())),updated=now() FROM joined j WHERE i.pilot_id=j.pilot_id AND i.id=j.link_id::text AND i.kind='money' AND i.payload->>'type'='link_log' AND i.payload->>'firstUse' IS NULL) UPDATE pilots SET revision=revision+1, updated=now() FROM joined WHERE pilots.id=joined.pilot_id RETURNING pilots.id`,
        [slug, invite, cookie],
      );
    },
    async invite(
      p: Access,
      rev: number,
      m: { id: string; name: string; organisation: string; role: string; endDate?: string },
      invite: string,
    ) {
      return one(
        `WITH bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND (SELECT count(*) FROM pilot_members WHERE pilot_id=$1)<150 RETURNING id,revision), added AS (INSERT INTO pilot_members(pilot_id,id,first_name,organisation,role,state,invite_hash,invite_expires,checker_until,link_id) SELECT id,$3,$4,$5,$6,'invited',$7,now()+interval '7 days',$8::date,gen_random_uuid() FROM bump RETURNING pilot_id,id,role,link_id), logged AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by) SELECT pilot_id,link_id::text,'money',jsonb_build_object('id',link_id::text,'type','link_log','version',1,'seat',id,'role',role,'kind','link','madeBy','owner','madeAt',now(),'firstUse',null),'lead' FROM added WHERE role IN ('lead','coordinator')) SELECT revision FROM bump`,
        [p.id, rev, m.id, m.name, m.organisation, m.role, invite, m.endDate ?? null],
      );
    },
    async changeRole(
      p: Access,
      rev: number,
      id: string,
      role: string,
      endDate: string | null,
      invite: string,
    ) {
      return one(
        `WITH bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND EXISTS(SELECT 1 FROM pilot_members WHERE pilot_id=$1 AND id=$3 AND id<>'lead' AND role<>$4) RETURNING id,revision),
      changed AS (UPDATE pilot_members m SET role=$4,checker_until=$5::date,invite_hash=$6,invite_expires=now()+interval '7 days',cookie_key_hash=NULL,cookie_expires=NULL,link_id=gen_random_uuid() FROM bump WHERE m.pilot_id=bump.id AND m.id=$3 RETURNING m.*),
      marks AS (SELECT i.pilot_id,i.id,i.payload AS before,i.payload || jsonb_build_object(
        'invoices',COALESCE((i.payload->>'invoices')::boolean,false) AND m.role IN ('technology supplier','tester','adviser'),
        'partner',COALESCE((i.payload->>'partner')::boolean,false) AND m.role IN ('technology supplier','tester','adviser','viewer','host'),
        'staff',COALESCE((i.payload->>'staff')::boolean,false) AND m.role<>'checker') AS after FROM changed m JOIN pilot_items i ON i.pilot_id=m.pilot_id AND i.kind='money' AND i.payload->>'type'='member_marks' AND i.payload->>'memberId'=m.id),
      cleared AS (UPDATE pilot_items i SET payload=m.after,updated=now() FROM marks m WHERE i.pilot_id=m.pilot_id AND i.id=m.id AND m.before<>m.after RETURNING m.*),
      audited AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by) SELECT c.pilot_id,g.id,'money',jsonb_build_object('id',g.id,'type','change_log','version',2,'record',c.id,'at',now(),'who',jsonb_build_object('seat','owner','link',null,'at',now()),'fields',jsonb_build_array('invoices','partner','staff'),'before',c.before,'after',c.after,'reason','Role changed'),'lead' FROM cleared c CROSS JOIN LATERAL (SELECT gen_random_uuid()::text AS id) g),
      logged AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by) SELECT pilot_id,link_id::text,'money',jsonb_build_object('id',link_id::text,'type','link_log','version',1,'seat',id,'role',role,'kind','role change','madeBy','owner','madeAt',now(),'firstUse',null),'lead' FROM changed WHERE role IN ('lead','coordinator')) SELECT revision FROM bump`,
        [p.id, rev, id, role, endDate, invite],
      );
    },
    async renew(p: Access, rev: number, member: string, invite: string) {
      return one(
        `WITH bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND EXISTS(SELECT 1 FROM pilot_members WHERE pilot_id=$1 AND id=$3 AND id<>'lead') RETURNING id,revision),
        renewed AS (UPDATE pilot_members m SET invite_hash=$4,invite_expires=now()+interval '7 days',cookie_key_hash=NULL,cookie_expires=NULL,link_id=gen_random_uuid() FROM bump WHERE m.pilot_id=bump.id AND m.id=$3 RETURNING m.pilot_id,m.id,m.role,m.link_id), logged AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by) SELECT pilot_id,link_id::text,'money',jsonb_build_object('id',link_id::text,'type','link_log','version',1,'seat',id,'role',role,'kind','replacement link','madeBy','owner','madeAt',now(),'firstUse',null),'lead' FROM renewed WHERE role IN ('lead','coordinator')) SELECT revision FROM bump`,
        [p.id, rev, member, invite],
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
      manageMoney = false,
      assignedPaper = false,
    ) {
      const edit = patch
        ? 'UPDATE pilot_items i SET payload=$5::jsonb,hidden=$7,updated=now() FROM bump WHERE i.pilot_id=bump.id AND i.id=$4 AND i.kind=$3 AND ($8 OR i.created_by=$6) RETURNING i.id'
        : "INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by,hidden) SELECT id,$4,$3,$5::jsonb,$6,$7 FROM bump ON CONFLICT (pilot_id,id) DO UPDATE SET hidden=false,payload=EXCLUDED.payload,updated=now() WHERE pilot_items.hidden AND pilot_items.kind=EXCLUDED.kind AND pilot_items.kind IN ('camera','schedule') RETURNING id";
      return one(
        `WITH bump AS (UPDATE pilots SET revision=revision+1,updated=now() WHERE id=$1 AND revision=$2 AND ${patch ? 'EXISTS(SELECT 1 FROM pilot_items WHERE pilot_id=$1 AND id=$4 AND kind=$3 AND ($8 OR created_by=$6))' : "NOT EXISTS(SELECT 1 FROM pilot_items WHERE pilot_id=$1 AND id=$4 AND NOT (kind=$3 AND kind IN ('camera','schedule') AND hidden)) AND (SELECT count(*) FROM pilot_items WHERE pilot_id=$1 AND kind=$3 AND (NOT hidden OR kind='photo')) < CASE $3 WHEN 'site' THEN 150 WHEN 'photo' THEN 200 WHEN 'step' THEN 100 WHEN 'readingType' THEN 100 WHEN 'baseline' THEN 150 WHEN 'schedule' THEN 1 WHEN 'paper' THEN 200 WHEN 'camera' THEN 150 ELSE 3000 END"} RETURNING id,revision), edited AS (${edit}), logged AS (INSERT INTO pilot_items(pilot_id,id,kind,payload,created_by) SELECT $1,gen_random_uuid()::text,'history',jsonb_build_object('item',$4::text,'entry',$5::jsonb),$6 FROM edited WHERE $3 IN ('paper','step','reading','sample','log','note','schedule','readingType','baseline')) SELECT revision FROM bump`,
        [
          p.id,
          rev,
          kind,
          id,
          JSON.stringify(payload),
          by,
          hidden,
          ...(patch
            ? [
                by === 'lead' ||
                  (kind === 'money' && manageMoney) ||
                  (kind === 'paper' && assignedPaper),
              ]
            : []),
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
