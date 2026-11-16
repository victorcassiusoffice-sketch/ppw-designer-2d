import { z } from 'zod';
import type { Access, hostedPilots } from '../_db/pilotStore.js';
import type { MinRes } from './sentry.js';
import { id } from '../../src/pilots/contract.js';
import { levelFor } from '../../src/pilots/access.js';
import { readsMoney, currency } from '../../src/pilots/money.js';
import { ledgerRow, typed, type Snapshot } from '../../src/pilots/ledger.js';
import { funderSet } from '../../src/pilots/funder.js';
import { eventSchema, indicatorSchema, packSchema } from '../../src/pilots/reports.js';
import { evidenceMeta } from '../../src/pilots/evidence.js';
import { revision } from '../../src/pilots/sharedContract.js';
import { saveLedger } from './pilotLedger.js';
type Db = ReturnType<typeof hostedPilots>;
function clean(raw: Record<string, unknown>) {
  const { audit, snapshot, ...row } = raw;
  return row;
}
export async function pilotReports(
  db: Db,
  p: Access,
  owner: boolean,
  by: string,
  action: string,
  key: string | undefined,
  method: string | undefined,
  body: () => Promise<unknown>,
  readFile: (path: string) => Promise<Buffer | null>,
  res: MinRes,
) {
  const reply = (s: number, data: unknown) => res.status(s).json(data),
    deny = () => reply(403, { error: 'Ask the owner for your link.' }),
    invalid = (s: string) => reply(400, { error: s }),
    clash = () => reply(409, { error: 'The pilot changed. Reload and try again.' });
  if (!readsMoney(owner, p.role)) return deny();
  const reportLevel = levelFor(p.role_rules, owner, p.role, 'reports'),
    checker = !owner && p.role === 'checker';
  if (action === 'export' || action === 'export-file') {
    if (method !== 'GET') return deny();
    if (action === 'export-file') {
      if (!key || !id.safeParse(key).success) return deny();
      const row = await db.item(p, key);
      if (!row || !['file', 'photo'].includes(String(row.kind))) return deny();
      if (checker) await db.checkerRead(p, action, [key]);
      const file = row.kind === 'file' ? evidenceMeta.parse(row.payload) : null;
      const path =
        'pilots/' +
        p.id +
        '/' +
        (file
          ? 'evidence/' + key
          : String((row.payload as { site: string }).site) + '/' + key + '.jpg');
      const bytes = await readFile(path);
      if (!bytes) return reply(404, { error: 'File unavailable.' });
      res.setHeader('Content-Type', file?.mime ?? 'image/jpeg');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      (res.status(200) as unknown as { end: (b: Buffer) => void }).end(bytes);
      return;
    }
    if (!key) {
      if (checker) await db.checkerRead(p, 'export', []);
      const d = await db.document(p, owner);
      return reply(200, {
        revision: p.revision,
        pilot: {
          name: p.name,
          lane: p.lane,
          state: p.state,
          summary: p.summary,
          slug: p.slug,
          members: d.members,
        },
      });
    }
    const match = /^(all|visible)-(\d+)-(\d+)$/.exec(key);
    if (!match) return invalid('Invalid archive page.');
    if (Number(match[2]) !== p.revision) return clash();
    const offset = Number(match[3]);
    if (!Number.isSafeInteger(offset) || offset > 10000000) return invalid('Invalid archive page.');
    const rows = await db.exportPage(p, match[1] === 'all', offset, checker);
    if (checker)
      await db.checkerRead(
        p,
        'export',
        rows.map((r) => String(r.id)),
      );
    return reply(200, { rows, next: rows.length === 60 ? offset + 60 : null });
  }
  if (reportLevel === 'none') return deny();
  const raw = (await db.ledger(p)).map((r) => r.payload as Record<string, unknown>),
    rows = raw
      .filter((r) => r.version === 2 && r.type !== 'pay_row')
      .map((r) => ledgerRow.parse(clean(r)));
  const periods = typed(rows, 'period'),
    book = currency.safeParse(raw.find((r) => r.id === 'book-currency')?.currency);
  const now = new Intl.DateTimeFormat('en-CA', {
    timeZone: typed(rows, 'settings')[0]?.timeZone ?? 'Indian/Mauritius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const set = (period: string) =>
    book.success
      ? funderSet(
          rows,
          book.data,
          Object.fromEntries(
            raw.filter((r) => r.snapshot).map((r) => [String(r.id), r.snapshot as Snapshot]),
          ),
          now,
          period,
        )
      : null;
  if (action === 'report-money') {
    if (method !== 'GET' || !key) return deny();
    const item = await db.item(p, key);
    if (!item || item.hidden || item.kind !== 'report') return deny();
    const pack = packSchema.parse(item.payload);
    if (checker)
      await db.checkerRead(
        p,
        'report-money',
        raw.map((r) => String(r.id)),
      );
    return reply(200, {
      currency: book.data,
      set: set(pack.period),
      file: pack.state === 'sent' ? periods.find((p) => p.id === pack.period)?.file : undefined,
    });
  }
  if (method === 'GET' && !key) {
    const list = await db.reportItems(p);
    if (checker)
      await db.checkerRead(
        p,
        'reports',
        list.map((r) => String(r.id)),
      );
    return reply(200, {
      revision: p.revision,
      events: list.filter((r) => r.kind === 'event').map((r) => eventSchema.parse(r.payload)),
      indicators: list
        .filter((r) => r.kind === 'indicator')
        .map((r) => indicatorSchema.parse(r.payload)),
      packs: list.filter((r) => r.kind === 'report').map((r) => packSchema.parse(r.payload)),
      periods: periods.map(({ id, number, start, end, final, sent }) => ({
        id,
        number,
        start,
        end,
        final,
        sent,
      })),
    });
  }
  if (method !== 'POST' || checker || reportLevel !== 'add' || key) return deny();
  const edit = z
    .object({
      revision,
      kind: z.enum(['event', 'indicator', 'report']),
      payload: z.unknown(),
      hide: z.boolean().optional(),
      moneyFile: id.optional(),
    })
    .strict()
    .parse(await body());
  const schema = { event: eventSchema, indicator: indicatorSchema, report: packSchema }[edit.kind],
    data = schema.parse(edit.payload);
  const prior = await db.item(p, data.id);
  if ((prior && (prior.hidden || prior.kind !== edit.kind)) || (edit.hide && !prior)) return deny();
  if (p.revision !== edit.revision) return clash();
  const evidence = async (key: string, money = false) => {
    const r = await db.item(p, key);
    if (!r || r.hidden || r.kind !== 'file') return null;
    const f = evidenceMeta.parse(r.payload);
    return f.money === money ? f : null;
  };
  if (edit.kind === 'event') {
    const d = eventSchema.parse(data),
      site = await db.item(p, d.site);
    if (!site || site.hidden || site.kind !== 'site') return invalid('Choose a pilot site.');
    for (const f of d.files) if (!(await evidence(f))) return deny();
  }
  if (edit.kind === 'indicator') {
    const d = indicatorSchema.parse(data);
    if (d.source.kind === 'typed' && !(await evidence(d.source.file))) return deny();
    if (d.source.kind === 'reading') {
      const t = await db.item(p, d.source.type),
        field = d.source.field;
      if (
        !t ||
        t.hidden ||
        t.kind !== 'readingType' ||
        !(t.payload as { fields: { id: string; kind: string }[] }).fields.some(
          (f) => f.id === field && f.kind === 'number',
        )
      )
        return invalid('Choose a numeric reading field.');
    }
  }
  if (edit.kind === 'report') {
    const pack = packSchema.parse(data),
      old = prior ? packSchema.parse(prior.payload) : undefined,
      period = periods.find((r) => r.id === pack.period);
    if (!period || period.final !== (pack.kind === 'final'))
      return invalid('Choose the matching report period.');
    const lead = !owner && p.role === 'lead';
    if (
      old?.state === 'sent' ||
      (!old && pack.state !== 'draft') ||
      (old && old.state !== pack.state && !lead) ||
      (old?.state === 'approved' && edit.hide)
    )
      return deny();
    if (pack.approvedDate !== old?.approvedDate || pack.sentDate !== old?.sentDate) return deny();
    for (const id of pack.photos) {
      const photo = await db.item(p, id);
      if (!photo || photo.hidden || photo.kind !== 'photo') return deny();
    }
    if (old?.state === 'approved' && (!lead || pack.state !== 'sent')) return deny();
    if (pack.state === 'approved') {
      if (!lead || old?.state !== 'draft') return deny();
      if (pack.kind === 'final' && set(pack.period)?.assetsReady !== true)
        return invalid('Complete the asset handovers first.');
      pack.approvedDate = now;
    }
    if (pack.state === 'sent') {
      if (!lead || old?.state !== 'approved' || !pack.file || !edit.moneyFile || period.sent)
        return deny();
      const paper = await evidence(pack.file),
        money = await evidence(edit.moneyFile, true);
      if (
        paper?.kind !== 'report' ||
        paper.source !== 'report pack' ||
        paper.mime !== 'application/pdf' ||
        money?.kind !== 'report' ||
        money.mime !== 'application/pdf'
      )
        return deny();
      const { file, ...submitted } = pack;
      if (
        JSON.stringify(packSchema.parse({ ...submitted, state: 'approved' })) !==
        JSON.stringify(old)
      )
        return invalid('Send the approved pack without changing its contents.');
      pack.sentDate = now;
      const result = await saveLedger(
        db,
        p,
        owner,
        by,
        { revision: edit.revision, row: { ...period, sent: now, file: edit.moneyFile } },
        false,
        { id: pack.id, payload: pack },
      );
      return result ? reply(200, { saved: true }) : clash();
    }
    if (pack.file || edit.moneyFile) return deny();
    return (await db.saveItem(
      p,
      edit.revision,
      'report',
      pack.id,
      pack,
      by,
      !!prior,
      !!edit.hide,
      false,
      false,
      true,
    ))
      ? reply(200, { saved: true })
      : clash();
  }
  if (edit.moneyFile) return deny();
  return (await db.saveItem(
    p,
    edit.revision,
    edit.kind,
    data.id,
    data,
    by,
    !!prior,
    !!edit.hide,
    false,
    false,
    true,
  ))
    ? reply(200, { saved: true })
    : clash();
}
