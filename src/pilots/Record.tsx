import {PilotTradeJobs} from './SiteVisitLinks';
import { WorkPlan, ConfiguredReadings, Baselines, PilotDue, RecordHistory } from './RunningRecord';
import { EvidencePicker } from './EvidenceFiles';
import { MemberLink } from './SharedControls';
import { EvidenceFiles } from './EvidenceFiles';
import { useState } from 'react';
import {
  roles,
  damageKinds,
  day,
  logSchema,
  paperStates,
  readingSchema,
  series,
  stepStates,
  today,
  totals,
  uid,
  type Pilot,
} from './contract';
import { Field } from './ui';
import { formValues, str } from './fields';
import { update } from './store';
import { permissions, isShared } from './remote';
export default function Record({ p }: { p: Pilot }) {
  const [site, setSite] = useState(p.sites.find((s) => s.area)?.id ?? p.sites[0]?.id ?? ''),
    [status, setStatus] = useState('');
  const rows = series(p.readings, site);
  return (
    <>
      {isShared(p.slug)&&<PilotTradeJobs p={p}/>}
      {isShared(p.slug) && <PilotDue />}
      {isShared(p.slug) && permissions(p, 'steps').read && <WorkPlan p={p} />}
      {!isShared(p.slug) && permissions(p, 'steps').read && (
        <>
          <h3>Six steps</h3>
          <ol className="pilot-timeline">
            {p.steps.map((s, i) => (
              <li key={s.id}>
                <strong>
                  {i + 1}. {s.title}
                </strong>
                <label>
                  Date
                  <input
                    type="date"
                    disabled={!permissions(p, 'steps').edit(s.id)}
                    aria-label={s.title + ' date'}
                    value={s.date}
                    onChange={(e) => {
                      const v = day.safeParse(e.target.value);
                      if (v.success)
                        update(p.slug, (q) => {
                          q.steps[i].date = v.data;
                        });
                    }}
                  />
                </label>
                <label>
                  Step state
                  <select
                    disabled={!permissions(p, 'steps').edit(s.id)}
                    value={s.state}
                    onChange={(e) =>
                      update(p.slug, (q) => {
                        q.steps[i].state = stepStates[e.target.selectedIndex];
                      })
                    }
                  >
                    {stepStates.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Step note (name a role)
                  <input
                    maxLength={200}
                    disabled={!permissions(p, 'steps').edit(s.id)}
                    key={s.id + '-' + s.note}
                    defaultValue={s.note ?? ''}
                    onBlur={(e) => {
                      const note = e.currentTarget.value.trim();
                      if (note !== (s.note ?? ''))
                        void update(p.slug, (q) => {
                          q.steps[i].note = note;
                        });
                    }}
                  />
                </label>
              </li>
            ))}
          </ol>
        </>
      )}
      {permissions(p, 'readings').read && (
        <>
          {isShared(p.slug) && <ConfiguredReadings p={p} />}
          <h3>Monthly cover</h3>
          {p.sites.length > 0 ? (
            <>
              <label>
                Reading site
                <select value={site} onChange={(e) => setSite(e.target.value)}>
                  {p.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div aria-label="Cover by month" className="pilot-bars">
                {rows.length ? (
                  rows.map((r) => (
                    <div key={r.id}>
                      <time>{r.month}</time>
                      <meter min="0" max="100" value={r.cover} />
                      <b>{r.cover}%</b>
                    </div>
                  ))
                ) : (
                  <p>Add the first monthly reading for this site.</p>
                )}
              </div>
              {permissions(p, 'readings').write && (
                <form
                  className="pilot-form"
                  onSubmit={async (e) => {
                    const f = formValues(e);
                    const qId = () =>
                      p.readings.find((r) => r.site === site && r.month === str(f, 'month'))?.id ??
                      uid();
                    const rec = readingSchema.parse({
                      id: qId(),
                      site,
                      month: str(f, 'month'),
                      cover: Number(f.get('cover')),
                      condition: str(f, 'condition'),
                      damage: f.get('damage'),
                      note: str(f, 'note'),
                      photo: str(f, 'photo') || undefined,
                    });
                    const saved = await update(p.slug, (q) => {
                      q.readings = q.readings.filter(
                        (r) => r.site !== site || r.month !== rec.month,
                      );
                      q.readings.push(rec);
                    });
                    if (!saved) return;
                    setStatus('Reading saved for ' + rec.month);
                  }}
                >
                  <Field label="Month" name="month" type="month" value={today().slice(0, 7)} />
                  <label>
                    Cover (%)
                    <input type="number" name="cover" required min="0" max="100" step=".1" />
                  </label>
                  <Field label="Render condition" name="condition" />
                  <label>
                    Damage
                    <select name="damage">
                      {damageKinds.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Photo from the wall
                    <select name="photo">
                      <option value="">No photo</option>
                      {p.photos
                        .filter((x) => x.site === site && !x.hidden)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.date} · {x.caption || x.kind}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Field name="note" label="Reading note" required={false} maxLength={2000} />
                  <button>Save reading</button>
                </form>
              )}
            </>
          ) : (
            <p>Add a site to record a reading.</p>
          )}
        </>
      )}
      {permissions(p, 'log').read && (
        <>
          <h3>Waste log</h3>
          {isShared(p.slug) && <Baselines p={p} />}
          <div className="pilot-log" role="table" aria-label="Waste log">
            {p.logs.map((row) => (
              <div role="row" key={row.id}>
                <time role="cell">{row.date}</time>
                <b role="cell">{row.type}</b>
                <span role="cell">
                  {row.quantity} {row.unit}
                </span>
                <span role="cell">{row.destination}</span>
                {row.photo && (
                  <img
                    loading="lazy"
                    width="80"
                    src={'/api/pilots/' + p.slug + '/photos/' + row.photo}
                    alt="Log photo"
                  />
                )}
                {row.ticket && (
                  <a href={'/api/pilots/' + p.slug + '/files/' + row.ticket}>Download ticket</a>
                )}
                {isShared(p.slug) && <RecordHistory p={p} id={row.id} />}
              </div>
            ))}
          </div>
          <p>
            {totals(p.logs)
              .map((r) => r.type + ' ' + Number(r.quantity.toFixed(3)) + ' ' + r.unit)
              .join(' · ') || 'Add the first load below.'}
          </p>
          {permissions(p, 'log').write && (
            <form
              className="pilot-form"
              onSubmit={async (e) => {
                const form = e.currentTarget,
                  f = formValues(e),
                  rec = logSchema.parse({
                    id: uid(),
                    date: str(f, 'date'),
                    type: str(f, 'type'),
                    quantity: Number(f.get('quantity')),
                    unit: str(f, 'unit'),
                    destination: str(f, 'destination'),
                    photo: str(f, 'photo') || undefined,
                    ticket: str(f, 'ticket') || undefined,
                  });
                const saved = await update(p.slug, (q) => q.logs.push(rec));
                if (!saved) return;
                form.reset();
                setStatus('Load added');
              }}
            >
              <Field name="date" label="Load date" type="date" value={today()} />
              <Field name="type" label="Material type" />
              <label>
                Quantity
                <input type="number" required min="0" max="1000000000" step="any" name="quantity" />
              </label>
              <Field name="unit" label="Unit" value="t" />
              <Field name="destination" label="Where it went" />
              {isShared(p.slug) && (
                <>
                  <label>
                    Log photo
                    <select name="photo">
                      <option value="">No photo</option>
                      {p.photos
                        .filter((x) => !x.hidden)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.caption || x.date}
                          </option>
                        ))}
                    </select>
                  </label>
                  {permissions(p, 'papers').read && <EvidencePicker p={p} />}
                </>
              )}
              <button>Add load</button>
            </form>
          )}
        </>
      )}
      <p role="status">{status}</p>
    </>
  );
}
export function Team({ p }: { p: Pilot }) {
  return (
    <>
      <div className="pilot-cards">
        {p.members.map((m) => (
          <article key={m.id}>
            <small>
              {m.role} · {m.state}
            </small>
            <h3>{m.name}</h3>
            {m.organisation}
            {isShared(p.slug) && permissions(p).owner && m.id !== 'lead' && (
              <MemberLink slug={p.slug} member={m} />
            )}
          </article>
        ))}
      </div>
      <details>
        <summary>
          {isShared(p.slug)
            ? 'My page · ' + (p.members.find((m) => m.id === permissions(p).by)?.name ?? 'Member')
            : 'My page · the lead'}
        </summary>
        <h3>My dates</h3>
        {p.steps.map((s) => (
          <p key={s.id}>
            {s.date} · {s.title}
          </p>
        ))}
        <h3>My papers</h3>
        {p.papers.map((x) => (
          <p key={x.id}>
            {x.title} · {x.state}
          </p>
        ))}
        <h3>My numbers</h3>
        <p>
          {p.sites.length} sites · {p.readings.length} readings ·{' '}
          {p.sites.reduce((sum, s) => sum + (s.area ?? 0), 0)} m² recorded
        </p>
        {totals(p.logs).map((t) => (
          <p key={t.type + t.unit}>
            {t.type} · {Number(t.quantity.toFixed(3))} {t.unit}
          </p>
        ))}
      </details>
    </>
  );
}
export function Notes({ p }: { p: Pilot }) {
  return (
    <>
      {permissions(p).write && (
        <form
          className="pilot-form"
          onSubmit={async (e) => {
            const form = e.currentTarget,
              f = formValues(e);
            const saved = await update(p.slug, (q) =>
              q.notes.unshift({
                id: uid(),
                date: today(),
                member: str(f, 'member'),
                text: str(f, 'text'),
              }),
            );
            if (!saved) return;
            form.reset();
          }}
        >
          <label>
            Added by
            <select name="member">
              {p.members
                .filter(
                  (m) => m.state === 'active' && (!permissions(p).by || permissions(p).by === m.id),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.organisation}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Note
            <textarea required maxLength={2000} name="text" />
          </label>
          <button>Add note</button>
        </form>
      )}
      {[...p.notes]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((n) => (
          <article key={n.id}>
            <small>
              {n.date} · {p.members.find((m) => m.id === n.member)?.name}
            </small>
            <p>{n.text}</p>
          </article>
        ))}
    </>
  );
}
export function Papers({ p }: { p: Pilot }) {
  return (
    <>
      <p>A tick here is a record, never a signature.</p>
      {isShared(p.slug) && <EvidenceFiles p={p} />}
      {p.papers.map((x, i) => (
        <article key={x.id}>
          <label>
            {x.title}
            <select
              disabled={!permissions(p, 'papers').edit(x.id)}
              value={x.state}
              onChange={(e) =>
                update(p.slug, (q) => {
                  q.papers[i].state = paperStates[e.target.selectedIndex];
                })
              }
            >
              {paperStates.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {x.due && (
            <p>
              Due {x.due} ·{' '}
              {p.members.find((m) => m.id === x.ownerMember)?.name ?? x.ownerRole ?? 'lead'}
            </p>
          )}
          {isShared(p.slug) && <RecordHistory p={p} id={x.id} />}
          {isShared(p.slug) && permissions(p, 'papers').edit(x.id) && (
            <details>
              <summary>Edit paper</summary>
              <form
                className="pilot-form"
                onSubmit={(e) => {
                  const f = formValues(e);
                  void update(p.slug, (q) => {
                    const paper = q.papers.find((s) => s.id === x.id)!;
                    paper.title = str(f, 'title');
                    paper.note = str(f, 'note');
                    paper.link = str(f, 'link') || undefined;
                    paper.due = str(f, 'due') || undefined;
                    if (permissions(p).owner) {
                      const owner = str(f, 'owner');
                      paper.ownerRole = owner.startsWith('r:')
                        ? (owner.slice(2) as (typeof roles)[number])
                        : undefined;
                      paper.ownerMember = owner.startsWith('m:') ? owner.slice(2) : undefined;
                    }
                  });
                }}
              >
                <Field name="title" label="Paper name" value={x.title} />
                <Field name="due" label="Due date" type="date" value={x.due} required={false} />
                <Field
                  name="link"
                  label="Outside link"
                  type="url"
                  value={x.link}
                  required={false}
                />
                <Field
                  name="note"
                  label="Paper notes"
                  value={x.note}
                  required={false}
                  maxLength={2000}
                />
                {permissions(p).owner && (
                  <label>
                    Assign to
                    <select
                      name="owner"
                      defaultValue={
                        x.ownerMember ? 'm:' + x.ownerMember : x.ownerRole ? 'r:' + x.ownerRole : ''
                      }
                    >
                      <option value="">Unassigned</option>
                      {roles.map((r) => (
                        <option key={r} value={'r:' + r}>
                          {r}
                        </option>
                      ))}
                      {p.members.map((m) => (
                        <option key={m.id} value={'m:' + m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button>Save paper</button>
              </form>
            </details>
          )}
          {x.link && (
            <a href={x.link} rel="noreferrer" target="_blank">
              Open paper
            </a>
          )}
          {x.note && <p>{x.note}</p>}
        </article>
      ))}
      {permissions(p, 'papers').write && (
        <form
          className="pilot-form"
          onSubmit={async (e) => {
            const form = e.currentTarget,
              f = formValues(e);
            const saved = await update(p.slug, (q) =>
              q.papers.push({
                id: uid(),
                title: str(f, 'title'),
                state: 'needed',
                due: str(f, 'due') || undefined,
                ownerMember: str(f, 'owner').startsWith('m:')
                  ? str(f, 'owner').slice(2)
                  : undefined,
                ownerRole: str(f, 'owner').startsWith('r:')
                  ? (str(f, 'owner').slice(2) as (typeof roles)[number])
                  : undefined,
                link: str(f, 'link') || undefined,
                note: str(f, 'note'),
              }),
            );
            if (!saved) return;
            form.reset();
          }}
        >
          <Field name="title" label="Paper title" />
          {isShared(p.slug) && (
            <>
              <Field name="due" type="date" label="Paper due date" required={false} />
              {permissions(p).owner && (
                <label>
                  Paper owner
                  <select name="owner">
                    <option value="">Unassigned</option>
                    {roles.map((r) => (
                      <option key={r} value={'r:' + r}>
                        {r}
                      </option>
                    ))}
                    {p.members.map((m) => (
                      <option key={m.id} value={'m:' + m.id}>
                        {m.name} · {m.organisation}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          <label>
            Outside link
            <input name="link" type="url" pattern="https://.*" maxLength={1500} />
          </label>
          <Field name="note" label="Paper note" required={false} maxLength={2000} />
          <button>Add paper</button>
        </form>
      )}
    </>
  );
}
