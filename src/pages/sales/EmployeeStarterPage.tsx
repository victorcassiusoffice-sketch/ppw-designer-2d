import { useState } from 'react';
import {
  CAPABILITIES,
  DISCOVERY,
  EXERCISES,
  handbook,
  MARKETS,
  MEETING,
  OFFERS,
  ONBOARDING,
  PACK_DATE,
  PACK_LINKS,
  SCRIPTS,
} from './salesPack';
import { Kicker, OpenLink, SalesShell } from './SalesShell';
import { downloadText, useChapter } from './salesNavigation';

const SECTIONS = [
  'Start',
  'Demo lab',
  'Markets',
  'Offers',
  'Onboarding',
  'Outreach',
  'Discovery',
  'All links',
] as const;
export default function EmployeeStarterPage() {
  const [chapter, select] = useChapter(SECTIONS);
  const [market, setMarket] = useState(0),
    [query, setQuery] = useState('');
  const [exercise, setExercise] = useState(0),
    [script, setScript] = useState(0);
  const [done, setDone] = useState<string[]>([]),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const origin = window.location.origin;
  const text = SCRIPTS[script].text
    .split('[meeting link]')
    .join(MEETING)
    .replace('[plumbing pitch link]', `${origin}/pitch/plumbing`);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(
        'Copied. Replace all remaining placeholders and obtain the usual approval before sending.',
      );
    } catch {
      setNotice('Select the text below and copy it, or download the template.');
    }
  };
  const selected = MARKETS[market],
    task = EXERCISES[exercise];
  return (
    <SalesShell kind="team" names={SECTIONS} chapter={chapter} select={select}>
      {chapter === 0 && (
        <div className="sales-hero">
          <div>
            <Kicker>Employee starter pack · {PACK_DATE}</Kicker>
            <h1>
              A useful demo.
              <br />
              <em>A clear next step.</em>
            </h1>
            <p className="sales-lead">
              Sell the part of Room Designer that solves a real customer problem. Learn the tools,
              tailor the conversation and build a scope with Victor.
            </p>
            <div className="sales-actions">
              <button className="sales-primary" onClick={() => select(1)}>
                Start the demo lab →
              </button>
              <button
                onClick={() =>
                  downloadText('Room-Designer-Employee-Starter-Pack.md', handbook(origin))
                }
              >
                Download full handbook
              </button>
            </div>
            <p className="sales-note">
              For employees acting as design consultants, catalogue coordinators and sales
              representatives. Use professional titles only when qualified.
            </p>
          </div>
          <aside className="sales-surface sales-start-card">
            <Kicker>Your first session</Kicker>
            <ol className="sales-steps">
              <li>
                <strong>Practise</strong>
                <span>Complete six short exercises and recover from a mistake.</span>
              </li>
              <li>
                <strong>Choose a market</strong>
                <span>Find the buyer, customer task and relevant demo.</span>
              </li>
              <li>
                <strong>Scope the pilot</strong>
                <span>Choose 2D, Premium 3D or both. Define what is included.</span>
              </li>
              <li>
                <strong>Arrange the next step</strong>
                <span>Bring the brief and catalogue owner to a meeting with Victor.</span>
              </li>
            </ol>
            <p className="sales-note">
              Pitches and Demo are open for exploration. Studio and onboarding may need approved
              access from Victor. Keep access codes out of prospect messages.
            </p>
          </aside>
          <details className="sales-wide sales-details">
            <summary>What employees may promise</summary>
            <div className="sales-card-grid">
              {CAPABILITIES.map(([status, title, body]) => (
                <article key={title}>
                  <span className="sales-status">{status}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </details>
        </div>
      )}
      {chapter === 1 && (
        <>
          <div className="sales-heading">
            <div>
              <Kicker>Learn by doing</Kicker>
              <h1>The demo lab</h1>
            </div>
            <span className="sales-badge">
              {done.length} / {EXERCISES.length} self-checked
            </span>
          </div>
          <div className="sales-workbench">
            <nav className="sales-menu" aria-label="Practice exercises">
              {EXERCISES.map((e, i) => (
                <button key={e.name} aria-pressed={exercise === i} onClick={() => setExercise(i)}>
                  <span>{done.includes(e.name) ? '✓' : String(i + 1).padStart(2, '0')}</span>
                  {e.name}
                  <small>{e.time}</small>
                </button>
              ))}
            </nav>
            <article className="sales-surface">
              <Kicker>Practice only · no orders</Kicker>
              <h2>{task.name}</h2>
              <ol className="sales-list">
                {task.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="sales-callout">
                <strong>Pass check:</strong> {task.pass}
              </p>
              <div className="sales-actions">
                <OpenLink href={task.path}>Open practice tool</OpenLink>
                <label className="sales-check">
                  <input
                    type="checkbox"
                    checked={done.includes(task.name)}
                    onChange={(e) =>
                      setDone(
                        e.target.checked
                          ? [...done, task.name]
                          : done.filter((n) => n !== task.name),
                      )
                    }
                  />
                  I can demonstrate this
                </label>
              </div>
              <p className="sales-note">
                Checklist progress stays only on this page and resets on reload. A colleague should
                observe your five-minute pitch before you present alone. In a demo, use Select/Back
                or Escape to leave tools, Fit to recover the view, and Undo to recover an edit.
              </p>
            </article>
          </div>
        </>
      )}
      {chapter === 2 && (
        <>
          <div className="sales-heading">
            <div>
              <Kicker>One platform, many entry points</Kicker>
              <h1>Who to approach</h1>
            </div>
            <label className="sales-search">
              Find a sector
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Furniture, plumbing, hotels…"
              />
            </label>
          </div>
          <div className="sales-workbench">
            <nav className="sales-menu" aria-label="Company categories">
              {MARKETS.map((m, i) => ({ m, i }))
                .filter(({ m }) =>
                  `${m.name} ${m.buyer}`.toLowerCase().includes(query.toLowerCase()),
                )
                .map(({ m, i }) => (
                  <button key={m.name} aria-pressed={market === i} onClick={() => setMarket(i)}>
                    {m.name}
                  </button>
                ))}
              {!MARKETS.some((m) =>
                `${m.name} ${m.buyer}`.toLowerCase().includes(query.toLowerCase()),
              ) && <p>No matching sector. Try a broader term.</p>}
            </nav>
            <article className="sales-surface">
              <Kicker>Prospect category</Kicker>
              <h2>{selected.name}</h2>
              <p className="sales-lead">{selected.problem}</p>
              <dl className="sales-definition">
                <div>
                  <dt>Speak to</dt>
                  <dd>{selected.buyer}</dd>
                </div>
                <div>
                  <dt>Starting scope</dt>
                  <dd>{selected.offer}</dd>
                </div>
                <div>
                  <dt>First question</dt>
                  <dd>{selected.ask}</dd>
                </div>
              </dl>
              <OpenLink href={selected.demo}>Open the relevant demo</OpenLink>
              <p className="sales-note">
                John Lewis, Courts, Espace Maison and other brands can be prospects. Naming a
                company does not mean it is a customer, endorses PPW or supplies a live feed. Obtain
                product and image permissions.
              </p>
            </article>
          </div>
        </>
      )}
      {chapter === 3 && (
        <>
          <Kicker>Fit the scope to the business</Kicker>
          <h1>Ways to buy the service</h1>
          <p className="sales-lead">
            A single category, a company website or a connected operation. Any budget conversation
            begins with priorities and a feasible first phase.
          </p>
          <div className="sales-card-grid">
            {OFFERS.map((o) => (
              <article className="sales-surface" key={o.name}>
                <h2>{o.name}</h2>
                <p>{o.scope}</p>
                <details>
                  <summary>Installation work & acceptance</summary>
                  <p>{o.work}</p>
                  <p>
                    <strong>Success check:</strong> {o.acceptance}
                  </p>
                </details>
              </article>
            ))}
          </div>
          <div className="sales-callout">
            <strong>Build a written proposal.</strong> Separate setup, catalogue/model preparation,
            website work, integrations, hosting, support, training and third-party services. Victor
            approves commercial terms. Do not promise every requested feature at any budget.
          </div>
          <details className="sales-details">
            <summary>Several companies around one project</summary>
            <p>
              A designer can coordinate a proposed brief involving furniture, paint, plumbing and
              installation. Agree a project owner and revision, each company’s catalogue ownership,
              client consent, who may see or change what, and who approves a purchase.
            </p>
            <p>
              Shared live editing, choice deadlines, stock reservation and automatic supplier orders
              require an agreed integration. Confirm a test workflow, failure handling and supplier
              acceptance before selling automation as operational.
            </p>
          </details>
        </>
      )}
      {chapter === 4 && (
        <>
          <Kicker>Employee as catalogue coordinator</Kicker>
          <h1>Onboard a company’s products</h1>
          <p className="sales-lead">
            Start with permission and verified dimensions. A small, checked catalogue is more useful
            than a large unverified import.
          </p>
          <div className="sales-card-grid">
            {ONBOARDING.map(([title, body], i) => (
              <article className="sales-surface" key={title}>
                <span className="sales-number">{String(i + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="sales-actions">
            <OpenLink href="/studio/merchants/connect">Open catalogue preparation</OpenLink>
            <button
              onClick={() =>
                downloadText(
                  'Product-Onboarding-Checklist.md',
                  `# Room Designer product onboarding\n\n${ONBOARDING.map(([t, b], i) => `${i + 1}. ${t}\n${b}`).join('\n\n')}`,
                )
              }
            >
              Download checklist
            </button>
          </div>
        </>
      )}
      {chapter === 5 && (
        <>
          <Kicker>Adapt, review, then send through your approved channel</Kicker>
          <h1>The first conversation</h1>
          <div className="sales-workbench">
            <nav className="sales-menu" aria-label="Outreach templates">
              {SCRIPTS.map((s, i) => (
                <button
                  key={s.name}
                  aria-pressed={script === i}
                  onClick={() => {
                    setScript(i);
                    setNotice('');
                  }}
                >
                  {s.name}
                </button>
              ))}
            </nav>
            <article className="sales-surface">
              <h2>{SCRIPTS[script].name}</h2>
              <textarea
                className="sales-script"
                aria-label="Outreach template"
                readOnly
                value={text}
              />
              <div className="sales-actions">
                <button className="sales-primary" onClick={() => void copy()}>
                  Copy template
                </button>
                <button onClick={() => downloadText('Room-Designer-Outreach.md', text)}>
                  Download template
                </button>
              </div>
              <p role="status">{notice}</p>
              <p className="sales-note">
                Replace every placeholder, verify the demo and obtain the usual outreach approval.
                These buttons do not email or message anyone. Record consent and the agreed
                follow-up in the approved company system.
              </p>
            </article>
          </div>
        </>
      )}
      {chapter === 6 && (
        <>
          <Kicker>Preparation worksheet · stays in this page</Kicker>
          <h1>A brief Victor can act on</h1>
          <p className="sales-lead">
            Use fictional details for practice. Capture real prospects in your approved CRM. These
            fields do not submit, autosave or create a meeting.
          </p>
          <div className="sales-form">
            {DISCOVERY.map((label) => (
              <label key={label}>
                {label}
                <textarea
                  rows={2}
                  value={answers[label] ?? ''}
                  maxLength={1200}
                  onChange={(e) => setAnswers({ ...answers, [label]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="sales-actions">
            <button
              className="sales-primary"
              onClick={() =>
                downloadText(
                  'Room-Designer-Discovery-Draft.md',
                  `# Room Designer discovery draft\nNot submitted.\n\n${DISCOVERY.map((x) => `## ${x}\n${answers[x] || '[To discuss]'}`).join('\n\n')}\n\nBook: ${MEETING}`,
                )
              }
            >
              Download my draft
            </button>
            <OpenLink href={MEETING}>Book a 1-hour meeting</OpenLink>
          </div>
          <details className="sales-details">
            <summary>Pipeline, objections and handover</summary>
            <p>
              Track: researched, contact authorized, contacted, discovery, demo, scoped, proposal,
              approved pilot, implementation and review. Give each stage a next owner and date.
            </p>
            <ul className="sales-list">
              <li>“We have a website”: offer one embedded task and check its platform.</li>
              <li>
                “We only need furniture”: scope a furniture catalogue and 2D, with optional 3D.
              </li>
              <li>“Our budget is small”: reduce the first phase and defer integrations.</li>
              <li>
                “We need exact models”: request reviewed manufacturer assets and usage rights.
              </li>
              <li>
                “Can it order automatically?”: map authorization and supplier systems before
                committing.
              </li>
            </ul>
            <p>
              Handover includes the business need, observed demo, data rights, assumptions,
              exclusions, success check, responsible people and next date. Confirm installation
              scope in writing before work starts.
            </p>
          </details>
        </>
      )}
      {chapter === 7 && (
        <>
          <Kicker>Share the right destination</Kicker>
          <h1>Every link in one place</h1>
          <p className="sales-note">
            Links below use this deployment. Check them before sending. Public pitches and Demo are
            for prospects; Studio preparation may request access. MCP requires a compatible client.
            Access credentials are never included.
          </p>
          <div className="sales-links">
            {PACK_LINKS.map((l) => (
              <article key={l.path}>
                <strong>{l.name}</strong>
                <a href={l.path} target="_blank" rel="noreferrer">
                  {origin}
                  {l.path}
                </a>
                <span>
                  {' '}
                  - Room Designer: {l.market}
                  {'api' in l ? ' (MCP endpoint, not a webpage)' : ''}
                </span>
              </article>
            ))}
            <article>
              <strong>One-hour meeting</strong>
              <a href={MEETING} target="_blank" rel="noreferrer">
                {MEETING}
              </a>
              <span> - Room Designer: all prospect markets</span>
            </article>
          </div>
          <div className="sales-actions">
            <button
              onClick={() =>
                downloadText('Room-Designer-Employee-Starter-Pack.md', handbook(origin))
              }
            >
              Download everything as a handbook
            </button>
          </div>
        </>
      )}
    </SalesShell>
  );
}
