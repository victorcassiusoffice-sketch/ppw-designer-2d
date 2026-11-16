import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { id } from '../../src/pilots/contract.js';
import { jobSchema, visitGeometry } from '../../src/pilots/buildRecord.js';
import { revision } from '../../src/pilots/sharedContract.js';
import { levelFor } from '../../src/pilots/access.js';
import type { Access, hostedPilots } from '../_db/pilotStore.js';
import type { MinRes } from './sentry.js';
export async function pilotBuild(
  db: ReturnType<typeof hostedPilots>,
  p: Access,
  owner: boolean,
  by: string,
  action: string,
  key: string | undefined,
  method: string | undefined,
  body: () => Promise<unknown>,
  res: MinRes,
) {
  const ok = (data: unknown) => res.status(200).json(data),
    deny = () => res.status(403).json({ error: 'Ask the owner for your link.' }),
    clash = () => res.status(409).json({ error: 'The pilot changed. Reload and try again.' });
  if (action === 'build-context' && !key && method === 'GET' && owner) {
    return ok({
      revision: p.revision,
      sites: await db.buildChoices(p, 'site'),
      steps: await db.buildChoices(p, 'step'),
    });
  }
  if (action === 'site-wall' && key && id.safeParse(key).success && method === 'GET') {
    if (levelFor(p.role_rules, owner, p.role, 'notes') === 'none') return deny();
    const site = await db.item(p, key);
    if (!site || site.hidden || site.kind !== 'site') return deny();
    const linked = site.payload as { plan?: string; photoWall?: boolean };
    const frame = linked.photoWall ? await db.latestWallPhoto(p, key) : undefined;
    if (!owner && p.role === 'checker')
      await db.checkerRead(p, 'site-wall', frame ? [String(frame.id)] : []);
    return ok({ plan: linked.plan, frame: frame?.id ?? null });
  }
  if (action === 'trade-jobs' && !key) {
    if (method === 'GET') {
      if (levelFor(p.role_rules, owner, p.role, 'steps') === 'none') return deny();
      const jobs = (await db.jobs(p)).map((r) => jobSchema.parse(r.payload));
      if (!owner && p.role === 'checker')
        await db.checkerRead(
          p,
          'trade-jobs',
          jobs.map((j) => j.id),
        );
      return ok({ jobs });
    }
    if (!owner || method !== 'POST') return deny();
    const v = z
        .object({ revision, job: jobSchema, hide: z.boolean().default(false) })
        .strict()
        .parse(await body()),
      site = await db.item(p, v.job.site),
      step = await db.item(p, v.job.step),
      prior = await db.item(p, v.job.id);
    if (
      !site ||
      site.hidden ||
      site.kind !== 'site' ||
      !step ||
      step.hidden ||
      step.kind !== 'step' ||
      (prior && (prior.hidden || prior.kind !== 'trade_job')) ||
      (v.hide && !prior)
    )
      return deny();
    return (await db.saveItem(p, v.revision, 'trade_job', v.job.id, v.job, by, !!prior, v.hide))
      ? ok({ saved: true })
      : clash();
  }
  if (action === 'site-plan' && key && id.safeParse(key).success) {
    const site = await db.item(p, key);
    if (!site || site.hidden || site.kind !== 'site') return deny();
    const linked = site.payload as { plan?: string; name: string };
    if (method === 'GET') {
      const rows = await db.siteSnapshot(p, key);
      if (!rows.length) return deny();
      const property = JSON.parse(rows.map((r) => String(r.part)).join(''));
      if (!linked.plan || property.id !== linked.plan) return deny();
      if (!owner && p.role === 'checker')
        await db.checkerRead(
          p,
          'site-plan',
          rows.map((r) => String(r.id)),
        );
      return ok({
        site: { id: key, name: linked.name },
        property,
      });
    }
    if (!owner || method !== 'POST') return deny();
    const v = z
      .object({ revision, property: z.unknown().optional(), hide: z.literal(true).optional() })
      .strict()
      .parse(await body());
    if (v.hide) {
      if (v.property !== undefined) return deny();
      return (await db.storeSnapshot(p, v.revision, key, [], by)) ? ok({ hidden: true }) : clash();
    }
    let property;
    try {
      property = visitGeometry(v.property);
    } catch {
      return res.status(400).json({ error: 'Choose a valid saved plan with measured rooms.' });
    }
    if (!linked.plan || property.id !== linked.plan) return deny();
    const raw = JSON.stringify(property),
      parts = Array.from(raw.matchAll(/[\s\S]{1,2700}/gu), (m, i) => ({
        id: randomUUID(),
        site: key,
        order: i,
        part: m[0],
      }));
    return (await db.storeSnapshot(p, v.revision, key, parts, by)) ? ok({ saved: true }) : clash();
  }
  return deny();
}
