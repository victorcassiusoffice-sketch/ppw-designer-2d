import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { OlbLockup } from '../brand/OlbLockup';
import { useAppPreferences } from '../i18n/AppPreferences';
import {
  exampleSlug,
  kinds,
  series,
  siteSchema,
  states,
  uid,
  type Pilot,
  type Site,
} from './contract';
import { blankPilot } from './example';
import { usePilots, createPilot, update, resetExample, photoBytes } from './store';
import PilotMap from './PilotMap';
import { Wall, Camera } from './Media';
import Record, { Team, Notes, Papers } from './Record';
import { Field, Picture } from './ui';
import { formValues, str } from './fields';
import { ensurePlan, planLink } from './plans';
import './pilot.css';
import { useRemote, isShared, enterShared, permissions } from './remote';
import { SharedList, Invites } from './SharedControls';
const sections = [
  'Map',
  'Sites',
  'Wall',
  'Camera',
  'Record',
  'Team',
  'Notes',
  'Papers',
  'Sheet',
] as const;
const lesson = {
  en: 'Select a map pin to visit its site. Add dated photos to the wall, then record monthly cover in Record.',
  fr: 'Sélectionnez un site sur la carte. Ajoutez des photos datées au mur, puis relevez la couverture mensuelle dans le registre.',
  es: 'Selecciona un punto del mapa. Añade fotos fechadas al muro y registra la cobertura mensual.',
  'zh-CN': '选择地图上的站点，添加带日期的墙面照片，然后记录每个月的覆盖率。',
};
function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
}
function SiteCard({ p, s, selected }: { p: Pilot; s: Site; selected: boolean }) {
  const photo = p.photos
    .filter((x) => !x.hidden && x.site === s.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <article id={'site-' + s.id} className={selected ? 'pilot-site picked' : 'pilot-site'}>
      <Picture p={p} photo={photo} />
      <small>
        {s.kind} · {s.state}
      </small>
      <h3>{s.name}</h3>
      <p>
        {s.place}
        {s.area !== undefined ? ' · ' + s.area + ' m²' : ''}
      </p>
      {s.plan ? (
        <div className="pilot-actions">
          {(['house', 'walk'] as const).map((view) => (
            <a key={view} href={planLink(s.plan!, view)} onClick={() => ensurePlan(s, s.plan!)}>
              {view === 'house' ? 'Open the build' : 'Walk it'}
            </a>
          ))}
        </div>
      ) : (
        <>
          <p>No build drawn yet</p>
          {permissions(p).owner && (
            <button
              onClick={async () => {
                const plan = uid();
                ensurePlan(s, plan);
                await update(p.slug, (q) => {
                  q.sites.find((x) => x.id === s.id)!.plan = plan;
                });
                if (
                  !isShared(p.slug) ||
                  useRemote.getState().doc?.pilot.sites.find((x) => x.id === s.id)?.plan === plan
                )
                  location.assign(planLink(plan, 'draw'));
              }}
            >
              Draw it
            </button>
          )}
        </>
      )}
    </article>
  );
}
function SiteForm({ p }: { p: Pilot }) {
  return (
    <details>
      <summary>Add site</summary>
      <form
        className="pilot-form"
        onSubmit={async (e) => {
          const form = e.currentTarget,
            f = formValues(e);
          const site = siteSchema.parse({
            id: uid(),
            name: str(f, 'name'),
            kind: str(f, 'kind'),
            place: str(f, 'place'),
            lat: Number(f.get('lat')),
            lon: Number(f.get('lon')),
            state: 'concept',
            area: str(f, 'area') ? Number(f.get('area')) : undefined,
          });
          if (!(await update(p.slug, (q) => q.sites.push(site)))) return;
          form.reset();
          requestAnimationFrame(() => scrollToId('site-' + site.id));
        }}
      >
        <Field name="name" label="Site name" />
        <Field name="place" label="Place" />
        <label>
          Kind
          <select name="kind">
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Latitude
          <input type="number" name="lat" required step="any" min="-90" max="90" />
        </label>
        <label>
          Longitude
          <input type="number" name="lon" required step="any" min="-180" max="180" />
        </label>
        <label>
          Wall area (m²)
          <input type="number" name="area" step=".01" min="0" max="100000000" />
        </label>
        <button>Save site</button>
      </form>
    </details>
  );
}
function Sheet({ p }: { p: Pilot }) {
  return (
    <div className="pilot-sheet">
      <small>{isShared(p.slug) ? 'Member record' : 'On this device'} · Pilot sheet</small>
      <h2>{p.name}</h2>
      <p>
        {p.lane} · {p.state}
      </p>
      <PilotMap sites={p.sites} />
      <h3>Sites and latest cover</h3>
      {p.sites.map((s) => {
        const r = series(p.readings, s.id).slice(-1)[0];
        return (
          <p key={s.id}>
            <b>{s.name}</b> · {s.place} · {r ? r.month + ' / ' + r.cover + '%' : 'Awaiting reading'}
          </p>
        );
      })}
      <h3>Timeline</h3>
      {p.steps.map((s) => (
        <p key={s.id}>
          {s.date} · {s.title} · {s.state}
        </p>
      ))}
      <h3>Team</h3>
      {p.members.map((m) => (
        <p key={m.id}>
          {m.role} · {m.organisation}
        </p>
      ))}
      <p>Estimates and records only, not an approval.</p>
      <button onClick={() => window.print()}>Print A4 sheet</button>
    </div>
  );
}
export default function Workspace() {
  const { slug } = useParams(),
    pilots = usePilots((s) => s.pilots),
    error = usePilots((s) => s.error),
    navigate = useNavigate(),
    { locale } = useAppPreferences();
  const memberIndex = slug === 'shared',
    shared = isShared(slug),
    remote = useRemote(),
    doc = remote.slug === slug ? remote.doc : undefined;
  useEffect(() => {
    if (slug && isShared(slug)) return enterShared(slug);
  }, [slug]);
  const p = shared ? doc?.pilot : pilots.find((x) => x.slug === slug);
  const owner = !shared || doc?.owner === true;
  const [selected, setSelected] = useState(''),
    [section, setSection] = useState('Map'),
    [more, setMore] = useState(false),
    [confirm, setConfirm] = useState(false),
    [status, setStatus] = useState('');
  useEffect(() => {
    document.title = (p?.name ?? 'Pilots') + ' · One Live Build';
    if (!slug) return;
    const id = location.hash.slice(1);
    if (sections.some((s) => s.toLowerCase() === id)) requestAnimationFrame(() => scrollToId(id));
  }, [slug, p?.name]);
  useEffect(() => {
    if (!p || p.slug !== exampleSlug) return;
    const wall = p.sites.find((s) => s.plan === 'example-wall');
    if (wall) ensurePlan(wall, 'example-wall');
    let active = true;
    (async () => {
      for (const ph of p.photos.filter((x) => x.id.startsWith('sample-photo-'))) {
        if (!active) return;
        await photoBytes(ph, p);
      }
    })().catch(() => {
      if (active) setStatus('Example photos need available browser storage.');
    });
    return () => {
      active = false;
    };
  }, [p]);
  function pick(id: string) {
    setSelected(id);
    setSection('Sites');
    history.replaceState(null, '', '#sites');
    scrollToId('site-' + id);
  }
  return (
    <main className="pilot">
      <header className="pilot-header">
        <a href="/home">
          <OlbLockup />
        </a>
        <Link to={shared || memberIndex ? '/pilots/shared' : '/pilots'}>Pilots</Link>
        <span>
          {shared || memberIndex
            ? 'Private pilot · members only'
            : 'On this device only' + (!slug || slug === exampleSlug ? ' · Example data' : '')}
        </span>
      </header>
      {shared && p && remote.message && (
        <p className="pilot-save-status" role="status">
          {remote.message}
        </p>
      )}
      {memberIndex ? (
        <SharedList memberOnly />
      ) : shared && !p ? (
        <p>
          {remote.denied
            ? 'Ask the owner for your link.'
            : remote.offline
              ? 'Shared record unavailable. Try again.'
              : 'Opening private pilot…'}
        </p>
      ) : !shared && error ? (
        <p role="alert">{error}</p>
      ) : !slug ? (
        <>
          <div className="pilot-title">
            <h1>Pilots</h1>
            <details>
              <summary>New pilot</summary>
              <form
                className="pilot-form"
                onSubmit={(e) => {
                  const f = formValues(e),
                    name = str(f, 'name'),
                    id = uid();
                  createPilot(blankPilot(id, name, str(f, 'lane')));
                  navigate('/pilots/' + id);
                }}
              >
                <Field name="name" label="Pilot name" />
                <Field name="lane" label="Lane" />
                <button>Create pilot</button>
              </form>
            </details>
          </div>
          <SharedList />
          <h2>On this device</h2>
          <div className="pilot-cards">
            {pilots.map((q) => (
              <Link className="pilot-list-card" to={'/pilots/' + q.slug} key={q.slug}>
                <PilotMap sites={q.sites} />
                <small>
                  {q.lane} · {q.state}
                </small>
                <h2>{q.name}</h2>
                <p>{q.sites.length} sites →</p>
              </Link>
            ))}
          </div>
        </>
      ) : !p ? (
        <p>
          Pilot unavailable on this device. <Link to="/pilots">Open pilot list</Link>
        </p>
      ) : (
        <>
          <div className="pilot-title">
            <small>
              {p.lane} · {p.state}
            </small>
            <h1>{p.name}</h1>
            <p>{p.summary}</p>
          </div>
          <nav aria-label="Pilot sections" data-expanded={more}>
            {sections.map((s) => (
              <a
                href={'#' + s.toLowerCase()}
                key={s}
                aria-current={s === section ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setSection(s);
                  setMore(false);
                  history.replaceState(null, '', '#' + s.toLowerCase());
                  requestAnimationFrame(() => scrollToId(s.toLowerCase()));
                }}
              >
                {s}
              </a>
            ))}
            <button className="pilot-more" aria-expanded={more} onClick={() => setMore(!more)}>
              {more ? 'Fewer sections' : 'More sections'}
            </button>
          </nav>
          {sections.map((name) => (
            <section
              key={name}
              id={name.toLowerCase()}
              className={'pilot-section s-' + name.toLowerCase()}
            >
              <h2>{name}</h2>
              {name === 'Map' ? (
                <PilotMap sites={p.sites} onPick={pick} />
              ) : name === 'Sites' ? (
                <>
                  <div className="pilot-cards">
                    {p.sites.map((s) => (
                      <SiteCard key={s.id} s={s} p={p} selected={selected === s.id} />
                    ))}
                  </div>
                  {owner && <SiteForm p={p} />}
                </>
              ) : name === 'Wall' ? (
                <Wall p={p} />
              ) : name === 'Camera' ? (
                <div className="pilot-cameras">
                  {p.sites.length ? (
                    p.sites.map((s) => <Camera p={p} s={s} key={s.id} />)
                  ) : (
                    <p>Add a site to set up its camera.</p>
                  )}
                </div>
              ) : name === 'Record' ? (
                <Record p={p} />
              ) : name === 'Team' ? (
                <>
                  <Team p={p} />
                  {shared && owner && <Invites slug={p.slug} />}
                </>
              ) : name === 'Notes' ? (
                <Notes p={p} />
              ) : name === 'Papers' ? (
                <Papers p={p} />
              ) : (
                <Sheet p={p} />
              )}
            </section>
          ))}
          {owner && (
            <details>
              <summary>Pilot settings</summary>
              {shared && (
                <form
                  className="pilot-form"
                  onSubmit={(e) => {
                    const f = formValues(e);
                    update(p.slug, (q) => {
                      q.name = str(f, 'name');
                      q.summary = str(f, 'summary');
                    });
                  }}
                >
                  <Field name="name" label="Pilot name" value={p.name} />
                  <Field
                    name="summary"
                    label="Summary"
                    value={p.summary}
                    maxLength={500}
                    required={false}
                  />
                  <button>Save pilot details</button>
                </form>
              )}
              <label>
                Pilot state
                <select
                  value={p.state}
                  onChange={(e) =>
                    update(p.slug, (q) => {
                      q.state = states[e.target.selectedIndex];
                    })
                  }
                >
                  {states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {p.slug === exampleSlug && (
                <>
                  <button onClick={() => setConfirm(true)}>Reset example</button>
                  {confirm && (
                    <div>
                      <p>Replace this example’s edits with the original record?</p>
                      <button
                        onClick={async () => {
                          await resetExample();
                          setConfirm(false);
                          setStatus('Example restored.');
                          location.reload();
                        }}
                      >
                        Restore example
                      </button>
                      <button onClick={() => setConfirm(false)}>Keep edits</button>
                    </div>
                  )}
                </>
              )}
            </details>
          )}
          <p>Photos, readings and notes are shared with this pilot’s members only.</p>
        </>
      )}
      <details>
        <summary>Pilot guide</summary>
        <p>{lesson[locale]}</p>
      </details>
      <p role="status">{status}</p>
      <footer>
        <OlbLockup height={22} />
        <span>Peak Performance Wellness Ltd · Mauritius</span>
      </footer>
    </main>
  );
}
