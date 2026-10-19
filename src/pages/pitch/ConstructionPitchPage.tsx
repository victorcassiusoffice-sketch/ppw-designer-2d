import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { OlbLockup } from '../../brand/OlbLockup';
import { MERCHANT_FURNITURE_REFERENCES } from '../../data/merchantFurniture';
import { MEETING_URL } from './workflowModel';
import {
  DEFAULT_ECO_CONFIG,
  ECO_AUDIENCES,
  ECO_CHAPTERS,
  ECO_LOGISTICS,
  ECO_ROLES,
  ECO_SCENARIOS,
  ECO_TOOLS,
  ECO_THEMES,
  ecoSharePath,
  readEcoConfig,
} from './ecoCityPitchModel';
import './ecoCityPitch.css';

function Capture({ name, alt, className = '' }: { name: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`eco-capture ${className}`}>
      {failed ? (
        <div className="eco-image-unavailable">
          App capture unavailable. The explanation remains available below.
        </div>
      ) : (
        <img src={`/pitch/eco-city/${name}.webp`} alt={alt} onError={() => setFailed(true)} />
      )}
      <figcaption>Captured in One Live Build · {alt}</figcaption>
    </figure>
  );
}

/** A sales presentation, not an embedded editor. All rehearsal changes stay in React state. */
export default function ConstructionPitchPage() {
  const [config, setConfig] = useState(() =>
    readEcoConfig(typeof window === 'undefined' ? '' : window.location.search),
  );
  const [chapter, setChapter] = useState(0);
  const [customize, setCustomize] = useState(false);
  const [share, setShare] = useState(false);
  const [tool, setTool] = useState(0);
  const [role, setRole] = useState(0);
  const [revision, setRevision] = useState(1);
  const [step, setStep] = useState(0);
  const [eco, setEco] = useState<'carbon' | 'climate' | 'local'>('carbon');
  const [ai, setAi] = useState<'brief' | 'proposed' | 'reviewed'>('brief');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Eco-city & construction | One Live Build';
    return () => {
      document.title = previous;
    };
  }, []);
  const selectChapter = (index: number) => {
    setChapter(index);
    setCustomize(false);
    setShare(false);
    stage.current?.scrollTo?.({ top: 0 });
    if (typeof window !== 'undefined' && window.scrollY > 160) window.scrollTo({ top: 0 });
    tabs.current[index]?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? ECO_CHAPTERS.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + ECO_CHAPTERS.length) %
            ECO_CHAPTERS.length;
    selectChapter(next);
    tabs.current[next]?.focus();
  };
  const selectedTool = ECO_TOOLS[tool],
    selectedRole = ECO_ROLES[role],
    selectedStep = ECO_LOGISTICS[step];
  const shareUrl =
    typeof window === 'undefined'
      ? ecoSharePath(config)
      : `${window.location.origin}${ecoSharePath(config)}`;
  function exportBrief() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: 'one-live-build-pitch',
              version: 1,
              ...readEcoConfig(new URLSearchParams({ ...config }).toString()),
              presentation: shareUrl,
              scope: 'Presentation brief only; no project, orders or permissions created.',
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'one-live-build-pilot-brief.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className={`eco-pitch eco-theme-${config.theme}`}>
      <header className="eco-header">
        <a
          href="/pitch/eco-city"
          className="eco-brand"
          aria-label="One Live Build eco-city presentation"
        >
          <OlbLockup height={30} reverse={config.theme === 'graphite'} />
        </a>
        <span className="eco-header-label">From one home to a connected district</span>
        <button
          type="button"
          className="eco-quiet"
          aria-expanded={customize}
          onClick={() => {
            setCustomize(!customize);
            setShare(false);
          }}
        >
          Personalise
        </button>
        <a className="eco-cta" href={MEETING_URL} target="_blank" rel="noreferrer">
          Book a walkthrough <span aria-hidden="true">↗</span>
        </a>
      </header>
      {customize && (
        <section
          className="eco-personalise"
          aria-label="Personalise this presentation"
          data-testid="eco-customization"
        >
          <div className="eco-custom-fields">
            <label>
              Company
              <input
                maxLength={80}
                value={config.company}
                onChange={(event) => setConfig({ ...config, company: event.target.value })}
              />
            </label>
            <label>
              Project
              <input
                maxLength={80}
                value={config.project}
                onChange={(event) => setConfig({ ...config, project: event.target.value })}
              />
            </label>
            <label>
              Audience
              <select aria-label="Audience"
                value={config.audience}
                onChange={(event) =>
                  setConfig({ ...config, audience: event.target.value as typeof config.audience })
                }
              >
                {ECO_AUDIENCES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Scenario
              <select aria-label="Scenario"
                value={config.scenario}
                onChange={(event) =>
                  setConfig({ ...config, scenario: event.target.value as typeof config.scenario })
                }
              >
                {ECO_SCENARIOS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="eco-custom-actions">
            <div className="eco-switch" aria-label="Presentation palette">
              {ECO_THEMES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={config.theme === value}
                  onClick={() => setConfig({ ...config, theme: value })}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="eco-quiet"
              onClick={() => setConfig(DEFAULT_ECO_CONFIG)}
            >
              Reset
            </button>
            <button type="button" className="eco-cta" onClick={() => setCustomize(false)}>
              Done
            </button>
          </div>
          <p className="eco-note">
            Presentation labels only. Use public company and project names; a shared link contains
            these fields. No private project data is loaded.
          </p>
        </section>
      )}
      <nav className="eco-chapters" role="tablist" aria-label="Eco-city presentation chapters">
        {ECO_CHAPTERS.map((name, index) => (
          <button
            key={name}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`eco-tab-${index}`}
            aria-controls="eco-stage"
            aria-selected={chapter === index}
            tabIndex={chapter === index ? 0 : -1}
            onClick={() => selectChapter(index)}
            onKeyDown={(event) => navigate(event, index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            {name}
          </button>
        ))}
      </nav>
      <section
        ref={stage}
        className="eco-stage"
        id="eco-stage"
        role="tabpanel"
        aria-labelledby={`eco-tab-${chapter}`}
        tabIndex={0}
        data-testid="eco-chapter-stage"
      >
        {chapter === 0 && (
          <div className="eco-overview">
            <div className="eco-intro">
              <p className="eco-eyebrow">
                {config.company || 'Your team'} · {config.scenario}
              </p>
              <h1>
                One place.
                <br />
                Every part of{' '}
                <br />
                <em>the build.</em>
              </h1>
              <p className="eco-lead">
                Design the homes. Connect the infrastructure. Give every company a clear view of its
                part in the same project.
              </p>
              <p className="eco-project-name">{config.project || DEFAULT_ECO_CONFIG.project}</p>
              <button type="button" className="eco-cta" onClick={() => selectChapter(1)}>
                Explore the tools <span aria-hidden="true">→</span>
              </button>
              <p className="eco-note">
                An interactive walkthrough with real app captures. This presentation does not open
                the full design tools.
              </p>
            </div>
            <div className="eco-visual">
              <Capture name="city" alt="City planning with buildings, roads and utility networks" />
              <div className="eco-visual-label">
                <span className="eco-dot" />
                {config.scenario} <small>Measured planning, connected decisions</small>
              </div>
              <div className="eco-overview-nodes">
                <span>
                  <b>01</b> Design + measure
                </span>
                <span>
                  <b>02</b> Coordinate + review
                </span>
                <span>
                  <b>03</b> Prepare delivery
                </span>
              </div>
            </div>
            <div className="eco-scope-bar">
              <span>
                <b>Build tools</b>Working in the app
              </span>
              <span>
                <b>Team stations</b>Working local pilot
              </span>
              <span>
                <b>Shared cloud</b>Activation required
              </span>
              <span>
                <b>Orders + invoices</b>Reviewed plans, no dispatch
              </span>
            </div>
          </div>
        )}
        {chapter === 1 && (
          <div className="eco-toolbox">
            <div className="eco-chapter-heading">
              <p className="eco-eyebrow">One measured model · many disciplines</p>
              <h2>Every tool has a place.</h2>
              <p>
                Choose a workstream to see what it does, what it measures and where professional
                review starts.
              </p>
            </div>
            <div className="eco-tool-list" role="group" aria-label="Construction workstreams">
              {ECO_TOOLS.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={tool === index}
                  onClick={() => setTool(index)}
                >
                  <span aria-hidden="true">{item.glyph}</span>
                  {item.name}
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className="eco-tool-detail">
              <Capture key={selectedTool.shot} name={selectedTool.shot} alt={selectedTool.name} />
              <div className="eco-tool-copy">
                <h3>{selectedTool.title}</h3>
                <p>{selectedTool.detail}</p>
                <div className="eco-tags">
                  {selectedTool.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <details>
                  <summary>Measurements & review boundary</summary>
                  <p>{selectedTool.takeoff}</p>
                  <p className="eco-note">{selectedTool.limit}</p>
                </details>
              </div>
            </div>
          </div>
        )}
        {chapter === 2 && (
          <div className="eco-collaboration">
            <div className="eco-chapter-heading">
              <p className="eco-eyebrow">Multiple companies · one coordinated specification</p>
              <h2>A change has a destination.</h2>
              <p>
                Select a role. Then change the example wall to see how the same revision reaches
                every station.
              </p>
            </div>
            <div className="eco-topology">
              <div className="eco-topology-hub">
                <span>Shared project specification</span>
                <strong>Wall A · revision {revision}</strong>
                <p>{revision === 1 ? 'Reviewed concept' : 'Thickness changed · review required'}</p>
                <small>
                  Geometry · material · quantity · evidence
                  <br />
                  responsible party · delivery target · history
                </small>
                <button
                  type="button"
                  className="eco-cta"
                  onClick={() => setRevision((value) => (value === 1 ? 2 : 1))}
                >
                  {revision === 1 ? 'Rehearse a design change' : 'Reset example'}
                </button>
              </div>
              <div className="eco-role-orbit">
                {ECO_ROLES.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={role === index}
                    onClick={() => setRole(index)}
                  >
                    <span className="eco-role-node" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {item.title}
                    <small>{revision === 1 ? 'Current concept' : 'Revision 2 to review'}</small>
                  </button>
                ))}
              </div>
            </div>
            <aside className="eco-role-station" aria-live="polite">
              <div className="eco-station-head">
                <span className="eco-badge">Dashboard rehearsal</span>
                <span>Revision {revision}</span>
              </div>
              <h3>{selectedRole.title} station</h3>
              <dl>
                <div>
                  <dt>Reads</dt>
                  <dd>{selectedRole.reads}</dd>
                </div>
                <div>
                  <dt>Contributes</dt>
                  <dd>{selectedRole.writes}</dd>
                </div>
              </dl>
              <div className="eco-next-action">
                <span>Next action</span>
                <p>
                  {revision === 1
                    ? 'Review the concept and the responsibility assigned to your company.'
                    : selectedRole.action}
                </p>
              </div>
              <p className="eco-note">
                Role stations, comments, version history and acknowledgements exist in the local
                pilot. Shared company sign-in, persisted multi-user access and propagation need
                cloud activation. This rehearsal does not send updates.
              </p>
            </aside>
          </div>
        )}
        {chapter === 3 && (
          <div className="eco-logistics">
            <div className="eco-chapter-heading">
              <p className="eco-eyebrow">A dependency chain, not seven disconnected inboxes</p>
              <h2>
                Know what happens next.
                <br />
                <em>And what it is waiting for.</em>
              </h2>
            </div>
            <ol className="eco-flow" aria-label="Project logistics stages">
              {ECO_LOGISTICS.map((item, index) => (
                <li key={item.title}>
                  <button
                    type="button"
                    aria-pressed={step === index}
                    onClick={() => setStep(index)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {item.title}
                  </button>
                </li>
              ))}
            </ol>
            <div className="eco-logistics-detail" aria-live="polite">
              <div>
                <p className="eco-eyebrow">{selectedStep.owner}</p>
                <h3>{selectedStep.title}</h3>
                <dl>
                  <div>
                    <dt>Needs</dt>
                    <dd>{selectedStep.input}</dd>
                  </div>
                  <div>
                    <dt>Produces</dt>
                    <dd>{selectedStep.output}</dd>
                  </div>
                </dl>
              </div>
              <div className="eco-release-gate">
                <span>Proceed when</span>
                <strong>{selectedStep.gate}</strong>
                <p>
                  A changed design revision reopens its affected reviews. An agreed delivery date is
                  only useful when the supplier and site can meet it.
                </p>
              </div>
            </div>
            <div className="eco-logistics-bottom">
              <Capture
                name="coordination"
                alt="Project coordination and stakeholder work stations"
              />
              <div>
                <h3>The actual planning records</h3>
                <p>
                  The app records supplier equipment packages, units, quantities, order / invoice /
                  delivery dates and chosen recipient emails. Teams can export a reviewable
                  schedule.
                </p>
                <p className="eco-note">
                  Orders, invoices and email dispatch are not automated in this preview. Procurement
                  records require review; live supplier acceptance and sending need an agreed
                  integration. Site and handover steps explain the proposed operating workflow.
                </p>
              </div>
            </div>
          </div>
        )}
        {chapter === 4 && (
          <div className="eco-intelligence">
            <div className="eco-chapter-heading">
              <p className="eco-eyebrow">Evidence first · assistance with accountability</p>
              <h2>
                An eco-city needs more
                <br />
                than an eco label.
              </h2>
            </div>
            <section className="eco-evidence">
              <div className="eco-switch" aria-label="Sustainability evidence">
                {(['carbon', 'climate', 'local'] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={eco === value}
                    onClick={() => setEco(value)}
                  >
                    {value === 'carbon'
                      ? 'Carbon'
                      : value === 'climate'
                        ? 'Tropical climate'
                        : 'Local / import'}
                  </button>
                ))}
              </div>
              {eco === 'carbon' ? (
                <>
                  <h3>Unknown is not zero.</h3>
                  <p>
                    Compare component quantities with declared carbon factors and their boundaries.
                    Keep missing declarations visible so an attractive material cannot look
                    low-carbon simply because its evidence is absent.
                  </p>
                  <div className="eco-equation">
                    <span>Quantity</span>
                    <b>×</b>
                    <span>Verified factor</span>
                    <b>→</b>
                    <span>Declared impact</span>
                  </div>
                </>
              ) : eco === 'climate' ? (
                <>
                  <h3>Ask what the climate changes.</h3>
                  <p>
                    Screen moisture and condensation assumptions, drying allowances and material
                    thresholds. Review windward / leeward exposure, water demand and maintenance for
                    living surfaces.
                  </p>
                  <div className="eco-equation">
                    <span>Climate inputs</span>
                    <b>+</b>
                    <span>Material evidence</span>
                    <b>→</b>
                    <span>Review flags</span>
                  </div>
                </>
              ) : (
                <>
                  <h3>Local does not automatically mean lower impact.</h3>
                  <p>
                    Compare on-island and imported candidates using documented origin, availability,
                    transport assumptions and performance. Mycelium or hemp can be research
                    candidates; local manufacture is not assumed.
                  </p>
                  <div className="eco-equation">
                    <span>Origin + transport</span>
                    <b>+</b>
                    <span>Suitability</span>
                    <b>→</b>
                    <span>Evidence to compare</span>
                  </div>
                </>
              )}
              <details>
                <summary>What else can the team screen?</summary>
                <p>
                  Trees and structural interfaces; water storage; solar and energy scenarios;
                  surface technology by area, including moss, piezoelectric surfaces and
                  traffic-turbine studies. Inputs and evidence determine whether a comparison is
                  meaningful.
                </p>
                <p className="eco-note">
                  Screening supports specialist review. It is not a whole-building hygrothermal
                  simulation, certified carbon assessment, energy guarantee or structural sign-off.
                </p>
              </details>
            </section>
            <section className="eco-ai">
              <span className="eco-badge">AI workflow rehearsal</span>
              <h3>
                A draft you can inspect.
                <br />A decision you control.
              </h3>
              <ol>
                <li data-active={ai === 'brief'}>
                  <b>01</b>
                  <span>
                    <strong>Brief</strong>Describe the intended space and constraints.
                  </span>
                </li>
                <li data-active={ai === 'proposed'}>
                  <b>02</b>
                  <span>
                    <strong>Propose</strong>Inspect the generated layout or structured change.
                  </span>
                </li>
                <li data-active={ai === 'reviewed'}>
                  <b>03</b>
                  <span>
                    <strong>Review</strong>Check scale, quantities, evidence and undo.
                  </span>
                </li>
                <li>
                  <b>04</b>
                  <span>
                    <strong>Approve separately</strong>Qualified team review before procurement or
                    site use.
                  </span>
                </li>
              </ol>
              <div className="eco-ai-response" aria-live="polite">
                {ai === 'brief'
                  ? 'Example brief: a shaded neighbourhood with shared green space, clear service routes and low operational demand.'
                  : ai === 'proposed'
                    ? 'Illustrative proposal: compare building placement, identify service corridors and list the missing solar, soil and supplier evidence. This is scripted presentation text, not an AI request.'
                    : 'Review rehearsal complete. No design, supplier order or approval was changed by this presentation.'}
              </div>
              <div className="eco-ai-actions">
                <button
                  type="button"
                  className="eco-cta"
                  onClick={() =>
                    setAi(ai === 'brief' ? 'proposed' : ai === 'proposed' ? 'reviewed' : 'brief')
                  }
                >
                  {ai === 'brief'
                    ? 'Show an example proposal'
                    : ai === 'proposed'
                      ? 'Review the example'
                      : 'Start again'}
                </button>
                {ai !== 'brief' && (
                  <button type="button" className="eco-quiet" onClick={() => setAi('brief')}>
                    Discard example
                  </button>
                )}
              </div>
              <p className="eco-note">
                Guided layout drafts and an AI workspace exist in the app. AI providers and MCP
                clients require configuration and permissions. The presentation uses no AI service
                or paid request.
              </p>
            </section>
          </div>
        )}
        {chapter === 5 && (
          <div className="eco-products">
            <div className="eco-chapter-heading">
              <p className="eco-eyebrow">Real supplier references · shared scale in both views</p>
              <h2>
                A product should belong
                <br />
                to the real world.
              </h2>
              <p>
                Use the merchant’s stated envelope to plan the space. Keep the source and the
                modelling limit attached to it.
              </p>
            </div>
            <Capture name="products" alt="Courts Mammouth and Espace Maison furniture in the app" />
            <div className="eco-product-cards">
              {MERCHANT_FURNITURE_REFERENCES.map((product) => (
                <article key={product.productId}>
                  <p className="eco-eyebrow">{product.supplier}</p>
                  <h3>{product.name}</h3>
                  <p className="eco-dimensions">
                    {product.dimensionsCm.length} × {product.dimensionsCm.width} ×{' '}
                    {product.dimensionsCm.height} cm <small>W × D × H</small>
                  </p>
                  <p>{product.materialSummary}</p>
                  <a href={product.sourceUrl} target="_blank" rel="noreferrer">
                    Supplier product reference ↗
                  </a>
                  <p className="eco-note">
                    {product.representation} {product.orderingNote}
                  </p>
                </article>
              ))}
            </div>
            <p className="eco-note">
              Measured parametric representations, not manufacturer CAD or guaranteed photographic
              likeness. Supplier references do not imply a partnership, live stock or an approved
              order. New merchants need verified dimensions and product evidence before onboarding.
            </p>
          </div>
        )}
        {chapter === 6 && (
          <div className="eco-pilot">
            <div className="eco-intro">
              <p className="eco-eyebrow">
                {config.company || 'Your team'} · {config.audience}
              </p>
              <h2>
                Start with one real project.
                <br />
                <em>Build the connections around it.</em>
              </h2>
              <p className="eco-lead">
                Choose the workflows your team needs: furniture-only, a 2D planning embed, the full
                2D / 3D designer or a project coordination station.
              </p>
              <div className="eco-pilot-actions">
                <button
                  type="button"
                  className="eco-quiet"
                  onClick={() => {
                    setCustomize(true);
                    if (typeof window !== 'undefined' && window.scrollY > 160)
                      window.scrollTo({ top: 0 });
                  }}
                >
                  Personalise this presentation
                </button>
                <button
                  type="button"
                  className="eco-quiet"
                  onClick={() => setShare(!share)}
                  aria-expanded={share}
                >
                  Share this version
                </button>
                <button type="button" className="eco-quiet" onClick={exportBrief}>
                  Download presentation brief
                </button>
              </div>
              {share && (
                <label className="eco-share">
                  Custom presentation URL
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <small>
                    Only the public presentation labels are included. Copy this link to share.
                  </small>
                </label>
              )}
              <a
                className="eco-cta eco-meeting"
                href={MEETING_URL}
                target="_blank"
                rel="noreferrer"
              >
                Book a 1-hour online / face-to-face meeting ↗
              </a>
              <p className="eco-note">
                Discuss the site, scope, participants and an in-person walkthrough with Victor. The
                booking page confirms available appointment options.
              </p>
            </div>
            <ol className="eco-pilot-plan">
              <li>
                <span>01</span>
                <div>
                  <h3>Select a pilot</h3>
                  <p>
                    One apartment, one building or one district phase. Agree the units, intended
                    uses and evidence needed.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Bring the right people</h3>
                  <p>
                    Assign the architect, engineers, suppliers, contractor and client. Map what each
                    reads, changes and approves.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Load the real catalogue</h3>
                  <p>
                    Verify dimensions, material declarations and product variants. Review scale in
                    both 2D and 3D before use.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Run a controlled change</h3>
                  <p>
                    Trace one wall or product revision through quantities, technical review and
                    supplier readiness.
                  </p>
                </div>
              </li>
              <li>
                <span>05</span>
                <div>
                  <h3>Activate agreed connections</h3>
                  <p>
                    Connect cloud access and approved business systems only after permissions,
                    acceptance criteria and responsibilities are agreed.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        )}
      </section>
      <footer className="eco-footer">
        <span>
          <span className="eco-dot" /> One Live Build · Mauritius{' '}
          <small>Presentation only · no orders or project writes</small>
        </span>
        <div>
          <span>{String(chapter + 1).padStart(2, '0')} / 07</span>
          <button
            type="button"
            className="eco-quiet"
            disabled={chapter === 0}
            onClick={() => selectChapter(chapter - 1)}
            aria-label="Previous chapter"
          >
            ←
          </button>
          <button
            type="button"
            className="eco-cta"
            onClick={() => selectChapter((chapter + 1) % ECO_CHAPTERS.length)}
          >
            {chapter === ECO_CHAPTERS.length - 1 ? 'Start again' : 'Next'}{' '}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </main>
  );
}
