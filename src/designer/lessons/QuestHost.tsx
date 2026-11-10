/**
 * The first-build quest: offered on an empty plan; seven steps ticked from
 * the real design, each with a small celebration; skip or come back at any
 * time (the Lessons list). Never modal; a press on the canvas folds it to a
 * chip, and the press goes to the canvas.
 */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useLessonsStore } from './lessonsStore';
import { useLessonText } from './useLessonText';
import { usePlacement } from './usePlacement';
import {
  QUEST_STEPS,
  QUEST_STEP_INFO,
  doneQuestSteps,
  isEmptyPlan,
  questFacts,
  questStepProgress,
  type QuestStepId,
} from './quest';
import { openLesson } from './openLesson';
import { playBuildSound } from './sound';
import { prefersReducedMotion } from './dom';
import { lessonText } from '../../i18n/lessonMessages';
import { useAppPreferences } from '../../i18n/AppPreferences';
import { SoundToggle } from './SoundToggle';

interface Burst {
  id: number;
  x: number;
  y: number;
  big: boolean;
}

let burstSeq = 0;

export function QuestHost(): JSX.Element | null {
  const t = useLessonText();
  const { locale } = useAppPreferences();
  const quest = useLessonsStore((s) => s.quest);
  const tipsOff = useLessonsStore((s) => s.tipsOff);
  const offerTucked = useLessonsStore((s) => s.offerTucked);
  const property = usePropertyStore((s) => s.property);
  const viewMode = useDesignerUIStore((s) => s.viewMode);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [finale, setFinale] = useState(false);
  const host = useRef<HTMLElement>(null);
  const facts = questFacts(property);
  const empty = isEmptyPlan(property);

  // Tick steps from the real design whenever it (or the 3D / Walk facts) changes.
  const startedSilently = useRef(false);
  useEffect(() => {
    const s = useLessonsStore.getState();
    if (s.quest.status !== 'active') {
      startedSilently.current = false;
      return;
    }
    const done = doneQuestSteps(questFacts(property), { saw3d: quest.saw3d, walked: quest.walked });
    const fresh = s.tickQuest(done);
    // Steps already done when the quest starts tick quietly.
    const silent = !startedSilently.current;
    startedSilently.current = true;
    if (!fresh.length || silent) return;
    const finished = useLessonsStore.getState().quest.status === 'done';
    for (const step of fresh) {
      useLessonsStore.getState().announce(lessonText(locale, 'lesson.quest.stepDone', { step: lessonText(locale, QUEST_STEP_INFO[step].label) }));
    }
    if (useLessonsStore.getState().soundOn) playBuildSound(finished ? 'done' : 'tick');
    if (!prefersReducedMotion()) {
      const r = host.current?.getBoundingClientRect();
      const x = r ? r.left + Math.min(r.width, 220) / 2 : innerWidth / 2;
      const y = r ? r.top + 18 : innerHeight / 2;
      burstSeq += 1;
      const id = burstSeq;
      setBursts((list) => [...list, { id, x, y, big: finished }]);
      window.setTimeout(() => setBursts((list) => list.filter((b) => b.id !== id)), finished ? 1600 : 1000);
    }
    if (finished) {
      setFinale(true);
      useLessonsStore.getState().announce(lessonText(locale, 'lesson.quest.allDone'));
    }
  }, [property, quest.saw3d, quest.walked, quest.status, locale]);

  const showOffer = quest.status === 'idle' && !tipsOff && empty && viewMode === 'plan';
  const showPanel = quest.status === 'active';
  const pos = usePlacement(host, {
    prefer: 'bottom',
    deps: [showOffer, offerTucked, showPanel, quest.minimized, finale, quest.ticks.length],
  });
  const style = pos ? { left: pos.x, top: pos.y } : { left: -9999, top: 0, visibility: 'hidden' as const };

  const bursts$ = bursts.map((b) => <BurstView key={b.id} burst={b} />);

  if (finale) {
    return createPortal(
      <>
        <section ref={host} className="lessons-quest lessons-quest--finale" role="region" aria-labelledby="lessons-quest-finale" style={style}>
          <h2 id="lessons-quest-finale">{t('lesson.quest.allDone')}</h2>
          <p>{t('lesson.quest.allDoneLine')}</p>
          <footer className="lessons-card__foot">
            <button type="button" className="lessons-quiet" onClick={() => { setFinale(false); window.dispatchEvent(new Event('olb:open-lessons')); }}>
              {t('lesson.list.title')}
            </button>
            <button type="button" className="lessons-primary" onClick={() => setFinale(false)}>
              {t('lesson.ui.close')}
            </button>
          </footer>
        </section>
        {bursts$}
      </>,
      document.body,
    );
  }

  if (showOffer && offerTucked) {
    return createPortal(
      <button
        ref={host as unknown as RefObject<HTMLButtonElement>}
        type="button"
        className="lessons-quest lessons-quest--chip"
        data-lessons-quest="offer-chip"
        aria-expanded={false}
        style={style}
        onClick={(event) => {
          useLessonsStore.getState().setOfferTucked(false);
          if (event.detail === 0) {
            requestAnimationFrame(() => host.current?.querySelector<HTMLButtonElement>('.lessons-primary')?.focus({ preventScroll: true }));
          }
        }}
      >
        <span>{t('lesson.quest.title')}</span>
      </button>,
      document.body,
    );
  }

  if (showOffer) {
    return createPortal(
      <section ref={host} className="lessons-quest lessons-quest--offer" role="region" aria-labelledby="lessons-quest-offer" data-lessons-quest="offer" style={style}>
        <h2 id="lessons-quest-offer">{t('lesson.quest.title')}</h2>
        <p>{t('lesson.quest.offer')}</p>
        <footer className="lessons-card__foot">
          <button type="button" className="lessons-quiet" onClick={() => useLessonsStore.getState().declineQuest()}>
            {t('lesson.quest.notNow')}
          </button>
          <button type="button" className="lessons-primary" onClick={() => useLessonsStore.getState().startQuest()}>
            {t('lesson.quest.start')}
          </button>
        </footer>
      </section>,
      document.body,
    );
  }

  if (!showPanel) return bursts.length ? createPortal(<>{bursts$}</>, document.body) : null;

  const doneCount = quest.ticks.length;
  const total = QUEST_STEPS.length;
  const next = QUEST_STEPS.find((step) => !quest.ticks.includes(step)) ?? null;

  if (quest.minimized) {
    return createPortal(
      <>
        <button
          ref={host as unknown as RefObject<HTMLButtonElement>}
          type="button"
          className="lessons-quest lessons-quest--chip"
          data-lessons-quest="chip"
          style={style}
          aria-label={t('lesson.quest.open', { done: doneCount, total })}
          onClick={() => useLessonsStore.getState().setQuestMinimized(false)}
        >
          <span>{t('lesson.quest.title')}</span>
          <span className="lessons-quest__count">{t('lesson.quest.progress', { done: doneCount, total })}</span>
        </button>
        {bursts$}
      </>,
      document.body,
    );
  }

  return createPortal(
    <>
      <section ref={host} className="lessons-quest" role="region" aria-labelledby="lessons-quest-title" data-lessons-quest="panel" style={style}>
        <header className="lessons-quest__head">
          <h2 id="lessons-quest-title">{t('lesson.quest.title')}</h2>
          <span className="lessons-quest__count">{t('lesson.quest.progress', { done: doneCount, total })}</span>
          <SoundToggle compact />
          <button type="button" className="lessons-quiet" onClick={() => useLessonsStore.getState().setQuestMinimized(true)}>
            {t('lesson.quest.hide')}
          </button>
        </header>
        <div className="lessons-quest__bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label={t('lesson.quest.title')}>
          <i style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        <ol className="lessons-quest__steps">
          {QUEST_STEPS.map((step) => (
            <QuestRow key={step} step={step} done={quest.ticks.includes(step)} next={step === next} progress={questStepProgress(step, facts)} />
          ))}
        </ol>
        <footer className="lessons-quest__foot">
          <button type="button" className="lessons-quiet" onClick={() => useLessonsStore.getState().skipQuest()}>
            {t('lesson.quest.skip')}
          </button>
        </footer>
      </section>
      {bursts$}
    </>,
    document.body,
  );
}

