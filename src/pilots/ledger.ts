import { z } from 'zod';
import { id, day } from './contract.js';
import { currency, categories } from './money.js';

export const minorDigits = { EUR: 2, MUR: 2, GBP: 2, USD: 2, JPY: 0, KWD: 3 } as const;
export const code = z.enum(['EUR', 'MUR', 'GBP', 'USD', 'JPY', 'KWD']);
export const decimal = z.string().regex(/^(0|[1-9]\d{0,10})(\.\d{1,8})?$/);
const positive = decimal.refine((v) => /[1-9]/.test(v));
export const integer = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);
const amount = integer.nonnegative(),
  short = z.string().trim().min(1).max(160),
  text = z.string().trim().max(500),
  month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const base = { id, version: z.literal(2) };
const pct = decimal.refine((v) => fraction(v).n <= 100n * fraction(v).d);
const tz = short.refine((t) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: t });
    return true;
  } catch {
    return false;
  }
});
export const settings = z
  .object({
    ...base,
    type: z.literal('settings'),
    timeZone: tz,
    accountsCurrency: code.optional(),
    maximumGrant: amount.optional(),
    grantPercent: pct.optional(),
    flatPercent: pct.optional(),
    contingencyPercent: pct.optional(),
    lowerBand: pct.optional(),
    upperBand: pct.optional(),
    reminderDays: z.number().int().min(0).max(3660).optional(),
    dueDays: z.number().int().min(0).max(3660).optional(),
    confirmDays: z.number().int().min(0).max(3660).optional(),
    advanceValues: pct.array().length(3).optional(),
    assetValue: amount.optional(),
    minimumShare: pct.optional(),
    committeeSize: z.number().int().min(1).max(100).optional(),
    awardBasis: z.record(short, short).optional(),
    headers: short.array().length(20).optional(),
    singleOfferReasons: short.array().max(30).optional(),
    purchaseLabels: short.array().max(80).optional(),
    receivers: short.array().max(80).optional(),
    noGlobal: z.boolean().default(false),
    flatOff: z.boolean().default(false),
    taxMayCount: z.boolean().default(false),
    funderOrder: z.boolean().default(false),
  })
  .strict();
export const marks = z
  .object({
    ...base,
    type: z.literal('member_marks'),
    memberId: id,
    invoices: z.boolean(),
    staff: z.boolean(),
    partner: z.boolean(),
  })
  .strict();
export const heading = z
  .object({
    ...base,
    type: z.literal('heading'),
    number: short,
    name: short,
    order: z.number().int().min(0).max(500),
    parent: id.optional(),
    subLines: z
      .array(z.object({ number: short, name: short }).strict())
      .max(150)
      .optional(),
    locked: z.boolean().default(false),
  })
  .strict();
export const line = z
  .object({
    ...base,
    type: z.literal('budget_line'),
    heading: short,
    number: short,
    label: short,
    kind: z.enum(['ordinary', 'staff']),
    costType: short,
    unit: short,
    units: decimal,
    unitValue: amount,
    direct: z.boolean(),
    flags: short.array().max(15),
    note: text,
  })
  .strict();
export const rate = z
  .object({
    ...base,
    type: z.literal('rate'),
    month,
    currency: code,
    rate: positive,
    source: short,
  })
  .strict();
export const period = z
  .object({
    ...base,
    type: z.literal('period'),
    number: z.number().int().positive().max(600),
    start: day,
    end: day,
    due: day,
    final: z.boolean(),
    sent: day.optional(),
    file: id.optional(),
  })
  .strict();
export const payment = z
  .object({
    ...base,
    type: z.literal('payment_row'),
    receivedDate: day,
    receivedAmount: amount,
    accountsCurrency: code,
    rate: positive,
    bankNotice: id.optional(),
    label: short,
  })
  .strict();
