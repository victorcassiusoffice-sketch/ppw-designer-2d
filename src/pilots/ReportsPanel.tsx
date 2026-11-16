import { useEffect, useState, type FormEvent } from 'react';
import { uid, today, type Pilot } from './contract';
import { request } from './remote';
import { type Evidence, fileCap } from './evidence';
import {
  eventSchema,
  indicatorValue,
  type ReportsView,
  type ReportPack,
  type Indicator,
} from './reports';
import { type BookCurrency, ledgerCsv } from './ledger';
import type { funderSet } from './funder';
import { recordPdf, moneyPdf, exportArchive, saveDownload } from './reportFiles';

export default function ReportsPanel({
  p,
  role,
  owner,
  canWrite,
}: {
  p: Pilot;
  role: string;
  owner: boolean;
  canWrite: boolean;
}) {
  const base = '/' + p.slug,
    [view, show] = useState<ReportsView>(),
    [files, store] = useState<Evidence[]>([]),
    [enabled, storage] = useState(false),
    [err, say] = useState(''),
    [busy, wait] = useState(false),
    [tick, reload] = useState(0),
    [edit, editing] = useState<ReportPack>(),
    [chosen, choose] = useState(''),
    [kind, source] = useState('attendance'),
    [includeHidden, hidden] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([
      request<ReportsView>(base + '/reports'),
      request<{ enabled: boolean; files: Evidence[] }>(base + '/files'),
    ])
      .then(([v, f]) => {
        if (live) {
          show(v);
          store(f.files.filter((x) => !x.money));
          storage(f.enabled);
        }
      })
      .catch((e) => {
        if (live) say(e.message);
      });
    return () => {
      live = false;
    };
  }, [base, tick]);
  async function run(fn: () => Promise<void>) {
    say('');
    wait(true);
    try {
      await fn();
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not complete the request.');
    } finally {
      wait(false);
    }
  }
  if (!view) return <p role="status">{err || 'Opening reports…'}</p>;
  const v = view,
    period = v.periods.find((x) => x.id === chosen),
    now = today(),
    lead = !owner && role === 'lead';
  async function save(
    kind: string,
    payload: unknown,
    hide = false,
    extra?: { revision?: number; moneyFile?: string },
  ) {
    await request(base + '/reports', 'POST', {
      revision: v.revision,
      kind,
      payload,
      hide,
      ...extra,
    });
    reload((n) => n + 1);
  }
  const handle = (e: FormEvent<HTMLFormElement>, fn: (f: FormData) => Promise<void>) => {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    void run(async () => {
      await fn(f);
      form.reset();
    });
  };
  const val = (f: FormData, k: string) => String(f.get(k) ?? '');
  const sections = [
    'indicators',
    'steps',
    'readings',
    'logs',
    'events',
    'photos',
    'papers',
  ] as const;
  async function privatePdf(pack: ReportPack) {
    const d = await request<{ currency: BookCurrency; set: ReturnType<typeof funderSet> }>(
      base + '/report-money/' + pack.id,
    );
    if (!d.set) throw Error('Set the pilot currency first.');
    return moneyPdf(p, pack, d.currency, d.set);
  }
  async function upload(blob: Blob, money: boolean, revision: number, title: string) {
    if (blob.size > fileCap)
      throw Error('The report PDF is above the store limit. Reduce the selected photos.');
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const doc = await request<{ file: Evidence }>(base + '/files', 'POST', {
      revision,
      file: { kind: 'report', source: money ? 'money' : 'report pack', title },
      data: content,
    });
    return doc.file.id;
  }
  return (
    <section aria-busy={busy}>
      <h2>Reports</h2>
      {err && <p role="status">{err}</p>}
      <label>
        Report period{' '}
        <select value={chosen} onChange={(e) => choose(e.target.value)}>
          <option value="">To date</option>
          {v.periods.map((r) => (
            <option key={r.id} value={r.id}>
              Period {r.number} · {r.start} – {r.end}
            </option>
          ))}
        </select>
      </label>
      <h3>Indicators</h3>
      {v.indicators.map((i) => {
        const r = indicatorValue(i, p, v.events, period?.start ?? '0001-01-01', period?.end ?? now);
        return (
          <article key={i.id}>
            <h4>{i.name}</h4>
            <p>
              {r.value ?? '—'} {i.unit} · Baseline {i.baseline} · Target {i.target}
            </p>
            {'women' in r && (
              <p>
                {r.women} women · {r.men} men · {r.notStated} not stated
              </p>
            )}
            {canWrite && (
              <button disabled={busy} onClick={() => void run(() => save('indicator', i, true))}>
                Hide indicator
              </button>
            )}
          </article>
        );
      })}
      {canWrite && (
        <details>
          <summary>Add indicator</summary>
          <form
            className="pilot-form"
            onSubmit={(e) =>
              handle(e, async (f) => {
                const s: Indicator['source'] =
                  kind === 'attendance' || kind === 'events'
                    ? {
                        kind,
                        event:
                          (val(f, 'event') as typeof eventSchema.shape.kind._type) || undefined,
                      }
                    : kind === 'log'
                      ? { kind: 'log', stream: val(f, 'stream') }
                      : kind === 'reading'
                        ? {
                            kind: 'reading',
                            type: val(f, 'reading').split('|')[0],
                            field: val(f, 'reading').split('|')[1],
                            mode: val(f, 'mode') as 'latest' | 'sum',
                          }
                        : {
                            kind: 'typed',
                            value: Number(f.get('value')),
                            date: val(f, 'date'),
                            file: val(f, 'file'),
                          };
                await save('indicator', {
                  id: uid(),
                  name: val(f, 'name'),
                  unit: val(f, 'unit'),
                  baseline: Number(f.get('baseline')),
                  target: Number(f.get('target')),
                  source: s,
                });
              })
            }
          >
            {['name', 'unit', 'baseline', 'target'].map((k) => (
              <label key={k}>
                {k}
                <input
                  name={k}
                  required
                  type={['baseline', 'target'].includes(k) ? 'number' : 'text'}
                  step="any"
                />
              </label>
            ))}
            <label>
              Source
              <select value={kind} onChange={(e) => source(e.target.value)}>
                {['attendance', 'events', 'reading', 'log', 'typed'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            {['attendance', 'events'].includes(kind) && (
              <label>
                Event type
                <select name="event">
                  <option value="">All events</option>
                  {eventSchema.shape.kind.options.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
            )}
            {kind === 'log' && (
              <label>
                Stream
                <select name="stream" required>
                  {[...new Set(p.logs.map((l) => l.type))].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            )}
            {kind === 'reading' && (
              <>
                <label>
                  Reading field
                  <select required name="reading">
                    {p.readingTypes?.flatMap((t) =>
                      t.fields
                        .filter((f) => f.kind === 'number')
                        .map((f) => (
                          <option key={t.id + f.id} value={t.id + '|' + f.id}>
                            {t.name} · {f.name}
                          </option>
                        )),
                    )}
                  </select>
                </label>
                <label>
                  Calculation
                  <select name="mode">
                    <option>latest</option>
                    <option>sum</option>
                  </select>
                </label>
              </>
            )}
            {kind === 'typed' && (
              <>
                <label>
                  Value
                  <input required type="number" step="any" name="value" />
                </label>
                <label>
                  As of
                  <input required type="date" name="date" defaultValue={now} />
                </label>
                <label>
                  Proof
                  <select required name="file">
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <button disabled={busy}>Save indicator</button>
          </form>
        </details>
      )}
      <details>
        <summary>Events and attendance · {v.events.length}</summary>
        {v.events.map((e) => (
          <article key={e.id}>
            <h4>{e.title}</h4>
            <p>
              {e.date} · {e.kind} · {e.women + e.men + e.notStated} attended
            </p>
            {canWrite && (
              <button disabled={busy} onClick={() => void run(() => save('event', e, true))}>
                Hide event
              </button>
            )}
          </article>
        ))}
        {canWrite && (
          <form
            className="pilot-form"
            onSubmit={(e) =>
              handle(e, async (f) =>
                save('event', {
                  id: uid(),
                  title: val(f, 'title'),
                  date: val(f, 'date'),
                  site: val(f, 'site'),
                  kind: val(f, 'kind'),
                  women: Number(f.get('women')),
                  men: Number(f.get('men')),
                  notStated: Number(f.get('notStated')),
                  note: val(f, 'note'),
                  files: f.getAll('files'),
                }),
              )
            }
          >
            <h4>Add event</h4>
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Date
              <input required type="date" name="date" defaultValue={now} />
            </label>
            <label>
              Kind
              <select name="kind">
                {eventSchema.shape.kind.options.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Site
              <select required name="site">
                {p.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {[
              ['women', 'Women'],
              ['men', 'Men'],
              ['notStated', 'Not stated'],
            ].map(([k, n]) => (
              <label key={k}>
                {n}
                <input type="number" name={k} min="0" defaultValue="0" required />
              </label>
            ))}
            <label>
              Note
              <textarea name="note" />
            </label>
            <label>
              Files
              <select multiple name="files">
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Save event</button>
          </form>
        )}
      </details>
      <h3>Report packs</h3>
      {v.packs.map((pack) => (
        <article key={pack.id}>
          <h4>
            {pack.kind === 'final' ? 'Final' : 'Interim'} report · Period{' '}
            {v.periods.find((p) => p.id === pack.period)?.number}
          </h4>
          <p>
            {pack.state} · Due {pack.due}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (pack.state === 'sent' && pack.file) {
                  const r = await fetch('/api/pilots' + base + '/files/' + pack.file, {
                    cache: 'no-store',
                  });
                  if (!r.ok) throw Error('Filed report unavailable.');
                  saveDownload('filed-report.pdf', await r.blob());
                } else saveDownload('pilot-report.pdf', await recordPdf(p, v, pack));
              })
            }
          >
            Download A4 report
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                saveDownload('private-money.pdf', await privatePdf(pack));
              })
            }
          >
            Download money pages
          </button>
          {canWrite && pack.state === 'draft' && (
            <>
              <button onClick={() => editing(pack)}>Edit draft</button>
              <button disabled={busy} onClick={() => void run(() => save('report', pack, true))}>
                Hide draft
              </button>
            </>
          )}
          {lead && pack.state === 'draft' && (
            <button
              disabled={busy}
              onClick={() => void run(() => save('report', { ...pack, state: 'approved' }))}
            >
              Record lead approval
            </button>
          )}
          {lead &&
            pack.state === 'approved' &&
            (enabled ? (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const report = await recordPdf(p, v, pack),
                      money = await privatePdf(pack);
                    const file = await upload(
                        report,
                        false,
                        v.revision,
                        'Filed ' + pack.kind + ' report',
                      ),
                      next = await request<ReportsView>(base + '/reports'),
                      moneyFile = await upload(money, true, next.revision, 'Filed money pages'),
                      latest = await request<ReportsView>(base + '/reports');
                    await save('report', { ...pack, state: 'sent', file }, false, {
                      revision: latest.revision,
                      moneyFile,
                    });
                  })
                }
              >
                Record as sent outside the app
              </button>
            ) : (
              <p>File storage must be available to keep the two sent PDFs.</p>
            ))}
        </article>
      ))}
      {canWrite && v.periods.length > 0 && (
        <button
          onClick={() => {
            const r = period ?? v.periods[0];
            editing({
              id: uid(),
              kind: r.final ? 'final' : 'interim',
              period: r.id,
              due: now,
              state: 'draft',
              photos: [],
              text: {},
            });
          }}
        >
          New report pack
        </button>
      )}
      {edit && (
        <form
          key={edit.id}
          className="pilot-form"
          onSubmit={(e) =>
            handle(e, async (f) => {
              const r = v.periods.find((t) => t.id === f.get('period'))!;
              await save('report', {
                ...edit,
                kind: r.final ? 'final' : 'interim',
                period: r.id,
                due: f.get('due'),
                text: Object.fromEntries(sections.map((s) => [s, val(f, s)])),
                photos: f.getAll('photos'),
              });
              editing(undefined);
            })
          }
        >
          <label>
            Period
            <select name="period" defaultValue={edit.period}>
              {v.periods.map((r) => (
                <option key={r.id} value={r.id}>
                  Period {r.number}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input name="due" type="date" required defaultValue={edit.due} />
          </label>
          {sections.map((s) => (
            <label key={s}>
              {s} notes
              <textarea name={s} defaultValue={edit.text[s]} />
            </label>
          ))}
          <label>
            Photos
            <select multiple name="photos" defaultValue={edit.photos}>
              {p.photos
                .filter((ph) => !ph.hidden)
                .map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.caption || ph.date}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy}>Save draft</button>
          <button type="button" onClick={() => editing(undefined)}>
            Cancel
          </button>
        </form>
      )}
      <details>
        <summary>Monthly log CSV</summary>
        {[...new Set(p.logs.map((l) => l.date.slice(0, 7) + ' · ' + l.type))].map((key) => (
          <button
            key={key}
            onClick={() => {
              const rows = p.logs.filter((r) => r.date.slice(0, 7) + ' · ' + r.type === key);
              saveDownload(
                key + '.csv',
                new Blob(
                  [
                    ledgerCsv([
                      ['date', 'stream', 'quantity', 'unit', 'destination'],
                      ...rows.map((r) => [
                        r.date,
                        r.type,
                        String(r.quantity),
                        r.unit,
                        r.destination,
                      ]),
                    ]),
                  ],
                  { type: 'text/csv' },
                ),
              );
            }}
          >
            Download {key}
          </button>
        ))}
      </details>
      <details>
        <summary>Full pilot export</summary>
        <label>
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(e) => hidden(e.target.checked)}
          />
          Include hidden items
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await exportArchive(p.slug, includeHidden, say);
              say('Archive downloaded.');
            })
          }
        >
          Download archive
        </button>
      </details>
    </section>
  );
}
