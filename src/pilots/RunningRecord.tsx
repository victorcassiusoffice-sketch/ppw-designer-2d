import { useState } from 'react';
import { type Pilot, roles, stepStates, today, uid, type readingTypeSchema } from './contract';
import type { z } from 'zod';
import { scheduleEnd } from './running';
import { permissions, useRemote, request } from './remote';
import { update } from './store';
import { Field } from './ui';
import { formValues, str } from './fields';
type Type = z.infer<typeof readingTypeSchema>;
const rhythms = ['weekly', 'fortnightly', 'monthly', 'once'] as const;
const states = { todo: 'Not started', doing: 'Under way', done: 'Done', late: 'Late' };
export function WorkPlan({ p }: { p: Pilot }) {
  const owner = permissions(p).owner,
    schedule = p.schedules?.[0],
    steps = [...p.steps].sort(
      (a, b) => (a.order ?? p.steps.indexOf(a)) - (b.order ?? p.steps.indexOf(b)),
    );
  const [selected, setSelected] = useState(''),
    [msg, setMsg] = useState('');
  const active = steps.find((s) => s.id === selected);
  async function save(change: (q: Pilot) => void) {
    const done = await update(p.slug, change);
    setMsg(done ? 'Saved.' : 'Review the current record and try again.');
  }
  const roleOptions = roles.map((r) => <option key={r}>{r}</option>);
  return (
    <>
      <h3>Works plan</h3>
      {schedule && (
        <p>
          {schedule.start} to {schedule.end} · {schedule.months} months
        </p>
      )}
      {owner && (
        <details>
          <summary>Pilot dates</summary>
          <form
            className="pilot-form"
            onSubmit={(e) => {
              const f = formValues(e),
                start = str(f, 'start'),
                months = Number(f.get('months'));
              void save((q) => {
                q.schedules = [
                  { id: 'pilot-schedule', start, months, end: scheduleEnd(start, months) },
                ];
              });
            }}
          >
            <Field name="start" type="date" label="Start date" value={schedule?.start ?? today()} />
            <label>
              Length in months
              <input
                name="months"
                type="number"
                min={1}
                max={600}
                required
                defaultValue={schedule?.months ?? 10}
              />
            </label>
            <button>Save dates</button>
          </form>
        </details>
      )}
      <ol className="pilot-works">
        {steps.map((s, i) => (
          <li key={s.id}>
            <strong>{s.title}</strong>
            <span>
              {states[s.state]} · {s.ownerRole ?? 'lead'}
            </span>
            <small>{s.startMonth ? 'Months ' + s.startMonth + '–' + s.endMonth : s.date}</small>
            {s.startMonth && s.endMonth && schedule && (
              <div aria-hidden="true" className="pilot-month-bar">
                <i
                  style={{
                    marginLeft: ((s.startMonth - 1) / schedule.months) * 100 + '%',
                    width: ((s.endMonth - s.startMonth + 1) / schedule.months) * 100 + '%',
                  }}
                />
              </div>
            )}
            {s.note && <p>{s.note}</p>}
            {s.tasks?.map((t) => (
              <p key={t.id}>
                {t.name} · {t.role} · {states[t.state]}
              </p>
            ))}
            {permissions(p, 'steps').edit(s.id) && (
              <button onClick={() => setSelected(s.id)}>Edit step</button>
            )}
            {owner && (
              <>
                <button
                  disabled={!i}
                  onClick={() =>
                    void save((q) => {
                      const cur = q.steps.find((v) => v.id === s.id)!;
                      cur.order =
                        i === 1
                          ? (steps[0].order ?? p.steps.indexOf(steps[0])) - 1
                          : ((steps[i - 2].order ?? p.steps.indexOf(steps[i - 2])) +
                              (steps[i - 1].order ?? p.steps.indexOf(steps[i - 1]))) /
                            2;
                    })
                  }
                >
                  Move earlier
                </button>
                <button
                  onClick={() =>
                    void save((q) => {
                      q.steps = q.steps.filter((v) => v.id !== s.id);
                    })
                  }
                >
                  Hide step
                </button>
                <RecordHistory p={p} id={s.id} />
              </>
            )}
          </li>
        ))}
      </ol>
      {permissions(p, 'steps').write && (
        <details
          open={!!selected}
          onToggle={(e) => {
            if (!e.currentTarget.open) setSelected('');
          }}
        >
          <summary>{active ? 'Edit ' + active.title : 'Add step'}</summary>
          <form
            className="pilot-form"
            key={selected}
            onSubmit={async (e) => {
              const f = formValues(e),
                id = active?.id ?? uid(),
                startMonth = Number(f.get('from')),
                endMonth = Number(f.get('to'));
              if (endMonth < startMonth) {
                setMsg('Choose an end month after the start month.');
                return;
              }
              const item = {
                ...active,
                id,
                title: str(f, 'name'),
                startMonth,
                endMonth,
                date: schedule ? scheduleEnd(schedule.start, endMonth) : (active?.date ?? today()),
                ownerRole: str(f, 'role') as (typeof roles)[number],
                state: str(f, 'state') as (typeof stepStates)[number],
                note: str(f, 'note'),
                order:
                  active?.order ??
                  (active
                    ? p.steps.indexOf(active)
                    : Math.max(0, ...steps.map((s, i) => s.order ?? i)) + 1),
              };
              await save((q) => {
                const i = q.steps.findIndex((v) => v.id === id);
                if (i < 0) q.steps.push(item);
                else q.steps[i] = item;
              });
              setSelected('');
            }}
          >
            <Field name="name" label="Step name" value={active?.title} />
            <label>
              Start month
              <input
                name="from"
                type="number"
                required
                min={1}
                max={schedule?.months ?? 600}
                defaultValue={active?.startMonth ?? 1}
              />
            </label>
            <label>
              End month
              <input
                name="to"
                type="number"
                required
                min={1}
                max={schedule?.months ?? 600}
                defaultValue={active?.endMonth ?? 1}
              />
            </label>
            <label>
              Responsible role
              <select name="role" defaultValue={active?.ownerRole ?? 'lead'}>
                {roleOptions}
              </select>
            </label>
            <label>
              State
              <select name="state" defaultValue={active?.state ?? 'todo'}>
                {stepStates.map((s) => (
                  <option key={s} value={s}>
                    {states[s]}
                  </option>
                ))}
              </select>
            </label>
            <Field name="note" label="Step note" value={active?.note} required={false} />
            <button>Save step</button>
          </form>
          {active && (
            <form
              className="pilot-form"
              onSubmit={(e) => {
                const f = formValues(e);
                void save((q) => {
                  (q.steps.find((s) => s.id === active.id)!.tasks ??= []).push({
                    id: uid(),
                    name: str(f, 'name'),
                    role: str(f, 'role') as (typeof roles)[number],
                    state: 'todo',
                  });
                });
              }}
            >
              <Field name="name" label="Sub-task name" />
              <label>
                Sub-task role<select name="role">{roleOptions}</select>
              </label>
              <button>Add sub-task</button>
              {active.tasks?.map((t) => (
                <label key={t.id}>
                  {t.name}
                  <select
                    value={t.state}
                    onChange={(e) => {
                      const state = e.target.value as (typeof stepStates)[number];
                      void save((q) => {
                        q.steps
                          .find((s) => s.id === active.id)!
                          .tasks!.find((x) => x.id === t.id)!.state = state;
                      });
                    }}
                  >
                    {stepStates.map((s) => (
                      <option value={s} key={s}>
                        {states[s]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </form>
          )}
        </details>
      )}
      <p role="status">{msg}</p>
    </>
  );
}
function TypeForm({ p }: { p: Pilot }) {
  const [fields, setFields] = useState([uid()]),
    [targets, setTargets] = useState([uid()]),
    [msg, setMsg] = useState('');
  return (
    <details>
      <summary>Define a reading type</summary>
      <form
        className="pilot-form"
        onSubmit={async (e) => {
          const form = e.currentTarget,
            f = formValues(e),
            change = str(f, 'change');
          const type: Type = {
            id: uid(),
            name: str(f, 'name'),
            rhythm: str(f, 'rhythm') as Type['rhythm'],
            change: change
              ? { date: change, rhythm: str(f, 'later') as Type['rhythm'] }
              : undefined,
            fields: fields.map((id) => ({
              id,
              name: str(f, id + 'name'),
              unit: str(f, id + 'unit'),
              kind: str(f, id + 'kind') as Type['fields'][number]['kind'],
              low: str(f, id + 'low') ? Number(f.get(id + 'low')) : undefined,
              high: str(f, id + 'high') ? Number(f.get(id + 'high')) : undefined,
              choices: str(f, id + 'choices')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })),
            targets: targets.map((id) => ({
              id,
              name: str(f, id + 'target'),
              site: str(f, id + 'site'),
              role: str(f, id + 'role') as (typeof roles)[number],
            })),
          };
          try {
            if (await update(p.slug, (q) => (q.readingTypes ??= []).push(type))) {
              form.reset();
              setFields([uid()]);
              setTargets([uid()]);
              setMsg('Reading type saved.');
            }
          } catch {
            setMsg('Check the bounds and enter choices for each choice field.');
          }
        }}
      >
        <Field name="name" label="Reading type name" />
        {fields.map((id, i) => (
          <fieldset key={id}>
            <legend>Field {i + 1}</legend>
            <Field name={id + 'name'} label="Field name" />
            <Field name={id + 'unit'} label="Unit" required={false} />
            <label>
              Field kind
              <select name={id + 'kind'}>
                {['number', 'choice', 'text', 'photo'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Low
              <input name={id + 'low'} type="number" step="any" />
            </label>
            <label>
              High
              <input name={id + 'high'} type="number" step="any" />
            </label>
            <Field name={id + 'choices'} label="Choices, separated by commas" required={false} />
          </fieldset>
        ))}
        <button
          type="button"
          disabled={fields.length >= 20}
          onClick={() => setFields([...fields, uid()])}
        >
          Add another field
        </button>
        <label>
          Reading rhythm
          <select name="rhythm">
            {rhythms.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <Field name="change" label="Change rhythm from" type="date" required={false} />
        <label>
          New rhythm
          <select name="later">
            {rhythms.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        {targets.map((id, i) => (
          <fieldset key={id}>
            <legend>Target {i + 1}</legend>
            <label>
              Site
              <select required name={id + 'site'}>
                {p.sites.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <Field name={id + 'target'} label="Target name" />
            <label>
              Reading role
              <select name={id + 'role'} defaultValue="tester">
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={targets.length >= 30}
          onClick={() => setTargets([...targets, uid()])}
        >
          Add another target
        </button>
        <button disabled={!p.sites.length}>Save reading type</button>
        <p role="status">{msg}</p>
      </form>
    </details>
  );
}
export function ConfiguredReadings({ p }: { p: Pilot }) {
  return (
    <>
      {(p.readingTypes ?? []).map((t) => (
        <details key={t.id}>
          <summary>
            {t.name} · {t.rhythm}
          </summary>
          {t.targets.map((target) => (
            <article key={target.id}>
              <h4>{target.name}</h4>
              {t.fields
                .filter((f) => f.kind === 'number')
                .map((f) => (
                  <div key={f.id}>
                    <b>
                      {f.name} · {f.unit}
                    </b>
                    {(p.samples ?? [])
                      .filter((s) => s.typeId === t.id && s.targetId === target.id)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((s) => (
                        <div className="pilot-bars" key={s.id}>
                          <time>{s.date}</time>
                          <meter
                            min={f.low ?? Math.min(0, Number(s.values[f.id]))}
                            max={f.high ?? Math.max(1, Number(s.values[f.id]))}
                            value={Number(s.values[f.id])}
                          />
                          <span>{s.values[f.id]}</span>
                        </div>
                      ))}
                  </div>
                ))}
              {permissions(p, 'readings').write && (
                <form
                  className="pilot-form"
                  onSubmit={async (e) => {
                    const form = e.currentTarget,
                      v = formValues(e),
                      values = Object.fromEntries(
                        t.fields.map((f) => [
                          f.id,
                          f.kind === 'number' ? Number(v.get(f.id)) : str(v, f.id),
                        ]),
                      );
                    if (
                      await update(p.slug, (q) =>
                        (q.samples ??= []).push({
                          id: uid(),
                          typeId: t.id,
                          targetId: target.id,
                          date: str(v, 'date'),
                          values,
                        }),
                      )
                    )
                      form.reset();
                  }}
                >
                  <Field name="date" label="Reading date" type="date" value={today()} />
                  {t.fields.map((f) => (
                    <label key={f.id}>
                      {f.name} {f.unit}
                      {f.kind === 'number' ? (
                        <input
                          name={f.id}
                          type="number"
                          min={f.low}
                          max={f.high}
                          step="any"
                          required
                        />
                      ) : f.kind === 'text' ? (
                        <input name={f.id} maxLength={500} required />
                      ) : (
                        <select name={f.id} required>
                          {f.kind === 'choice'
                            ? f.choices?.map((c) => <option key={c}>{c}</option>)
                            : p.photos
                                .filter((x) => !x.hidden && x.site === target.site)
                                .map((x) => (
                                  <option value={x.id} key={x.id}>
                                    {x.caption || x.date}
                                  </option>
                                ))}
                        </select>
                      )}
                    </label>
                  ))}
                  <button>Save target reading</button>
                </form>
              )}
            </article>
          ))}
        </details>
      ))}
      {permissions(p).owner && <TypeForm p={p} />}
    </>
  );
}
export function Baselines({ p }: { p: Pilot }) {
  return (
    <>
      {p.baselines?.map((b) => (
        <p key={b.id}>
          {b.type} ·{' '}
          {p.logs
            .filter((x) => x.type === b.type && x.unit === b.unit)
            .reduce((a, x) => a + x.quantity, 0)}{' '}
          of {b.quantity} {b.unit}
        </p>
      ))}
      {permissions(p).owner && (
        <details>
          <summary>Stream baseline</summary>
          <form
            className="pilot-form"
            onSubmit={(e) => {
              const f = formValues(e),
                type = str(f, 'type'),
                unit = str(f, 'unit'),
                quantity = Number(f.get('quantity'));
              void update(p.slug, (q) => {
                const rows = (q.baselines ??= []),
                  old = rows.find((b) => b.type === type && b.unit === unit);
                if (old) old.quantity = quantity;
                else rows.push({ id: uid(), type, unit, quantity });
              });
            }}
          >
            <Field name="type" label="Stream type" />
            <Field name="unit" label="Baseline unit" />
            <label>
              Baseline quantity
              <input type="number" name="quantity" min={0} step="any" required />
            </label>
            <button>Save baseline</button>
          </form>
        </details>
      )}
    </>
  );
}
export function PilotDue() {
  const due = useRemote((s) => s.doc?.due);
  return due ? (
    <details>
      <summary>Due this month · {due.length}</summary>
      {due.map((d) => (
        <p key={d.id}>
          {d.label} · {d.role ?? d.member} · {d.date} · {d.state}
        </p>
      ))}
    </details>
  ) : null;
}
export function RecordHistory({ p, id }: { p: Pilot; id: string }) {
  const [history, set] = useState<{ at: string; entry: Record<string, unknown> }[]>([]),
    [error, setError] = useState('');
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open)
          void request<{ entries: typeof history }>('/' + p.slug + '/history/' + id)
            .then((r) => set(r.entries))
            .catch(() => setError('History unavailable.'));
      }}
    >
      <summary>History</summary>
      {history.map((h, i) => (
        <div key={i}>
          <time>{new Date(h.at).toLocaleString()}</time>
          <dl>
            {Object.entries(h.entry)
              .filter(([k]) => k !== 'id')
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
          </dl>
        </div>
      ))}
      {error}
    </details>
  );
}
