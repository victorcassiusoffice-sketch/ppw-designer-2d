import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ledgerRow, minorDigits, type Ledger } from './ledger';
import { today, uid, type Pilot } from './contract';
import { categories } from './money';
import { recordKinds, proofKinds, type Evidence } from './evidence';

type Raw = Record<string, unknown>;
type Context = {
  jobs?:{id:string;title:string}[];
  p: Pilot;
  records: Raw[];
  files: Evidence[];
  book: string;
  personal?: boolean;
  seat: string;
  owner: boolean;
  role: string;
};
export const typeLabels: Record<string, string> = {
  plan_version: 'Signed plan',
  move: 'Budget move',
  contingency_use: 'Contingency use',
  change_record: 'Contract change',
  source: 'Contribution source',
  cut: 'Recorded cut',
  forecast: 'Next-period forecast',
  band_table: 'Purchase value bands',
  procurement_plan: 'Procurement plan',
  buying_check: 'Buying check',
  offer: 'Offer',
  guarantee: 'Guarantee',
  asset: 'Asset handover',
  staff_month: 'Staff month',
  wrong_sum: 'Amount to recover',
  settings: 'Ledger settings',
  member_marks: 'Member access',
  heading: 'Heading',
  budget_line: 'Budget line',
  rate_month: 'Monthly rate',
  period: 'Report period',
  payment_row: 'Funder payment',
  cost_row: 'Cost row',
  invoice: 'Invoice or credit note',
  transfer: 'Transfer',
  row_entry: 'Funder result or late proof',
};
const labels: Record<string, string> = {
  ownerSupplies: "The owner's company supplies",
  whose: 'Whose cost',
  paidBy: 'Paid by',
  amount: 'Amount without tax',
  unitValue: 'Unit value',
  currency: 'Currency',
  number: 'Number',
  heading: 'Heading',
  unit: 'Unit',
  costType: 'Type of cost',
  units: 'Number of units',
  source: 'Rate source',
  paymentRate: 'Funder payment used for the rate',
  file: 'File',
  costId: 'Linked cost row',
  sender: 'Member sending the invoice',
  thirdParty: 'Third party',
  memberId: 'Member',
  invoices: 'Invoices the lead',
  partner: 'Partner',
  staff: 'Staff of the lead',
  timeZone: 'Pilot time zone',
  commitDate: 'Commitment date',
  activityDate: 'Activity, delivery or installation date',
  type: 'Type',
  refusal: 'Refusal reason the sender can read',
  parent: 'Parent heading',
  credits: 'Invoice being credited',
  corrects: 'Claimed row being corrected',
  grantPercent: 'Grant percent',
  maximumGrant: 'Maximum grant',
  proofs: 'Proof checklist',
  bankNotice: 'Bank notice file',
  eligible: 'Amount eligible',
  costTypeLabel: 'Cost type',
};
const words = (s: string) =>
  labels[s] ?? (s[0].toUpperCase() + s.slice(1)).replace(/([a-z])([A-Z])/g, '$1 $2');
const fileFields = new Set([
  'file',
  'delivery',
  'integrity',
  'bankNotice',
  'issuedFile',
  'releaseFile',
  'approvalFile',
  'requestFile',
  'reasonFile',
  'reasonsFile',
  'replyFile',
  'committeeReport',
  'tender',
  'timeSheet',
  'paySlip',
]);
const minorFields = new Set([
  'amount',
  'tax',
  'unitValue',
  'value',
  'gross',
  'otherPay',
  'netPay',
  'employerCharges',
  'calledAmount',
  'askedAmount',
  'accountsAmount',
  'expectedAmount',
  'promised',
  'recovered',
  'committeeFrom',
  'eligible',
  'receivedAmount',
  'maximumGrant',
  'assetValue',
]);
const fileName = (k: string) =>
  ({
    delivery: 'Delivery note or report',
    integrity: 'Integrity statement',
    file: 'File',
    bankNotice: 'Bank notice',
  })[k] ?? k;
