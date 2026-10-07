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

function ComingShot({ slot }: { slot: string }) {
  return <div className="c-coming" data-slot={slot}>screenshot coming</div>;
}

function Person({ src, alt, tone = false }: { src: string; alt: string; tone?: boolean }) {
  return <figure className={`c-portrait${tone ? ' is-toned' : ''}`}><img src={src} alt={alt} /></figure>;
}

function TryStep({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <iframe className="c-frame" title={title} src="/demo?pitch=1" />;
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
        <p className="c-lead">The same drawing feeds the quantities and the services layout, so quotes are faster and the site has fewer mistakes. Built around what the client needs and their budget.</p>
        <h2>How it works</h2>
        <ol className="c-steps">
          <li><a href="#plan-import">The plan comes in.</a></li>
          <li><a href="#house">The house, in 2D and in 3D.</a></li>
          <li><a href="#materials">Blocks, cement and sand.</a></li>
          <li><a href="#plumbing">Plumbing and electric floors.</a></li>
        </ol>
      </div>
    </section>

    <section className="c-section" id="plan-import">
      <div className="c-wrap c-chapter">
        <Person src="/pitch/construction/people/ravi.webp" alt="Ravi, contractor" tone />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status">new, in preview</span> Plan import</p>
          <p className="c-line">The plan comes in, and the build starts from that drawing.</p>
        </div>
        <ComingShot slot="plan-import" />
        <div className="c-demo"><TryStep title="Try plan import" /><p className="c-note">{STARTING_POINT}</p></div>
      </div>
    </section>

    <section className="c-section" id="house">
      <div className="c-wrap c-chapter">
        <Person src="/pitch/construction/people/ravi.webp" alt="Ravi, contractor" tone />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status is-live">Live</span> House</p>
          <p className="c-line">The same house, in 2D and in 3D.</p>
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
          <p className="c-line">Blocks, cement and sand, with cement in kilograms and 25 kg bags.</p>
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

    <section className="c-section" id="plumbing">
      <div className="c-wrap c-chapter">
        <Person src="/pitch/construction/people/marc.webp" alt="Marc, plumber" />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status">new, in preview</span> Plumbing</p>
          <p className="c-line">A plumbing layout for each floor.</p>
        </div>
        <ComingShot slot="plumbing" />
        <div className="c-demo"><TryStep title="Try the plumbing floor" /><p className="c-note">{STARTING_POINT}</p></div>
      </div>
    </section>

    <section className="c-section" id="electric">
      <div className="c-wrap c-chapter">
        <Person src="/pitch/construction/people/sophie.webp" alt="Sophie, site manager" tone />
        <div className="c-copy">
          <p className="c-kicker"><span className="c-status">new, in preview</span> Electric</p>
          <p className="c-line">The electric floor follows the same plan.</p>
        </div>
        <ComingShot slot="electric" />
        <div className="c-demo"><TryStep title="Try the electric floor" /><p className="c-note">{STARTING_POINT}</p></div>
      </div>
    </section>

    <section className="c-section" id="connect">
      <div className="c-wrap">
        <h2>Connects your suppliers, designer, customer and workers in one live build.</h2>
        <div className="c-map">
          <p className="c-node"><strong>Client</strong> Moves a wall. The 2D plan and the 3D house update. <em>Live</em></p>
          <p className="c-plan">Shared plan</p>
          <p className="c-node"><strong>Designer</strong> Works in that same plan.</p>
          <p className="c-node"><strong>Merchant / supplier</strong> Catalogue products stay in the plan at real sizes through the merchant connection. <em>Live</em></p>
          <p className="c-node"><strong>Materials</strong> Recalculates blocks, cement and sand. <em>Live</em></p>
          <p className="c-node"><strong>Contractor</strong> Reads the shared plan with the team.</p>
          <p className="c-node"><strong>Plumber / electrician</strong> Plumbing and electric floors follow the plan. <em>new, in preview</em></p>
          <p className="c-node c-workers"><strong>Workers</strong> Use the shared plan, the 3D view, the Materials list, and the plumbing and electric floors.</p>
        </div>
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
