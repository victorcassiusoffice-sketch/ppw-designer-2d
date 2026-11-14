import { useEffect, useState } from 'react';
import type { Pilot } from './contract';
import { uid } from './contract';
import { request } from './remote';
import {
  categories,
  currencies,
  display,
  exportCsv,
  lineStates,
  minor,
  payStates,
  totals,
  type Budget,
  type Pay,
  type MoneyBook,
  type Money as Row,
} from './money';

export default function MoneyPanel({ p, owner }: { p: Pilot; owner: boolean }) {
  const [book, setBook] = useState<MoneyBook>(),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Row>();
  const url = '/' + p.slug + '/money';
  useEffect(() => {
    let live = true;
    setBook(undefined);
    setErr('');
    request<MoneyBook>(url)
      .then((b) => {
        if (live) setBook(b);
      })
      .catch(() => {
        if (live) setErr('Private budget unavailable.');
      });
    return () => {
      live = false;
    };
  }, [url]);
  async function save(payload: unknown) {
    if (!book || busy) return;
    setBusy(true);
    setErr('');
    try {
      await request(url, 'POST', { revision: book.revision, ...(payload as object) });
      setEdit(undefined);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      try {
        setBook(await request<MoneyBook>(url));
      } catch {
        setBook(undefined);
        setErr('Private budget unavailable.');
      }
      setBusy(false);
    }
  }
  const lines = (book?.rows ?? []).filter((r): r is Budget => r.type === 'budget_line'),
    pay = (book?.rows ?? []).filter((r): r is Pay => r.type === 'pay_row');
  const code = book?.currency,
    fmt = (n: number) => (code ? display(n, code) : ''),
    who = (id: string) => p.members.find((m) => m.id === id)?.name ?? 'Member',
    line = (id: string) => lines.find((l) => l.id === id)?.label ?? '',
    sum = totals(lines);
  const dec = (v: number) => String((v / 100).toFixed(2));
  return (
    <div className="pilot-money">
      <p>Private to the owner, the lead and the coordinator.</p>
      {err && <p role="alert">{err}</p>}
      {!book ? (
        <p>Opening budget…</p>
      ) : !code ? (
        owner ? (
          <form
            className="pilot-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save({ currency: new FormData(e.currentTarget).get('currency') });
            }}
          >
            <label>
              Pilot currency
              <select name="currency" required defaultValue="">
                <option disabled value="">
                  Choose a currency
                </option>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Set currency</button>
          </form>
        ) : (
          <p>The owner chooses the currency first.</p>
        )
      ) : (
        <>
          <h3>Budget · {code}</h3>
          <div className="pilot-money-totals">
            {(['planned', 'committed', 'spent', 'remaining'] as const).map((k) => (
              <p key={k}>
                {k}: <strong>{fmt(sum[k])}</strong>
              </p>
            ))}
          </div>
          {categories
            .filter((c) => lines.some((l) => l.category === c))
            .map((c) => {
              const t = totals(lines.filter((l) => l.category === c));
              return (
                <details key={c}>
                  <summary>
                    {c} · remaining {fmt(t.remaining)}
                  </summary>
                  <p>
                    Planned {fmt(t.planned)} · committed {fmt(t.committed)} · spent {fmt(t.spent)}
                  </p>
                </details>
              );
            })}
          <div className="pilot-actions">
            <button
              onClick={() =>
                setEdit({
                  type: 'budget_line',
                  id: 'budget-' + uid(),
                  currency: code,
                  label: '',
                  category: 'works',
                  planned: 0,
                  committed: 0,
                  spent: 0,
                  state: 'planned',
                  note: '',
                })
              }
            >
              Add budget line
            </button>
            <button
              onClick={() =>
                exportCsv('pilot-budget', [
                  [
                    'Label',
                    'Category',
                    'Currency',
                    'Planned',
                    'Committed',
                    'Spent',
                    'Remaining',
                    'State',
                    'Note',
                  ],
                  ...lines.map((l) => [
                    l.label,
                    l.category,
                    code,
                    dec(l.planned),
                    dec(l.committed),
                    dec(l.spent),
                    dec(l.planned - l.spent),
                    l.state,
                    l.note,
                  ]),
                ])
              }
            >
              Download budget CSV
            </button>
          </div>
          {lines.map((l) => (
            <article key={l.id}>
              <b>{l.label}</b>
              <p>
                {l.category} · {l.state} · planned {fmt(l.planned)} · committed {fmt(l.committed)} ·
                spent {fmt(l.spent)}
              </p>
              <p>{l.note}</p>
              <button onClick={() => setEdit(l)}>Edit {l.label}</button>
            </article>
          ))}
          <h3>Team pay</h3>
          {p.members.map((m) => {
            const row = pay.find((v) => v.memberId === m.id);
            return (
              <article key={m.id}>
                <b>{m.name}</b> · {m.role}
                <p>
                  {row
                    ? fmt(row.agreed) + ' · ' + row.state + ' · ' + line(row.from)
                    : 'No agreement recorded'}
                </p>
                {row?.note && <p>{row.note}</p>}
                <button
                  disabled={!lines.length}
                  onClick={() =>
                    setEdit(
                      row ?? {
                        type: 'pay_row',
                        id: 'pay-' + m.id,
                        memberId: m.id,
                        role: m.role,
                        from: lines[0].id,
                        agreed: 0,
                        state: 'not agreed',
                        note: '',
                      },
                    )
                  }
                >
                  Edit pay for {m.name}
                </button>
              </article>
            );
          })}
          <button
            onClick={() =>
              exportCsv('pilot-team-pay', [
                ['Member', 'Role', 'Paid from', 'Currency', 'Agreed', 'State', 'Note'],
                ...pay.map((q) => [
                  who(q.memberId),
                  q.role,
                  line(q.from),
                  code,
                  dec(q.agreed),
                  q.state,
                  q.note,
                ]),
              ])
            }
          >
            Download pay CSV
          </button>
          {edit && (
            <form
              key={edit.id}
              className="pilot-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  get = (k: string) => String(f.get(k) ?? '');
                try {
                  const row =
                    edit.type === 'budget_line'
                      ? {
                          ...edit,
                          label: get('label'),
                          category: get('category'),
                          planned: minor(get('planned')),
                          committed: minor(get('committed')),
                          spent: minor(get('spent')),
                          state: get('state'),
                          note: get('note'),
                        }
                      : {
                          ...edit,
                          agreed: minor(get('agreed')),
                          from: get('from'),
                          state: get('state'),
                          note: get('note'),
                        };
                  void save({ row });
                } catch {
                  setErr('Enter a valid amount, with up to two decimal places.');
                }
              }}
            >
              <h4>
                {edit.type === 'budget_line' ? 'Budget line' : 'Pay for ' + who(edit.memberId)}
              </h4>
              {edit.type === 'budget_line' ? (
                <>
                  <label>
                    Label
                    <input name="label" maxLength={80} required defaultValue={edit.label} />
                  </label>
                  <label>
                    Category
                    <select name="category" defaultValue={edit.category}>
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label>
                  Paid from
                  <select name="from" defaultValue={edit.from}>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(edit.type === 'budget_line'
                ? (['planned', 'committed', 'spent'] as const)
                : (['agreed'] as const)
              ).map((k) => (
                <label key={k}>
                  {k} ({code})
                  <input
                    name={k}
                    type="number"
                    step=".01"
                    min="0"
                    max="10000000000"
                    required
                    defaultValue={dec((edit as unknown as Record<string, number>)[k])}
                  />
                </label>
              ))}
              <label>
                State
                <select name="state" defaultValue={edit.state}>
                  {(edit.type === 'budget_line' ? lineStates : payStates).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <textarea name="note" maxLength={200} defaultValue={edit.note} />
              </label>
              <button disabled={busy}>Save {edit.type === 'budget_line' ? 'line' : 'pay'}</button>
              <button type="button" onClick={() => setEdit(undefined)}>
                Cancel
              </button>
              {book.rows.some((r) => r.id === edit.id) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ row: edit, hide: true })}
                >
                  Hide row
                </button>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
}