const proof = z.object({ kind: short, file: id.optional(), reason: text.optional() }).strict();
export const cost = z
  .object({
    ...base,
    type: z.literal('cost_row'),
    costType: z.enum(['service', 'supply', 'works', 'equipment', 'travel']),
    vehicle: z.boolean(),
    line: id,
    whose: id,
    paidBy: z.enum(['lead', 'partner', 'outside payer']),
    thirdParty: short,
    ownerSupplies: z.boolean().default(false),
    description1: short,
    description2: short,
    documentKind: z.enum(['invoice', 'receipt', 'pay slip', 'other']),
    documentRef: short,
    documentDate: day,
    accountingRef: short,
    means: z.enum(['cash', 'bank card', 'transfer', 'cheque', 'other']),
    activity: id,
    amount: integer,
    tax: integer,
    taxNotRecoverable: z.boolean(),
    currency: code,
    paymentRate: id.optional(),
    commitDate: day,
    activityDate: day,
    paymentDate: day.optional(),
    funding: z.enum(['in the budget', 'outside the grant']),
    finalReport: z.boolean(),
    note: text,
    state: z.enum(['committed', 'invoiced', 'paid', 'claimed', 'accepted']),
    proofs: proof.array().max(40),
    tradeJob: id.optional(),
    corrects: id.optional(),
    pendingDue: day.optional(),
    pendingReason: text.optional(),
  })
  .strict();
export const invoice = z
  .object({
    ...base,
    type: z.literal('invoice'),
    sender: id.optional(),
    thirdParty: short.optional(),
    number: short,
    date: day,
    amount: integer,
    tax: integer,
    currency: code,
    file: id.optional(),
    delivery: id.optional(),
    integrity: id.optional(),
    line: id.optional(),
    costId: id.optional(),
    credits: id.optional(),
    state: z.enum(['received', 'approved', 'paid', 'refused', 'withdrawn']),
    refusal: text.optional(),
    leadNote: text.optional(),
    paymentDate: day.optional(),
  })
  .strict();
export const transfer = z
  .object({
    ...base,
    type: z.literal('transfer'),
    direction: z.literal('out'),
    partner: id,
    date: day,
    amount,
    currency: code,
    paymentRate: id.optional(),
    bankNotice: id.optional(),
  })
  .strict();
export const entry = z
  .object({
    ...base,
    type: z.literal('row_entry'),
    costId: id,
    kind: z.enum(['funder result', 'late proof']),
    date: day,
    eligible: amount.optional(),
    comment: text.optional(),
    proof: proof.optional(),
  })
  .strict();
