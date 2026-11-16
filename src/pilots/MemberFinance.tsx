import { useEffect, useState } from 'react';
import { request } from './remote';
import { type Evidence, fileCap } from './evidence';
import { minorDigits, major } from './ledger';
import { uid, today } from './contract';
type OwnRow = {
  type: 'invoice' | 'cost_row' | 'transfer' | 'pay_row';
  id?: string;
  number?: string;
  date?: string;
  currency?: keyof typeof minorDigits;
  amount?: number;
  tax?: number;
  file?: string;
  delivery?: string;
  integrity?: string;
  credits?: string;
  state?: string;
  refusal?: string;
  editable?: boolean;historyRef?:string;
  description?: string;
  missing?: string[];
};
export type PersonalLedger = {
  marks?: { invoices: boolean; staff: boolean; partner: boolean };
  items?: OwnRow[];
  due?: { id: string; label: string }[];
  partnerBalance?: number;
  currency?: keyof typeof minorDigits;
};
function toMinor(s: string, digits: number) {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m || (m[3] ?? '').length > digits) throw Error('Check the amount for this currency.');
  return Number(BigInt(m[1] + m[2] + (m[3] ?? '').padEnd(digits, '0')));
}
export function MemberFinance({ slug, finance }: { slug: string; finance: PersonalLedger }) {
  const [record, set] = useState<PersonalLedger & { revision: number; memberId: string }>(),
    [files, setFiles] = useState<Evidence[]>([]),
    [queued, setQueued] = useState<Evidence[]>([]),
    [enabled, setEnabled] = useState(false),
    [tick, bump] = useState(0),
    [edit, setEdit] = useState<OwnRow>(),
    [msg, setMsg] = useState('');
  const url = '/' + slug;
  useEffect(() => {
    let live = true;
    request<NonNullable<typeof record>>(url + '/my-finance')
      .then((r) => {
        if (live) set(r);
      })
      .catch(() => {
        if (live) set(undefined);
      });
    request<{ enabled: boolean; files: Evidence[] }>(url + '/files')
      .then((f) => {
        if (live) {
          setEnabled(f.enabled);
          setFiles(f.files.filter((x) => x.money));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url, tick, finance]);
  const rows = record?.items ?? finance.items ?? [],
    marks = record?.marks ?? finance.marks;
  const [history,setHistory]=useState<{ref:string;entries:{at:string;after:{state?:string;amount?:number;number?:string;description?:string}}[]}>();
  const refresh = () => bump((v) => v + 1);
  return (
    <section>
      <h2>{marks?.partner ? 'Our costs' : marks?.invoices ? 'My invoices' : 'My money records'}</h2>
      {finance.due?.map((d) => (
        <p key={d.id}>{d.label}</p>
      ))}
      {finance.partnerBalance !== undefined && finance.currency && (
        <p>
          Transfers less accepted costs ·{' '}
          {major(finance.partnerBalance, minorDigits[finance.currency])} {finance.currency}
        </p>
      )}
      {rows
        .filter((r) => r.type !== 'pay_row')
        .map((r, i) => (
          <article key={r.id ?? i}>
            <h3>{r.number ?? r.description ?? r.type}</h3>
            <p>
              {r.state} ·{' '}
              {r.currency && r.amount !== undefined
                ? major(r.amount, minorDigits[r.currency]) + ' ' + r.currency
                : ''}
            </p>
            {r.missing?.length ? <p>Missing {r.missing.join(', ')}</p> : null}
            {r.refusal && <p>{r.refusal}</p>}
            {r.historyRef&&<button onClick={()=>void request<{entries:NonNullable<typeof history>['entries']}>(url+'/history/'+r.historyRef).then(d=>setHistory({ref:r.historyRef!,entries:d.entries})).catch(e=>setMsg(e.message))}>View history</button>}
            {r.historyRef&&history?.ref===r.historyRef&&history.entries.map((entry,i)=><p key={i}>{entry.at} · {entry.after.number??entry.after.description} · {entry.after.state}</p>)}
            {r.editable && <button onClick={() => setEdit(r)}>Correct invoice</button>}
          </article>
        ))}
      {marks?.invoices && record && (
        <>
          <button
            onClick={() =>
              setEdit({ id: uid(), type: 'invoice', state: 'received', date: today() })
            }
          >
            Add an invoice
          </button>
          {enabled && (
            <form
              className="pilot-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  file = f.get('file');
                if (!(file instanceof File) || file.size > fileCap) {
                  setMsg('Choose a file of 1 MB or less.');
                  return;
                }
                try {
                  const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                  const result = await request<{ file: Evidence }>(url + '/files', 'POST', {
                    revision: record.revision,
                    file: { source: 'money', kind: f.get('kind'), title: f.get('title') },
                    data,
                  });
                  setQueued((v) => [...v, result.file]);
                  setMsg('Proof ready for your invoice.');
                  refresh();
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Could not save.');
                }
              }}
            >
              <label>
                Proof title
                <input name="title" required />
              </label>
              <label>
                Kind
                <select name="kind">
                  <option>invoice</option>
                  <option>delivery note</option>
                  <option>buying paper</option>
                  <option>report</option>
                </select>
              </label>
              <label>
                Proof file
                <input
                  type="file"
                  name="file"
                  required
                  accept="application/pdf,image/jpeg,image/png"
                />
              </label>
              <button>Upload invoice proof</button>
            </form>
          )}
          {edit && (
            <form
              className="pilot-form"
              key={edit.id}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  c = String(f.get('currency')) as keyof typeof minorDigits;
                try {
                  const row = {
                    id: edit.id,
                    version: 2,
                    type: 'invoice',
                    sender: record.memberId,
                    number: String(f.get('number')),
                    date: f.get('date'),
                    currency: c,
                    amount: toMinor(String(f.get('amount')), minorDigits[c]),
                    tax: toMinor(String(f.get('tax')), minorDigits[c]),
                    credits: f.get('credits') || undefined,
                    file: f.get('file') || undefined,
                    delivery: f.get('delivery') || undefined,
                    integrity: f.get('integrity') || undefined,
                    state: f.get('state'),
                  };
                  await request(url + '/my-finance', 'POST', { revision: record.revision, row });
                  setEdit(undefined);
                  setMsg('Saved.');
                  refresh();
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Could not save.');
                }
              }}
            >
              <label>
                Invoice number
                <input name="number" required defaultValue={edit.number} />
              </label>
              <label>
                Date
                <input type="date" name="date" required defaultValue={edit.date} />
              </label>
              <label>
                Currency
                <select name="currency" defaultValue={edit.currency}>
                  {Object.keys(minorDigits).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {(['amount', 'tax'] as const).map((k) => (
                <label key={k}>
                  {k === 'amount' ? 'Amount without tax' : 'Tax'}
                  <input
                    name={k}
                    required
                    type="number"
                    step="any"
                    defaultValue={
                      edit[k] !== undefined && edit.currency
                        ? major(edit[k]!, minorDigits[edit.currency])
                        : k === 'tax'
                          ? 0
                          : undefined
                    }
                  />
                </label>
              ))}
              <label>
                Credit against
                <select name="credits" defaultValue={edit.credits}>
                  <option value="">Ordinary invoice</option>
                  {rows
                    .filter((r) => r.type === 'invoice' && !r.credits && r.id !== edit.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number}
                      </option>
                    ))}
                </select>
              </label>
              {(['file', 'delivery', 'integrity'] as const).map((k) => (
                <label key={k}>
                  {k === 'file'
                    ? 'Invoice file'
                    : k === 'delivery'
                      ? 'Delivery note or report'
                      : 'Integrity statement'}
                  <select name={k} defaultValue={edit[k]}>
                    <option value="">Missing</option>
                    {[...new Map([...files, ...queued].map((f) => [f.id, f])).values()].map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                State
                <select name="state" defaultValue={edit.state}>
                  <option>received</option>
                  {rows.some((r) => r.id === edit.id) && <option>withdrawn</option>}
                </select>
              </label>
              <button>Save invoice</button>
              <button type="button" onClick={() => setEdit(undefined)}>
                Cancel
              </button>
            </form>
          )}
        </>
      )}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
