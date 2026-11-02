import { lazy, Suspense, useState } from 'react';
import { EmbeddedDesigner } from '../../demo/EmbeddedDesigner';
import { BUILDING_SERVICES_SOURCES } from '../../data/buildingServicesCatalog';
import { Kicker, OpenLink, SalesShell } from './SalesShell';
import { useChapter } from './salesNavigation';
import { MEETING } from './salesPack';
import hero from './plumbingHero.json';

const PlumbingEnquiryForm = lazy(() => import('./PlumbingEnquiryForm'));

const CHAPTERS = [
  'The opportunity',
  'Try the tools',
  'Your catalogue',
  'Your website',
  'Work together',
  'Next step',
] as const;
export default function PlumbingPitchPage() {
  const [chapter, select] = useChapter(CHAPTERS);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  return (
    <SalesShell kind="plumbing" names={CHAPTERS} chapter={chapter} select={select}>
      {chapter === 0 && (
        <div className="sales-hero">
          <div>
            <Kicker>Plumbing suppliers · installers · bathroom showrooms</Kicker>
            <h1>
              A clearer picture.
              <br />
              <em>Before the quote.</em>
            </h1>
            <p className="sales-lead">
              Place fixtures, connect measured routes and review the same layout in 2D and 3D. Give
              customers a clearer picture and your technical team a useful starting brief.
            </p>
            <div className="sales-actions">
              <button className="sales-primary" onClick={() => select(1)}>
                Explore the working demo →
              </button>
              <OpenLink href={MEETING}>Discuss your business</OpenLink>
            </div>
            <p className="sales-note">
              Connected pipework, ventilation, fire-water and data routes are available to explore.
              Your qualified team still sizes, specifies and approves each system.
            </p>
          </div>
          <figure className="sales-shot">
            <img
              src={hero.src}
              srcSet={hero.srcSet}
              sizes={hero.sizes}
              width={hero.width}
              height={hero.height}
              {...{ fetchpriority: 'high' }}
              decoding="async"
              alt="Actual Room Designer Plumbing and Electric workspace, with a measured floor, sink, toilet and coloured service routes"
            />
            <figcaption>
              <span>Actual 2D app capture</span> Floor-specific fixtures and measured service routes
            </figcaption>
          </figure>
          <div className="sales-wide sales-three">
            <article>
              <span className="sales-number">01</span>
              <h2 className="sales-card-heading">Showroom consultation</h2>
              <p>
                Place the fixtures with the customer and discuss space before producing a quotation.
              </p>
            </article>
            <article>
              <span className="sales-number">02</span>
              <h2 className="sales-card-heading">Installer handover</h2>
              <p>
                Review the proposed routes, level and assumptions with the person who will specify
                the work.
              </p>
            </article>
            <article>
              <span className="sales-number">03</span>
              <h2 className="sales-card-heading">Product conversation</h2>
              <p>
                Bring published material references into the discussion and confirm the required
                specification.
              </p>
            </article>
          </div>
        </div>
      )}
      {chapter === 1 && (
        <>
          <div className="sales-heading">
            <div>
              <Kicker>Use the software here</Kicker>
              <h1>A bathroom planning session</h1>
            </div>
            <OpenLink href="/demo?view=2d&panel=services&pitch=1">Open full-size demo</OpenLink>
          </div>
          <div className="sales-live-layout">
            <aside className="sales-surface">
              <ol className="sales-steps">
                <li>
                  <strong>Choose the floor</strong>
                  <span>
                    Use Floors to keep each level separate and return to your original 2D or 3D
                    view.
                  </span>
                </li>
                <li>
                  <strong>Place the fixtures</strong>
                  <span>Add a sink, toilet and mains tap. Inspect the editable sizes.</span>
                </li>
                <li>
                  <strong>Connect in 2D or 3D</strong>
                  <span>
                    Choose 2D plan or 3D edit. Draw a route, connect compatible fixture ports or an
                    existing route node, then Finish. Crossing lines alone do not create a junction.
                  </span>
                </li>
                <li>
                  <strong>Move, measure, review</strong>
                  <span>
                    Move or rotate a connected fixture: linked endpoints follow it. Drag route
                    nodes, set their elevations and review measured lengths and connection warnings.
                  </span>
                </li>
              </ol>
              <p className="sales-note">
                Ports are schematic. Drainage needs surveyed elevations; another floor needs a
                separately measured riser. This is not a hydraulic simulation. Pipe sizing, falls,
                fittings and compliance require installer review.
              </p>
            </aside>
            <div className="sales-demo">
              {live ? (
                <EmbeddedDesigner
                  scene="home"
                  view={mode}
                  onViewChange={setMode}
                  panel="services"
                  pitch
                  title="Working 2D and 3D building services planner"
                  loading="eager"
                />
              ) : (
                <button className="sales-start-demo" onClick={() => setLive(true)}>
                  <img
                    src="/showcase/building-services-3d.jpg"
                    width={1280}
                    height={900}
                    decoding="async"
                    alt="Actual Building services 3D editor with measured pipe routes, raised equipment and editable dimensions"
                  />
                  <span>Launch interactive workspace →</span>
                </button>
              )}
              <p>
                Actual 3D editor capture. Practice demo opens in 2D; choose 3D edit. No orders or
                payments.
              </p>
            </div>
          </div>
        </>
      )}
      {chapter === 2 && (
        <>
          <Kicker>Supplier data with visible assumptions</Kicker>
          <h1>Your products, in context</h1>
          <div className="sales-three">
            <article className="sales-surface">
              <span className="sales-status">In this build</span>
              <h2>Published references</h2>
              <p>
                Water, drainage and conduit presets include HPL Pipes and Espace Maison references.
                Explore ventilation, refrigerant, fire-water and data materials too. Open each
                source to confirm size, application and supply length.
              </p>
              <p>
                Try Resiglas tanks and Espace Maison toilet, sink, bidet, garden sofa, PVC pipe and
                conduit examples. Published outer dimensions drive paired 2D and 3D objects.
              </p>
              <p className="sales-note">
                Models are dimensional illustrations, not manufacturer CAD. Tank capacity, pipe
                bore, ports and installation clearances need separate checks. Manufacturer
                references do not confirm Mauritius availability; verify local supply and
                quotations.
              </p>
            </article>
            <article className="sales-surface">
              <span className="sales-status">Merchant setup</span>
              <h2>Your catalogue</h2>
              <p>
                Prepare approved product identifiers, dimensions, images and specifications. The
                catalogue wizard validates a small batch before an authorized merchant publishes it.
              </p>
              <p className="sales-note">
                Service-material presets and specialist product models require their own mapping.
                The generic catalogue importer does not automatically build a plumbing
                specification.
              </p>
            </article>
            <article className="sales-surface">
              <span className="sales-status">Scope with your team</span>
              <h2>A maintained connection</h2>
              <p>
                Agree who updates the catalogue and when. A stock feed, order-system connection and
                exact manufacturer models form a separate implementation scope.
              </p>
              <p className="sales-note">
                These examples do not indicate a supplier partnership, endorsement or live
                inventory.
              </p>
            </article>
          </div>
          <details className="sales-details">
            <summary>Supplier reference documents</summary>
            <div className="sales-links">
              {BUILDING_SERVICES_SOURCES.slice(0, 2).map((s) => (
                <article key={s.supplier}>
                  <strong>{s.supplier}</strong>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.url}
                  </a>
                  <span>
                    {' '}
                    - Room Designer: plumbing material references, reviewed {s.checkedAt}
                  </span>
                </article>
              ))}
            </div>
          </details>
          <div className="sales-actions">
            <OpenLink href="/studio/merchants/connect">Explore catalogue preparation</OpenLink>
          </div>
        </>
      )}
      {chapter === 3 && (
        <>
          <Kicker>Choose the part that fits your business</Kicker>
          <h1>A planner on your terms</h1>
          <div className="sales-card-grid">
            <article className="sales-surface">
              <h2>2D service planning</h2>
              <p>A focused consultation tool for fixture positions, routes and measured lengths.</p>
              <OpenLink href="/demo?view=2d&panel=services&pitch=1">Try 2D services</OpenLink>
            </article>
            <article className="sales-surface">
              <h2>3D route editing</h2>
              <p>
                Inspect routes in space, move their nodes and compare the fixtures with the
                building. Open Building services and choose 3D edit.
              </p>
              <OpenLink href="/demo?view=3d&panel=services&pitch=1">
                Open services → 3D edit
              </OpenLink>
            </article>
            <article className="sales-surface">
              <h2>Both views, one design</h2>
              <p>
                One measured model feeds both views. Layers can isolate plumbing, electrical,
                ventilation &amp; AC, fire protection or cameras &amp; data without deleting
                objects.
              </p>
              <p className="sales-note">
                Coordinate layouts and quantities. Capacity, coverage and regulatory approval remain
                specialist work.
              </p>
            </article>
          </div>
          <div className="sales-surface sales-choice">
            <h2 className="sales-card-heading">Installation options</h2>
            <p>
              Embed a focused experience in your existing website. Run a standalone studio with an
              optional shop. Use it internally with advisers. Or commission a full website around
              the customer journey.
            </p>
            <p className="sales-note">
              Branding, permitted categories, catalogue filters, domains, accounts and purchasing
              connections need an agreed setup. We scope a feasible first phase around your budget
              and priorities.
            </p>
          </div>
        </>
      )}
      {chapter === 4 && (
        <>
          <Kicker>Proposed connected workflow</Kicker>
          <h1>A shared project brief</h1>
          <p className="sales-lead">
            A customer, designer, installer and supplier can work toward the same approved plan. The
            connected workflow begins with clear responsibilities.
          </p>
          <div className="sales-four">
            {[
              ['Customer', 'Explores choices and confirms the preferred layout.'],
              ['Designer / adviser', 'Coordinates dimensions, products and the project revision.'],
              ['Installer', 'Checks sizing, falls, clearances and installation requirements.'],
              ['Supplier', 'Confirms specification, stock, quotation and accepted delivery date.'],
            ].map(([t, b], i) => (
              <article className="sales-surface" key={t}>
                <span className="sales-number">0{i + 1}</span>
                <h2 className="sales-card-heading">{t}</h2>
                <p>{b}</p>
              </article>
            ))}
          </div>
          <div className="sales-three sales-choice">
            <article>
              <h2 className="sales-card-heading">Coordinate below ground</h2>
              <p>
                Use Floors → Foundation for rectangular excavations or circular holes with explicit
                diameter and depth. Review separate excavation and concrete volumes alongside
                routes. Overlapping circular excavation totals are withheld for review.
              </p>
              <p className="sales-note">
                Measured coordination; not a pile design or excavation method.
              </p>
              <OpenLink href="/demo?view=2d&panel=foundation&pitch=1">
                Try foundation planning
              </OpenLink>
            </article>
            <article>
              <h2 className="sales-card-heading">Follow the house guide</h2>
              <p>
                Open Guide in the plan toolbar for a saved checklist from the brief and foundations
                through services, finishes and review. Each step opens its existing tool, then gets
                out of the way.
              </p>
              <OpenLink href="/demo?view=2d&pitch=1">Open demo → House guide</OpenLink>
              <p className="sales-note">
                A project review guide, not construction instructions or approval.
              </p>
            </article>
            <article>
              <h2 className="sales-card-heading">Configure and test connections</h2>
              <p>
                Scope your catalogue, staff permissions, commerce backend and supplier feeds. Agree
                approval deadlines and delivery responsibilities before enabling purchasing.
              </p>
              <OpenLink href="/demo?panel=project&pitch=1">Explore the project hub</OpenLink>
            </article>
          </div>
          <p className="sales-callout">
            The current demo does not automatically share edits between companies, place orders,
            reserve stock or book installers. Agree and test those connections before activating
            them.
          </p>
        </>
      )}
      {chapter === 5 && (
        <div className="sales-contact">
          <aside>
            <Kicker>A small pilot, a measurable result</Kicker>
            <h1>
              Your first
              <br />
              <em>planning session.</em>
            </h1>
            <p className="sales-lead">
              Bring one typical bathroom layout, a permitted product sample and the person who owns
              your quotations or catalogue.
            </p>
            <ol className="sales-list">
              <li>Choose the customer task and staff users.</li>
              <li>Agree 2D, 3D or both and the installation option.</li>
              <li>Check product data and required integrations.</li>
              <li>Define a trial and success criteria before a written proposal.</li>
            </ol>
            <OpenLink href={MEETING}>Book a 1-hour meeting</OpenLink>
            <p className="sales-note">
              Use the form to request a physical meeting or share feedback. It saves a business
              enquiry for the team; it does not book a time or place an order.
            </p>
          </aside>
          <div className="sales-surface pitch-app sales-contact-form">
            <Suspense fallback={<p role="status">Loading form…</p>}>
              <PlumbingEnquiryForm />
            </Suspense>
          </div>
        </div>
      )}
    </SalesShell>
  );
}
