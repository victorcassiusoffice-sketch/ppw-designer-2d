import { useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { MEETING_URL } from './workflowModel';
import { EmbeddedDesigner } from '../../demo/EmbeddedDesigner';
import './pitch.css';

export function PitchShell({ audience, chapters, chapter, onChapter, children }: {
  audience: 'Developers' | 'Merchants'; chapters: readonly string[]; chapter: number; onChapter: (chapter: number) => void; children: ReactNode;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${audience === 'Developers' ? 'Property Developer' : 'Merchant'} Experience | PPW Studio`;
    return () => { document.title = previous; };
  }, [audience]);
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + chapters.length) % chapters.length;
    onChapter(next); buttons.current[next]?.focus();
  };
  return <main className="pitch-app">
    <header className="pitch-header"><a className="pitch-brand" href="/studio" aria-label="PPW Studio home"><span className="pitch-brand-mark">P<span>·</span></span><span>PPW <strong>STUDIO</strong></span></a>
      <span className="pitch-audience">For {audience.toLowerCase()}</span>
      <nav aria-label="Pitch links"><a href={audience === 'Developers' ? '/pitch/merchants' : '/pitch/developers'}>{audience === 'Developers' ? 'For merchants' : 'For developers'}</a><a className="pitch-meeting" href={MEETING_URL} target="_blank" rel="noreferrer">Meet Victor <span aria-hidden="true">↗</span></a></nav>
    </header>
    <div className="pitch-chapters" role="tablist" aria-label={`${audience} presentation chapters`}>
      {chapters.map((label, index) => <button key={label} ref={(node) => { buttons.current[index] = node; }} type="button" role="tab" id={`pitch-tab-${index}`} aria-selected={chapter === index} aria-controls="pitch-stage" tabIndex={chapter === index ? 0 : -1} onClick={() => onChapter(index)} onKeyDown={(event) => navigate(event, index)}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>)}
    </div>
    <section id="pitch-stage" role="tabpanel" aria-labelledby={`pitch-tab-${chapter}`} tabIndex={0} className="pitch-stage" key={chapter}>{children}</section>
    <footer className="pitch-footer"><span><span className="pitch-status-dot" /> Real design tools. A workflow built around you.</span><div><a href="/studio">Studio</a><a href="/demo">Explore the demo ↗</a><button type="button" onClick={() => onChapter((chapter + 1) % chapters.length)} aria-label={chapter === chapters.length - 1 ? 'Return to first chapter' : 'Next chapter'}>{chapter === chapters.length - 1 ? 'Start again' : 'Next chapter'} <span aria-hidden="true">→</span></button></div></footer>
  </main>;
}

export function Eyebrow({ children }: { children: ReactNode }) { return <p className="pitch-eyebrow">{children}</p>; }
export function ConceptNote({ children }: { children?: ReactNode }) { return <div className="pitch-concept-note"><span>Workflow preview</span><p>{children ?? 'Integration required. This example does not send orders, book contractors or notify anyone.'}</p></div>; }
export function StatusChip({ available, children }: { available?: boolean; children: ReactNode }) { return <span className={`pitch-chip ${available ? 'is-available' : ''}`}>{available ? '● ' : '◇ '}{children}</span>; }
export function MeetingCard() { return <div className="pitch-meeting-card"><span className="pitch-avatar">VC</span><div><strong>Victor Cassius</strong><p>Your ongoing partner for ideas, workflow design and customization.</p></div><a href={MEETING_URL} target="_blank" rel="noreferrer">Book a 1-hour meeting ↗</a></div>; }

export function ApartmentDiagram({ wall, floor = '#c5a685', showServices = false }: { wall: string; floor?: string; showServices?: boolean }) {
  return <svg className="pitch-apartment-diagram" viewBox="0 0 500 350" role="img" aria-label={`Illustrative apartment plan with ${showServices ? 'electrical points and structural pillars' : 'selected wall and floor finishes'}`}>
    <defs><pattern id="pitch-floor-lines" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M0 0h35v35" fill="none" stroke="#ffffff" strokeOpacity=".16" /></pattern></defs>
    <rect x="27" y="28" width="448" height="294" rx="13" fill="#ffffff" opacity=".07" />
    <path d="M52 52H443V296H52Z" fill={floor} /><path d="M52 52H443V296H52Z" fill="url(#pitch-floor-lines)" />
    <path d="M52 52H443V296H52ZM302 52V206M302 246V296M302 171H443M52 209H132M172 209H302" fill="none" stroke={wall} strokeWidth="14" strokeLinejoin="round" />
    <rect x="329" y="76" width="83" height="60" rx="5" fill="#ede8dc" /><rect x="334" y="80" width="33" height="16" rx="4" fill="#fff" /><rect x="374" y="80" width="33" height="16" rx="4" fill="#fff" />
    <rect x="80" y="78" width="53" height="99" rx="8" fill="#556b62" /><rect x="84" y="82" width="15" height="89" rx="5" fill="#759281" />
    <rect x="161" y="95" width="69" height="59" rx="24" fill="#e8d9bd" /><circle cx="195" cy="124" r="10" fill="#516c52" />
    <rect x="83" y="237" width="111" height="31" rx="6" fill="#d8cfbc" /><rect x="82" y="267" width="44" height="15" rx="3" fill="#64716b" />
    <rect x="330" y="202" width="74" height="45" rx="5" fill="#dfdbd1" /><rect x="337" y="209" width="60" height="31" rx="12" fill="#aac5c2" />
    <path d="M62 48H139M222 48H280M349 48H420M447 210V270" stroke="#93cbd3" strokeWidth="8" />
    {[[52,52],[302,52],[443,171],[52,209]].map(([x,y]) => <rect key={`${x}-${y}`} x={x-9} y={y-9} width="18" height="18" fill="#53666e" stroke="#e4ded0" strokeWidth="2" />)}
    <g fill="#233b40" fontSize="12" fontFamily="inherit"><text x="176" y="186">Living</text><text x="344" y="158">Bedroom</text><text x="205" y="270">Kitchen</text><text x="346" y="276">Bathroom</text></g>
    {showServices && <g fill="#7befcc" stroke="#173f43" strokeWidth="2">{[[72,94],[275,111],[426,89],[281,239],[321,280]].map(([x,y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="10" /><path d={`M${x+1} ${y-6}l-5 7h4l-1 5 5-7h-4Z`} strokeWidth="1" /></g>)}</g>}
    <path d="M52 329H443M52 324V334M443 324V334" stroke="#879fa7" /><text x="215" y="345" fontSize="11" fill="#b9cbd2">Example layout · not to scale</text>
  </svg>;
}

export function LiveDesigner({ paint = false, view = '3d', onViewChange }: { paint?: boolean; view?: '2d' | '3d'; onViewChange?: (view: '2d' | '3d') => void }) {
  return <EmbeddedDesigner scene={paint ? 'paint' : 'home'} view={view} onViewChange={onViewChange} className="pitch-designer-frame" title={paint ? 'Interactive paint designer' : 'Interactive house designer'} loading="lazy" />;
}