export const ledgerRow = z.discriminatedUnion('type', [
  settings,
  marks,
  heading,
  line,
  rate,
  period,
  payment,
  cost,
  invoice,
  transfer,
  entry,
]);
export type Ledger = z.infer<typeof ledgerRow>;
export type Row<T extends Ledger['type']> = Extract<Ledger, { type: T }>;
export function fraction(raw: string) {
  const [whole, part = ''] = raw.split('.');
  return { n: BigInt(whole + part), d: 10n ** BigInt(part.length) };
}
export function roundMinor(n: bigint, d: bigint) {
  if (d <= 0n) throw Error('Invalid divisor.');
  const a = n < 0n ? -n : n,
    q = a / d,
    r = a % d,
    result = (q + (r * 2n >= d ? 1n : 0n)) * (n < 0n ? -1n : 1n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER))
    throw Error('Amount is too large.');
  return Number(result);
}
export function lineTotal(l: Row<'budget_line'>) {
  const u = fraction(l.units);
  return roundMinor(BigInt(l.unitValue) * u.n, u.d);
}
export function exchange(amount: number, rate: string, fromDigits: number, toDigits: number) {
  const v = fraction(rate);
  return roundMinor(
    BigInt(amount) * v.d * 10n ** BigInt(toDigits),
    v.n * 10n ** BigInt(fromDigits),
  );
}
export function allowedMarks(
  role: string,
  m: Pick<Row<'member_marks'>, 'invoices' | 'staff' | 'partner'>,
) {
  const supplier = ['technology supplier', 'tester', 'adviser'].includes(role);
  return (
    (!m.invoices || (supplier && !m.partner && !m.staff)) &&
    (!m.staff || role !== 'checker') &&
    (!m.partner || supplier || role === 'host' || role === 'viewer')
  );
}
export function mayHoldPay(role: string, m?: Pick<Row<'member_marks'>, 'invoices' | 'staff'>) {
  return (
    role === 'lead' ||
    role === 'coordinator' ||
    (['technology supplier', 'tester', 'adviser'].includes(role) && !!(m?.invoices || m?.staff))
  );
}
export function typed<T extends Ledger['type']>(rows: Ledger[], t: T) {
  return rows.filter((s): s is Row<T> => s.type === t);
}
export type BookCurrency = z.infer<typeof currency>;
export type Snapshot = { converted?: number; rate?: string; period?: number };
export function converted(
  rows: Ledger[],
  book: BookCurrency,
  c: { currency: z.infer<typeof code>; date: string; amount: number; paymentRate?: string },
) {
  if (c.currency === book) return { amount: c.amount, rate: '1' };
  const account = typed(rows, 'settings')[0]?.accountsCurrency;
  let value: string | undefined;
  if (c.currency === account) {
    const candidates = typed(rows, 'payment_row')
      .filter((r) => r.accountsCurrency === account && r.receivedDate <= c.date)
      .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
    value = c.paymentRate
      ? candidates.find((v) => v.id === c.paymentRate)?.rate
      : candidates[0]?.rate;
  } else
    value = typed(rows, 'rate').find(
      (r) => r.currency === c.currency && r.month === c.date.slice(0, 7),
    )?.rate;
  return value
    ? { amount: exchange(c.amount, value, minorDigits[c.currency], minorDigits[book]), rate: value }
    : undefined;
}
export function proofGaps(c: Row<'cost_row'>, rows: Ledger[]) {
  const checklist = [
    ['buying paper'],
    ['contract', 'order'],
    ['delivery note', 'report', 'attendance list', 'handover record'],
    ['invoice', 'receipt'],
    ['proof of payment'],
  ];
  if (c.vehicle)
    checklist.push(
      ...['distance covered', 'average consumption', 'fuel', 'upkeep costs'].map((k) => [k]),
    );
  if (c.tax && c.taxNotRecoverable && typed(rows, 'settings')[0]?.taxMayCount)
    checklist.push(['tax note']);
  const later = typed(rows, 'row_entry')
    .filter((r) => r.kind === 'late proof' && r.costId === c.id && r.proof)
    .map((r) => r.proof!);
  return checklist
    .filter(
      (k) =>
        ![...c.proofs, ...later].some((p) => k.includes(p.kind) && (p.file || p.reason?.trim())),
    )
    .map((x) => x.join(' or '));
}
export function valueOf(c: Row<'cost_row'>, rows: Ledger[], book: BookCurrency) {
  const invoices = typed(rows, 'invoice').filter(
    (i) => i.costId === c.id && !['withdrawn', 'refused'].includes(i.state),
  );
  const amount = invoices.length ? invoices.reduce((sum, i) => sum + i.amount, 0) : c.amount;
  const tax = invoices.length ? invoices.reduce((sum, i) => sum + i.tax, 0) : c.tax;
  const original =
    amount +
    (typed(rows, 'settings')[0]?.taxMayCount &&
    c.taxNotRecoverable &&
    c.proofs.some((p) => p.kind === 'tax note' && p.file)
      ? tax
      : 0);
  const result = converted(rows, book, {
    currency: c.currency,
    date: c.paymentDate ?? c.commitDate,
    amount: original,
    paymentRate: c.paymentRate,
  });
  return { original, converted: result?.amount, rate: result?.rate };
}
export const costHeaders = [
  'month',
  'date',
  'third party',
  'document number',
  'description 1',
  'description 2',
  'debit',
  'currency',
  'exchange rate',
  'CURRENCY',
  'means of payment',
  'cost item',
  'line reference',
  'activity',
  'period',
  'comments',
  'verification date',
  'amount eligible',
  'difference',
  'funder comments',
];
export function major(n: number, digits: number) {
  const v = String(Math.abs(n)).padStart(digits + 1, '0');
  return (n < 0 ? '-' : '') + (digits ? v.slice(0, -digits) + '.' + v.slice(-digits) : v);
}
export function ledgerCsv(rows: (string | number)[][]) {
  return (
    rows
      .map((row) =>
        row
          .map((x) => {
            const s = String(x);
            return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  );
}
export function rateCsv(rows: Ledger[], code: string) {
  return ledgerCsv([
    ['month', 'rate', 'source'],
    ...typed(rows, 'rate')
      .filter((r) => r.currency === code)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => [r.month, r.rate, r.source]),
  ]);
}
export function costCsv(
  rows: Ledger[],
  currency: BookCurrency,
  steps: { id: string; title: string }[],
  snapshots: Record<string, Snapshot>,
  internal = false,
) {
  const settings = typed(rows, 'settings')[0],
    headers =
      !internal && settings?.funderOrder && settings.headers
        ? settings.headers
        : costHeaders.map((h) => (h === 'CURRENCY' ? currency : h));
  const result: (string | number)[][] = [
    [...headers, ...(internal ? ['state', 'funding mark', 'whose cost'] : [])],
  ];
  for (const c of typed(rows, 'cost_row')) {
    if (
      c.funding !== 'in the budget' ||
      !['paid', 'claimed', 'accepted'].includes(c.state) ||
      !c.paymentDate
    )
      continue;
    const period = typed(rows, 'period').find(
      (p) => p.start <= c.paymentDate! && p.end >= c.paymentDate!,
    );
    if (!period) continue;
    const l = typed(rows, 'budget_line').find((l) => l.id === c.line),
      h = typed(rows, 'heading').find((h) => h.id === l?.heading),
      v = valueOf(c, rows, currency),
      snap = snapshots[c.id],
      converted = snap?.converted ?? v.converted;
    const check = typed(rows, 'row_entry').find(
      (e) => e.kind === 'funder result' && e.costId === c.id,
    );
    result.push([
      c.paymentDate.slice(0, 7).replace('-', ''),
      c.documentDate,
      c.thirdParty,
      c.documentRef,
      c.description1,
      c.description2,
      major(v.original, minorDigits[c.currency]),
      c.currency,
      snap?.rate ?? v.rate ?? '',
      converted == null ? '' : major(converted, minorDigits[currency]),
      c.means,
      h ? h.number + '. ' + h.name : (l?.heading ?? categories[5]),
      l?.number ?? '',
      steps.find((s) => s.id === c.activity)?.title ?? '',
      'Period ' + period.number,
      c.note,
      check?.date ?? '',
      check?.eligible == null ? '' : major(check.eligible, minorDigits[currency]),
      check?.eligible == null || converted == null
        ? ''
        : major(converted - check.eligible, minorDigits[currency]),
      check?.comment ?? '',
      ...(internal ? [c.state, c.funding, c.whose] : []),
    ]);
  }
  return ledgerCsv(result);
}

export function ledgerSummary(
  rows: Ledger[],
  book: BookCurrency,
  legacyPlanned = 0,
  snapshots: Record<string, Snapshot> = {},
  scope?: Set<string>,
) {
  const sums = {
    planned: legacyPlanned,
    committed: 0,
    invoiced: 0,
    paid: 0,
    claimed: 0,
    accepted: 0,
    spent: 0,
    remaining: 0,
    outside: 0,
  };
  for (const l of typed(rows, 'budget_line'))
    if (!scope || scope.has(l.id)) sums.planned += lineTotal(l);
  for (const c of typed(rows, 'cost_row')) {
    if (scope && !scope.has(c.line)) continue;
    const current = valueOf(c, rows, book),
      eligible = typed(rows, 'row_entry').find(
        (e) => e.costId === c.id && e.kind === 'funder result',
      )?.eligible;
    const amount =
      c.state === 'accepted' ? eligible : (snapshots[c.id]?.converted ?? current.converted);
    if (amount == null) continue;
    if (c.funding === 'outside the grant') sums.outside += amount;
    else sums[c.state] += amount;
  }
  sums.spent = sums.paid + sums.claimed + sums.accepted;
  sums.remaining = sums.planned - sums.spent;
  return sums;
}
export function flagsFor(
  c: Row<'cost_row'>,
  rows: Ledger[],
  book: BookCurrency,
  dates?: { start: string; end: string },
  snapshot?: Snapshot,
) {
  const flags = proofGaps(c, rows).map((k) => 'Missing ' + k);
  if (c.taxNotRecoverable && c.tax && !c.proofs.some((f) => f.kind === 'tax note' && f.file))
    flags.push('Tax proof missing');
  if (dates && (c.activityDate < dates.start || (c.activityDate > dates.end && !c.finalReport)))
    flags.push('Outside the period');
  const v = valueOf(c, rows, book);
  if (v.converted === undefined) flags.push('Rate missing');
  else if (snapshot?.converted !== undefined && snapshot.converted !== v.converted)
    flags.push('Rate changed after claim');
  if (!c.paymentDate && c.currency !== book) flags.push('Rate provisional');
  if (
    c.paymentDate &&
    !typed(rows, 'period').some((p) => p.start <= c.paymentDate! && p.end >= c.paymentDate!)
  )
    flags.push('No period');
  return flags;
}
