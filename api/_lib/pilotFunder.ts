import { fraction, lineTotal, typed, type Ledger, type Row } from '../../src/pilots/ledger.js';
import { planValues, percent, staffCost } from '../../src/pilots/funder.js';
import { advance, shiftMonth } from '../../src/pilots/running.js';
import { scheduleSchema } from '../../src/pilots/contract.js';
import type { Access, hostedPilots } from '../_db/pilotStore.js';

type Context = {
  db: ReturnType<typeof hostedPilots>;
  p: Access;
  by: string;
  owner: boolean;
  lead: boolean;
  side: boolean;
  memberForm: boolean;
  hide: boolean;
  rows: Ledger[];
  old?: Ledger;
  oldLines: boolean;
  bad: (s: string) => never;
  deny: () => never;
};
export function funderFiles(r: Ledger) {
  switch (r.type) {
    case 'cost_row':
      return [r.reasonFile];
    case 'staff_month':
      return [r.timeSheet, r.paySlip];
    case 'plan_version':
    case 'change_record':
    case 'source':
    case 'wrong_sum':
    case 'offer':
      return [r.file];
    case 'cut':
      return [r.reasonFile];
    case 'contingency_use':
      return [r.reasonsFile, r.approvalFile];
    case 'procurement_plan':
    case 'asset':
      return [r.file, r.approvalFile, ...(r.type === 'asset' ? [r.requestFile] : [])];
    case 'buying_check':
      return [r.integrity, r.committeeReport, r.tender];
    case 'guarantee':
      return [r.issuedFile, r.releaseFile];
    case 'payment_row':
      return [r.replyFile];
    default:
      return [];
  }
}
export async function validateFunder(d: Ledger, c: Context) {
  const { rows, old, owner, side, lead, hide, bad, deny } = c;
  const plan = planValues(rows),
    lines = typed(rows, 'budget_line'),
    settings = typed(rows, 'settings')[0];
  const line = (id?: string) => lines.find((l) => l.id === id);
  const spending = (id?: string) => {
    const l = line(id);
    if (!l || l.kind === 'flat rate' || l.kind === 'contingency')
      return bad('Choose a spending line.');
    return l;
  };
  const ownerLine = (id: string) =>
    typed(rows, 'cost_row').some((r) => r.line === id && r.ownerSupplies);
  const signed = (id?: string) =>
    typed(rows, 'change_record').find((r) => r.id === id && r.signedDate && r.file);
  const exclusive = (type: Ledger['type']) => rows.some((r) => r.type === type && r.id !== d.id);
  if (hide && ['plan_version', 'move', 'contingency_use', 'cut'].includes(d.type)) deny();
  if (old && ['plan_version', 'move', 'contingency_use', 'cut'].includes(d.type)) deny();
  if (
    d.type === 'settings' &&
    old?.type === 'settings' &&
    plan.plan &&
    (d.grantPercent !== old.grantPercent || d.maximumGrant !== old.maximumGrant) &&
    !signed(d.signedChange)
  )
    bad('Choose a signed change.');
  if (d.type === 'budget_line') {
    if (
      plan.plan?.lines?.some((l) => l.id === d.id) &&
      old?.type === 'budget_line' &&
      (hide ||
        ['unit', 'units', 'unitValue', 'kind', 'direct', 'heading'].some(
          (k) => d[k as keyof typeof d] !== old[k as keyof typeof old],
        ))
    )
      bad('Use a move or signed change.');
    if (d.kind === 'flat rate' || d.kind === 'contingency') {
      if (d.direct || lines.some((l) => l.id !== d.id && l.kind === d.kind))
        bad('Use one indirect line of this kind.');
      if (d.kind === 'flat rate' && d.unitValue !== 0) bad('The flat rate is computed.');
    }
    if (d.kind === 'staff' && d.unit.toLowerCase() !== 'person-month')
      bad('Use person-month as the unit.');
    const future = planValues(rows.filter((r) => r.id !== d.id).concat(hide ? [] : [d]));
    const cap = percent(
      future.plan?.lines?.filter((l) => l.direct).reduce((s, l) => s + l.total, 0) ?? future.direct,
      settings?.contingencyPercent,
    );
    if (cap !== null && future.contingency > cap) bad('The contingency exceeds its limit.');
  }
  if (d.type === 'cost_row') {
    const l = line(d.line);
    if (l?.kind === 'flat rate' || l?.kind === 'contingency') bad('Choose a spending line.');
    if (d.buyingCheck && !typed(rows, 'buying_check').some((b) => b.id === d.buyingCheck))
      bad('Choose a buying check.');
    if (d.costType === 'staff') {
      const m = typed(rows, 'staff_month').find((m) => m.id === d.staffMonth);
      if (!m || m.memberId === c.by || (!side && !owner)) return deny();
      if (
        l?.kind !== 'staff' ||
        (m.line && m.line !== d.line) ||
        d.gross === undefined ||
        d.employerCharges === undefined ||
        d.otherPay === undefined ||
        d.netPay === undefined ||
        (!d.normalPay && !d.reasonFile)
      )
        return bad('Complete the staff month, line and pay split.');
      if (d.state === 'paid' && !m.approved) deny();
      if (
        typed(rows, 'cost_row').some((r) => r.id !== d.id && r.staffMonth === m.id && !r.corrects)
      )
        bad('This month already has a cost row.');
      if (!d.corrects)
        d.amount = staffCost(d.gross, d.employerCharges, d.otherPay, m.hours, m.totalHours);
    } else if (l?.kind === 'staff' || d.staffMonth) bad('Use a staff cost on this line.');
  }
  if (d.type === 'invoice' && d.line) {
    const l = line(d.line);
    if (l && ['flat rate', 'contingency', 'staff'].includes(l.kind)) bad('Choose a purchase line.');
  }
  if (d.type === 'payment_row') {
    const prev = old?.type === 'payment_row' ? old : undefined;
    const received = [
      'receivedDate',
      'receivedAmount',
      'rate',
      'bankNotice',
      'accountsCurrency',
      'accountsAmount',
      'confirmed',
      'reply',
      'replyFile',
      'replyDate',
    ] as const;
    if (!side && received.some((k) => d[k] !== prev?.[k])) deny();
    if (
      received.slice(0, 6).some((k) => d[k] !== undefined) &&
      (!d.receivedDate || d.receivedAmount === undefined || !d.accountsCurrency || !d.rate)
    )
      bad('Complete the received date, amount, currency and rate.');
    if (
      d.stops?.some(
        (s, i, stops) =>
          (s.restart && s.restart < s.notice) ||
          (i > 0 && (!stops[i - 1].restart || s.notice < stops[i - 1].restart!)),
      )
    )
      bad('Check the stop dates.');
  }
  if (d.type === 'plan_version') {
    if ((!owner && !side) || c.oldLines)
      return bad('Convert earlier budget lines before freezing.');
    if (d.number !== (plan.plan?.number ?? 0) + 1 || (plan.plan && !signed(d.change)))
      bad('Choose a signed change and the next version.');
    if (plan.plan && typed(rows, 'plan_version').some((v) => v.change === d.change))
      bad('This change was already frozen.');
    const supplied = d.lines ?? [];
    d.lines = lines.map((l) => {
      const prior = plan.plan?.lines?.find((s) => s.id === l.id),
        total = plan.values.get(l.id) ?? 0;
      const input = supplied.find((s) => s.id === l.id),
        units = input?.units ?? prior?.units ?? l.units,
        unitValue = input?.unitValue ?? prior?.unitValue ?? l.unitValue;
      if (prior && total !== prior.total && ownerLine(l.id) && !lead) deny();
      if (l.kind !== 'flat rate' && lineTotal({ ...l, units, unitValue }) !== total)
        bad('Set units and unit value for each changed total.');
      return {
        id: l.id,
        heading: l.heading,
        kind: l.kind,
        direct: l.direct,
        costType: l.costType,
        unit: l.unit,
        units,
        unitValue,
        total,
      };
    });
    if (Buffer.byteLength(JSON.stringify(d)) > 12500)
      bad('The signed plan exceeds the item size limit.');
  }
  if (d.type === 'move') {
    const from = spending(d.from),
      to = spending(d.to);
    if (
      d.plan !== plan.plan?.id ||
      d.from === d.to ||
      !d.amount ||
      d.amount > (plan.values.get(d.from) ?? 0)
    )
      bad('Choose two different lines of the signed plan and an available amount.');
    if ((ownerLine(d.from) || ownerLine(d.to)) && !lead) deny();
    if (
      typed(rows, 'heading').some((h) => h.locked && (h.id === from.heading || h.id === to.heading))
    )
      bad('This heading is locked.');
  }
  if (d.type === 'contingency_use') {
    if (!side) deny();
    if (
      d.plan !== plan.plan?.id ||
      d.approvalDate < d.requestDate ||
      d.receivers.reduce((s, r) => s + r.amount, 0) !== d.amount ||
      d.amount > plan.contingency ||
      !d.amount
    )
      bad('Check the approval, available reserve and receiving amounts.');
    for (const r of d.receivers) spending(r.line);
  }
  if (d.type === 'source') {
    if (!owner && !lead) deny();
    if (!d.earmarked && d.lines.length) bad('Clear the lines for an unrestricted source.');
    for (const l of d.lines) spending(l);
    if (d.proofState !== 'none' && !d.file) bad('Attach the contribution proof.');
  }
  if (d.type === 'cut' && !lead) deny();
  if (d.type === 'forecast') {
    spending(d.line);
    if (
      !typed(rows, 'period').some((p) => p.id === d.period) ||
      typed(rows, 'forecast').some(
        (f) => f.id !== d.id && f.period === d.period && f.line === d.line,
      )
    )
      bad('Choose one forecast per period and line.');
  }
  if (d.type === 'band_table') {
    if (!owner) deny();
    if (
      d.edges.length + 1 !== d.bands.length ||
      d.edges.some((e, i) => i > 0 && e.value <= d.edges[i - 1].value) ||
      typed(rows, 'band_table').some((b) => b.id !== d.id && b.purchaseType === d.purchaseType)
    )
      bad('Use ascending edges and one more band than edges.');
  }
  if (d.type === 'procurement_plan' && (!side || !!d.noObjection !== !!d.approvalFile)) {
    if (!side) deny();
    bad('Enter both the no-objection date and file.');
  }
  if (d.type === 'buying_check') {
    if ((d.ownerBids || (old?.type === 'buying_check' && old.ownerBids)) && !lead) deny();
    if (d.ownerBids) {
      const allowed = new Set([
        'id',
        'version',
        'type',
        'ownerBids',
        'procedure',
        'consulted',
        'offerCount',
        'outcome',
        'awardedProvider',
        'awardDate',
      ]);
      if (
        Object.keys(d).some((k) => !allowed.has(k)) ||
        typed(rows, 'offer').some((o) => o.check === d.id)
      )
        bad('Keep offers, files, scoring and committee details outside this check.');
    } else {
      spending(d.line);
      if (d.singleReason && !settings?.singleOfferReasons?.includes(d.singleReason))
        bad('Choose a recorded single-offer reason.');
      if (d.plan && !typed(rows, 'procurement_plan').some((p) => p.id === d.plan))
        bad('Choose a procurement plan.');
    }
  }
  if (d.type === 'offer') {
    const check = typed(rows, 'buying_check').find((b) => b.id === d.check);
    if (!check || check.ownerBids) bad('This check cannot hold offers.');
  }
  if (d.type === 'guarantee') {
    if (exclusive('guarantee')) bad('Use the existing guarantee card.');
    if ((!old || (old.type === 'guarantee' && d.applies !== old.applies)) && !owner) deny();
    if (
      (d.state === 'issued' && !d.issuedFile) ||
      (d.state === 'released' && (!d.releaseFile || !d.releaseDate)) ||
      (d.state === 'called' && d.calledAmount === undefined)
    )
      bad('Complete the guarantee evidence.');
  }
  if (d.type === 'asset') {
    const cost = typed(rows, 'cost_row').find((r) => r.id === d.costId);
    if (
      !cost ||
      cost.funding !== 'in the budget' ||
      !['equipment', 'supply'].includes(cost.costType) ||
      typed(rows, 'asset').some((a) => a.id !== d.id && a.costId === d.costId)
    )
      bad('Choose an available equipment or supply row.');
    if (
      (['keep asked', 'keep approved'].includes(d.state) ||
        !settings?.receivers?.includes(d.receiver)) &&
      (!d.requestFile || !d.approvalFile)
    )
      bad('Attach the request and approval.');
  }
  if (d.type === 'staff_month') {
    if (old?.type === 'staff_month' && (old.approved || old.memberId !== d.memberId)) deny();
    if (!((await c.db.marks(c.p, d.memberId)) as Row<'member_marks'> | undefined)?.staff) deny();
    if (c.memberForm && (d.memberId !== c.by || d.approved || d.line || d.paySlip)) deny();
    if (!c.memberForm && !owner && !side) deny();
    if (d.approved && (!side || c.by === d.memberId)) deny();
    if (old?.type === 'staff_month' && c.memberForm) d.line = old.line;
    if ((d.line && line(d.line)?.kind !== 'staff') || (d.approved && !d.line))
      bad('Choose a staff line.');
    const h = fraction(d.hours),
      t = fraction(d.totalHours);
    if (!t.n || h.n * t.d > t.n * h.d) bad('Check the total hours.');
    if (
      (await c.db.item(c.p, d.step))?.kind !== 'step' ||
      typed(rows, 'staff_month').some(
        (m) => m.id !== d.id && m.memberId === d.memberId && m.month === d.month,
      )
    )
      bad('Choose one month and step.');
  }
  if (d.type === 'change_record') {
    if (old?.type === 'change_record' && old.signedDate) deny();
    if (!!d.signedDate !== !!d.file) bad('Enter the signed date and file together.');
    if (d.signedDate && d.kind !== 'signed change') {
      const item = await c.db.item(c.p, 'pilot-schedule');
      if (!item || item.hidden || item.kind !== 'schedule')
        return bad('Set the pilot dates first.');
      const s = scheduleSchema.parse(item.payload);
      if (
        (d.kind === 'extension' && !d.months) ||
        (d.kind === 'suspension' && (!d.start || !d.end || d.end < d.start))
      )
        return bad('Enter the extension length or suspension dates.');
      const end =
        d.kind === 'extension'
          ? shiftMonth(s.end, d.months!)
          : advance(s.end, 1 + (Date.parse(d.end!) - Date.parse(d.start!)) / 86400000);
      return { ...s, months: s.months + (d.kind === 'extension' ? d.months! : 0), end };
    }
  }
}
