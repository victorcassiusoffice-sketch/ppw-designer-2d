import { useState } from 'react';
import { ConceptNote, DesignerCapture, Eyebrow, MeetingCard, PitchShell, StatusChip } from './PitchShell';
import { constructionDeliveryStudy, type ConstructionPhase } from './constructionWorkflow';
import { EmbeddedDesigner } from '../../demo/EmbeddedDesigner';
import { CONSTRUCTION_BLOCK_PRESETS, constructionSource } from '../../data/constructionMaterials';
import './constructionPitch.css';

const CHAPTERS = ['The project', 'Draw & measure', 'Choose materials', 'Plan delivery', 'Build together'];
const SOURCES = {
  classic: constructionSource('ubp-blocks')!.url,
  smart: 'https://ubp.mu/sites/default/files/dta_vf_6.pdf',
};
const PHASES: { id: ConstructionPhase; title: string; detail: string }[] = [
  { id: 'draft', title: 'Keep designing', detail: 'Adjust walls, openings and materials. The live Materials panel recalculates the design; the date study here stays an independent planning example.' },
  { id: 'review', title: 'Review the brief', detail: 'Agree measurements, approved structural details, final quantities and a supplier quotation. No supplier has accepted this date or reserved stock.' },
  { id: 'release', title: 'Authorized release', detail: 'The proposed workflow releases only after the customer and project team approve, the supplier accepts, and the purchasing connection is configured. Reaching this date does not create an order.' },
];

