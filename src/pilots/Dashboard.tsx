import { MemberFinance, type PersonalLedger } from './MemberFinance';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OlbLockup } from '../brand/OlbLockup';
import { display } from './money';
import { isShared, request } from './remote';
import './pilot.css';
type Dashboard = {
  finance?: PersonalLedger;
  owned?: string[];
  due?: { id: string; label: string; date: string; state: string }[];
  pilot: string;
  name: string;
  role: string;
  nearExpiry: boolean;
  links?: {
    id: string;
    seat: string;
    role: string;
    kind: string;
    madeBy: string;
    madeAt: string;
    firstUse: string | null;
  }[];
  next: { title: string; note?: string; date: string } | null;
  activity: { kind: string; id: string; date: string; label: string }[];
  pay: { agreed: number; currency: string; state: string; note: string } | null;
};
export default function MemberDashboard() {
  const { slug } = useParams(),
    [doc, setDoc] = useState<{ slug: string; data: Dashboard }>(),
    [msg, setMsg] = useState('Opening your dashboard…');
  useEffect(() => {
    let live = true;
    setDoc(undefined);
    setMsg('Opening your dashboard…');
    async function load() {
      try {
        if (!isShared(slug)) throw Error('Ask the owner for your link.');
        const data = await request<Dashboard>('/' + slug + '/me');
        if (live) setDoc({ slug: slug!, data });
      } catch (e) {
        if (live) {
          setDoc(undefined);
          setMsg(e instanceof Error ? e.message : 'Dashboard unavailable.');
        }
      }
    }
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [slug]);
  const d = doc?.slug === slug ? doc?.data : undefined;
  return (
    <main className="pilot pilot-dashboard">
      <header className="pilot-header">
        <OlbLockup />
        <Link to="/pilots/shared">My pilots</Link>
      </header>
      {!d ? (
        <p role="status">{msg}</p>
      ) : (
        <>
          <small>
            {d.pilot} · {d.role}
          </small>
          <h1>{d.name}’s dashboard</h1>
          <Link to={'/pilots/' + slug}>Open pilot record</Link>
          {d.links && (
            <details>
              <summary>Lead and coordinator link log</summary>
              {d.links.map((l) => (
                <article key={l.id}>
                  <h3>
                    {l.role} · {l.kind}
                  </h3>
                  <p>Seat {l.seat}</p>
                  <p>
                    Issued by {l.madeBy} · {l.madeAt}
                  </p>
                  <p>First use {l.firstUse ?? 'Unclaimed'}</p>
                </article>
              ))}
            </details>
          )}
          {d.finance && <MemberFinance slug={slug!} finance={d.finance} />}
          {d.nearExpiry && <p role="status">Ask the owner for a new link.</p>}
          {!!d.owned?.length && (
            <section>
              <h2>Assigned to me</h2>
              {d.owned.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </section>
          )}
          {!!d.due?.length && (
            <section>
              <h2>Due from me</h2>
              {d.due.map((s) => (
                <p key={s.id}>
                  {s.label} · {s.date} · {s.state}
                </p>
              ))}
            </section>
          )}
          <section>
            <h2>Next step</h2>
            {d.next ? (
              <>
                <h3>{d.next.title}</h3>
                <p>
                  {d.next.date} · {d.next.note}
                </p>
              </>
            ) : (
              <p>All recorded steps are done.</p>
            )}
          </section>
          <section>
            <h2>My contributions</h2>
            {d.activity.length ? (
              <ol>
                {d.activity.map((a) => (
                  <li key={a.id}>
                    <small>
                      {a.kind} · {a.date}
                    </small>
                    <p>{a.label}</p>
                    {a.kind === 'photo' && (
                      <img
                        loading="lazy"
                        src={'/api/pilots/' + slug + '/photos/' + a.id}
                        alt={a.label}
                        style={{ width: 'min(20rem,100%)' }}
                      />
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p>Your photos, notes, readings and log entries will appear here.</p>
            )}
          </section>
          <section className="pilot-money">
            <h2>My pay</h2>
            {d.pay ? (
              <>
                <b>{display(d.pay.agreed, d.pay.currency)}</b>
                <p>{d.pay.state}</p>
                <p>{d.pay.note}</p>
              </>
            ) : (
              <p>No pay agreement recorded.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
