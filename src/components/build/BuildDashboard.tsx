import { useEffect, useMemo, useRef, useState } from 'react';
import type { Property } from '../../store/propertyStore';
import { useLinkStore } from '../../store/linkStore';
import { projectFingerprint } from '../../designer/projectHub';
import { packagesFromProperty } from '../../designer/link/packages';
import {
  moneyTotals,
  needsDecision,
  packageStatus,
  packagesCsv,
  checkAnswer,
  type PackageDraft,
  type LinkPackage,
} from '../../designer/link/exchange';
import { readAnswer, type TradeAnswer } from '../../designer/link/planView';
import { downloadFile, opaqueId } from './transfer';
import { StatusChip, Sheet } from './BuildControls';
import { statusLabels } from './statusLabels';
import { PackageInspector } from './PackageInspector';
import '../../designer/link/contract/build-tokens.css';
import './dashboard.css';
import { RolePicker, TradeStation } from './TradeStation';
import { useTradeFlow } from './tradeFlow';
import { packageTrade } from '../../designer/link/tradeWork';

const freshFilters = { project: '', site: '', phase: '', trade: '', status: '' };
const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
export default function BuildDashboard({
  property,
  onBack,
  onClose,
}: {
  property: Property;
  onBack: () => void;
  onClose: () => void;
}) {
  const role = useTradeFlow((s) => s.role);
  useEffect(() => {
    useTradeFlow.getState().scope(property.id);
  }, [property.id]);
  const ledger = useLinkStore(),
    [fingerprint, setFingerprint] = useState(''),
    [hide, setHide] = useState(false);
  const [filter, setFilter] = useState(freshFilters),
    [need, setNeed] = useState(''),
    [sheet, setSheet] = useState(''),
    [selected, setSelected] = useState('');
  const [text, setText] = useState(''),
    [preview, setPreview] = useState<TradeAnswer | null>(null),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [restore, setRestore] = useState(''),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const root = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState(''),
    [preparedBy, setPreparedBy] = useState(''),
    [site, setSite] = useState(''),
    [phase, setPhase] = useState('Phase 1'),
    [currency, setCurrency] = useState('MUR');
  useEffect(() => {
    const d = root.current;
    d?.showModal();
    void useLinkStore.getState().hydrate();
    return () => d?.close();
  }, []);
  useEffect(() => {
    let live = true;
    setFingerprint('');
    projectFingerprint(property)
      .then((f) => {
        if (live) setFingerprint(f);
      })
      .catch(() => {
        if (live) setError('Cannot check this plan revision.');
      });
    return () => {
      live = false;
    };
  }, [property]);
  useEffect(() => {
    const f = () => setOffline(!navigator.onLine);
    window.addEventListener('online', f);
    window.addEventListener('offline', f);
    return () => {
      window.removeEventListener('online', f);
      window.removeEventListener('offline', f);
    };
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete this step.');
    } finally {
      setBusy(false);
    }
  };
  const rows = ledger.packages,
    selectedRow = rows.find((r) => r.draft.id === selected);
  const activeFp = (r: LinkPackage) =>
    r.draft.projectId === property.id ? fingerprint || undefined : undefined;
  const needs = rows.map((r) => needsDecision(r, activeFp(r)));
  const visible = rows
    .filter((r) => {
      const d = r.draft,
        n = needsDecision(r, activeFp(r));
      return (
        (!filter.project || filter.project === d.projectId) &&
        (!filter.site || filter.site === d.siteLabel) &&
        (!filter.phase || filter.phase === d.phase) &&
        (!filter.trade || filter.trade === d.trade) &&
        (!filter.status || filter.status === packageStatus(r, activeFp(r))) &&
        (!need || !!n[need as keyof typeof n])
      );
    })
    .sort((a, b) => {
      const score = (r: LinkPackage) =>
        Number(Object.values(needsDecision(r, activeFp(r))).some(Boolean));
      return (
        score(b) - score(a) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.draft.title.localeCompare(b.draft.title)
      );
    });
  const totals = moneyTotals(visible);
  const measured = useMemo(() => {
    try {
      return { drafts: sheet === 'make' ? packagesFromProperty(property) : [], error: '' };
    } catch (e) {
      return {
        drafts: [],
        error: e instanceof Error ? e.message : 'Cannot measure this property.',
      };
    }
  }, [property, sheet]);
  const prepared = measured.drafts;
  async function make() {
    if (role !== 'owner' && !preparedBy.trim())
      throw new Error('Enter your name to record who prepared these packages.');
    if (!company.trim() || !site.trim() || !phase.trim())
      throw new Error('Enter a company name, site label and phase.');
    const matching = rows.find(
      (r) => r.draft.projectId === property.id && r.draft.siteLabel === site.trim(),
    );
    const siteId = matching?.draft.siteId ?? opaqueId();
    let count = 0;
    for (const source of prepared) {
      if (
        rows.some(
          (r) =>
            r.draft.projectId === property.id &&
            r.draft.siteId === siteId &&
            r.draft.phase === phase.trim() &&
            r.draft.sourceKey === source.key,
        )
      )
        continue;
      const d: PackageDraft = {
        id: opaqueId(),
        projectId: property.id,
        projectLabel: property.name,
        sourceKey: source.key,
        title: source.title,
        scope: source.scope,
        trade: source.trade,
        levelIds: source.levelIds,
        quantities: source.quantities,
        siteId,
        siteLabel: site.trim(),
        siteKind: 'build-site',
        phase: phase.trim(),
        company: company.trim(),
        requester: 'developer',
        currency,
        preferredDates: [],
      };
      await ledger.saveDraft(d, undefined, preparedBy.trim() || undefined);
      count++;
    }
    setSheet('');
    setMessage(
      count
        ? count + ' draft packages are ready to review.'
        : 'These packages already exist for this site and phase.',
    );
  }
  async function inspectAnswer(value: string) {
    setText(value);
    setPreview(null);
    const pack = await readAnswer(value, new Date().toISOString());
    const target = checkAnswer(useLinkStore.getState().packages, pack);
    if (role !== 'owner' && packageTrade(target) !== role)
      throw new Error(
        'This answer belongs to another trade. Open its station or the project owner view.',
      );
    setPreview(pack);
  }
  useEffect(() => {
    const f = () => {
      if (!ledger.hydrated || !location.hash.startsWith('#w=')) return;
      setSheet('answer');
      setPreview(null);
      setText(location.href);
    };
    f();
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, [ledger.hydrated]);
  function dismiss() {
    setSheet('');
    setError('');
    setPreview(null);
    setRestore('');
  }
  const filterFields = (
    <div className="bd-filters">
      {(Object.keys(freshFilters) as (keyof typeof freshFilters)[]).map((key) => {
        const options = new Map(
          rows.map((r) => {
            const d = r.draft;
            const value =
              key === 'project'
                ? d.projectId
                : key === 'site'
                  ? d.siteLabel
                  : key === 'status'
                    ? packageStatus(r, activeFp(r))
                    : d[key];
            return [
              value,
              key === 'project' ? d.projectLabel : key === 'status' ? statusLabels[value] : value,
            ] as const;
          }),
        );
        return (
          <label key={key}>
            {key}
            <select
              value={filter[key]}
              onChange={(e) => setFilter({ ...filter, [key]: e.target.value })}
            >
              <option value="">All</option>
              {[...options].sort().map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <button
        type="button"
        onClick={() => {
          setFilter(freshFilters);
          setNeed('');
        }}
      >
        Reset filters
      </button>
    </div>
  );
  const feedback = (
    <>
      {(error || ledger.loadError) && (
        <p role="alert" className="bd-error">
          {error || ledger.loadError}
        </p>
      )}
      {message && (
        <p role="status" className="bd-notice">
          {message}
        </p>
      )}
    </>
  );
  return (
    <dialog
      open={undefined}
      ref={root}
      className="build-dashboard"
      data-build-surface=""
      aria-labelledby="build-title"
      onCancel={(e) => {
        e.preventDefault();
        onBack();
      }}
    >
      <header className="bd-mast">
        <div>
          <span className="bd-kicker">ONE LIVE BUILD / PROJECT HUB</span>
          <h1 id="build-title">Build dashboard</h1>
          <p>Pilot · this browser only</p>
        </div>
        <RolePicker />
        <div className="bd-actions">
          {role === 'owner' && (
            <button
              onClick={() => {
                const field = document.getElementById('trade-field-record');
                field?.focus();
                field?.scrollIntoView({ block: 'start' });
              }}
            >
              Project timeline
            </button>
          )}
          <button onClick={onBack}>Project hub</button>
          <button onClick={onClose}>Back to plan</button>
        </div>
      </header>
      <main className="bd-body">
        {offline && <p role="status">Offline · local files and decisions still work.</p>}
        {role === 'owner' && (
          <>
            <section className="bd-needs" aria-labelledby="needs-title">
              <div>
                <span className="bd-kicker">DECISION DESK</span>
                <h2 id="needs-title">Needs you</h2>
                <p>Review the next decision for each trade.</p>
              </div>
              <div className="bd-need-actions">
                {(
                  [
                    ['quotes', 'Quotes to decide'],
                    ['invoices', 'Invoices to check'],
                    ['changed', 'Plans changed'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={need === key}
                    onClick={() => {
                      setNeed(need === key ? '' : key);
                      setFilter(freshFilters);
                    }}
                  >
                    <strong>{needs.reduce((s, n) => s + Number(n[key]), 0)}</strong>
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <div className="bd-section-head">
              <h2>Money by currency</h2>
              <button aria-pressed={hide} onClick={() => setHide(!hide)}>
                {hide ? 'Show amounts' : 'Hide amounts'}
              </button>
            </div>
            {totals.length === 0 ? (
              <p>No amounts recorded for these packages.</p>
            ) : (
              totals.map((t) => (
                <section className="bd-money" key={t.currency} aria-label={t.currency + ' totals'}>
                  <b>{t.currency}</b>
                  {(['quoted', 'approved', 'invoiced', 'paid', 'planned'] as const)
                    .filter((k) => k !== 'planned' || t.planned !== undefined)
                    .map((k) => (
                      <div key={k}>
                        <span>{k}</span>
                        <strong className="build-num">
                          {hide ? 'Hidden' : fmt(t[k]!, t.currency)}
                        </strong>
                      </div>
                    ))}
                </section>
              ))
            )}
            <div className="bd-section-head">
              <div>
                <span className="bd-kicker">WORK REGISTER</span>
                <h2>Packages</h2>
              </div>
              <div className="bd-actions">
                <button
                  disabled={!ledger.hydrated || !!ledger.loadError}
                  onClick={() => {
                    setError('');
                    setSheet('make');
                  }}
                >
                  Make packages
                </button>
                <button
                  disabled={!ledger.hydrated}
                  onClick={() => {
                    setText('');
                    setPreview(null);
                    setError('');
                    setSheet('answer');
                  }}
                >
                  Add an answer
                </button>
                <button onClick={() => setSheet('files')}>Files</button>
              </div>
            </div>
            <div className="bd-desktop-filters">{filterFields}</div>
            <button className="bd-mobile-filter" onClick={() => setSheet('filters')}>
              Filters
            </button>
            {need && <button onClick={() => setNeed('')}>Clear decision filter ×</button>}
            {!sheet && !selectedRow && feedback}
            {!ledger.hydrated ? (
              <p role="status">Opening local packages…</p>
            ) : visible.length === 0 ? (
              <div className="bd-empty">
                <h3>{rows.length ? 'No matching packages' : 'No work packages yet'}</h3>
                <p>
                  {rows.length
                    ? 'Reset the filters to see more work.'
                    : 'Choose Make packages to review estimates from this plan.'}
                </p>
              </div>
            ) : (
              <div className="bd-register">
                {visible.map((row) => (
                  <button
                    className="bd-row"
                    key={row.draft.id}
                    onClick={() => {
                      setSelected(row.draft.id);
                      setError('');
                      setMessage('');
                    }}
                  >
                    <StatusChip status={packageStatus(row, activeFp(row))} />
                    <span>
                      <strong>{row.draft.title}</strong>
                      <small>
                        {row.draft.projectLabel} · {row.draft.siteLabel} · {row.draft.phase}
                      </small>
                    </span>
                    <span>
                      {row.draft.trade}
                      <small>{row.draft.preferredDates.join(' – ') || 'Dates open'}</small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {role !== 'owner' && !sheet && !selectedRow && feedback}
        <TradeStation
          key={role}
          property={property}
          rows={rows}
          onModel={onClose}
          onPackage={setSelected}
          onMake={() => {
            setError('');
            setSheet('make');
          }}
          onAnswer={() => {
            setError('');
            setText('');
            setPreview(null);
            setSheet('answer');
          }}
        />
      </main>
      {sheet === 'filters' && (
        <Sheet title="Filter packages" onClose={dismiss}>
          {filterFields}
          <button onClick={dismiss}>Show packages</button>
        </Sheet>
      )}
      {sheet === 'make' && (
        <Sheet title="Make packages from this plan" onClose={dismiss}>
          <p>
            {prepared.length} trade packages have measured work. Review and edit each draft before
            sharing.
          </p>
          {measured.error && <p role="alert">{measured.error}</p>}
          <div className="bd-fields">
            {role !== 'owner' && (
              <label>
                Prepared by
                <input
                  maxLength={120}
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                />
              </label>
            )}
            <label>
              Company name
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
            <label>
              Site or plot label
              <input value={site} placeholder="Plot 12" onChange={(e) => setSite(e.target.value)} />
            </label>
            <div className="bd-pair">
              <label>
                Phase
                <input value={phase} onChange={(e) => setPhase(e.target.value)} />
              </label>
              <label>
                Currency
                <input
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </label>
            </div>
          </div>
          {feedback}
          <button
            className="bd-primary"
            disabled={busy || !prepared.length}
            onClick={() => void run(make)}
          >
            Create draft packages
          </button>
        </Sheet>
      )}
      {sheet === 'answer' && (
        <Sheet title="Add an answer" onClose={dismiss}>
          <p>
            Choose a Trade Folder file or paste its link. Review the sender and contents before
            saving.
          </p>
          <label>
            Answer file
            <input
              aria-label="Answer file"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  void run(async () => {
                    setPreview(null);
                    if (f.size > 96000) throw new Error('This answer is too large.');
                    await inspectAnswer(await f.text());
                  });
              }}
            />
          </label>
          {!preview && (
            <label>
              Answer link or JSON
              {hide ? (
                <input
                  type="password"
                  autoComplete="off"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              ) : (
                <textarea value={text} onChange={(e) => setText(e.target.value)} />
              )}
            </label>
          )}
          {!preview && (
            <button
              disabled={busy || !text.trim()}
              onClick={() => void run(() => inspectAnswer(text))}
            >
              Review answer
            </button>
          )}
          {preview && (
            <div className="bd-answer">
              <h3>
                {preview.kind} from {preview.from.label}
              </h3>
              <p>
                For{' '}
                {
                  rows.find((r) => r.sends.some((s) => s.request.id === preview.requestId))?.draft
                    .title
                }
              </p>
              {hide ? (
                <>
                  <p>Amounts hidden. Show the full contents to review this answer.</p>
                  <button onClick={() => setHide(false)}>Show amounts</button>
                </>
              ) : (
                <pre>{JSON.stringify(preview, null, 2)}</pre>
              )}
              <button
                className="bd-primary"
                disabled={busy || hide}
                onClick={() =>
                  void run(async () => {
                    await ledger.addAnswer(preview);
                    dismiss();
                    setMessage('Answer recorded. No decision has been made.');
                  })
                }
              >
                Save answer
              </button>
            </div>
          )}
          {feedback}
        </Sheet>
      )}
      {sheet === 'files' && (
        <Sheet title="Dashboard files" onClose={dismiss}>
          <p>
            A backup includes amounts, internal notes and the history. Keep it private. Restoring
            replaces this browser’s dashboard.
          </p>
          <button
            disabled={!ledger.hydrated || !!ledger.loadError}
            onClick={() =>
              void run(async () => downloadFile('build-dashboard.backup.json', ledger.backup()))
            }
          >
            Export backup
          </button>
          <button
            onClick={() =>
              downloadFile(
                'build-packages.csv',
                packagesCsv(visible, hide),
                'text/csv;charset=utf-8',
              )
            }
          >
            Download package CSV
          </button>
          <input
            type="file"
            ref={input}
            accept=".json"
            aria-label="Backup file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setRestore('');
              if (f)
                void run(async () => {
                  if (f.size > 4000000) throw new Error('This backup is too large.');
                  setRestore(await f.text());
                });
            }}
          />
          <button
            disabled={!restore || busy}
            onClick={() =>
              void run(async () => {
                await ledger.restoreBackup(restore);
                dismiss();
                setMessage('Dashboard restored.');
              })
            }
          >
            Replace from backup
          </button>
          {feedback}
        </Sheet>
      )}
      {selectedRow && (
        <PackageInspector
          key={selectedRow.draft.id}
          row={selectedRow}
          property={property}
          fingerprint={activeFp(selectedRow)}
          hide={hide}
          onClose={() => setSelected('')}
        />
      )}
    </dialog>
  );
}
