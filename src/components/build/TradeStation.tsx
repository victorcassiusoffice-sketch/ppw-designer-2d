import { useMemo, useState } from 'react';
import type { Property } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useLinkStore } from '../../store/linkStore';
import {
  JOB_STATUSES,
  TRADE_ROLES,
  projectTimeline,
  workItems,
  type JobStatus,
  type TradeRole,
} from '../../designer/link/tradeWork';
import type { LinkPackage } from '../../designer/link/exchange';
import { useTradeFlow, type JobForm } from './tradeFlow';
import { jobPhoto } from './jobPhoto';
import { Sheet } from './BuildControls';
import { statusLabels } from './statusLabels';
import './tradeStation.css';

const human = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const who = (id: TradeRole | 'owner') =>
  id === 'owner' ? 'Project owner' : (TRADE_ROLES.find((r) => r.id === id)?.label ?? human(id));
const when = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const problem = (e: unknown) =>
  e instanceof Error ? e.message : 'This change could not be saved.';
type Items = ReturnType<typeof workItems>;
type Timeline = ReturnType<typeof projectTimeline>;

export function RolePicker() {
  const role = useTradeFlow((s) => s.role),
    set = useTradeFlow((s) => s.setRole);
  return (
    <label className="ts-role">
      I am a …
      <select
        data-testid="trade-role"
        value={role}
        onChange={(e) => set(e.target.value as TradeRole | 'owner')}
      >
        <option value="owner">Project owner</option>
        {TRADE_ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function TimelineList({
  entries,
  heading = 'Project timeline',
}: {
  entries: Timeline;
  heading?: string;
}) {
  const [limit, setLimit] = useState(12);
  return (
    <section className="ts-history" aria-label={heading}>
      <h3>{heading}</h3>
      {!entries.length ? (
        <p>No changes recorded yet.</p>
      ) : (
        <ol data-testid="trade-timeline">
          {entries.slice(0, limit).map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.title}</strong>
                <span>{e.label}</span>
              </div>
              <small>
                {e.actor}
                {e.source === 'trade-folder' ? ' · Trade Folder' : ''} · {who(e.trade)} ·{' '}
                <time dateTime={e.at}>{when(e.at)}</time>
              </small>
            </li>
          ))}
        </ol>
      )}
      {entries.length > limit && (
        <button onClick={() => setLimit((n) => n + 24)}>Show older changes</button>
      )}
    </section>
  );
}
type Props = {
  property: Property;
  rows: LinkPackage[];
  onModel: () => void;
  onPackage: (id: string) => void;
  onMake: () => void;
  onAnswer: () => void;
};
export function TradeStation({ property, rows, onModel, onPackage, onMake, onAnswer }: Props) {
  const flow = useTradeFlow(),
    role = flow.role;
  const [detail, setDetail] = useState(''),
    [actor, setActor] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState('all');
  const items = useMemo(() => workItems(property, rows), [property, rows]);
  const allTimeline = useMemo(() => projectTimeline(property.id, rows), [property.id, rows]);
  const own = items.filter((i) => role === 'owner' || i.trade === role),
    visible = own.filter((i) => filter === 'all' || i.kind === filter);
  const item = own.find((i) => i.id === detail),
    row = item && rows.find((r) => r.draft.id === item.packageId);
  const openModel = (view: 'plan' | '3d', pick?: JobForm) => {
    if (pick) flow.beginPick(property.id, pick);
    else flow.beginMap(property.id);
    onModel();
    useDesignerUIStore.getState().setViewMode(view);
  };
  const modelButtons = (
    <div className="bd-actions">
      <button onClick={() => openModel('plan')}>Progress on plan</button>
      <button onClick={() => openModel('3d')}>Progress in 3D</button>
    </div>
  );
  function newJob(parentId?: string) {
    if (role === 'owner') return;
    setDetail('');
    setError('');
    flow.setForm({
      id: crypto.randomUUID(),
      role,
      projectId: property.id,
      existing: false,
      parentId,
      title: '',
      note: '',
      status: 'planned',
      by: actor,
      startDate: '',
      dueDate: '',
      pin: null,
      photo: null,
    });
  }
  function edit(r: LinkPackage, status: JobStatus) {
    if (!r.job) return;
    setDetail('');
    setError('');
    flow.setForm({
      id: r.draft.id,
      role: r.job.role,
      projectId: property.id,
      existing: true,
      parentId: r.job.parentId,
      title: r.draft.title,
      note: r.draft.scope,
      status,
      by: actor,
      startDate: r.job.startDate ?? '',
      dueDate: r.job.dueDate ?? '',
      pin: r.job.pin,
      photo: r.job.photo ?? null,
    });
  }
  const [notice, setNotice] = useState('');
  if (role === 'owner')
    return (
      <section className="ts-owner" id="trade-field-record" tabIndex={-1}>
        <div className="bd-section-head">
          <div>
            <span className="bd-kicker">FIELD RECORD</span>
            <h2>Work on this build</h2>
          </div>
          {modelButtons}
        </div>
        <p>
          Explore the recorded work on the plan or house. Pick a trade above to take a package or
          add a job.
        </p>
        <TimelineList entries={allTimeline} />
      </section>
    );
  return (
    <section className="ts-station">
      <header className="ts-banner">
        <div>
          <span className="bd-kicker">TRADE STATION · THIS BUILD</span>
          <h2>{who(role)}</h2>
          <p>
            {property.name} · {own.filter((i) => i.kind === 'job').length} jobs ·{' '}
            {own.filter((i) => i.kind === 'package').length} packages
          </p>
        </div>
        <button onClick={() => newJob()}>Add a job</button>
      </header>
      <div className="bd-section-head">
        <div>
          <span className="bd-kicker">MODEL PROGRESS</span>
          <p>Tap a coloured part to see its work and history.</p>
        </div>
        {modelButtons}
      </div>
      <div className="bd-section-head">
        <h2>My work</h2>
        <div className="bd-actions">
          <button onClick={onMake}>Make packages</button>
          <button onClick={onAnswer}>Add an answer</button>
        </div>
      </div>
      <div className="ts-tabs" aria-label="Work type">
        {[
          ['all', 'All work'],
          ['job', 'Jobs'],
          ['package', 'Packages'],
        ].map(([k, t]) => (
          <button key={k} aria-pressed={k === filter} onClick={() => setFilter(k)}>
            {t}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="bd-notice">
          {notice}
        </p>
      )}
      {visible.length ? (
        <div className="ts-list">
          {visible.map((i) => (
            <button
              key={i.id}
              data-testid="trade-work-row"
              className="ts-row"
              onClick={() => {
                setError('');
                setDetail(i.id);
              }}
            >
              <span className="ts-mark" data-progress={i.status} aria-hidden="true" />
              <span>
                <strong>{i.title}</strong>
                <small>
                  {i.kind === 'job' ? 'Pinned job' : 'Work package'} · {when(i.updatedAt)}
                </small>
              </span>
              <span className="ts-status">
                {human(i.status)}
                {i.exchange !== 'draft' && <small>{statusLabels[i.exchange]}</small>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="bd-empty">
          <h3>
            No {filter === 'all' ? 'work' : filter === 'job' ? 'jobs' : 'packages'} for this trade
            yet
          </h3>
          <p>Add a job at a spot in the build, or make packages from the current plan.</p>
        </div>
      )}
      <TimelineList
        entries={allTimeline.filter((e) => e.trade === role)}
        heading="Trade timeline"
      />
      {item && row && !flow.form && (
        <Sheet title={item.title} onClose={() => setDetail('')} wide>
          <p className="bd-meta">
            {who(item.trade)} · {property.name} · {human(item.status)}
          </p>
          <p>{row.draft.scope || 'No note recorded.'}</p>
          {row.job && (
            <>
              <p>
                {row.job.pin.planRef} · {row.job.pin.levelId}
              </p>
              <p>
                {row.job.startDate ? 'Start: ' + row.job.startDate : ''}{' '}
                {row.job.dueDate ? 'Due: ' + row.job.dueDate : ''}
              </p>
              {row.job.photo && (
                <img
                  className="ts-photo"
                  src={row.job.photo.ref}
                  alt={'Job photo: ' + item.title}
                />
              )}
            </>
          )}
          {row.claim && (
            <p>
              Taken by {row.claim.name} · {when(row.claim.at)}
            </p>
          )}
          {item.kind === 'package' && !row.claim && (
            <>
              <label>
                Recorded by
                <input value={actor} maxLength={120} onChange={(e) => setActor(e.target.value)} />
              </label>
              <button
                disabled={!actor.trim() || busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await useLinkStore.getState().takePackage(row.draft.id, role, actor.trim());
                    setNotice('Package taken by ' + actor.trim() + '.');
                  } catch (e) {
                    setError(problem(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Take package
              </button>
            </>
          )}
          <div className="bd-actions">
            {item.kind === 'package' ? (
              <button onClick={() => newJob(row.draft.id)}>Add pinned job</button>
            ) : (
              <button onClick={() => edit(row, item.status)}>Edit job</button>
            )}
            <button
              onClick={() => {
                setDetail('');
                onPackage(row.draft.id);
              }}
            >
              Open work file
            </button>
          </div>
          {error && (
            <p role="alert" className="bd-error">
              {error}
            </p>
          )}
          <TimelineList entries={item.history} heading="History" />
        </Sheet>
      )}
      {flow.form?.projectId === property.id && (
        <JobEditor
          form={flow.form}
          rows={own}
          property={property}
          onPickView={openModel}
          onSaved={(id, by) => {
            setActor(by);
            setNotice('Job change recorded.');
            setDetail(id);
            flow.clearForm();
          }}
        />
      )}
    </section>
  );
}
function JobEditor({
  form: f,
  property,
  rows,
  onPickView,
  onSaved,
}: {
  form: JobForm;
  property: Property;
  rows: Items;
  onPickView: (v: 'plan' | '3d', f: JobForm) => void;
  onSaved: (id: string, by: string) => void;
}) {
  const set = useTradeFlow((s) => s.setForm),
    clear = useTradeFlow((s) => s.clearForm),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const patch = (value: Partial<JobForm>) => set({ ...f, ...value });
  const save = async () => {
    if (!f.pin || !f.title.trim() || !f.by.trim()) {
      setError('Add a job name, your name and a pin in the build.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const ledger = useLinkStore.getState();
      if (f.existing)
        await ledger.editJob(
          f.id,
          {
            title: f.title.trim(),
            note: f.note.trim(),
            status: f.status,
            pin: f.pin,
            photo: f.photo,
            startDate: f.startDate || null,
            dueDate: f.dueDate || null,
          },
          f.by.trim(),
        );
      else
        await ledger.createJob({
          id: f.id,
          projectId: property.id,
          projectLabel: property.name,
          role: f.role,
          parentId: f.parentId,
          title: f.title.trim(),
          note: f.note.trim(),
          status: f.status,
          pin: f.pin,
          photo: f.photo ?? undefined,
          startDate: f.startDate || undefined,
          dueDate: f.dueDate || undefined,
          by: f.by.trim(),
        });
      onSaved(f.id, f.by.trim());
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={f.existing ? 'Edit job' : 'Add a pinned job'} wide onClose={clear}>
      <p>
        {who(f.role)} · {property.name}
      </p>
      <div className="bd-fields">
        <label>
          Job name
          <input
            maxLength={160}
            value={f.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        {!f.existing && (
          <label>
            Related package
            <select
              value={f.parentId ?? ''}
              onChange={(e) => patch({ parentId: e.target.value || undefined })}
            >
              <option value="">Standalone job</option>
              {rows
                .filter((i) => i.kind === 'package')
                .map((i) => (
                  <option value={i.packageId} key={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Short note
          <textarea
            maxLength={1000}
            value={f.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </label>
        <div className="bd-pair">
          <label>
            Status
            <select
              value={f.status}
              onChange={(e) => patch({ status: e.target.value as JobStatus })}
            >
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {human(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recorded by
            <input maxLength={120} value={f.by} onChange={(e) => patch({ by: e.target.value })} />
          </label>
          <label>
            Start date
            <input
              type="date"
              value={f.startDate}
              onChange={(e) => patch({ startDate: e.target.value })}
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              min={f.startDate || undefined}
              value={f.dueDate}
              onChange={(e) => patch({ dueDate: e.target.value })}
            />
          </label>
        </div>
        <section className="ts-location">
          <h3>Location in the build</h3>
          <p>
            {f.pin
              ? 'Pinned to ' + f.pin.planRef + ' · ' + f.pin.levelId
              : 'Choose a view, then tap the part where this work belongs.'}
          </p>
          <div className="bd-actions">
            <button disabled={busy} onClick={() => onPickView('plan', f)}>
              Pin on plan
            </button>
            <button disabled={busy} onClick={() => onPickView('3d', f)}>
              Pin in 3D
            </button>
          </div>
        </section>
        <label>
          Job photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError('');
              try {
                const photo = await jobPhoto(file),
                  current = useTradeFlow.getState().form;
                if (current?.id === f.id) set({ ...current, photo });
              } catch (err) {
                setError(problem(err));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {f.photo && (
          <div>
            <img className="ts-photo" src={f.photo.ref} alt="Attached job photo" />
            <button onClick={() => patch({ photo: null })}>Remove photo</button>
          </div>
        )}
        {error && (
          <p role="alert" className="bd-error">
            {error}
          </p>
        )}
        <button className="bd-primary" disabled={busy} onClick={() => void save()}>
          Save job
        </button>
      </div>
    </Sheet>
  );
}
