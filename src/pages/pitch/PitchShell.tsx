import { useAppPreferences } from '../../i18n/AppPreferences';
import { LocaleThemeControls } from '../../components/LocaleThemeControls';
import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { MEETING_URL } from './workflowModel';
import { EmbeddedDesigner, type EmbeddedDesignerProps } from '../../demo/EmbeddedDesigner';
import type { DemoScene } from '../../demo/demoRoute';
import { PitchConnectChapter } from './PitchConnectChapter';
import { OlbLockup } from '../../brand/OlbLockup';
import './pitch.css';
import './pitch-tactile.css';
import './pitch.olb.generated.css';
import './pitch.olb.css';

export function PitchShell({
  audience,
  chapters,
  chapter,
  onChapter,
  children,
}: {
  audience: 'Developers' | 'Merchants' | 'Construction';
  chapters: readonly string[];
  chapter: number;
  onChapter: (chapter: number) => void;
  children: ReactNode;
}) {
  const { t, tx } = useAppPreferences();
  const allChapters = [...chapters, 'AI & connect'];
  const [connectEntry, setConnectEntry] = useState<'ai' | 'contact'>('ai');
  const selectChapter = (index: number) => {
    setConnectEntry('ai');
    onChapter(index);
  };
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${audience === 'Developers' ? 'Property Developer' : audience === 'Construction' ? 'Construction & Materials' : 'Merchant'} Experience | One Live Build`;
    return () => {
      document.title = previous;
    };
  }, [audience]);
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
      return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? allChapters.length - 1
          : (index +
              (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) +
              allChapters.length) %
            allChapters.length;
    selectChapter(next);
    buttons.current[next]?.focus();
  };
  return (
    <main className={`pitch-app${audience === 'Construction' ? ' pitch-construction' : ''}`}>
      <header className="pitch-header">
        <a className="pitch-brand" href="/studio" aria-label="One Live Build home">
          <OlbLockup />
        </a>
        <span className="pitch-audience">{tx(`For ${audience.toLowerCase()}`)}</span>
        <LocaleThemeControls />
        <nav aria-label={t('Pitch links')}>
          <a href={`/demo?panel=project&company=${audience.toLowerCase()}`}>{t('projectHub')}</a>
          <a href={audience === 'Developers' ? '/pitch/merchants' : '/pitch/developers'}>
            {audience === 'Developers' ? t('For merchants') : t('For developers')}
          </a>
          <a className="pitch-meeting" href={MEETING_URL} target="_blank" rel="noreferrer">
            {t('Meet Victor')}
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <div
        className="pitch-chapters"
        role="tablist"
        aria-label={t('presentationChapters', { audience: tx(audience) })}
      >
        {allChapters.map((label, index) => (
          <button
            key={label}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`pitch-tab-${index}`}
            aria-selected={chapter === index}
            aria-controls="pitch-stage"
            tabIndex={chapter === index ? 0 : -1}
            onClick={() => selectChapter(index)}
            onKeyDown={(event) => navigate(event, index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            {tx(label)}
          </button>
        ))}
      </div>
      <section
        id="pitch-stage"
        role="tabpanel"
        aria-labelledby={`pitch-tab-${chapter}`}
        tabIndex={0}
        className="pitch-stage"
        key={chapter}
      >
        {chapter === allChapters.length - 1 ? (
          <PitchConnectChapter
            key={connectEntry}
            audience={audience.toLowerCase() as 'developers' | 'merchants' | 'construction'}
            initialSection={connectEntry}
          />
        ) : (
          children
        )}
      </section>
      <footer className="pitch-footer">
        <span>
          <span className="pitch-status-dot" />{' '}
          {t('Real design tools. A workflow built around you.')}
        </span>
        <div>
          <button
            type="button"
            className="pitch-feedback-link"
            onClick={() => {
              setConnectEntry('contact');
              onChapter(allChapters.length - 1);
            }}
          >
            {t('Feedback & meetings')}
          </button>
          <a href="/pitch/construction">{t('Materials')}</a>
          <a href="/studio">{t('Studio')}</a>
          <a href="/demo?pitch=1">Demo ↗</a>
          <button
            type="button"
            onClick={() => selectChapter((chapter + 1) % allChapters.length)}
            aria-label={
              chapter === allChapters.length - 1 ? t('Return to first chapter') : t('Next chapter')
            }
          >
            {chapter === allChapters.length - 1 ? t('Start again') : t('Next chapter')}{' '}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </main>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="pitch-eyebrow">{children}</p>;
}
export function ConceptNote({ children }: { children?: ReactNode }) {
  const { t } = useAppPreferences();
  return (
    <div className="pitch-concept-note">
      <span>{t('Workflow preview')}</span>
      <p>
        {children ??
          t(
            'Integration required. This example does not send orders, book contractors or notify anyone.',
          )}
      </p>
    </div>
  );
}
/** ● live in the designer today · ◐ in build · ◇ integration required / later phase. */
export function StatusChip({
  available,
  building,
  children,
}: {
  available?: boolean;
  building?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`pitch-chip ${available ? 'is-available' : building ? 'is-build' : ''}`}>
      {available ? '● ' : building ? '◐ ' : '◇ '}
      {children}
    </span>
  );
}
export function MeetingCard() {
  const { t } = useAppPreferences();
  return (
    <div className="pitch-meeting-card">
      <span className="pitch-avatar">VC</span>
      <div>
        <strong>Victor Cassius Bhatoolaul</strong>
        <p>Your ongoing partner for ideas, workflow design and customization.</p>
      </div>
      <a href={MEETING_URL} target="_blank" rel="noreferrer">
        {t('Book a 1-hour meeting ↗')}
      </a>
    </div>
  );
}

/** Shot from the running app by tools/shoot-pitch-captures.mjs; a test asserts both files exist. */
export const CAPTURED_VIEWS = {
  '2d': {
    src: '/showcase/designer-plan.webp',
    label: '2D plan',
    alt: 'One Live Build 2D plan captured with its drawing and product controls',
  },
  '3d': {
    src: '/showcase/designer-3d.webp',
    label: 'Premium 3D',
    alt: 'One Live Build Premium 3D captured with its building and camera controls',
  },
} as const;

export function DesignerCapture({
  view = '2d',
  onOpenLive,
}: {
  view?: '2d' | '3d';
  onOpenLive?: () => void;
}) {
  const { t } = useAppPreferences();
  const capture = CAPTURED_VIEWS[view];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === capture.src;
  return (
    <figure className="pitch-app-capture">
      <figcaption>
        <span>{failed ? t('App view unavailable') : t('Captured in the app')}</span>
        <strong>{capture.label}</strong>
        {!failed && <span>{t('Tap to enlarge ↗')}</span>}
      </figcaption>
      {failed ? (
        <div className="pitch-capture-unavailable" role="status">
          <p>This screenshot could not load. Explore the working designer below.</p>
        </div>
      ) : (
        <a
          className="pitch-capture-image"
          href={capture.src}
          target="_blank"
          rel="noreferrer"
          aria-label={`Enlarge ${capture.label} screenshot`}
        >
          <img
            src={capture.src}
            alt={capture.alt}
            loading="lazy"
            onError={() => setFailedSrc(capture.src)}
          />
        </a>
      )}
      <dl className="pitch-capture-tools" aria-label={`${capture.label} controls`}>
        {view === '2d' ? (
          <>
            <div>
              <dt>Build / Finish</dt>
              <dd>Draw walls, then choose paint or flooring.</dd>
            </div>
            <div>
              <dt>{t('Furnish')}</dt>
              <dd>Open products, search and categories.</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>{t('Build')}</dt>
              <dd>Place walls and openings. Use the floor selector for storeys and roof.</dd>
            </div>
            <div>
              <dt>{t('Move view')}</dt>
              <dd>Pan the camera; drag to orbit when off.</dd>
            </div>
          </>
        )}
      </dl>
      <div className="pitch-capture-actions">
        <p className="pitch-fine">
          A saved view of the app. Brief samples do not change this image.
        </p>
        {onOpenLive ? (
          <button type="button" onClick={onOpenLive}>
            {t('Try these tools ↗')}
          </button>
        ) : (
          <a href={`/demo?scene=home&view=${view}`} target="_blank" rel="noreferrer">
            {t('Try these tools ↗')}
          </a>
        )}
      </div>
    </figure>
  );
}

export function DesignerCaptureGallery({ onOpenLive }: { onOpenLive: () => void }) {
  const [view, setView] = useState<'2d' | '3d'>('2d');
  return (
    <div className="pitch-capture-gallery">
      <div className="pitch-segment" role="group" aria-label="Captured designer view">
        {(['2d', '3d'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {CAPTURED_VIEWS[value].label}
          </button>
        ))}
      </div>
      <DesignerCapture view={view} onOpenLive={onOpenLive} />
    </div>
  );
}

const SCENE_TITLES: Record<DemoScene, string> = {
  home: 'Interactive house designer',
  paint: 'Interactive paint designer',
  captamarin: 'Interactive Cap Tamarin two-bedroom designer',
};

export function LiveDesigner({
  scene = 'home',
  view = '3d',
  onViewChange,
  panel,
}: {
  scene?: DemoScene;
  view?: '2d' | '3d';
  onViewChange?: (view: '2d' | '3d') => void;
  panel?: EmbeddedDesignerProps['panel'];
}) {
  return (
    <EmbeddedDesigner
      scene={scene}
      view={view}
      onViewChange={onViewChange}
      panel={panel}
      pitch
      className="pitch-designer-frame"
      title={SCENE_TITLES[scene]}
      loading="lazy"
    />
  );
}
