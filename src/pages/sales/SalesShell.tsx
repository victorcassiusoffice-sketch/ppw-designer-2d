import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { MEETING } from './salesPack';
import './salesPack.css';

export function SalesShell({
  kind,
  names,
  chapter,
  select,
  children,
}: {
  kind: 'plumbing' | 'team';
  names: readonly string[];
  chapter: number;
  select: (i: number) => void;
  children: ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const old = document.title;
    document.title =
      kind === 'team'
        ? 'Employee starter pack · PPW Room Designer'
        : 'Plumbing companies · PPW Room Designer';
    return () => {
      document.title = old;
    };
  }, [kind]);
  const keys = (e: KeyboardEvent, i: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? names.length - 1
          : (i + (e.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length;
    select(next);
    refs.current[next]?.focus();
  };
  return (
    <main className={`sales-pack sales-${kind}`}>
      <a className="sales-skip" href="#sales-content">
        Skip to presentation
      </a>
      <header className="sales-header">
        <a href="/studio" className="sales-brand">
          <span aria-hidden="true">P.</span>
          <strong>
            Room Designer<small>by PPW Studio</small>
          </strong>
        </a>
        <span className="sales-edition">
          {kind === 'team' ? 'Employee field guide' : 'For plumbing companies'}
        </span>
        <a className="sales-meeting" href={MEETING} target="_blank" rel="noreferrer">
          Book 1 hour ↗
        </a>
      </header>
      <nav
        className="sales-tabs"
        aria-label={kind === 'team' ? 'Starter pack sections' : 'Plumbing pitch chapters'}
        role="tablist"
      >
        {names.map((n, i) => (
          <button
            key={n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`sales-tab-${i}`}
            aria-controls="sales-content"
            aria-selected={chapter === i}
            tabIndex={chapter === i ? 0 : -1}
            onKeyDown={(e) => keys(e, i)}
            onClick={() => select(i)}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            {n}
          </button>
        ))}
      </nav>
      <section
        id="sales-content"
        className="sales-content"
        role="tabpanel"
        aria-labelledby={`sales-tab-${chapter}`}
        tabIndex={0}
      >
        {children}
      </section>
      <footer className="sales-footer">
        <span>
          PPW Room Designer <span aria-hidden="true">/</span> {String(chapter + 1).padStart(2, '0')}{' '}
          of {names.length}
        </span>
        <div>
          <a href={kind === 'team' ? '/pitch/plumbing' : '/pitch/merchants'}>
            {kind === 'team' ? 'Customer plumbing pitch' : 'Other industries'} ↗
          </a>
          <button type="button" onClick={() => select((chapter + 1) % names.length)}>
            {chapter === names.length - 1 ? 'Start again' : 'Next'} →
          </button>
        </div>
      </footer>
    </main>
  );
}
export function Kicker({ children }: { children: ReactNode }) {
  return <p className="sales-kicker">{children}</p>;
}
export function OpenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="sales-button" href={href} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  );
}