function QuestRow({ step, done, next, progress }: {
  step: QuestStepId;
  done: boolean;
  next: boolean;
  progress: { count: number; target: number } | null;
}): JSX.Element {
  const t = useLessonText();
  const info = QUEST_STEP_INFO[step];
  return (
    <li className="lessons-quest__step" data-quest-step={step} data-done={done} data-next={next}>
      <span className="lessons-quest__mark" aria-hidden="true">{done ? '✓' : next ? '●' : '○'}</span>
      <span className="lessons-quest__label">
        {t(info.label)}
        {!done && progress && progress.count > 0 && (
          <span className="lessons-quest__part"> · {t('lesson.quest.count', { count: progress.count, target: progress.target })}</span>
        )}
        <span className="sr-only"> · {done ? t('lesson.list.ticked') : t('lesson.list.notTicked')}</span>
      </span>
      {next && (
        <button
          type="button"
          className="lessons-primary lessons-quest__show"
          onClick={() => {
            // Out of the way: the list folds to its chip, the tool and its card come up.
            useLessonsStore.getState().setQuestMinimized(true);
            openLesson(info.lesson);
          }}
        >
          {t('lesson.quest.showMe')}
        </button>
      )}
    </li>
  );
}

function BurstView({ burst }: { burst: Burst }): JSX.Element {
  const pieces = burst.big ? 22 : 12;
  return (
    <div className={`lessons-burst${burst.big ? ' is-big' : ''}`} style={{ left: burst.x, top: burst.y }} aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (360 / pieces) * i + (i % 2 ? 9 : -9);
        const distance = (burst.big ? 90 : 52) + (i % 3) * 14;
        return <i key={i} style={{ '--a': `${angle}deg`, '--d': `${distance}px`, '--c': i % 3 } as CSSProperties} />;
      })}
    </div>
  );
}
