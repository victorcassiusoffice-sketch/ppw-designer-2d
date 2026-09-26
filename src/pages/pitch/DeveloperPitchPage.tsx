import { useState } from 'react';
import { ConceptNote, DesignerCapture, DesignerCaptureGallery, Eyebrow, LiveDesigner, MeetingCard, PitchShell, StatusChip } from './PitchShell';
import type { DemoScene } from '../../demo/demoRoute';
import { DEVELOPER_CLIENTS, currentSearch, deliveryStudy, quantityStudy, readPitchClient, type DeveloperClient, type PaintStudy } from './workflowModel';

const CHAPTERS = ['The vision', 'Make it yours', 'Plan delivery', 'One shared brief', 'Build together'];
const PAINTS: { id: PaintStudy; name: string; colour: string; description: string }[] = [
  { id: 'matte', name: 'Warm matte', colour: '#dfd6bf', description: 'Soft, quiet walls · example 2-day cure allowance' },
  { id: 'satin', name: 'Coastal satin', colour: '#94b5b3', description: 'A gentle sheen · example 3-day cure allowance' },
  { id: 'mineral', name: 'Mineral plaster', colour: '#bcaa94', description: 'A textured finish study · example 7-day cure allowance' },
];
const DEADLINE_PHASES = [
  { title: 'Before deadline', detail: 'The client can keep editing paint and material choices. The latest approved selection is the proposed release version.' },
  { title: 'At deadline', detail: 'The proposed workflow freezes the latest approved materials and quantities, then releases purchasing after authorization and supplier acceptance.' },
  { title: 'Site ready', detail: 'Confirmed delivery comes first. Contractor arrival follows received materials and site readiness, with curing and inspection before handover.' },
];
/** What the designer does today; the right-hand column of chapter 05 is what still needs integration. */
const BUILT_TODAY = [
  '2D plan and Premium 3D on the same plan',
  'Colour-true paint: a wall shows the picked shade in every view · TintEX and Sofap ranges with real tin prices',
  'Floors, roof and solar with a plain-English energy meter',
  'Garden, paving and a Duraco water tank',
  'Real merchant catalogues: the Courts range and the Cap Tamarin two-bedroom scene',
  'Read-only demo: nothing is ordered from the demo',
];
const INTEGRATION_REQUIRED = [
  'Buyer accounts, unit plans and a change deadline per unit',
  'Approved purchasing and routing to your suppliers',
  'Contractor scheduling and recipient emails',
  'E-signature, secure identity and finance providers',
  'AI-assisted design with buyer review',
];
/** A client overlay changes words and the scene, never routes or structure. No prices anywhere. */
const CLIENTS: Record<DeveloperClient, { name: string; eyebrow: string; headline: string; lead: string; scene: DemoScene; artLabel: string; liveNote: string; managed: string[]; team: string[]; laterPhases: string }> = {
  'cap-tamarin': {
    name: 'Cap Tamarin',
    eyebrow: 'Cap Tamarin · off-plan buyers',
    headline: 'Let your buyers make their Cap Tamarin home their own, before it is built.',
    lead: 'A buyer opens their unit as a plan and in 3D from the day they reserve, chooses paint, floors and furniture, and keeps changing until the deadline you set. Once connected, each choice routes to the suppliers you nominate.',
    scene: 'captamarin',
    artLabel: 'The two-bedroom, before handover.',
    liveNote: 'Cap Tamarin two-bedroom scene · Courts range at supplier dimensions.',
    managed: ['PPW loads each unit plan and attaches the supplier ranges you approve.', 'PPW supports buyer sessions and answers the design questions.', 'Changes are collected and handed to your team before every deadline.'],
    team: ['Your sales and design staff run the studio under your brand.', 'Your logins, your supplier list, your deadlines.', 'PPW maintains the tool and trains the team.'],
    laterPhases: 'Later phases, once the first units are live: complexes and masterplans, a unit inside a block, landscaping.',
  },
};
const money = (value: number) => new Intl.NumberFormat('en-MU', { maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function DeveloperPitchPage() {
  const [client] = useState(() => readPitchClient(currentSearch(), DEVELOPER_CLIENTS));
  const overlay = client ? CLIENTS[client] : null;
  const scene: DemoScene = overlay?.scene ?? 'home';
  const [chapter, setChapter] = useState(0);
  const [finish, setFinish] = useState<PaintStudy>('matte');
  const [floor, setFloor] = useState<'oak' | 'stone'>('oak');
  const [designTab, setDesignTab] = useState<'study' | 'live'>('live');
  const [view, setView] = useState<'2d' | '3d'>('3d');
  const [role, setRole] = useState<'client' | 'designer'>('client');
  const [variants, setVariants] = useState<{ id: number; finish: PaintStudy; floor: 'oak' | 'stone' }[]>([]);
  const [deadline, setDeadline] = useState('2026-12-18');
  const [confirmedOn, setConfirmedOn] = useState('2026-11-20');
  const [leadDays, setLeadDays] = useState(14);
  const [deadlinePhase, setDeadlinePhase] = useState(0);
  const [area, setArea] = useState(42);
  const [packPrice, setPackPrice] = useState(1250);
  const [lights, setLights] = useState(6);
  const [recipient, setRecipient] = useState('Project company');
  const selectedPaint = PAINTS.find((paint) => paint.id === finish)!;
  const schedule = deliveryStudy(deadline, finish, leadDays, confirmedOn);
  const quantity = quantityStudy(area, 2, 12);
  const paintChoices = <div className="pitch-swatch-list" role="group" aria-label="Example wall finish">{PAINTS.map((paint) => <button type="button" key={paint.id} aria-pressed={finish === paint.id} onClick={() => setFinish(paint.id)}><span style={{ background: paint.colour }} /><span>{paint.name}</span>{finish === paint.id && <span aria-hidden="true">✓</span>}</button>)}</div>;

  return <PitchShell audience="Developers" chapters={CHAPTERS} chapter={chapter} onChapter={setChapter}>
    {chapter === 0 && <div className="pitch-hero">
      <div className="pitch-hero-copy"><Eyebrow>{overlay?.eyebrow ?? 'Property, with possibility'}</Eyebrow>{overlay ? <h1 className="pitch-h1-client">{overlay.headline}</h1> : <h1>A home they can <em>make their own.</em></h1>}<p className="pitch-lead">{overlay?.lead ?? 'Let buyers walk their apartment as a 2D plan and in Premium 3D, pick paint and finishes that show true in every view, and see what each choice means for the handover.'}</p><div className="pitch-chip-row"><StatusChip available>2D plan + Premium 3D · live</StatusChip><StatusChip available>Colour-true paint · live</StatusChip><StatusChip>Delivery workflow · integration required</StatusChip></div><button type="button" className="pitch-primary" onClick={() => setChapter(1)}>Shape an apartment <span aria-hidden="true">↗</span></button><div className="pitch-hero-metrics"><span><strong>01</strong>Explore the space</span><span><strong>02</strong>Agree the choices</span><span><strong>03</strong>Coordinate the people</span></div></div>
      <figure className="pitch-hero-art"><img src="/showcase/developer-vision.webp" alt="Architectural concept of a warmly furnished apartment, garden and material palette" /><figcaption>Architectural concept imagery · explore the actual designer in chapter 02</figcaption><div className="pitch-art-label"><span className="pitch-status-dot" /> {overlay?.artLabel ?? 'The apartment becomes a conversation.'}</div></figure>
    </div>}

    {chapter === 1 && <div className="pitch-split pitch-design-stage">
      <div className="pitch-panel pitch-panel-dark pitch-live-panel"><div className="pitch-section-heading"><div className="pitch-segment" aria-label="Design experience">{(['live', 'study'] as const).map((tab) => <button type="button" key={tab} aria-pressed={designTab === tab} onClick={() => setDesignTab(tab)}>{tab === 'study' ? 'App screenshots' : 'Live designer'}</button>)}</div>{designTab === 'live' && <div className="pitch-segment" aria-label="Designer view"><button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D · to scale</button><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>Premium 3D</button></div>}</div>
        <div className="pitch-live-stage" hidden={designTab !== 'live'}><LiveDesigner scene={scene} view={view} onViewChange={setView} /><div className="pitch-live-footer"><p className="pitch-fine">{overlay?.liveNote ?? 'Courts range at supplier dimensions · one plan in 2D and 3D · read-only demo.'}</p><a href={`/demo?scene=${scene}&view=${view}`} target="_blank" rel="noreferrer">Open full demo ↗</a></div></div>
        {designTab === 'study' && <DesignerCaptureGallery onOpenLive={() => setDesignTab('live')} />}
      </div>
      <aside className="pitch-panel pitch-panel-ivory"><div className="pitch-segment" aria-label="Review perspective"><button type="button" aria-pressed={role === 'client'} onClick={() => setRole('client')}>Client view</button><button type="button" aria-pressed={role === 'designer'} onClick={() => setRole('designer')}>Designer view</button></div><h3>{role === 'client' ? 'Choose the feeling.' : 'Keep the detail attached.'}</h3><p>{role === 'client' ? 'Try a quieter neutral or a coastal colour. Keep alternatives before settling on a direction.' : 'Review walls, floor finishes, furniture, openings and structural elements such as pillars as one material brief.'}</p>{paintChoices}<p className="pitch-fine">{selectedPaint.description}. Brief samples only; they do not repaint the screenshots or live designer. Real paint lives in the designer: TintEX and Sofap ranges, colour-true in 2D and 3D, priced by the tin.</p><div className="pitch-segment" aria-label="Example floor finish"><button type="button" aria-pressed={floor === 'oak'} onClick={() => setFloor('oak')}>Oak</button><button type="button" aria-pressed={floor === 'stone'} onClick={() => setFloor('stone')}>Stone</button></div><button type="button" className="pitch-secondary" onClick={() => setVariants((current) => [...current.slice(-3), { id: (current[current.length - 1]?.id ?? 0) + 1, finish, floor }])}>＋ Duplicate this study</button><div className="pitch-variants" aria-live="polite">{variants.length === 0 ? <span>Compare alternatives without losing your starting point.</span> : variants.map((variant) => <button type="button" key={variant.id} onClick={() => { setFinish(variant.finish); setFloor(variant.floor); }}>Alternative {variant.id} <span>↗</span></button>)}</div><ConceptNote>Client/designer views and duplicates here are local examples. Shared approvals, permissions and saved project variants need integration.</ConceptNote></aside>
    </div>}

    {chapter === 2 && <div className="pitch-split pitch-timeline-stage"><aside className="pitch-panel pitch-panel-ivory"><Eyebrow>Work backwards from handover</Eyebrow><h2>One change.<br />A visible consequence.</h2><p>See how finish allowances and supplier lead times affect the latest design sign-off{overlay ? ' for each unit' : ''}.</p><div className="pitch-form-grid"><label>Target handover<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><label>Proposed sign-off<input type="date" value={confirmedOn} onChange={(event) => setConfirmedOn(event.target.value)} /></label></div><label className="pitch-range-label">Supplier lead time <strong>{leadDays} days</strong><input type="range" min="0" max="45" value={leadDays} onChange={(event) => setLeadDays(Number(event.target.value))} /></label>{paintChoices}<ConceptNote>Calendar-day simulation only, with example cure allowances. Suppliers and contractors must confirm specifications, stock, capacity and dates. No orders, bookings or emails are sent.</ConceptNote></aside>
      <div className="pitch-panel pitch-panel-dark"><div className="pitch-section-heading"><div><Eyebrow>Delivery & installation dependencies</Eyebrow><h2>Your example timeline</h2></div>{schedule && <span className={`pitch-timing-result ${schedule.marginDays < 0 ? 'is-tight' : ''}`} data-testid="timing-result">{schedule.marginDays < 0 ? `${Math.abs(schedule.marginDays)} days late` : `${schedule.marginDays} days in reserve`}</span>}</div><div className="pitch-deadline-preview"><div className="pitch-segment pitch-wrap" aria-label="Deadline workflow preview">{DEADLINE_PHASES.map((phase, index) => <button type="button" key={phase.title} aria-pressed={deadlinePhase === index} onClick={() => setDeadlinePhase(index)}>{phase.title}</button>)}</div><p className="pitch-fine" aria-live="polite">{DEADLINE_PHASES[deadlinePhase].detail}</p></div>{schedule ? <><ol className="pitch-timeline">{schedule.steps.map((step, index) => <li key={step.id}><span className="pitch-timeline-number">{index + 1}</span><div><strong>{step.label}</strong><p>{step.dependency}</p></div><time dateTime={step.date}>{dateLabel(step.date)}</time></li>)}</ol><p className="pitch-fine">{schedule.totalDays} calendar days allowed · {schedule.cureDays} for curing/inspection · a supplier delay shifts the available choice deadline.</p></> : <p role="status">Choose valid dates to see the dependency timeline.</p>}</div>
    </div>}

    {chapter === 3 && <div className="pitch-split"><div className="pitch-panel pitch-panel-dark pitch-brief-capture"><Eyebrow>Space + materials + services</Eyebrow><h2>One brief.<br />The right detail for each team.</h2><DesignerCapture view="2d" onOpenLive={() => { setView('2d'); setDesignTab('live'); setChapter(1); }} /><p className="pitch-fine">The live designer connects measured layouts, product quantities, tins of paint and the energy meter. The calculation alongside is a separate example, not data extracted from this screenshot.</p></div>
      <aside className="pitch-panel pitch-panel-ivory"><Eyebrow>Editable calculation study</Eyebrow><h3>Explain the numbers.</h3><div className="pitch-form-grid"><label>Paint area · m²<input aria-label="Paint area in square metres" type="number" min="0" max="10000" value={area} onChange={(event) => setArea(Math.max(0, Number(event.target.value)))} /></label><label>Example pack price · Rs<input aria-label="Example paint pack price" type="number" min="0" value={packPrice} onChange={(event) => setPackPrice(Math.max(0, Number(event.target.value)))} /></label></div><div className="pitch-calculation" aria-live="polite"><div><span>2 coats · 12 m²/L · 2.5 L packs</span><strong>{quantity?.packs ?? 0} packs <small>({quantity?.litres.toFixed(1) ?? 0} L needed)</small></strong></div><div><span>Illustrative material subtotal</span><strong>Rs {money((quantity?.packs ?? 0) * packPrice)}</strong></div></div><label className="pitch-range-label">9 W LED lights <strong>{lights} lights · {lights * 9} W</strong><input aria-label="Example LED light count" type="range" min="0" max="30" value={lights} onChange={(event) => setLights(Number(event.target.value))} /></label><p className="pitch-fine">Assumptions, not a supplier quote or electrical design. Waste, labour, tax and other loads are excluded. Solar output depends on site, orientation, shading and system inputs.</p><label className="pitch-select-label">Assigned recipient preview<select value={recipient} onChange={(event) => setRecipient(event.target.value)}><option>Project company</option><option>Painting contractor</option><option>Electrical designer</option></select></label><div className="pitch-recipient"><span aria-hidden="true">↗</span><div><strong>{recipient}</strong><p>{recipient === 'Painting contractor' ? `${selectedPaint.name} · ${area} m² · ${quantity?.packs ?? 0} example packs · date dependencies` : recipient === 'Electrical designer' ? `${lights} example lighting points · ${lights * 9} W connected lighting load · site review needed` : 'Client choices · room scope · example quantities · team responsibilities'}</p></div></div><ConceptNote>Recipient assignment is a preview. Company accounts, permissions, actual quotes and delivery of this brief need integration.</ConceptNote></aside>
    </div>}

    {chapter === 4 && <div className={`pitch-partnership-stage ${overlay ? 'has-models' : ''}`}><div className="pitch-partnership-heading"><Eyebrow>A practical next chapter</Eyebrow><h2>Start with the space.<br /><em>Build the workflow around it.</em></h2><p>Victor works with your team to turn recurring buyer questions and project decisions into a useful experience.</p></div>
      {overlay && <div className="pitch-model-grid" data-testid="operating-models"><article className="pitch-panel pitch-panel-dark"><Eyebrow>Model A</Eyebrow><h3>Managed by PPW</h3><ul className="pitch-check-list">{overlay.managed.map((line) => <li key={line}>{line}</li>)}</ul></article><article className="pitch-panel pitch-panel-ivory"><Eyebrow>Model B</Eyebrow><h3>Run by your team</h3><ul className="pitch-check-list">{overlay.team.map((line) => <li key={line}>{line}</li>)}</ul></article><p className="pitch-later-phase">{overlay.laterPhases}</p></div>}
      <div className="pitch-capability-grid"><article className="pitch-panel pitch-panel-dark"><StatusChip available>Live in the designer today</StatusChip><h3>Try it today.</h3><ul className="pitch-check-list">{BUILT_TODAY.map((line) => <li key={line}>{line}</li>)}</ul><a className="pitch-primary" href="/studio">Open standalone studio ↗</a></article><article className="pitch-panel pitch-panel-ivory"><StatusChip>Workflow preview / integration required</StatusChip><h3>Define the next connections.</h3><ul className="pitch-check-list">{INTEGRATION_REQUIRED.map((line) => <li key={line}>{line}</li>)}</ul><p className="pitch-fine">Scope, partners and authorization come first. These services are not activated by this presentation.</p></article></div><MeetingCard /></div>}
  </PitchShell>;
}
