import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Access, hostedPilots } from '../_db/pilotStore.js';
import { id } from '../../src/pilots/contract.js';
import { categories, currency as bookCode, managesMoney } from '../../src/pilots/money.js';
import {
  ledgerRow,
  typed,
  marks,
  allowedMarks,
  mayHoldPay,
  valueOf,
  converted,
  proofGaps,
  fraction,
  lineTotal,
  type Ledger,
  type Row,
  type Snapshot,
} from '../../src/pilots/ledger.js';
import type { MinRes } from './sentry.js';

type Db = ReturnType<typeof hostedPilots>;
type Stamp = { seat: string; link: string | null; at: string };
type Provenance = { typedBy: Stamp; approvedBy?: Stamp; paidBy?: Stamp; lastMove?: Stamp };
type Stored = Record<string, unknown> & {
  id: string;
  type: string;
  audit?: Provenance;
  snapshot?: Snapshot;
};
type Change = { id: string; payload: Stored; hidden: boolean };
const problem = (status: number, message: string): never => {
  throw new LedgerError(status, message);
};
class LedgerError extends Error {
  constructor(
    readonly status: number,
    msg: string,
  ) {
    super(msg);
  }
}
const deny = (): never => problem(403, 'Ask the owner for your link.');
const bad = (s: string): never => problem(400, s);
const strip = (row: Stored) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'audit' && k !== 'snapshot'));
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function changed(a: Record<string, unknown>, b: Record<string, unknown>) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !equal(a[k], b[k]));
}
const dataRows = (rows: Stored[]) =>
  rows.filter((r) => r.version === 2 && r.type !== 'pay_row').map((r) => ledgerRow.parse(strip(r)));
