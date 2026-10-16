import { useAppPreferences } from '../../i18n/AppPreferences';
import { LocaleThemeControls } from '../../components/LocaleThemeControls';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { MEETING } from './salesPack';
import { OlbLockup } from '../../brand/OlbLockup';
import './salesPack.css';
import './salesPack.olb.generated.css';
import './salesPack.olb.css';

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
  const { t, tx } = useAppPreferences();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const product = 'One Live Build';
  useEffect(() => {
    const old = document.title;
    document.title =
      kind === 'team' ? `Employee starter pack · ${product}` : `Plumbing companies · ${product}`;
    return () => {
      document.title = old;
    };
  }, [kind, product]);
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
        {t('Skip to presentation')}
      </a>
      <header className="sales-header">
        <a href="/studio" className="sales-brand" aria-label="One Live Build home">
          <OlbLockup height={30} />
        </a>
        <span className="sales-edition">
          {kind === 'team' ? t('Employee field guide') : t('For plumbing companies')}
        </span>
        <a href={`/demo?panel=project&company=${kind === 'plumbing' ? 'plumbing' : 'merchants'}`}>
          {t('projectHub')}
        </a>
        <LocaleThemeControls />
        <a className="sales-meeting" href={MEETING} target="_blank" rel="noreferrer">
          {t('Book 1 hour ↗')}
        </a>
      </header>
      <nav
        className="sales-tabs"
        aria-label={kind === 'team' ? t('Starter pack sections') : t('Plumbing pitch chapters')}
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
            {tx(n)}
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
          {product} <span aria-hidden="true">/</span>{' '}
          {t('chapterCount', { current: chapter + 1, total: names.length })}
        </span>
        <div>
          <a href={kind === 'team' ? '/pitch/plumbing' : '/pitch/merchants'}>
            {kind === 'team' ? t('Customer plumbing pitch') : t('Other industries')} ↗
          </a>
          <button type="button" onClick={() => select((chapter + 1) % names.length)}>
            {chapter === names.length - 1 ? t('Start again') : t('Next')} →
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
