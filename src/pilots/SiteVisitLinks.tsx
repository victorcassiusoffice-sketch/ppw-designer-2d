import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { type Pilot, type Site } from './contract';
import { request, useRemote } from './remote';
import { visitGeometry, type PilotJob } from './buildRecord';
export function SiteVisitLinks({ p, s, owner }: { p: Pilot; s: Site; owner: boolean }) {
  const [msg, say] = useState(''),
    [busy, wait] = useState(false);
  async function share(hide = false) {
    wait(true);
    try {
      const ctx = await request<{ revision: number }>('/' + p.slug + '/build-context');
      const snapshot = hide
        ? null
        : JSON.parse(localStorage.getItem('ppw-pilot-plan-' + s.plan) || 'null')?.state?.property;
      if (!hide && !snapshot) throw Error('Open and save this site’s plan on this device first.');
      await request('/' + p.slug + '/site-plan/' + s.id, 'POST', {
        revision: ctx.revision,
        ...(hide ? { hide: true } : { property: visitGeometry(snapshot) }),
      });
      say(hide ? 'Snapshot hidden.' : 'The saved plan is shared with members.');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not share this plan.');
    } finally {
      wait(false);
    }
  }
  return (
    <>
      <Link to={'/pilots/' + p.slug + '?visit=' + encodeURIComponent(s.id) + '&view=house'}>
        View shared house
      </Link>
      <Link to={'/pilots/' + p.slug + '?visit=' + encodeURIComponent(s.id) + '&view=walk'}>
        Walk shared plan
      </Link>
      {owner && (
        <details>
          <summary>Share the plan with members</summary>
          <button disabled={busy} onClick={() => void share()}>
            Share current saved plan
          </button>
          <button disabled={busy} onClick={() => void share(true)}>
            Hide shared plan
          </button>
        </details>
      )}
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
export function PilotTradeJobs({ p }: { p: Pilot }) {
  const [jobs, set] = useState<PilotJob[]>([]),
    [msg, say] = useState('');
  const doc = useRemote().doc;
  useEffect(() => {
    let live = true;
    request<{ jobs: PilotJob[] }>('/' + p.slug + '/trade-jobs')
      .then((d) => {
        if (live) set(d.jobs);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [p.slug, doc?.revision]);
  if (!jobs.length) return null;
  return (
    <section>
      <h3>Trade jobs</h3>
      {jobs.map((j) => (
        <article key={j.id}>
          <h4>{j.title}</h4>
          <p>
            {p.sites.find((s) => s.id === j.site)?.name} ·{' '}
            {p.steps.find((s) => s.id === j.step)?.title}
          </p>
          <p>{j.scope}</p>
          {j.quote && (
            <p>
              {j.quote.trade} quote · {j.quote.state} · Valid until {j.quote.validUntil}
            </p>
          )}
          {j.progress.map((r, i) => (
            <p key={i}>
              {r.date} · {r.state} · {r.note}
            </p>
          ))}
          {doc?.owner && (
            <button
              onClick={() =>
                void request('/' + p.slug + '/trade-jobs', 'POST', {
                  revision: doc.revision,
                  job: j,
                  hide: true,
                })
                  .then(() => set(jobs.filter((x) => x.id !== j.id)))
                  .catch((e) => say(e.message))
              }
            >
              Hide job
            </button>
          )}
        </article>
      ))}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
