import { useEffect, useState } from 'react';
import { EmbeddedDesigner } from '../../demo/EmbeddedDesigner';
import {
  CONSTRUCTION_FOOTER, CONSTRUCTION_MEETING_URL, CONSTRUCTION_SHOTS, MATERIALS_NOTE, STARTING_POINT,
} from './constructionWorkflow';
import './constructionPitch.css';

function Shot({ desktop, phone, alt }: { desktop: string; phone?: string; alt: string }) {
  const image = <img src={desktop} alt={alt} />;
  return <figure className="c-shot">{phone
    ? <picture><source media="(max-width: 768px)" srcSet={phone} />{image}</picture>
    : image}</figure>;
}

function Person({ src, alt, tone = false }: { src: string; alt: string; tone?: boolean }) {
  return <figure className={`c-portrait${tone ? ' is-toned' : ''}`}><img src={src} alt={alt} /></figure>;
}

function TryStep({ title, path }: { title: string; path: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <iframe className="c-frame" title={title} src={path} />;
  return <div className="c-try"><p>Open the designer and try this step there.</p><button type="button" onClick={() => setOpen(true)}>Try this step</button></div>;
}

function HouseDemo() {
  const [view, setView] = useState<'2d' | '3d'>('3d');
  return <div className="c-demo">
    <div className="c-segment" role="group" aria-label="House view">
      <button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D</button>
      <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button>
    </div>
    <EmbeddedDesigner scene="home" view={view} onViewChange={setView} pitch title="Live house in 2D and 3D" />
    <p className="c-note">{STARTING_POINT}</p>
  </div>;
}

/** Scrolling construction pitch. Developer and merchant pitches keep the tabbed shell. */
export default function ConstructionPitchPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Construction | PPW Studio';
    return () => { document.title = previous; };
  }, []);
  return <main className="c-pitch">
    <header className="c-top">
      <div className="c-wrap c-top-row">
        <a className="c-brand" href="/pitch/construction">PPW Studio</a>
        <nav aria-label="Other pitches">
          <a href="/pitch/developers">For developers</a>
          <a href="/pitch/merchants">For merchants</a>
        </nav>
      </div>
    </header>

    <section className="c-section c-hero">
      <div className="c-wrap">
        <div className="c-hero-shots">
          <Shot desktop={CONSTRUCTION_SHOTS.house2d} phone={CONSTRUCTION_SHOTS.house2dPhone} alt="Room Designer 2D plan of the sample house" />
          <Shot desktop={CONSTRUCTION_SHOTS.house3d} phone={CONSTRUCTION_SHOTS.house3dPhone} alt="Room Designer 3D view of the sample house" />
        </div>
        <p className="c-kicker">Mauritius · contractors, quantity surveyors, plumbers and developers</p>
        <h1>A floor plan becomes cement, sand and a layout for each floor.</h1>
        <p className="c-lead">One measured design connects the house, material quantities and service routes. Review the assumptions with your team before a supplier quote or site decision.</p>
        <h2>How it works</h2>
        <ol className="c-steps">
          <li><a href="#plan-import">The plan comes in.</a></li>
          <li><a href="#house">The house, in 2D and in 3D.</a></li>
          <li><a href="#materials">Blocks, cement and sand.</a></li>
          <li><a href="#foundation">Foundation dimensions and depth.</a></li>
          <li><a href="#plumbing">Plumbing and electric floors.</a></li>
        </ol>
      </div>
    </section>

    <section className="c-section" id="plan-import">
      <div className="c-wrap c-chapter c-chapter-step">
        <Person src="/pitch/construction/people/ravi.webp" alt="Ravi, contractor" tone />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status">new, in preview</span> Plan import</p>
          <p className="c-line">The plan comes in, and the build starts from that drawing.</p>
        </div>
        <div className="c-demo"><TryStep title="Try plan import" path="/demo?view=2d&panel=import&pitch=1" /><p className="c-note">{STARTING_POINT}</p></div>
      </div>
    </section>

    <section className="c-section" id="house">
      <div className="c-wrap c-chapter">
        <Person src="/pitch/construction/people/ravi.webp" alt="Ravi, contractor" tone />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status is-live">Live</span> House</p>
          <p className="c-line">The same house, in 2D and in 3D.</p>
          <p>Close a polygon against existing walls to form an adjoining room or partition. Shared edges need no redraw. Floors and Materials stay directly accessible in the plan.</p>
        </div>
        <div className="c-shots">
          <Shot desktop={CONSTRUCTION_SHOTS.house2d} phone={CONSTRUCTION_SHOTS.house2dPhone} alt="Room Designer 2D plan of the sample house" />
          <Shot desktop={CONSTRUCTION_SHOTS.house3d} phone={CONSTRUCTION_SHOTS.house3dPhone} alt="Room Designer 3D view of the sample house" />
        </div>
        <HouseDemo />
      </div>
    </section>

    <section className="c-section" id="materials">
      <div className="c-wrap c-chapter">
        <Person src="/pitch/construction/people/leena.webp" alt="Leena, quantity surveyor" />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status is-live">Live</span> Materials</p>
          <p className="c-line">Blocks, cement and sand, with selectable mix ratios, pack sizes and waste.</p>
          <p>Physical wall quantities and painted faces use their own measurements. Paint coats change coverage demand; whole tins may round differently. Choose site-mixed ingredients or ready-mix for concrete, so alternatives are not counted twice.</p>
          <p className="c-warning">{MATERIALS_NOTE}</p>
        </div>
        <div className="c-shots">
          <Shot desktop={CONSTRUCTION_SHOTS.materialsWarning} alt="Materials quantities for blocks, cement and sand beside the full warning" />
          <Shot desktop={CONSTRUCTION_SHOTS.materials} phone={CONSTRUCTION_SHOTS.materialsPhone} alt="Materials list for blocks, cement and sand" />
          <Shot desktop={CONSTRUCTION_SHOTS.materialsReport} alt="Materials report for the sample house" />
        </div>
        <div className="c-demo">
          <EmbeddedDesigner scene="home" view="2d" panel="materials" pitch loading="lazy" title="Live materials for blocks, cement and sand" />
          <p className="c-note">{STARTING_POINT}</p>
        </div>
      </div>
    </section>

    <section className="c-section" id="foundation">
      <div className="c-wrap c-foundation">
        <p className="c-kicker"><span className="c-status is-live">Live</span> Foundations</p>
        <h2>Measure the excavation. Add the concrete.</h2>
        <p className="c-lead">Choose Floors → Foundation. Draw the excavation, set its depth and inspect the cutaway. Add concrete when ready to review the filled design: excavation, fill and remaining void have separate volumes. Overlapping concrete is counted once.</p>
        <p>Compare a UBP / Premix ready-mix reference with editable site-mix ratios; the supplier confirms grade, suitability and quotation. Enter an engineer’s rebar schedule for the steel allowance. Choosing a building floor returns to your original 2D or 3D view.</p>
        <p className="c-warning">This estimates entered geometry; it does not design or approve foundations. Ground conditions, loading, reinforcement and service penetrations need professional specification. Unresolved overlapping steel is withheld for review.</p>
        <div className="c-demo"><TryStep title="Try measured foundations" path="/demo?view=2d&panel=foundation&pitch=1" /></div>
      </div>
    </section>

    <section className="c-section" id="plumbing">
      <div className="c-wrap c-chapter c-chapter-step">
        <Person src="/pitch/construction/people/marc.webp" alt="Marc, plumber" />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status">new, in preview</span> Plumbing</p>
          <p className="c-line">A plumbing layout for each floor.</p>
          <p>Attach route endpoints to compatible fixture ports. Linked routes follow fixture moves and rotation; incomplete connections stay visible. Surveyed drainage levels and separately measured risers need installer review. Floors remains available while editing services and returns you to the view you entered from.</p>
        </div>
        <div className="c-demo"><TryStep title="Try the plumbing floor" path="/demo?view=2d&panel=services&pitch=1" /><p className="c-note">{STARTING_POINT}</p></div>
      </div>
    </section>

    <section className="c-section" id="electric">
      <div className="c-wrap c-chapter c-chapter-step">
        <Person src="/pitch/construction/people/sophie.webp" alt="Sophie, site manager" tone />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status">new, in preview</span> Electric</p>
          <p className="c-line">The electric floor follows the same plan.</p>
          <p>Plan conduit routes beside the same fixtures and walls. Sourced tanks, sanitaryware, pipe stock and electrical enclosures share published outer dimensions in 2D and 3D. Espace Maison sink, bidet and garden-sofa examples join the catalogue; their illustrations are not exact manufacturer models.</p>
          <p className="c-note">Quote-required items need supplier confirmation. No live inventory is implied. Schematic ports and stock objects do not establish installation clearances, automatic route connections or electrical compliance.</p>
        </div>
        <div className="c-demo"><TryStep title="Try the electric floor" path="/demo?view=2d&panel=services&pitch=1" /><p className="c-note">{STARTING_POINT}</p></div>
      </div>
    </section>

    <section className="c-section" id="connect">
      <div className="c-wrap">
        <h2>One reviewable brief for your team.</h2>
        <div className="c-map">
          <p className="c-node"><strong>Client</strong> Moves a wall. The 2D plan and the 3D house update. <em>Live</em></p>
          <p className="c-plan">Design brief</p>
          <p className="c-node"><strong>Designer</strong> Reviews the layout, dimensions and agreed revision.</p>
          <p className="c-node"><strong>Merchant / supplier</strong> Confirms product specification, availability and a quotation.</p>
          <p className="c-node"><strong>Materials</strong> Recalculates blocks, cement and sand. <em>Live</em></p>
          <p className="c-node"><strong>Contractor</strong> Checks quantities and site conditions with the team.</p>
          <p className="c-node"><strong>Plumber / electrician</strong> Plumbing and electric floors follow the plan. <em>new, in preview</em></p>
          <p className="c-node c-workers"><strong>Workers</strong> Work from professionally approved drawings and installation instructions.</p>
        </div>
        <p className="c-note">Design edits and quantity updates work within the current session. Shared company access, approval roles, live co-editing, orders and delivery scheduling require agreed integrations; this demo activates none of them.</p>
      </div>
    </section>

    <section className="c-section c-close">
      <div className="c-wrap">
        <a className="c-meeting" href={CONSTRUCTION_MEETING_URL} target="_blank" rel="noreferrer">Book a meeting with a Live Demo</a>
        <p className="c-footer">{CONSTRUCTION_FOOTER}</p>
      </div>
    </section>
  </main>;
}
