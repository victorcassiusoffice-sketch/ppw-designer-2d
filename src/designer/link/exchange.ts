/** Browser-owned work ledger. Decision invariants ported from Trade Folder
 * aa81052:src/lib/jobPack/records.ts (SHA256 83e83e3e58dce711d84040dc472a395000ed28b114e31e8b68ef16caea4e5e40).
 * Incoming reports never create approvals. Historic sends remain separate.
 */
import { z } from 'zod';
import type { WorkPackage } from './planView';
import { canonical, parsePack, realDay } from './vendor/tradefolder/lib/jobPack/protocol';
import type {
  QuotePack,
  StatusPack,
  InvoicePack,
  RequestPack,
} from './vendor/tradefolder/lib/jobPack/types';
import { parseWorkPackage } from './planView';
import { applyJobEvent, workerName, type JobEvent, type JobInfo, type TradeClaim } from './tradeJobs';

export type AnswerPack = QuotePack | StatusPack | InvoicePack;
const instant = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const label = z.string().trim().min(1).max(160);
const actorSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.enum(['owner', 'engineer', 'contractor']),
  })
  .strict();
export type Actor = z.infer<typeof actorSchema>;
const quantity = z
  .object({
    item: label,
    qty: z.number().finite().min(0.001).max(1000000),
    unit: z.string().trim().min(1).max(30),
    planRef: z
      .string()
      .regex(
        /^olb:(level|room|wall|opening|run|item|mat|fnd|city-road|city-net|city-asset):[a-zA-Z0-9_.:-]+$/,
      )
      .max(120)
      .optional(),
  })
  .strict();
