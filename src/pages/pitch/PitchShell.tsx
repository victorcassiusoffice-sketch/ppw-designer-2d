import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
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

const CAPTURED_VIEWS = {
  '2d': { src: '/showcase/designer-plan.png', label: '2D plan', alt: 'Room Designer 2D plan captured with its drawing and product controls' },
  '3d': { src: '/showcase/designer-3d.png', label: 'Premium 3D', alt: 'Room Designer Premium 3D captured with its building and camera controls' },
};

export function DesignerCapture({ view = '2d', onOpenLive }: { view?: '2d' | '3d'; onOpenLive?: () => void }) {
  const capture = CAPTURED_VIEWS[view];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === capture.src;
  return <figure className="pitch-app-capture">
    <figcaption><span>{failed ? 'App view unavailable' : 'Captured in the app'}</span><strong>{capture.label}</strong>{!failed && <span>Tap to enlarge ↗</span>}</figcaption>
    {failed ? <div className="pitch-capture-unavailable" role="status"><p>This screenshot could not load. Explore the working designer below.</p></div> : <a className="pitch-capture-image" href={capture.src} target="_blank" rel="noreferrer" aria-label={`Enlarge ${capture.label} screenshot`}><img src={capture.src} alt={capture.alt} loading="lazy" onError={() => setFailedSrc(capture.src)} /></a>}
    <dl className="pitch-capture-tools" aria-label={`${capture.label} controls`}>
      {view === '2d' ? <><div><dt>Walls</dt><dd>Draw the room footprint.</dd></div><div><dt>Furnish</dt><dd>Open products, search and categories.</dd></div></> : <><div><dt>Build</dt><dd>Choose a floor, walls, openings or roof.</dd></div><div><dt>Move view</dt><dd>Pan the camera; drag to orbit when off.</dd></div></>}
    </dl>
    <div className="pitch-capture-actions"><p className="pitch-fine">A saved view of the app. Brief samples do not change this image.</p>{onOpenLive ? <button type="button" onClick={onOpenLive}>Try these tools ↗</button> : <a href={`/demo?scene=home&view=${view}`} target="_blank" rel="noreferrer">Try these tools ↗</a>}</div>
  </figure>;
}

export function DesignerCaptureGallery({ onOpenLive }: { onOpenLive: () => void }) {
  const [view, setView] = useState<'2d' | '3d'>('2d');
  return <div className="pitch-capture-gallery"><div className="pitch-segment" role="group" aria-label="Captured designer view">{(['2d', '3d'] as const).map((value) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{CAPTURED_VIEWS[value].label}</button>)}</div><DesignerCapture view={view} onOpenLive={onOpenLive} /></div>;
}

export function LiveDesigner({ paint = false, view = '3d', onViewChange }: { paint?: boolean; view?: '2d' | '3d'; onViewChange?: (view: '2d' | '3d') => void }) {
  return <EmbeddedDesigner scene={paint ? 'paint' : 'home'} view={view} onViewChange={onViewChange} className="pitch-designer-frame" title={paint ? 'Interactive paint designer' : 'Interactive house designer'} loading="lazy" />;
}