const civil = (tz = 'Indian/Mauritius') =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
function filesOf(row: Ledger) {
  switch (row.type) {
    case 'invoice':
      return [row.file, row.delivery, row.integrity];
    case 'cost_row':
      return row.proofs.map((p) => p.file);
    case 'period':
      return [row.file];
    case 'transfer':
    case 'payment_row':
      return [row.bankNotice];
    case 'row_entry':
      return [row.proof?.file];
    default:
      return [];
  }
}
export async function seatMarks(db: Db, p: Access, seat: string) {
  const r = (await db.marks(p, seat)) as Stored | undefined;
  return r ? marks.parse(strip(r)) : undefined;
}
function ownProjection(row: Stored) {
  if (row.type === 'invoice') {
    const {
      id,
      number,
      date,
      amount,
      tax,
      currency,
      file,
      delivery,
      integrity,
      credits,
      state,
      refusal,
    } = row;
    return {
      type: 'invoice',
      id,
      editable: state === 'received' && !row.line && !row.costId,
      number,
      date,
      amount,
      tax,
      currency,
      file,
      delivery,
      integrity,
      credits,
      state,
      refusal,
      missing: [
        !file ? 'invoice' : null,
        !delivery ? 'delivery note or report' : null,
        !integrity ? 'integrity statement' : null,
      ].filter(Boolean),
    };
  }
  if (row.type === 'cost_row')
    return {
      type: row.type,
      description: row.description1,
      amount: row.amount,
      currency: row.currency,
      state: row.state,
      missing: proofGaps(ledgerRow.parse(strip(row)) as Row<'cost_row'>, []),
    };
  if (row.type === 'transfer')
    return {
      type: row.type,
      date: row.date,
      amount: row.amount,
      currency: row.currency,
      bankNotice: row.bankNotice,
    };
  if (row.type === 'pay_row') return { type: row.type, agreed: row.agreed, state: row.state };
  return null;
}
function historyKey(p: Access, seat: string, id: string) {
  return (
    'own-' +
    createHash('sha256')
      .update(p.id + '|' + seat + '|' + id)
      .digest('hex')
  );
}
export async function managerDues(db: Db, p: Access) {
  const stored = (await db.ledger(p)).map((r) => r.payload as Stored),
    rows = dataRows(stored);
  if (!typed(rows, 'settings').length) return [];
  return rows.flatMap((r) => {
    if (r.type === 'cost_row' && proofGaps(r, rows).length)
      return [{ id: r.id, label: 'Proof missing on a cost row' }];
    if (r.type === 'invoice' && !r.file && !['withdrawn', 'refused'].includes(r.state))
      return [{ id: r.id, label: 'File missing from an invoice' }];
    return [];
  });
}
export async function personalFinance(db: Db, p: Access, seat: string, role: string) {
  const m = await seatMarks(db, p, seat);
  const rows = await db.ownFinance(p, seat, !!m?.invoices, !!m?.partner, mayHoldPay(role, m));
  const items = rows.flatMap((r) => {
    const row = r.payload as Stored,
      v = ownProjection(row);
    return v
      ? [
          {
            ...v,
            ...(['cost_row', 'invoice'].includes(row.type)
              ? { historyRef: historyKey(p, seat, row.id) }
              : {}),
          },
        ]
      : [];
  });
  const basis =
    m?.partner || m?.invoices
      ? (await db.financeBasis(p, seat)).map((r) => r.payload as Stored)
      : [];
  const configured = basis.some((r) => r.type === 'settings');
  const code = bookCode.safeParse(basis.find((r) => r.id === 'book-currency')?.currency);
  const partnerBalance =
    m?.partner && code.success
      ? rows.reduce((sum, r) => {
          const row = r.payload as Stored;
          if (row.type === 'transfer') {
            const t = ledgerRow.parse(strip(row)) as Row<'transfer'>;
            return (
              sum +
              (converted(dataRows(basis), code.data!, {
                currency: t.currency,
                date: t.date,
                amount: t.amount,
                paymentRate: t.paymentRate,
              })?.amount ?? 0)
            );
          }
          if (row.type === 'cost_row' && row.state === 'accepted')
            return (
              sum -
              Number(
                basis.find(
                  (e) =>
                    e.type === 'row_entry' && e.kind === 'funder result' && e.costId === row.id,
                )?.eligible ?? 0,
              )
            );
          return sum;
        }, 0)
      : undefined;
  const due =
    !configured || role === 'host' || role === 'viewer'
      ? []
      : rows.flatMap((r) => {
          const row = r.payload as Stored;
          if (
            row.type === 'invoice' &&
            m?.invoices &&
            !row.file &&
            !['withdrawn', 'refused'].includes(String(row.state))
          )
            return [{ id: row.id, label: 'File missing from an invoice' }];
          if (
            row.type === 'cost_row' &&
            m?.partner &&
            proofGaps(ledgerRow.parse(strip(row)) as Row<'cost_row'>, []).length
          )
            return [{ id: row.id, label: 'Proof missing on a cost row' }];
          return [];
        });
  return {
    ...(partnerBalance !== undefined && code.success
      ? { partnerBalance, currency: code.data }
      : {}),
    ...(m && (m.invoices || m.staff || m.partner)
      ? { marks: { invoices: m.invoices, staff: m.staff, partner: m.partner } }
      : {}),
    ...(items.length ? { items } : {}),
    ...(due.length ? { due } : {}),
    showPay: mayHoldPay(role, m),
  };
}
export async function financeHistory(db: Db, p: Access, owner: boolean, key: string) {
  if (key.startsWith('own-')) {
    if (owner || !p.member_id || !p.role || p.role === 'checker') return null;
    const m = await seatMarks(db, p, p.member_id);
    const records = await db.ownFinance(p, p.member_id, !!m?.invoices, !!m?.partner, false);
    const match = records
      .map((r) => r.payload as Stored)
      .find((r) => historyKey(p, p.member_id!, r.id) === key);
    if (!match) return null;
    key = match.id;
  }
  const row = await db.item(p, key);
  if (!row || row.hidden || row.kind !== 'money') return null;
  const item = row.payload as Stored;
  if (['link_log', 'checker_log', 'change_log'].includes(item.type)) return null;
  const manager = managesMoney(owner, p.role);
  if (!manager) {
    if (!p.member_id || p.role === 'checker') return null;
    const m = await seatMarks(db, p, p.member_id);
    if (
      !(m?.invoices && item.type === 'invoice' && item.sender === p.member_id) &&
      !(
        m?.partner &&
        item.type === 'cost_row' &&
        item.whose === p.member_id &&
        item.costType !== 'staff'
      )
    )
      return null;
  }
  const logs = await db.financeHistory(p, key);
  return logs.map((r) => {
    const v = r.payload as { at: string; before: Stored | null; after: Stored; reason: string };
    return manager
      ? v
      : {
          at: v.at,
          before: v.before ? ownProjection(v.before) : null,
          after: ownProjection(v.after),
        };
  });
}
export async function saveLedger(
  db: Db,
  p: Access,
  owner: boolean,
  by: string,
  input: unknown,
  memberForm = false,
) {
  const v = z
    .object({
      revision: z.number().int().positive(),
      row: z.unknown(),
      createCost: z.unknown().optional(),
      hide: z.boolean().default(false),
      reason: z.string().trim().max(300).default(''),
    })
    .strict()
    .parse(input);
  const manager = managesMoney(owner, p.role),
    lead = !owner && p.role === 'lead',
    side = !owner && (p.role === 'lead' || p.role === 'coordinator');
  if (!manager && !memberForm) deny();
  const raw = z
    .object({ id, type: z.string().max(40) })
    .passthrough()
    .parse(v.row);
  if (
    [
      'typedBy',
      'approvedBy',
      'markedPaidBy',
      'audit',
      'snapshot',
      'typed by',
      'approved by',
      'marked paid by',
    ].some((k) => Object.prototype.hasOwnProperty.call(raw, k))
  )
    bad('Provenance is set by the server.');
  if (['link_log', 'change_log', 'checker_log'].includes(raw.type)) deny();
  if (!manager && raw.type !== 'invoice') deny();
  const data = ledgerRow.parse(raw);
  if (!manager && data.type === 'invoice') {
    const m = await seatMarks(db, p, by);
    if (m?.partner) problem(403, 'partner, not a supplier');
    if (!m?.invoices) deny();
    if (
      data.sender !== by ||
      data.thirdParty ||
      data.line ||
      data.costId ||
      data.leadNote ||
      data.refusal ||
      data.paymentDate ||
      !['received', 'withdrawn'].includes(data.state)
    )
      deny();
  }
  if (!manager && (v.hide || v.createCost !== undefined)) deny();
  const all = (await db.ledger(p)).map((r) => r.payload as Stored),
    rows = dataRows(all);
  const legacy = all.find((r) => r.id === 'book-currency'),
    code = bookCode.safeParse(legacy?.currency);
  if (!code.success) bad('Choose a pilot currency first.');
  const priorRecord = await db.item(p, data.id);
  if (priorRecord && (priorRecord.kind !== 'money' || priorRecord.hidden)) deny();
  const prior = priorRecord?.payload as Stored | undefined;
  if (prior && prior.type !== data.type) deny();
  if (prior && prior.version !== 2 && data.type !== 'budget_line') deny();
  const old = prior?.version === 2 ? ledgerRow.parse(strip(prior)) : undefined;
  const actionTime = new Date().toISOString(),
    stamp = { seat: owner ? 'owner' : by, link: owner ? null : p.link_id, at: actionTime };
  const changes = new Map<string, Change>(),
    fileIds: string[] = [];
  function save(row: Ledger, hidden = false, metadata?: Snapshot) {
    const before = changes.get(row.id)?.payload ?? all.find((r) => r.id === row.id);
    const audit: Provenance = { ...(before?.audit ?? { typedBy: stamp }) };
    if (!before) audit.typedBy = stamp;
    if ('state' in row && row.state !== before?.state) {
      audit.lastMove = stamp;
      if (row.state === 'approved') audit.approvedBy = stamp;
      if (row.state === 'paid') audit.paidBy = stamp;
    }
    const payload: Stored = {
      ...row,
      audit,
      ...(metadata || before?.snapshot ? { snapshot: metadata ?? before?.snapshot } : {}),
    };
    changes.set(row.id, { id: row.id, payload, hidden });
  }
  function byType<T extends Ledger['type']>(t: T, id?: string) {
    return typed(rows, t).find((x) => x.id === id);
  }
  const setting = typed(rows, 'settings')[0];
  if (v.createCost !== undefined) {
    if (data.type !== 'invoice' || !manager || data.costId || data.credits || !data.line) deny();
    const draft = ledgerRow.parse(v.createCost);
    if (draft.type !== 'cost_row') bad('Supply the commitment details.');
    if (draft.type === 'cost_row' && data.type === 'invoice') {
      if (
        prior?.costId ||
        (await db.item(p, draft.id)) ||
        draft.line !== data.line ||
        draft.currency !== data.currency ||
        draft.state !== 'committed' ||
        draft.corrects ||
        (draft.ownerSupplies && !lead) ||
        (draft.tradeJob && draft.funding !== 'outside the grant')
      )
        deny();
      if (
        !(await db.memberRole(p, draft.whose)) ||
        (draft.whose !== 'lead' && !(await seatMarks(db, p, draft.whose))?.partner) ||
        (await db.item(p, draft.activity))?.kind !== 'step'
      )
        deny();
      if (draft.proofs.length) bad('Attach the cost proofs after linking.');
      save({ ...draft, state: 'invoiced' });
      rows.push(draft);
      data.costId = draft.id;
    }
  }
  if (v.hide && (!prior || ['payment_row', 'row_entry'].includes(data.type))) deny();
  if (data.type === 'settings') {
    if (!owner || data.id !== 'ledger-settings' || v.hide) deny();
  }
  if (data.type === 'member_marks') {
    const member = await db.memberRole(p, data.memberId);
    if (!owner || !member || data.id !== 'marks-' + data.memberId || v.hide) deny();
    if (!allowedMarks(String(member?.role), data)) bad('Check the member marks for this role.');
  }
  if (data.type === 'heading') {
    if (!owner || (!old && typed(rows, 'heading').length >= 250)) deny();
    const nodes = typed(rows, 'heading')
      .filter((h) => h.id !== data.id)
      .concat(data);
    for (const h of nodes) {
      let node: Row<'heading'> | undefined = h;
      const seen = new Set<string>();
      while (node) {
        if (seen.has(node.id) || seen.size >= 3) bad('Use at most three heading levels.');
        seen.add(node.id);
        if (!node.parent) break;
        node = nodes.find((h) => h.id === node!.parent);
        if (!node) bad('Choose a heading in this pilot.');
      }
    }
    if (v.hide && typed(rows, 'budget_line').some((l) => l.heading === data.id))
      bad('Move the lines first.');
    if (v.hide && nodes.some((h) => h.parent === data.id)) bad('Move the subheadings first.');
  }
  if (data.type === 'budget_line') {
    if (!byType('heading', data.heading) && !categories.some((h) => h === data.heading))
      bad('Choose a heading.');
    if (
      !old &&
      prior &&
      (data.units !== '1' || data.unitValue !== prior.planned || data.kind !== 'ordinary')
    )
      bad('Convert the old planned amount as one unit.');
    if (
      prior &&
      typed(rows, 'cost_row').some((c) => c.line === data.id && c.ownerSupplies) &&
      !lead &&
      (old?.type !== 'budget_line' || data.units !== old.units || data.unitValue !== old.unitValue)
    )
      deny();
    if (
      v.hide &&
      (typed(rows, 'cost_row').some((c) => c.line === data.id) ||
        all.some((r) => r.type === 'pay_row' && r.from === data.id))
    )
      bad('The line has linked records.');
    if (BigInt(data.unitValue) * fraction(data.units).n > 1000000000000n * fraction(data.units).d)
      bad('Check the line total.');
    if (!Number.isSafeInteger(lineTotal(data))) bad('Check the line total.');
  }
  if (data.type === 'rate') {
    if (!owner) deny();
    if (
      data.currency === code.data ||
      typed(rows, 'rate').some(
        (r) => r.id !== data.id && r.month === data.month && r.currency === data.currency,
      )
    )
      bad('Use one rate per month and foreign currency.');
  }
  if (data.type === 'payment_row' && !side) deny();
  if (data.type === 'transfer') {
    const m = await seatMarks(db, p, data.partner);
    if (!m?.partner) bad('Choose a partner.');
  }
  const allowedFiles = filesOf(data).filter((f): f is string => !!f);
  for (const id of allowedFiles) {
    const row = await db.item(p, id);
    if (!row || row.kind !== 'file' || row.hidden) deny();
    const file = row!.payload as { money: boolean };
    if (!manager ? row!.created_by !== by : row!.created_by !== by && !file.money) deny();
    fileIds.push(id);
  }
  if (data.type === 'cost_row') {
    if (
      !all.some(
        (r) => r.type === 'budget_line' && r.id === data.line && r.id !== 'book-currency',
      ) ||
      (await db.item(p, data.activity))?.kind !== 'step'
    )
      bad('Choose a line and activity.');
    if (data.whose !== 'lead' && !(await seatMarks(db, p, data.whose))?.partner)
      bad('Choose the lead or a partner.');
    const prev = old?.type === 'cost_row' ? old : undefined;
    if (prev && ['claimed', 'accepted'].includes(prev.state)) deny();
    const approvedCost = typed(rows, 'invoice').some(
      (i) => i.costId === data.id && i.state === 'approved',
    );
    if (
      prev &&
      approvedCost &&
      (v.hide ||
        changed(strip(prior!), data).some((k) =>
          ['amount', 'tax', 'currency', 'line', 'thirdParty', 'funding'].includes(k),
        ))
    ) {
      if (!lead) deny();
      if (!v.reason) bad('Enter the change reason.');
    }
    if (!prev && data.amount < 0 && !data.corrects) bad('Name the claimed row being corrected.');
    if (data.ownerSupplies !== !!prev?.ownerSupplies && !lead) deny();
    if (
      data.tradeJob &&
      ((!prev && data.funding !== 'outside the grant') ||
        (prev && data.funding !== prev.funding && (!owner || prev.state !== 'committed')))
    )
      deny();
    if (
      prev?.state === 'paid' &&
      (v.hide ||
        changed(strip(prior!), data).some((k) =>
          ['amount', 'tax', 'currency', 'line', 'thirdParty', 'funding'].includes(k),
        ))
    ) {
      if (!lead) deny();
      if (!v.reason) bad('Enter the change reason.');
    }
    if (!prev && data.state !== 'committed' && !data.corrects) deny();
    if (data.corrects) {
      const ref = byType('cost_row', data.corrects);
      if (
        !side ||
        !ref ||
        !['claimed', 'accepted'].includes(ref.state) ||
        data.amount >= 0 ||
        data.state !== 'paid' ||
        data.paymentDate !== civil(setting?.timeZone)
      )
        deny();
    }
    if (prev && prev.state !== data.state) {
      const order = ['committed', 'invoiced', 'paid', 'claimed', 'accepted'];
      if (!side || ['claimed', 'accepted'].includes(data.state)) deny();
      if (order.indexOf(data.state) < order.indexOf(prev.state)) {
        if (!v.reason) bad('Enter the reason for moving back.');
      } else if (data.state === 'paid') {
        if (data.ownerSupplies && !lead) deny();
        const inv = typed(rows, 'invoice').find(
          (i) => i.costId === data.id && !i.credits && !['withdrawn', 'refused'].includes(i.state),
        );
        if (inv) {
          if (inv.state !== 'approved') deny();
          save({ ...inv, state: 'paid', paymentDate: data.paymentDate });
        } else if (data.documentKind !== 'receipt') deny();
        if (!data.paymentDate) bad('Enter the payment date.');
      } else deny();
    }
  }
  if (data.type === 'invoice') {
    const prev = old?.type === 'invoice' ? old : undefined;
    if ((!data.sender && !data.thirdParty) || (data.sender && data.thirdParty))
      bad('Choose one sender.');
    if (data.sender) {
      const m = await seatMarks(db, p, data.sender);
      if (!m?.invoices || m.partner) deny();
    }
    if (
      !manager &&
      prev &&
      (prev.sender !== by || prev.state !== 'received' || prev.line || prev.costId)
    )
      deny();
    if (prev && (prev.state === 'refused' || prev.state === 'withdrawn')) deny();
    if (prev?.costId && data.costId !== prev.costId) deny();
    if (prev && prev.credits !== data.credits) deny();
    if (prev?.state === 'paid' && data.state !== 'paid') deny();
    if (prev?.state === 'approved' && !['approved', 'paid', 'refused'].includes(data.state)) deny();
    if (
      prev &&
      ['approved', 'paid'].includes(prev.state) &&
      (v.hide ||
        changed(strip(prior!), data).some((k) =>
          ['amount', 'tax', 'currency', 'line', 'thirdParty', 'sender'].includes(k),
        ))
    ) {
      if (!lead) deny();
      if (!v.reason) bad('Enter the change reason.');
    }
    if (
      typed(rows, 'invoice').some(
        (i) =>
          i.id !== data.id &&
          i.number === data.number &&
          i.sender === data.sender &&
          i.thirdParty === data.thirdParty &&
          !['refused', 'withdrawn'].includes(i.state),
      )
    )
      bad('Use a unique live invoice number for this sender.');
    if (!prev && data.state !== 'received') deny();
    if (data.credits) {
      const original = byType('invoice', data.credits);
      if (
        !original ||
        original.sender !== data.sender ||
        original.thirdParty !== data.thirdParty ||
        original.currency !== data.currency ||
        data.amount >= 0
      )
        deny();
      if (original!.amount + data.amount < 0) bad('The credit exceeds this invoice.');
      if (manager && (data.costId || data.line)) {
        const credits = typed(rows, 'invoice').filter(
          (i) =>
            !!i.costId &&
            i.credits === original!.id &&
            i.id !== data.id &&
            !['refused', 'withdrawn'].includes(i.state),
        );
        if (original!.amount + data.amount + credits.reduce((sum, c) => sum + c.amount, 0) < 0)
          bad('The credit exceeds the invoice.');
        const billed = byType('cost_row', original!.costId);
        if (billed && ['claimed', 'accepted'].includes(billed.state)) {
          if (!side) deny();
          const correction: Row<'cost_row'> = {
            ...billed,
            id: randomUUID(),
            corrects: billed.id,
            state: 'paid',
            amount: data.amount,
            tax: data.tax,
            paymentDate: civil(setting?.timeZone),
            documentDate: data.date,
            documentRef: data.number,
          };
          save(correction);
          data.costId = correction.id;
          rows.push(correction);
        } else data.costId = original!.costId;
      }
    } else if (data.amount < 0) bad('Name the invoice for this credit.');
    const linked = byType('cost_row', data.costId ?? prev?.costId);
    if (
      data.costId &&
      (!linked || linked.currency !== data.currency || (data.line && data.line !== linked.line))
    )
      deny();
    if (linked && ['claimed', 'accepted'].includes(linked.state)) deny();
    if (data.line && !all.some((r) => r.id === data.line && r.type === 'budget_line')) deny();
    if (data.state !== prev?.state && prev) {
      if (
        ['approved', 'paid', 'refused'].includes(data.state) &&
        (!side || (linked?.ownerSupplies && !lead && data.state !== 'refused'))
      )
        deny();
      if (data.state === 'approved' && (!linked || prev.state !== 'received'))
        bad('Link the received invoice before approving.');
      if (data.state === 'paid' && (prev.state !== 'approved' || !linked || !data.paymentDate))
        deny();
      if (data.state === 'refused' && !data.refusal) bad('Enter the refusal reason.');
      if (data.state === 'received') deny();
    }
    if (!data.credits && linked) {
      if (['refused', 'withdrawn'].includes(data.state)) {
        data.costId = undefined;
        save({ ...linked, state: 'committed' });
      } else if (data.state === 'paid')
        save({ ...linked, state: 'paid', paymentDate: data.paymentDate });
      else if (!prev?.costId && data.costId) {
        if (
          linked.state !== 'committed' ||
          typed(rows, 'invoice').some(
            (i) =>
              i.costId === linked.id && !i.credits && !['refused', 'withdrawn'].includes(i.state),
          )
        )
          deny();
        save({ ...linked, state: 'invoiced' });
      }
    }
  }
  if (data.type === 'period') {
    if (old?.type === 'period' && old.sent) deny();
    if (data.end < data.start) bad('The end must follow the start.');
    const periods = typed(rows, 'period')
      .filter((r) => r.id !== data.id)
      .concat(data)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (
      periods.some((r, i) => r.final && i !== periods.length - 1) ||
      periods.filter((r) => r.final).length > 1 ||
      new Set(periods.map((r) => r.number)).size !== periods.length
    )
      bad('Use one final period and unique numbers.');
    for (let i = 1; i < periods.length; i++) {
      const after = new Date(periods[i - 1].end);
      after.setUTCDate(after.getUTCDate() + 1);
      if (after.toISOString().slice(0, 10) !== periods[i].start)
        bad('Periods must meet without gaps or overlaps.');
    }
    if (data.sent) {
      if (!lead || v.hide) deny();
      if (!data.file) bad('Attach the sent period file.');
      const costs = typed(rows, 'cost_row').filter(
        (c) =>
          c.funding === 'in the budget' &&
          c.state === 'paid' &&
          c.paymentDate &&
          periods.some(
            (t) =>
              (t.id === data.id || (t.sent && t.end < data.start)) &&
              c.paymentDate! >= t.start &&
              c.paymentDate! <= t.end,
          ),
      );
      const values = costs.map((c) => valueOf(c, rows, code.data!));
      const missing = values.filter((v) => v.converted === undefined).length;
      if (missing) bad('Rate missing on ' + missing + ' rows.');
      costs.forEach((c, i) =>
        save({ ...c, state: 'claimed' }, false, {
          converted: values[i].converted,
          rate: values[i].rate,
          period: data.number,
        }),
      );
    }
  }
  if (data.type === 'row_entry') {
    const row = byType('cost_row', data.costId);
    if (old || !row || !['claimed', 'accepted'].includes(row.state) || v.hide) deny();
    if (data.kind === 'funder result') {
      if (!side || data.eligible === undefined || row!.state === 'accepted') deny();
      save({ ...row!, state: 'accepted' });
    } else if (!data.proof?.file) bad('Attach the late proof.');
  }
  save(data, v.hide);
  const edits = [...changes.values()];
  for (const edit of edits) {
    const previous = all.find((r) => r.id === edit.id),
      after = edit.payload;
    const id = randomUUID();
    const log: Stored = {
      id,
      type: 'change_log',
      version: 2,
      record: edit.id,
      at: actionTime,
      who: stamp,
      fields: changed(previous ?? {}, after),
      before: previous ?? null,
      after,
      hidden: edit.hidden,
      reason: v.reason,
    };
    if (Buffer.byteLength(JSON.stringify(log)) > 15000)
      bad('Use shorter notes or split the record.');
    changes.set(id, { id, payload: log, hidden: false });
  }
  return await db.ledgerCommit(p, v.revision, [...changes.values()], by, fileIds);
}
export async function copyHeadingTree(db: Db, p: Access, owner: boolean, body: unknown) {
  if (!owner) return null;
  const v = z.object({ revision: z.number().int().positive(), from: id }).strict().parse(body);
  if (v.from === p.slug) return null;
  const source = await db.access(v.from, { owner: p.owner_id, member: '' });
  if (source?.owner_id !== p.owner_id) return null;
  const data = dataRows((await db.ledger(source)).map((r) => r.payload as Stored)),
    heads = typed(data, 'heading'),
    lines = typed(data, 'budget_line');
  const target = dataRows((await db.ledger(p)).map((r) => r.payload as Stored));
  if (typed(target, 'heading').length + heads.length > 250) return null;
  const ids = new Map(heads.map((h) => [h.id, randomUUID()])),
    rows = heads.map((h) => {
      const id = ids.get(h.id)!;
      return {
        id,
        payload: {
          id,
          type: 'heading',
          version: 2,
          name: h.name,
          number: h.number,
          order: h.order,
          parent: h.parent ? ids.get(h.parent) : undefined,
          locked: false,
          subLines: lines
            .filter((l) => l.heading === h.id)
            .map((l) => ({ number: l.number, name: l.label })),
        },
        hidden: false,
      };
    });
  return await db.ledgerCommit(p, v.revision, rows, 'lead');
}
export async function ledgerRoute(
  db: Db,
  p: Access,
  owner: boolean,
  by: string,
  memberForm: boolean,
  key: string | undefined,
  method: string | undefined,
  body: () => Promise<unknown>,
  res: MinRes,
) {
  const error = (status: number, message: string) => res.status(status).json({ error: message });
  try {
    if (
      key ||
      (!managesMoney(owner, p.role) && !memberForm) ||
      (!owner && p.role === 'checker') ||
      (memberForm && (!p.member_id || owner))
    )
      deny();
    if (method === 'GET') {
      if (memberForm) {
        const me = await personalFinance(db, p, by, p.role!);
        if (!me.marks && !me.showPay) deny();
        return res.status(200).json({ revision: p.revision, memberId: by, ...me });
      }
      const stored = (await db.ledger(p)).map((r) => r.payload as Stored);
      return res.status(200).json({
        revision: p.revision,
        rows: stored.filter((r) => r.id !== 'book-currency'),
        currency: stored.find((r) => r.id === 'book-currency')?.currency ?? null,
      });
    }
    if (method !== 'POST') deny();
    return (await saveLedger(db, p, owner, by, await body(), memberForm))
      ? res.status(200).json({ saved: true })
      : error(409, 'The pilot changed. Reload and try again.');
  } catch (e) {
    if (e instanceof LedgerError) return error(e.status, e.message);
    throw e;
  }
}
export function allowedPayInput(
  role: string,
  member: string,
  own: string,
  owner: boolean,
  seatRole: string | null,
  m?: Row<'member_marks'>,
) {
  return mayHoldPay(role, m) && member !== own && (owner || seatRole === 'lead');
}
