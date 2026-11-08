/**
 * The card a tool shows the first time it is picked: its name, one line on
 * what it does, two or three steps (mouse or touch), its keys, a short silent
 * clip of the tool in our own app, "Got it" and "No more tips".
 *
 * It never blocks the work: it is not modal, it has no backdrop, it sits
 * where it covers neither the tool's controls nor the bottom bar (measured,
 * see placement.ts), a press on the canvas folds it to a small chip and lets
 * the press through, and while any press is held it takes no pointer events.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { LESSONS } from './lessonData';
import { useLessonsStore, type ActiveCard } from './lessonsStore';
import { useLessonText } from './useLessonText';
import { placeCard } from './placement';
import { coarsePointer, firstVisible, followFor, markSettling, prefersReducedMotion, protectedRects, stageBand, workRects } from './dom';
import { SoundToggle } from './SoundToggle';
import { lastPointerWasTouch } from './pointerKind';

const RE_PLACE_MS = 400;

function posterOf(clip: string): string {
  return clip.replace(/\.webm$/, '.webp');
}

export function LessonCard({ card }: { card: ActiveCard }): JSX.Element {
  const lesson = LESSONS[card.id];
  const t = useLessonText();
  const gotIt = useLessonsStore((s) => s.gotIt);
  const noMoreTips = useLessonsStore((s) => s.noMoreTips);
  const untuck = useLessonsStore((s) => s.untuck);
  const ref = useRef<HTMLElement>(null);
  // 0 full; 1 compact (the clip and steps behind "How"); 2 tight (the line
  // too); 3 one row (name, How, Got it: the smallest screens with a tool
  // panel open, where nothing else fits).
  const [size, setSize] = useState<0 | 1 | 2 | 3>(0);
  const compact = size > 0;
  const [howOpen, setHowOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // The last position set, read before any update so an unchanged spot never re-renders.
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const reduced = prefersReducedMotion();
  const touch = lastPointerWasTouch() ?? coarsePointer();
  const name = t(lesson.name);
  const titleId = `lessons-card-title-${lesson.id}`;

  // A new card starts full size and re-measures.
  useEffect(() => {
    setSize(0);
    setHowOpen(false);
    posRef.current = null;
    setPos(null);
    setMediaFailed(false);
  }, [card.id, card.nonce]);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const measured = { w: el.offsetWidth, h: el.offsetHeight };
    const anchor = firstVisible(lesson.anchors)?.rect ?? null;
    const ui = protectedRects();
    const band = stageBand(ui);
    const placed = placeCard({ size: measured, viewport: { w: innerWidth, h: innerHeight }, band: { top: band.top, bottom: band.bottom }, anchor, protect: ui, work: workRects() });
    // Shrink when it would cover tool controls, or, on a phone, the room.
    // Too little room (a small phone with a tool card open): fold the steps
    // and the clip behind "How" first; only tool controls under it fold the
    // line too, then make it one row. Never while "How" is open: the person
    // asked for the steps.
    const shrink = placed.coversTools ? size < 3 : placed.overlaps && innerWidth < 700 && size < 1;
    if (shrink && !howOpen && !card.tucked) {
      setSize((size + 1) as 1 | 2 | 3);
      return;
    }
    const prev = posRef.current;
    if (prev && Math.abs(prev.x - placed.x) < 1 && Math.abs(prev.y - placed.y) < 1) return;
    markSettling(el);
    posRef.current = { x: placed.x, y: placed.y };
    setPos(posRef.current);
  }, [lesson.anchors, size, howOpen, card.tucked]);

  // Measure when the card opens, folds or changes size class; the timer and
  // resize below follow anything that moves later (a tool card sliding in).
  useLayoutEffect(() => {
    place();
  }, [place, card.nonce, howOpen, mediaFailed]);

  // Follow the plan while it settles after the pick (see FOLLOW_MS).
  useEffect(() => followFor(place), [place, card.nonce]);

  useEffect(() => {
    const timer = window.setInterval(place, RE_PLACE_MS);
    window.addEventListener('resize', place);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  const style = pos ? { left: pos.x, top: pos.y } : { left: -9999, top: 0, visibility: 'hidden' as const };

  if (card.tucked) {
    return createPortal(
      <button
        ref={ref as unknown as RefObject<HTMLButtonElement>}
        type="button"
        className="lessons-chip"
        data-lesson-chip={lesson.id}
        style={style}
        aria-label={t('lesson.ui.showTip', { tool: name })}
        onClick={untuck}
      >
        <BulbIcon />
        <span>{name}</span>
      </button>,
      document.body,
    );
  }

  if (size === 3 && !howOpen) {
    return createPortal(
      <section
        ref={ref}
        className="lessons-card is-compact is-tight is-mini"
        data-lesson-card={lesson.id}
        role="region"
        aria-labelledby={titleId}
        style={style}
      >
        <div className="lessons-card__mini">
          <BulbIcon />
          <h2 id={titleId} className="lessons-card__title">
            {name}
          </h2>
          <button type="button" className="lessons-quiet" aria-expanded={false} onClick={() => setHowOpen(true)}>
            {t('lesson.ui.how')}
          </button>
          <button type="button" className="lessons-primary" onClick={gotIt}>
            {t('lesson.ui.gotIt')}
          </button>
        </div>
      </section>,
      document.body,
    );
  }

  const showSteps = !compact || howOpen;
  const showLine = size < 2 || howOpen;
  const showMedia = !!lesson.clip && !compact && !mediaFailed;
  return createPortal(
    <section
      ref={ref}
      className={`lessons-card${compact ? ' is-compact' : ''}${size >= 2 ? ' is-tight' : ''}`}
      data-lesson-card={lesson.id}
      role="region"
      aria-labelledby={titleId}
      style={style}
    >
      <header className="lessons-card__head">
        <span className="lessons-card__eyebrow" aria-hidden="true">
          <BulbIcon /> {t('lesson.ui.tip')}
        </span>
        <h2 id={titleId} className="lessons-card__title">
          {name}
        </h2>
        <SoundToggle compact />
      </header>
      {showLine && <p className="lessons-card__line">{t(lesson.line)}</p>}
      {(showSteps || showMedia) && (
        <div className="lessons-card__body">
          {showMedia &&
            (reduced ? (
              <img
                className="lessons-card__media"
                src={posterOf(lesson.clip!)}
                alt=""
                width={160}
                height={100}
                onError={() => setMediaFailed(true)}
              />
            ) : (
              <video
                className="lessons-card__media"
                src={lesson.clip}
                poster={posterOf(lesson.clip!)}
                muted
                loop
                autoPlay
                playsInline
                preload="auto"
                width={160}
                height={100}
                aria-label={t('lesson.ui.clipLabel', { tool: name })}
                onError={() => setMediaFailed(true)}
              />
            ))}
          {showSteps && (
            <ol className="lessons-card__steps">
              {lesson.steps.map((step) => (
                <li key={step.text}>{t(touch && step.touch ? step.touch : step.text)}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {lesson.keys && showSteps && !(touch && lesson.keyboardOnly) && (
        <p className="lessons-card__keys">
          <span>{t('lesson.ui.key')}</span> {t(lesson.keys)}
        </p>
      )}
      <footer className="lessons-card__foot">
        {compact && (
          <button type="button" className="lessons-quiet" aria-expanded={howOpen} onClick={() => setHowOpen(!howOpen)}>
            {t('lesson.ui.how')}
          </button>
        )}
        <button type="button" className="lessons-quiet" onClick={noMoreTips}>
          {t('lesson.ui.noMoreTips')}
        </button>
        <button type="button" className="lessons-primary" onClick={gotIt}>
          {t('lesson.ui.gotIt')}
        </button>
      </footer>
    </section>,
    document.body,
  );
}

export function BulbIcon(): JSX.Element {
  return (
    <svg className="lessons-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M7.5 14.5h5M8.3 17h3.4M10 2.8a5 5 0 0 0-3 9c.6.5 1 1.1 1 1.8v.9h4v-.9c0-.7.4-1.3 1-1.8a5 5 0 0 0-3-9Z" />
    </svg>
  );
}