/** Independent pitch: real estimator iframe, researched references, explicitly simulated procurement. */
export default function ConstructionPitchPage() {
  const [chapter, setChapter] = useState(0);
  const [view, setView] = useState<'2d' | '3d'>('3d');
  const [deliveryDate, setDeliveryDate] = useState('2026-11-30');
  const [leadDays, setLeadDays] = useState(14);
  const [phase, setPhase] = useState<ConstructionPhase>('draft');
  const [material, setMaterial] = useState<'classic' | 'smart'>('classic');
  const block = CONSTRUCTION_BLOCK_PRESETS.find((item) => item.id === 'ubp-150')!;
  const dates = constructionDeliveryStudy(deliveryDate, leadDays);
  return <PitchShell audience="Construction" chapters={CHAPTERS} chapter={chapter} onChapter={setChapter}>
    {chapter === 0 && <div className="pitch-hero">
      <div className="pitch-hero-copy"><Eyebrow>Construction in Mauritius · supplier example: UBP</Eyebrow>
        <h1>Draw the wall.<br /><em>Understand the materials.</em></h1>
        <p className="pitch-lead">Start with an AI-assisted layout or draw by hand. Review the same home in 2D and Premium 3D, then open Materials for the blocks, concrete and roof quantities behind it.</p>
        <div className="pitch-chip-row"><StatusChip available>Materials · editable quantity estimates</StatusChip><StatusChip>Supplier ordering · integration required</StatusChip></div>
        <div className="pitch-hero-actions"><button type="button" className="pitch-primary" onClick={() => setChapter(1)}>Try the live Materials workspace ↗</button><button type="button" className="pitch-secondary" onClick={() => setChapter(5)}>Explore AI automation ↗</button></div>
        <p className="pitch-fine">An independent PPW presentation using publicly documented UBP products. This is not an official UBP platform, partnership or endorsement.</p>
        <div className="pitch-hero-metrics"><span><strong>Draw</strong>Walls & openings</span><span><strong>Inspect</strong>Editable assumptions</span><span><strong>Review</strong>Supplier quantities</span></div>
      </div>
      <div className="pitch-panel pitch-panel-dark construction-intro-preview"><DesignerCapture view="3d" onOpenLive={() => setChapter(1)} /><p className="pitch-fine">Actual app capture. Open the live workspace for the current Materials controls.</p></div>
    </div>}
    {chapter === 1 && <div className="construction-live-layout">
      <aside className="pitch-panel pitch-panel-ivory"><Eyebrow>Try the working app</Eyebrow><h2>Your wall,<br />your assumptions.</h2>
        <ol className="construction-steps"><li>Draw a room or wall in the shared plan.</li><li>Open <strong>Materials</strong> beside the canvas.</li><li>Review measured scope, block sizes, ratios, depth and waste.</li><li>Adjust the inputs and compare the estimate.</li></ol>
        <div className="pitch-segment" aria-label="Construction designer view"><button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D · to scale</button><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>Premium 3D</button></div>
        <p className="pitch-fine">Materials is optional. Keep the clean design workspace when you only want to arrange the home. Switching between 2D and Premium 3D keeps your design in the same session.</p>
        <p className="pitch-fine">Quantity planning does not certify structural safety. Foundations, reinforced slabs, pillars and roof fixings need site-specific engineering and supplier specifications.</p>
        <a className="pitch-secondary" href="/demo?view=3d&panel=materials" target="_blank" rel="noreferrer">Open full-size Materials demo ↗</a>
      </aside>
      <div className="pitch-panel pitch-panel-dark construction-live-frame"><EmbeddedDesigner scene="home" view={view} onViewChange={setView} panel="materials" title="Interactive construction Materials designer" loading="lazy" /><div className="construction-live-caption"><StatusChip available>Live editable design</StatusChip><span>Demo only · no orders or payments</span></div></div>
    </div>}
    {chapter === 2 && <div className="pitch-split">
      <aside className="pitch-panel pitch-panel-ivory"><Eyebrow>Real products, traceable assumptions</Eyebrow><h2>A supplier reference.<br />A visible calculation.</h2><p>UBP’s published block dimensions and technical information anchor this example. Keep each product reference attached to the materials brief.</p>
        <div className="pitch-channel-list" role="group" aria-label="UBP material references"><button type="button" aria-pressed={material === 'classic'} onClick={() => setMaterial('classic')}><span aria-hidden="true">▥</span><div><strong>Classic 6-inch block</strong><small>Published product dimensions</small></div></button><button type="button" aria-pressed={material === 'smart'} onClick={() => setMaterial('smart')}><span aria-hidden="true">▧</span><div><strong>U Block & Corner Block</strong><small>Technical reference for detailing</small></div></button></div>
        <p className="pitch-fine">These cards explain source documents. Choose the actual dimensions and construction method in Materials; a reference card does not modify your drawing.</p><button type="button" className="pitch-primary" onClick={() => setChapter(1)}>Review the live quantities ↗</button>
      </aside>
      <article className="pitch-panel pitch-panel-dark construction-source-card" aria-live="polite"><StatusChip available>Official supplier reference</StatusChip>
        {material === 'classic' ? <><div className="construction-block-symbol" aria-hidden="true"><span /><span /></div><h2>UBP Classic Block 6″</h2><div className="construction-dimension">{block.lengthM * 1000} × {block.heightM * 1000} × {block.thicknessM * 1000} <small>mm</small></div><p>The supplier’s dimensions describe length, height and thickness. Mortar joints, cut pieces, openings and waste affect the quantity to purchase.</p><p className="pitch-fine">{block.note}</p><div className="pitch-token-row"><span>Published size</span><span>Editable joints</span><span>Opening deductions</span><span>Waste allowance</span></div></> : <><div className="construction-block-symbol is-u" aria-hidden="true"><span /></div><h2>UBP Smart Blocks</h2><p>UBP documents U Blocks for horizontal ties and lintels, and Corner Blocks for vertical ties and opening jambs. These details are not interchangeable with a designed reinforced concrete frame.</p><p>The Materials brief can record concrete and reinforcement assumptions. A structural engineer must specify the actual arrangement, reinforcement, concrete and connections.</p></>}
        <a className="pitch-secondary" href={SOURCES[material]} target="_blank" rel="noreferrer">Read the UBP source ↗</a><p className="pitch-fine">Source reviewed 30 September 2026. Supplier quotes, stock and approved structural drawings are separate from this demonstration.</p>
      </article>
    </div>}
    {chapter === 3 && <div className="pitch-split">
      <aside className="pitch-panel pitch-panel-ivory"><Eyebrow>Delivery planning · interactive example</Eyebrow><h2>Decide now.<br />Release when ready.</h2><p>Explore how a requested site date and supplier lead time could set a review window. Choices stay editable until the agreed sign-off.</p>
        <div className="pitch-form-grid"><label>Requested delivery<input type="date" value={deliveryDate} aria-label="Requested construction delivery date" onChange={(event) => setDeliveryDate(event.target.value)} /></label><label>Supplier lead time · calendar days<input type="number" min="0" max="365" value={Number.isFinite(leadDays) ? leadDays : ''} aria-label="Construction supplier lead days" onChange={(event) => setLeadDays(event.target.value === '' ? Number.NaN : Number(event.target.value))} /></label></div>
        <div className="construction-phase-picker" role="group" aria-label="Construction workflow phase">{PHASES.map((item) => <button type="button" key={item.id} aria-pressed={phase === item.id} onClick={() => setPhase(item.id)}>{item.title}</button>)}</div>
        <ConceptNote>Dates illustrate a future connected workflow. No orders, payments, emails or contractor bookings are sent. Supplier acceptance and project approval are always separate.</ConceptNote>
      </aside>
      <article className="pitch-panel pitch-panel-dark"><Eyebrow>From drawing to an approved request</Eyebrow><h2>{PHASES.find((item) => item.id === phase)!.title}</h2><p className="pitch-lead">{PHASES.find((item) => item.id === phase)!.detail}</p>
        {dates ? <ol className="construction-schedule" aria-live="polite"><li><span>Review quantities & quote</span><time dateTime={dates.review}>{dates.review}</time><small>Example two-day review allowance</small></li><li><span>Earliest planned release</span><time dateTime={dates.release}>{dates.release}</time><small>Approval and supplier acceptance required</small></li><li><span>Requested site delivery</span><time dateTime={dates.delivery}>{dates.delivery}</time><small>Unconfirmed · not a booking</small></li></ol> : <p role="status">Enter a valid date and a lead time from 0 to 365 days.</p>}
        <p className="pitch-fine">Calendar days only; holidays, supplier capacity, access and installation sequencing need a real project schedule.</p>
      </article>
    </div>}
    {chapter === 4 && <div className="pitch-growth-stage"><div className="pitch-growth-columns"><article className="pitch-panel pitch-panel-ivory"><Eyebrow>Useful today</Eyebrow><h2>A brief your team<br />can interrogate.</h2><ul className="pitch-check-list"><li>One geometry for the 2D plan and 3D home</li><li>Optional Materials estimates with visible assumptions</li><li>Real supplier references, editable ratios and quantities</li><li>Garden products from Mr. Bricolage Mauritius and JKalachand</li><li>Materials methods kept in versioned, tested app code</li></ul><a className="pitch-secondary" href="/demo?panel=materials">Explore Materials ↗</a></article><article className="pitch-panel pitch-panel-dark"><Eyebrow>Connect with your company</Eyebrow><h3>Your products.<br />Your review process.</h3><p>Configure approved ranges and staff responsibilities, then agree how quantities become supplier quotations and authorized orders.</p><div className="pitch-token-row"><span>Catalogue feed</span><span>Supplier quotes</span><span>Change deadlines</span><span>Approval trail</span></div><ConceptNote>Supplier stock feeds, automated purchasing, project approvals, contractor scheduling and e-signatures require agreements and integration. This public demo grants no supplier access.</ConceptNote></article></div><MeetingCard /></div>}
  </PitchShell>;
}