const draftSchema = z
  .object({
    id,
    projectId: id,
    projectLabel: label,
    sourceKey: label,
    title: label,
    scope: z.string().max(2000),
    trade: z.string().trim().min(1).max(60),
    levelIds: z.array(z.string().min(1).max(100)).max(32),
    quantities: z.array(quantity).max(50),
    siteId: id,
    siteLabel: label,
    siteKind: z.enum(['build-site', 'house', 'lot']),
    phase: z.string().trim().min(1).max(60),
    preferredDates: z.array(z.string().refine(realDay)).max(20),
    currency: z.string().regex(/^[A-Z]{3}$/),
    company: z.string().trim().min(1).max(120),
    requester: z.enum(['developer', 'company']),
    planned: z.number().finite().min(0).max(1e12).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type PackageDraft = z.infer<typeof draftSchema>;
type Stamp = { by: Actor; at: string };
type QuoteRow = { pack: QuotePack; decision?: Stamp & { choice: 'approved' | 'declined' } };
type InvoiceRow = {
  pack: InvoicePack;
  accepted?: Stamp;
  rejected?: Stamp;
  paid?: Stamp & { on: string; method: string; reference: string };
};
export interface RequestExchange {
  work: WorkPackage;
  request: RequestPack;
  quotes: QuoteRow[];
  statuses: StatusPack[];
  invoices: InvoiceRow[];
}
export type LinkPackage = {
  draft: PackageDraft;
  job?: JobInfo;
  claim?: TradeClaim;
  sends: RequestExchange[];
  updatedAt: string;
  history: { at: string; label: string; requestId?: string; by?: Actor; worker?: string; fileSender?: string; fileId?:string }[];
};
export type Choice = 'approved' | 'declined' | 'accepted' | 'rejected';
export type LinkEvent =
  | JobEvent
  | { kind: 'draft'; at: string; draft: PackageDraft; byName?:string }
  | { kind: 'send'; at: string; work: WorkPackage; byName?:string }
  | { kind: 'answer'; at: string; pack: AnswerPack }
  | { kind: 'decide'; at: string; requestId: string; answerId: string; choice: Choice; by: Actor }
  | {
      kind: 'pay';
      at: string;
      requestId: string;
      answerId: string;
      by: Actor;
      on: string;
      method: string;
      reference: string;
    };

const newest = <T>(items: readonly T[]): T | undefined => items[items.length - 1];
const fail = (message: string): never => {
  throw new Error(message);
};
function ownerOf(rows: LinkPackage[], requestId: string) {
  for (const row of rows) {
    const send = row.sends.find((s) => s.request.id === requestId);
    if (send) return { row, send };
  }
  return fail(
    'This browser has not sent that request. Choose an answer for a package on this dashboard.',
  );
}
const packs = (s: RequestExchange) => [
  s.request,
  ...s.quotes.map((q) => q.pack),
  ...s.statuses,
  ...s.invoices.map((i) => i.pack),
];
function existingId(rows: LinkPackage[], id: string) {
  for (const row of rows)
    for (const s of row.sends) {
      const p = packs(s).find((p) => p.id === id);
      if (p) return p;
    }
}
function quoteFor(send: RequestExchange, pack: StatusPack | InvoicePack) {
  const quote = send.quotes.find((q) => q.pack.id === pack.quoteId);
  if (!quote) return fail('Add the matching quote to this request first.');
  if (quote.pack.from.label !== pack.from.label)
    return fail('This answer names a different tradesperson. Ask them for a corrected copy.');
  return quote;
}
function receive(rows: LinkPackage[], pack: AnswerPack): RequestExchange {
  if (pack.from.app !== 'tradefolder') return fail('Choose an answer from Trade Folder.');
  const { send } = ownerOf(rows, pack.requestId);
  const existing = existingId(rows, pack.id);
  if (
    existing &&
    (existing.sha256 !== pack.sha256 ||
      existing.kind !== pack.kind ||
      existing.requestId !== pack.requestId)
  )
    return fail('This answer ID already has different contents. Ask for a new copy.');
  if ('currency' in pack && pack.currency !== send.request.currency)
    return fail(
      'This answer uses a different currency from the request. Ask for a corrected copy.',
    );
  if (existing) return send;
  if (pack.kind === 'quote') {
    if (send.quotes.some((q) => q.decision?.choice === 'approved'))
      return fail('A quote is already approved. Send an update for changed work.');
    return { ...send, quotes: [...send.quotes, { pack }] };
  }
  const quote = quoteFor(send, pack);
  if (pack.kind === 'status')
    return {
      ...send,
      statuses: [...send.statuses, pack].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    };
  if (quote.decision?.choice !== 'approved')
    return fail('Approve the matching quote before adding its invoice.');
  if (send.invoices.some((i) => i.accepted))
    return fail(
      'An invoice is already accepted for this request. Send a new request for extra work.',
    );
  return { ...send, invoices: [...send.invoices, { pack }] };
}
/** Read-only preview preflight; saving runs the same checks again. */
export function checkAnswer(rows: LinkPackage[], pack: AnswerPack): LinkPackage {
  receive(rows, pack);
  return ownerOf(rows, pack.requestId).row;
}
export function nextRevision(rows: LinkPackage[], projectId: string, fingerprint: string): number {
  if (!/^[a-f0-9]{64}$/.test(fingerprint))
    return fail('The plan fingerprint is missing or invalid.');
  const plans = rows
    .filter((r) => r.draft.projectId === projectId)
    .flatMap((r) => r.sends.map((s) => s.work.planView?.plan));
  const last = plans.reduce<(typeof plans)[number]>(
    (best, p) => (p && (!best || p.revision > best.revision) ? p : best),
    undefined,
  );
  return last ? last.revision + Number(last.fingerprint !== fingerprint) : 1;
}
function replace(rows: LinkPackage[], row: LinkPackage, next: LinkPackage) {
  return rows.map((r) => (r === row ? next : r));
}
function changedSend(
  rows: LinkPackage[],
  row: LinkPackage,
  send: RequestExchange,
  next: RequestExchange,
  e: LinkEvent,
  caption: string,
  by?: Actor,
) {
  if (send === next) return rows;
  return replace(rows, row, {
    ...row,
    sends: row.sends.map((s) => (s === send ? next : s)),
    updatedAt: e.at,
    history: [
      ...row.history,
      { at: e.at, requestId: send.request.id, label: caption, ...(by ? { by } : {}), ...(e.kind==='answer'?{fileSender:e.pack.from.label,fileId:e.pack.id}:{}) },
    ],
  });
}
function withDecision(
  send: RequestExchange,
  e: Extract<LinkEvent, { kind: 'decide' }>,
): RequestExchange {
  const { answerId, choice, at, by } = e;
  if (choice === 'approved' || choice === 'declined') {
    const row = send.quotes.find((q) => q.pack.id === answerId);
    if (!row || row.decision) return fail('This quote is missing or has already been decided.');
    if (
      choice === 'approved' &&
      (row.pack.validUntil < at.slice(0, 10) || row.pack.expiresAt <= at)
    )
      return fail('This quote has expired. Ask for a new quote.');
    if (choice === 'approved' && send.quotes.some((q) => q.decision?.choice === 'approved'))
      return fail('Another quote is already approved for this request.');
    return {
      ...send,
      quotes: send.quotes.map((q) => (q === row ? { ...q, decision: { by, at, choice } } : q)),
    };
  }
  const row = send.invoices.find((i) => i.pack.id === answerId);
  if (!row || row.accepted || row.rejected)
    return fail('This invoice is missing or has already been decided.');
  if (
    choice === 'accepted' &&
    (send.invoices.some((i) => i.accepted) ||
      quoteFor(send, row.pack).decision?.choice !== 'approved')
  )
    return fail('Only one invoice for the approved quote can be accepted per request.');
  return {
    ...send,
    invoices: send.invoices.map((i) => (i === row ? { ...i, [choice]: { by, at } } : i)),
  };
}
function withPayment(
  send: RequestExchange,
  e: Extract<LinkEvent, { kind: 'pay' }>,
): RequestExchange {
  const { answerId, by, at, on, method, reference } = e;
  const row = send.invoices.find((i) => i.pack.id === answerId);
  if (!row?.accepted || row.paid)
    return fail('Accept this invoice first. A payment can be recorded only once.');
  if (
    !realDay(on) ||
    on > at.slice(0, 10) ||
    !['bank', 'cash', 'cheque', 'other', 'juice'].includes(method) ||
    !reference.trim() ||
    reference.length > 120
  )
    return fail('Check the payment date, method and reference.');
  return {
    ...send,
    invoices: send.invoices.map((i) =>
      i === row ? { ...i, paid: { by, at, on, method, reference: reference.trim() } } : i,
    ),
  };
}
/** Pure async only to check hashes; same ordered transitions for live writes and restoring a backup. */
export async function applyLinkEvent(rows: LinkPackage[], e: LinkEvent): Promise<LinkPackage[]> {
  if (!instant.safeParse(e.at).success) return fail('Use a valid date and time.');
  if(e.kind==='trade-job'||e.kind==='trade-take'||e.kind==='trade-edit')return applyJobEvent(rows,e);
  if (e.kind === 'draft') {
    const parsed = draftSchema.safeParse(e.draft);
    if (!parsed.success)
      return fail('Check the package details: ' + parsed.error.issues[0].path.join('.') + '.');
    const d = parsed.data,
      row = rows.find((r) => r.draft.id === d.id);
    if (row && (row.draft.projectId !== d.projectId || row.draft.sourceKey !== d.sourceKey))
      return fail('Cannot reassign a package to another project or source.');
    if (row && canonical(row.draft) === canonical(d)) return rows;
    if ((row?.job || row?.claim) && !workerName.safeParse(e.byName).success)
      return fail('Enter your name before changing this trade’s work.');
    if (row?.job && (d.trade!==row.draft.trade || canonical(d.levelIds)!==canonical(row.draft.levelIds)))
      return fail('Use the pinned job editor to change its location.');
    const history = { at: e.at, label: row ? 'Package details edited' : 'Draft created', ...(e.byName?{worker:e.byName.trim()}:{}) };
    return row
      ? replace(rows, row, {
          ...row,
          draft: d,
          ...(row.job && canonical(d.preferredDates)!==canonical(row.draft.preferredDates)
            ? {job:{...row.job, startDate:d.preferredDates[0],dueDate:d.preferredDates[1]}} : {}),
          updatedAt: e.at,
          history: [...row.history, history],
        })
      : [...rows, { draft: d, sends: [], updatedAt: e.at, history: [history] }];
  }
  if (e.kind === 'send') {
    const work = await parseWorkPackage(e.work, e.at),
      { request: r, planView: v } = work;
    if (!v) return fail('Attach the design view before recording this send.');
    const row = rows.find((i) => i.draft.id === v.package.id);
    if (!row) return fail('Save the reviewed package before sending.');
    const existing = existingId(rows, r.id);
    if (existing) {
      const prior = row.sends.find((s) => s.request.id === r.id);
      if (prior && canonical(prior.work) === canonical(work)) return rows;
      return fail('This request ID has already been used.');
    }
    if (rows.some((i) => i.sends.some((s) => s.work.planView?.id === v.id)))
      return fail('This plan view ID has already been used.');
    if ((row.job || row.claim) && !workerName.safeParse(e.byName).success)
      return fail('Enter your name before sharing this trade’s work.');
    const d = row.draft;
    if (
      v.project.id !== d.projectId ||
      v.project.label !== d.projectLabel ||
      v.site.id !== d.siteId ||
      v.site.label !== d.siteLabel ||
      v.site.kind !== d.siteKind ||
      v.phase !== d.phase ||
      v.package.title !== d.title ||
      v.package.trade !== d.trade ||
      r.title !== d.title ||
      r.trade !== d.trade ||
      r.description !== d.scope ||
      r.currency !== d.currency ||
      r.from.label !== d.company ||
      r.requester.type !== d.requester ||
      r.requester.label !== d.company ||
      r.site.label !== d.siteLabel ||
      r.site.kind !== d.siteKind ||
      canonical(r.preferredDates ?? []) !== canonical(d.preferredDates) ||
      canonical(r.quantities ?? []) !== canonical(d.quantities)
    )
      return fail(
        'Package details changed since preparation. Review the current package before sending.',
      );
    if (v.plan.revision !== nextRevision(rows, d.projectId, v.plan.fingerprint))
      return fail('The project revision changed. Prepare the current version again.');
    const next: RequestExchange = { work, request: r, quotes: [], statuses: [], invoices: [] };
    return replace(rows, row, {
      ...row,
      sends: [...row.sends, next],
      updatedAt: e.at,
      history: [
        ...row.history,
        { at: e.at, requestId: r.id, label: 'Request sent · plan revision ' + v.plan.revision, ...(e.byName?{worker:e.byName.trim()}:{}) },
      ],
    });
  }
  if (e.kind === 'answer') {
    const p = await parsePack(e.pack, e.at);
    if (p.kind === 'request' || p.from.app !== 'tradefolder')
      return fail('Choose a quote, work report or invoice from Trade Folder.');
    const { row, send } = ownerOf(rows, p.requestId);
    return changedSend(
      rows,
      row,
      send,
      receive(rows, p),
      e,
      p.kind === 'status'
        ? 'Work report: ' + p.state
        : p.kind === 'quote'
          ? 'Quote added'
          : 'Invoice added',
    );
  }
  const by = actorSchema.safeParse(e.by);
  if (!by.success)
    return fail('Enter the name and project role of the person making this decision.');
  const { row, send } = ownerOf(rows, e.requestId);
  if (e.kind === 'decide') {
    const next = withDecision(send, { ...e, by: by.data });
    return changedSend(
      rows,
      row,
      send,
      next,
      e,
      (e.choice === 'approved' || e.choice === 'declined' ? 'Quote ' : 'Invoice ') + e.choice,
      by.data,
    );
  }
  return changedSend(
    rows,
    row,
    send,
    withPayment(send, { ...e, by: by.data }),
    e,
    'Payment recorded',
    by.data,
  );
}
export type LinkStatus =
  | 'draft'
  | 'sent'
  | 'quote'
  | 'booked'
  | 'working'
  | 'done'
  | 'invoiced'
  | 'paid'
  | 'lost'
  | 'changed';
export function needsDecision(row: LinkPackage, currentFingerprint?: string) {
  const last = newest(row.sends);
  return {
    quotes: row.sends.reduce(
      (n, s) =>
        n +
        (s.quotes.some((q) => q.decision?.choice === 'approved')
          ? 0
          : s.quotes.filter((q) => !q.decision).length),
      0,
    ),
    invoices: row.sends.reduce(
      (n, s) =>
        n +
        (s.invoices.some((i) => i.accepted)
          ? 0
          : s.invoices.filter((i) => !i.accepted && !i.rejected).length),
      0,
    ),
    changed:
      !!currentFingerprint && !!last && last.work.planView?.plan.fingerprint !== currentFingerprint,
  };
}
export function packageStatus(row: LinkPackage, currentFingerprint?: string): LinkStatus {
  if (needsDecision(row, currentFingerprint).changed) return 'changed';
  const s = newest(row.sends);
  if (!s) return 'draft';
  if (s.invoices.some((i) => i.paid)) return 'paid';
  if (s.invoices.some((i) => !i.rejected)) return 'invoiced';
  const approved = s.quotes.find((q) => q.decision?.choice === 'approved');
  // A trade's "accepted" report alone cannot promote a quote to Approved.
  const report = newest(s.statuses.filter((r) => !approved || r.quoteId === approved.pack.id));
  if (report?.state === 'done') return 'done';
  if (report?.state === 'started') return 'working';
  if (approved) return 'booked';
  if (s.quotes.some((q) => !q.decision)) return 'quote';
  return s.quotes.length ? 'lost' : 'sent';
}
export type Totals = {
  currency: string;
  quoted: number;
  approved: number;
  invoiced: number;
  paid: number;
  planned?: number;
};
/** Compare a single active/latest offer per request (not the sum of competing offers).
 * Invoiced counts the accepted invoice, or the latest unrejected one while pending.
 * Previous requests remain in the ledger; amounts from different currencies never mix. */
export function moneyTotals(rows: LinkPackage[]): Totals[] {
  const totals = new Map<string, Totals>();
  const bucket = (c: string) => {
    const b = totals.get(c) ?? { currency: c, quoted: 0, approved: 0, invoiced: 0, paid: 0 };
    totals.set(c, b);
    return b;
  };
  const add = (a: number, b: number) => (Math.round(100 * a) + Math.round(100 * b)) / 100;
  for (const row of rows) {
    const d = bucket(row.draft.currency);
    if (row.draft.planned !== undefined) d.planned = add(d.planned ?? 0, row.draft.planned);
    for (const s of row.sends) {
      const b = bucket(s.request.currency),
        approved = s.quotes.find((q) => q.decision?.choice === 'approved');
      const latest = approved ?? newest(s.quotes.filter((q) => q.decision?.choice !== 'declined'));
      if (latest) b.quoted = add(b.quoted, latest.pack.total);
      if (approved) b.approved = add(b.approved, approved.pack.total);
      const invoice =
        s.invoices.find((i) => i.accepted) ?? newest(s.invoices.filter((i) => !i.rejected));
      if (invoice) b.invoiced = add(b.invoiced, invoice.pack.total);
      if (invoice?.paid) b.paid = add(b.paid, invoice.pack.total);
    }
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
function csvCell(v: unknown) {
  const raw = String(v ?? ''),
    safe = /^[\s]*[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function packagesCsv(rows: LinkPackage[], hideAmounts = false): string {
  const columns = [
    'Project',
    'Site',
    'Phase',
    'Trade',
    'Package',
    'Status',
    'Plan revision',
    'Currency',
    'Planned',
    'Quoted',
    'Approved',
    'Invoiced',
    'Paid',
  ];
  const data: unknown[][] = [columns];
  for (const row of rows)
    for (const b of moneyTotals([row])) {
      data.push([
        row.draft.projectLabel,
        row.draft.siteLabel,
        row.draft.phase,
        row.draft.trade,
        row.draft.title,
        packageStatus(row),
        newest(row.sends)?.work.planView?.plan.revision,
        b.currency,
        ...(hideAmounts
          ? ['', '', '', '', '']
          : [b.planned, b.quoted, b.approved, b.invoiced, b.paid]),
      ]);
    }
  return data.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