function options(key: string, ctx: Context, values: Raw): { value: string; name: string }[] | null {
  const map = (rows: Raw[], label: string) =>
    rows.map((r) => ({ value: String(r.id), name: String(r[label] ?? r.id) }));
  const records = ctx.records;
  if(key==='tradeJob')return (ctx.jobs??[]).map(j=>({value:j.id,name:j.title}));
  if (fileFields.has(key)) return map(ctx.files as unknown as Raw[], 'title');
  if (
    ['memberId', 'sender', 'whose', 'partner'].includes(key) &&
    !(key === 'partner' && values.type === 'member_marks')
  )
    return ctx.p.members.map((m) => ({ value: m.id, name: m.name + ' · ' + m.role }));
  if (key === 'activity' || key === 'step') return map(ctx.p.steps, 'title');
  if (key === 'heading' || key === 'parent')
    return [
      ...(key === 'heading' ? categories.map((v) => ({ value: v, name: v })) : []),
      ...map(
        records.filter((r) => r.type === 'heading' && r.id !== values.id),
        'name',
      ),
    ];
  const lookup: Record<string, [string, string]> = {
    ...(values.type === 'transfer' && key === 'source'
      ? { source: ['source', 'name'] as [string, string] }
      : {}),
    from: ['budget_line', 'label'],
    to: ['budget_line', 'label'],
    period: ['period', 'number'],
    staffMonth: ['staff_month', 'month'],
    buyingCheck: ['buying_check', 'procedure'],
    check: ['buying_check', 'procedure'],
    plan:
      values.type === 'buying_check' ? ['procurement_plan', 'sent'] : ['plan_version', 'number'],
    change: ['change_record', 'kind'],
    signedChange: ['change_record', 'kind'],
    line: ['budget_line', 'label'],
    costId: ['cost_row', 'description1'],
    corrects: ['cost_row', 'description1'],
    credits: ['invoice', 'number'],
    paymentRate: ['payment_row', 'label'],
  };
  if (lookup[key]) {
    const [t, l] = lookup[key];
    return map(
      records.filter((r) => r.type === t && r.id !== values.id),
      l,
    );
  }
  return null;
}
function unwrap(shape: z.ZodTypeAny) {
  let node = shape;
  while (
    node instanceof z.ZodOptional ||
    node instanceof z.ZodDefault ||
    node instanceof z.ZodEffects
  )
    node = node instanceof z.ZodEffects ? node.innerType() : node._def.innerType;
  return node;
}
const proofOptions = [
  ...proofKinds,
  ...recordKinds,
  'integrity statement',
  'distance covered',
  'average consumption',
  'fuel',
  'upkeep costs',
];
function Checklist({
  value,
  onChange,
  files,
}: {
  value: Raw[];
  onChange: (v: Raw[]) => void;
  files: Evidence[];
}) {
  function set(i: number, k: string, v: string) {
    onChange(value.map((r, j) => (i === j ? { ...r, [k]: v || undefined } : r)));
  }
  return (
    <fieldset>
      <legend>Proof checklist</legend>
      {value.map((r, i) => (
        <div key={i}>
          <label>
            Proof kind
            <select value={String(r.kind)} onChange={(e) => set(i, 'kind', e.target.value)}>
              {proofOptions.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Proof file
            <select value={String(r.file ?? '')} onChange={(e) => set(i, 'file', e.target.value)}>
              <option value="">Missing</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason if not needed
            <input
              value={String(r.reason ?? '')}
              onChange={(e) => set(i, 'reason', e.target.value)}
            />
          </label>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Remove checklist entry
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { kind: 'buying paper' }])}>
        Add checklist entry
      </button>
    </fieldset>
  );
}
export function LedgerEditor({
  ctx,
  type,
  initial,
  submit,
  cancel,
}: {
  ctx: Context;
  type: Ledger['type'];
  initial?: Raw;
  submit: (row: Raw, reason: string) => Promise<void>;
  cancel: () => void;
}) {
  const schema = ledgerRow.options.find((s) => s.shape.type.value === type)!;
  const initialValues: Raw = {
    id: uid(),
    version: 2,
    type,
    ...(type === 'member_marks' ? { memberId: ctx.p.members[0]?.id } : {}),
    ...(type === 'settings' ? { id: 'ledger-settings', timeZone: 'Indian/Mauritius' } : {}),
    ...(type === 'invoice' && ctx.personal ? { sender: ctx.seat } : {}),
    ...initial,
  };
  for (const [k, s] of Object.entries(schema.shape) as [string, z.ZodTypeAny][]) {
    if (initialValues[k] !== undefined || (s.isOptional() && !(s instanceof z.ZodDefault)))
      continue;
    const n = unwrap(s),
      opts = options(k, ctx, initialValues);
    if (n instanceof z.ZodBoolean) initialValues[k] = false;
    else if (n instanceof z.ZodArray) initialValues[k] = [];
    else if (n instanceof z.ZodEnum)
      initialValues[k] = n.options.includes(ctx.book) ? ctx.book : n.options[0];
    else if (n instanceof z.ZodLiteral) initialValues[k] = n.value;
    else if (opts?.length) initialValues[k] = opts[0].value;
    else if (k === 'note') initialValues[k] = '';
    else if (k === 'date' || /Date$/.test(k)) initialValues[k] = today();
  }
  const [values, setValues] = useState(initialValues),
    [reason, setReason] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value,...(key==='tradeJob'&&value&&!initial?.tradeJob?{funding:'outside the grant'}:{}) }));
  const personalFields = [
    'number',
    'date',
    'amount',
    'tax',
    'currency',
    'file',
    'delivery',
    'integrity',
    'credits',
    'state',
  ];
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const raw = { ...values };
      if (type === 'member_marks') raw.id = 'marks-' + raw.memberId;
      const v = ledgerRow.safeParse(raw);
      if (!v.success)
        throw Error(
          'Check ' +
            v.error.issues
              .map((i) => i.path.join(' '))
              .slice(0, 5)
              .join(', ') +
            '.',
        );
      await submit(v.data, reason);
      cancel();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save this record.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="pilot-form" onSubmit={save}>
      <h4>{typeLabels[type]}</h4>
      {(Object.entries(schema.shape) as [string, z.ZodTypeAny][]).map(([k, shape]) => {
        if (
          ['id', 'version', 'type', 'subLines'].includes(k) ||
          (ctx.personal && !personalFields.includes(k))
        )
          return null;
        const n = unwrap(shape),
          v = values[k],
          text = String(v ?? ''),
          label = words(k),
          optional = shape.isOptional(),
          opts = options(k, ctx, values);
        if (n instanceof z.ZodLiteral) return null;
        if (k === 'proofs')
          return (
            <Checklist
              key={k}
              value={(v as Raw[] | undefined) ?? []}
              files={ctx.files}
              onChange={(r) => set(k, r)}
            />
          );
        if (k === 'proof')
          return (
            <fieldset key={k}>
              <legend>Late proof</legend>
              <label>
                Kind
                <select
                  value={String((v as Raw)?.kind ?? '')}
                  onChange={(e) => set(k, { ...(v as Raw), kind: e.target.value })}
                >
                  <option value="">Choose</option>
                  {proofOptions.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                File
                <select
                  value={String((v as Raw)?.file ?? '')}
                  onChange={(e) => set(k, { ...(v as Raw), file: e.target.value })}
                >
                  <option value="">Choose</option>
                  {ctx.files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          );
        if (n instanceof z.ZodBoolean)
          return (
            <label key={k}>
              <input
                type="checkbox"
                checked={!!v}
                disabled={k === 'ownerSupplies' && (ctx.owner || ctx.role !== 'lead')}
                onChange={(e) => set(k, e.target.checked)}
              />
              {label}
            </label>
          );
        if (n instanceof z.ZodEnum || opts) {
          const list =
            opts ??
            (n as z.ZodEnum<[string, ...string[]]>).options.map((v) => ({ name: v, value: v }));
          return (
            <label key={k}>
              {fileFields.has(k) ? fileName(k) : label}
              <select
                required={!optional}
                value={text}
                onChange={(e) => set(k, e.target.value || undefined)}
              >
                <option value="">{optional ? 'None' : 'Choose'}</option>
                {list
                  .filter(
                    (x) =>
                      !ctx.personal || k !== 'state' || ['received', 'withdrawn'].includes(x.value),
                  )
                  .map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </label>
          );
        }
        if (n instanceof z.ZodArray && unwrap(n.element) instanceof z.ZodObject) {
          const shape = (unwrap(n.element) as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>,
            items = (Array.isArray(v) ? v : []) as Raw[];
          return (
            <fieldset key={k}>
              <legend>{label}</legend>
              {items.map((item, i) => (
                <fieldset key={i}>
                  <legend>{i + 1}</legend>
                  {Object.entries(shape).map(([field, schema]) => {
                    const t = unwrap(schema),
                      change = (val: unknown) =>
                        set(
                          k,
                          items.map((row, j) => (i === j ? { ...row, [field]: val } : row)),
                        ),
                      list = options(field, ctx, values);
                    return (
                      <label key={field}>
                        {words(field)}
                        {t instanceof z.ZodBoolean ? (
                          <input
                            type="checkbox"
                            checked={item[field] === true}
                            onChange={(e) => change(e.target.checked)}
                          />
                        ) : list || t instanceof z.ZodEnum ? (
                          <select
                            value={String(item[field] ?? '')}
                            onChange={(e) => change(e.target.value || undefined)}
                          >
                            <option value="">Choose</option>
                            {(
                              list ??
                              (t as z.ZodEnum<[string, ...string[]]>).options.map((v) => ({
                                name: v,
                                value: v,
                              }))
                            ).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={t instanceof z.ZodNumber ? 'number' : 'text'}
                            defaultValue={String(item[field] ?? '')}
                            onChange={(e) =>
                              change(
                                e.target.value === ''
                                  ? undefined
                                  : t instanceof z.ZodNumber
                                    ? Number(e.target.value)
                                    : e.target.value,
                              )
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        k,
                        items.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remove row
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() =>
                  set(k, [
                    ...items,
                    Object.fromEntries(
                      Object.entries(shape)
                        .filter(([, s]) => unwrap(s) instanceof z.ZodBoolean)
                        .map(([f]) => [f, false]),
                    ),
                  ])
                }
              >
                Add row
              </button>
            </fieldset>
          );
        }
        if (n instanceof z.ZodArray)
          return (
            <label key={k}>
              {label} · one per line
              <textarea
                defaultValue={Array.isArray(v) ? v.join('\n') : ''}
                onChange={(e) => {
                  const a = e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  set(k, a.length || !optional ? a : undefined);
                }}
              />
            </label>
          );
        if (n instanceof z.ZodRecord)
          return (
            <label key={k}>
              {label} · purchase type and basis per line
              <textarea
                defaultValue={Object.entries(v ?? {})
                  .map(([k, x]) => k + ' = ' + x)
                  .join('\n')}
                onChange={(e) =>
                  set(
                    k,
                    Object.fromEntries(
                      e.target.value
                        .split('\n')
                        .filter((s) => s.includes('='))
                        .map((s) => s.split('=').map((v) => v.trim())),
                    ),
                  )
                }
              />
            </label>
          );
        const num = n instanceof z.ZodNumber,
          minor = minorFields.has(k) && num,
          digits =
            minorDigits[String(values.currency ?? ctx.book) as keyof typeof minorDigits] ?? 2;
        const dateField =
          ['start', 'end', 'due', 'sent', 'date', 'pendingDue'].includes(k) || /Date$/.test(k);
        return (
          <label key={k}>
            {label}
            {minor ? ' (' + (values.currency ?? ctx.book) + ')' : ''}
            <input
              type={num ? 'number' : dateField ? 'date' : k === 'month' ? 'month' : 'text'}
              step={minor ? 1 / 10 ** digits : num ? 1 : undefined}
              defaultValue={minor && v !== undefined ? Number(v) / 10 ** digits : text}
              required={!optional && k !== 'note'}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw && optional) return set(k, undefined);
                if (minor) {
                  const m = /^(-?)(\d+)(?:\.(\d*))?$/.exec(raw);
                  set(
                    k,
                    m && (m[3] ?? '').length <= digits
                      ? Number(BigInt((m[1] || '') + m[2] + (m[3] ?? '').padEnd(digits, '0')))
                      : undefined,
                  );
                } else set(k, num ? Number(raw) : raw);
              }}
            />
          </label>
        );
      })}
      <label>
        Reason for this change
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </label>
      <button disabled={busy}>Save {typeLabels[type].toLowerCase()}</button>
      <button type="button" onClick={cancel}>
        Cancel
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
