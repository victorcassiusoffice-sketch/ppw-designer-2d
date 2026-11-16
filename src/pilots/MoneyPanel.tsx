import { useEffect, useState } from 'react';
import { uid, type Pilot } from './contract';
import { categories, currencies, display, minor, payStates, type Pay, type Budget } from './money';
import { exportCsv } from './moneyCsv';
import { LedgerEditor, typeLabels } from './LedgerEditor';
import {
  ledgerRow,
  typed,
  major,
  mayHoldPay,
  ledgerSummary,
  flagsFor,
  costCsv,
  rateCsv,
  type Ledger,
  type BookCurrency,
  type Snapshot,
} from './ledger';
import { request, useRemote, saveFile } from './remote';
import { fileCap, proofKinds, type Evidence } from './evidence';
type Raw = Record<string, unknown> & { id: string; type: string };
type Book = { revision: number; currency: BookCurrency | null; rows: Raw[] };
function data(row: Raw) {
  const { audit, snapshot, ...v } = row;
  return v;
}
function csv(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ProofUpload({
  enabled,
  slug,
  after,
}: {
  enabled: boolean;
  slug: string;
  after: () => void;
}) {
  const [msg, setMsg] = useState('');
  if (!enabled) return <p>Private proof uploads are off.</p>;
  return (
    <details>
      <summary>Add money proof</summary>
      <form
        className="pilot-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            v = new FormData(form),
            file = v.get('file');
          if (!(file instanceof File) || file.size > fileCap) {
            setMsg('Choose a file of 1 MB or less.');
            return;
          }
          try {
            const data = await new Promise<string>((resolve, reject) => {
              const f = new FileReader();
              f.onload = () => resolve(String(f.result).split(',')[1]);
              f.onerror = reject;
              f.readAsDataURL(file);
            });
            const r = (await saveFile(
              slug,
              { source: 'money', title: v.get('title'), kind: v.get('kind') },
              data,
            )) as { file: Evidence };
            setMsg('Saved · ' + r.file.title);
            form.reset();
            after();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : 'Could not save the proof.');
          }
        }}
      >
        <label>
          Title
          <input name="title" required maxLength={160} />
        </label>
        <label>
          Proof kind
          <select name="kind">
            {proofKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          File
          <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png" />
        </label>
        <button>Save proof</button>
        <p role="status">{msg}</p>
      </form>
    </details>
  );
}
export default function MoneyPanel({ p, owner }: { p: Pilot; owner: boolean }) {
  const remote = useRemote((s) => s.doc),
    [book, setBook] = useState<Book>(),
    [files, setFiles] = useState<{ enabled: boolean; files: Evidence[] }>({
      enabled: false,
      files: [],
    }),
    [reload, bump] = useState(0),
    [error, setError] = useState(''),
    [edit, setEdit] = useState<{ type: Ledger['type']; initial?: Raw; invoice?: Raw }>(),
    [kind, setKind] = useState<Ledger['type']>('budget_line'),
    [foreign, setForeign] = useState('USD'),
    [history, setHistory] = useState<{ key: string; rows: Record<string, unknown>[] }>();
  const url = '/' + p.slug,
    seat = remote?.memberId ?? '',
    role = remote?.role ?? '';
  useEffect(() => {
    let live = true;
    Promise.all([request<Book>(url + '/ledger'), request<typeof files>(url + '/files')])
      .then(([b, f]) => {
        if (live) {
          setBook(b);
          setFiles(f);
          setError('');
        }
      })
      .catch((e) => {
        if (live) {
          setBook(undefined);
          setError(e.message);
        }
      });
    return () => {
      live = false;
    };
  }, [url, reload, remote?.revision]);
  async function write(path: string, data: Record<string, unknown>) {
    try {
      await request(url + path, 'POST', { revision: book!.revision, ...data });
      bump((n) => n + 1);
    } catch (e) {
      bump((n) => n + 1);
      throw e;
    }
  }
  if (!book) return <p role="status">{error || 'Opening the private ledger…'}</p>;
  if (!book.currency)
    return owner ? (
      <form
        className="pilot-form"
        onSubmit={(e) => {
          e.preventDefault();
          void write('/money', { currency: new FormData(e.currentTarget).get('currency') }).catch(
            (e) => setError(e.message),
          );
        }}
      >
        <label>
          Pilot currency
          <select name="currency" required>
            <option value="">Choose</option>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button>Set currency</button>
        <p role="alert">{error}</p>
      </form>
    ) : (
      <p>The owner chooses the currency first.</p>
    );
  const code = book.currency,
    records = book.rows,
    rows = records
      .filter((r) => r.version === 2 && r.type !== 'pay_row')
      .map((r) => ledgerRow.parse(data(r))),
    old = records.filter((r) => r.type === 'budget_line' && r.version !== 2) as unknown as Budget[],
    pays = records.filter((r) => r.type === 'pay_row') as unknown as Pay[],
    snapshots = Object.fromEntries(
      records.filter((r) => r.snapshot).map((r) => [r.id, r.snapshot as Snapshot]),
    ),
    heads = typed(rows, 'heading'),
    lines = typed(rows, 'budget_line');
  const sum = ledgerSummary(
      rows,
      code,
      old.reduce((s, l) => s + l.planned, 0),
      snapshots,
    ),
    fmt = (n: number) => display(n, code);
  const ctx = { p, records, files: files.files, book: code, owner, seat, role };
  const allowed = (k: string) =>
    !['settings', 'member_marks', 'heading', 'rate_month'].includes(k) || owner;
  const add = (type: Ledger['type'], initial?: Raw) => {
    setEdit({ type, initial });
    setError('');
  };
  return (
    <div className="pilot-money">
      <p>
        Private to the owner, the lead and the coordinator. Members see only their own rows, on
        their own page.
      </p>
      <p>Estimates and records only, not an approval.</p>
      {!typed(rows, 'settings').length && <p>Settings missing</p>}
      {error && <p role="alert">{error}</p>}
      <div className="pilot-money-totals">
        {Object.entries(sum).map(([k, v]) => (
          <p key={k}>
            {k === 'outside' ? 'Outside the grant' : k} <strong>{fmt(v)}</strong>
          </p>
        ))}
      </div>
      <div className="pilot-form">
        <label>
          Money record
          <select value={kind} onChange={(e) => setKind(e.target.value as Ledger['type'])}>
            {Object.entries(typeLabels)
              .filter(([k]) => allowed(k))
              .map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <button
          onClick={() =>
            add(
              kind,
              kind === 'settings'
                ? records.find((r) => r.type === 'settings') &&
                    (data(records.find((r) => r.type === 'settings')!) as Raw)
                : undefined,
            )
          }
        >
          Add or update {typeLabels[kind].toLowerCase()}
        </button>
      </div>
      {edit && (
        <LedgerEditor
          key={edit.type + '-' + (edit.initial?.id ?? 'new')}
          ctx={ctx}
          type={edit.type}
          initial={edit.initial}
          cancel={() => setEdit(undefined)}
          submit={(row, reason) =>
            edit.invoice
              ? write('/ledger', {
                  row: { ...edit.invoice, line: row.line },
                  reason,
                  createCost: row,
                })
              : write('/ledger', { row, reason })
          }
        />
      )}
      <ProofUpload slug={p.slug} enabled={files.enabled} after={() => bump((n) => n + 1)} />
      {owner && (
        <details>
          <summary>Copy headings from another pilot</summary>
          <form
            className="pilot-form"
            onSubmit={(e) => {
              e.preventDefault();
              const text = String(new FormData(e.currentTarget).get('pilot') ?? '');
              void write('/copy-tree', { from: text.split('/').filter(Boolean).pop() }).catch((e) =>
                setError(e.message),
              );
            }}
          >
            <label>
              Source pilot address
              <input required name="pilot" />
            </label>
            <button>Copy heading tree</button>
          </form>
        </details>
      )}
      {!!remote?.moneyDue?.length && (
        <details>
          <summary>Money due · {remote.moneyDue.length}</summary>
          {remote.moneyDue.map((d) => (
            <p key={d.id}>{d.label}</p>
          ))}
        </details>
      )}
      <h3>Budget headings</h3>
      {(heads.length ? [...heads.map((h) => h.id), 'unplaced'] : [...categories]).map((k) => {
        const ids = new Set(
            lines
              .filter(
                (l) =>
                  l.heading === k || (k === 'unplaced' && categories.some((c) => c === l.heading)),
              )
              .map((l) => l.id),
          ),
          legacy = old.filter((l) => k === 'unplaced' || l.category === k);
        const sums = ledgerSummary(
          rows,
          code,
          legacy.reduce((n, l) => n + l.planned, 0),
          snapshots,
          ids,
        );
        return (
          <details key={k}>
            <summary>
              {heads.find((h) => h.id === k)?.name ?? (k === 'unplaced' ? 'Not yet placed' : k)} ·{' '}
              {fmt(sums.planned)}
            </summary>
            <p>
              Spent {fmt(sums.spent)} · Remaining {fmt(sums.remaining)}
            </p>
            {legacy.map((l) => (
              <article key={l.id}>
                <b>{l.label}</b>
                <p>State before S11 · {l.state}</p>
                <p>
                  Typed before S11 · committed {fmt(l.committed)} · spent {fmt(l.spent)}
                </p>
                <button
                  onClick={() =>
                    add('budget_line', {
                      id: l.id,
                      type: 'budget_line',
                      version: 2,
                      heading: l.category,
                      label: l.label,
                      note: l.note,
                      kind: 'ordinary',
                      units: '1',
                      unitValue: l.planned,
                      direct: false,
                      flags: [],
                    })
                  }
                >
                  Convert line
                </button>
              </article>
            ))}
          </details>
        );
      })}
      {Object.entries(typeLabels).map(([k, label]) => (
        <details key={k}>
          <summary>
            {label} records · {rows.filter((r) => r.type === k).length}
          </summary>
          {records
            .filter((r) => r.version === 2 && r.type === k)
            .map((r) => (
              <article key={r.id}>
                <h4>
                  {String(
                    r.label ??
                      r.name ??
                      r.description1 ??
                      r.number ??
                      p.members.find((m) => m.id === r.memberId)?.name ??
                      label,
                  )}
                </h4>
                <dl>
                  {Object.entries(r)
                    .filter(
                      ([key, value]) =>
                        !['id', 'type', 'version', 'audit', 'snapshot'].includes(key) &&
                        value !== undefined,
                    )
                    .map(([key, v]) => (
                      <div key={key}>
                        <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
                        <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                      </div>
                    ))}
                </dl>
                {r.type === 'cost_row' && (
                  <p>
                    {flagsFor(
                      data(r) as RowCost,
                      rows,
                      code,
                      p.schedules?.[0],
                      snapshots[r.id],
                    ).join(' · ') || 'Complete'}
                  </p>
                )}
                {r.audit != null && (
                  <details>
                    <summary>Recorded actions</summary>
                    {Object.entries(
                      r.audit as Record<string, { seat: string; at: string; link?: string }>,
                    ).map(([k, s]) => (
                      <p key={k}>
                        {k} · {s.seat} · {s.link ?? 'studio'} · {s.at}
                      </p>
                    ))}
                  </details>
                )}
                {r.type === 'invoice' && r.state === 'received' && !r.costId && (
                  <button
                    onClick={() =>
                      setEdit({
                        type: 'cost_row',
                        invoice: data(r) as Raw,
                        initial: {
                          id: uid(),
                          type: 'cost_row',
                          version: 2,
                          currency: r.currency,
                          amount: r.amount,
                          tax: r.tax,
                          documentKind: 'invoice',
                          documentRef: r.number,
                          documentDate: r.date,
                          thirdParty:
                            r.thirdParty ?? p.members.find((m) => m.id === r.sender)?.organisation,
                          description1: '',
                          description2: '',
                          line: r.line ?? lines[0]?.id,
                        },
                      })
                    }
                  >
                    Create linked cost row
                  </button>
                )}
                {allowed(k) &&
                  !['settings', 'member_marks', 'payment_row', 'row_entry'].includes(k) && (
                    <details>
                      <summary>Hide record</summary>
                      <form
                        className="pilot-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void write('/ledger', {
                            row: data(r),
                            hide: true,
                            reason: String(new FormData(e.currentTarget).get('reason') ?? ''),
                          }).catch((e) => setError(e.message));
                        }}
                      >
                        <label>
                          Reason
                          <input name="reason" maxLength={300} />
                        </label>
                        <button>Hide this record</button>
                      </form>
                    </details>
                  )}
                {allowed(k) && (
                  <button onClick={() => add(k as Ledger['type'], data(r) as Raw)}>
                    Edit record
                  </button>
                )}
                <button
                  onClick={() =>
                    void request<{ entries: Record<string, unknown>[] }>(url + '/history/' + r.id)
                      .then((v) => setHistory({ key: r.id, rows: v.entries }))
                      .catch((e) => setError(e.message))
                  }
                >
                  View history
                </button>
                {history?.key === r.id &&
                  history.rows.map((h, i) => (
                    <p key={i}>
                      {String(h.at)} · {String(h.fields)} · {String(h.reason ?? '')}
                    </p>
                  ))}
              </article>
            ))}
        </details>
      ))}
      <h3>Team pay</h3>
      {p.members.map((m) => {
        const row = pays.find((r) => r.memberId === m.id),
          mark = typed(rows, 'member_marks').find((r) => r.memberId === m.id),
          eligible = mayHoldPay(m.role, mark);
        return (
          <details key={m.id}>
            <summary>
              {m.name} · {m.role}
            </summary>
            {row && (
              <p>
                {fmt(row.agreed)} · {row.state} · {row.note}
              </p>
            )}
            {row && !eligible && <p>Check: member may not hold pay</p>}
            {row &&
              mark?.invoices &&
              ['invoiced', 'paid'].includes(row.state) &&
              !typed(rows, 'invoice').some((r) => r.sender === m.id) && <p>Check: no invoice</p>}
            {eligible && (owner || role === 'lead') && m.id !== seat && (
              <form
                className="pilot-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const pay = {
                    id: 'pay-' + m.id,
                    type: 'pay_row',
                    role: m.role,
                    memberId: m.id,
                    agreed: minor(String(f.get('agreed'))),
                    state: f.get('state'),
                    from: f.get('from'),
                    note: f.get('note'),
                  };
                  void write('/money', { row: pay }).catch((e) => setError(e.message));
                }}
              >
                <label>
                  Agreed ({code})
                  <input
                    required
                    type="number"
                    step=".01"
                    min="0"
                    name="agreed"
                    defaultValue={row ? major(row.agreed, 2) : ''}
                  />
                </label>
                <label>
                  Pay state
                  <select name="state" defaultValue={row?.state}>
                    {payStates.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Paid from
                  <select required name="from" defaultValue={row?.from}>
                    {[...old, ...lines].map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note
                  <input name="note" defaultValue={row?.note} />
                </label>
                <button>Save pay row</button>
              </form>
            )}
          </details>
        );
      })}
      <details>
        <summary>Download CSVs</summary>
        <button onClick={() => csv('cost-list', costCsv(rows, code, p.steps, snapshots))}>
          Download cost list
        </button>
        <button
          onClick={() => csv('internal-cost-list', costCsv(rows, code, p.steps, snapshots, true))}
        >
          Download internal cost list
        </button>
        <label>
          Rate currency
          <select value={foreign} onChange={(e) => setForeign(e.target.value)}>
            {Object.keys(minorDigitsForUi).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button onClick={() => csv('monthly-rates-' + foreign, rateCsv(rows, foreign))}>
          Download monthly rates
        </button>
        <button
          onClick={() =>
            exportCsv('pilot-team-pay', [
              ['Member', 'Role', 'Paid from', 'Currency', 'Agreed', 'State', 'Note'],
              ...pays.map((q) => [
                p.members.find((m) => m.id === q.memberId)?.name ?? '',
                q.role,
                [...old, ...lines].find((l) => l.id === q.from)?.label ?? '',
                code,
                major(q.agreed, 2),
                q.state,
                q.note,
              ]),
            ])
          }
        >
          Download pay CSV
        </button>
      </details>
    </div>
  );
}
import { minorDigits as minorDigitsForUi, type Row } from './ledger';
type RowCost = Row<'cost_row'>;
