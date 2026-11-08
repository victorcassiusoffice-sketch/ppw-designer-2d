/**
 * A tooltip with the tool's name, its key and one line on every tool button:
 * on hover or keyboard focus, or a long press on a phone.
 *
 * Read-only towards the buttons: it listens on the document (passive) and
 * draws its own bubble. While the bubble shows, the button's own `title` is
 * parked on `data-lessons-title` so the browser's tooltip does not double it,
 * and put back when the bubble goes. A long press that showed the bubble
 * does not also press the button.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LESSONS, tooltipTargets, type LessonId } from './lessonData';
import { useLessonText } from './useLessonText';
import { prefersReducedMotion } from './dom';

const HOVER_DELAY_MS = 380;
const LONG_PRESS_MS = 480;
const TOUCH_SHOW_MS = 1800;

interface Shown {
  id: LessonId;
  rect: DOMRect;
}

const TARGETS = tooltipTargets();
const SELECTOR = TARGETS.map((target) => target.selector).join(', ');

function targetOf(node: EventTarget | null): { el: HTMLElement; id: LessonId } | null {
  if (!(node instanceof Element)) return null;
  const el = node.closest<HTMLElement>(SELECTOR);
  if (!el) return null;
  const match = TARGETS.find((target) => el.matches(target.selector));
  return match ? { el, id: match.id } : null;
}

function parkTitle(el: HTMLElement): void {
  const title = el.getAttribute('title');
  if (title !== null) {
    el.setAttribute('data-lessons-title', title);
    el.removeAttribute('title');
  }
}

function restoreTitle(el: HTMLElement | null): void {
  if (!el) return;
  const parked = el.getAttribute('data-lessons-title');
  if (parked !== null) {
    if (!el.hasAttribute('title')) el.setAttribute('title', parked);
    el.removeAttribute('data-lessons-title');
  }
}

export function ToolTips(): JSX.Element | null {
  const t = useLessonText();
  const [shown, setShown] = useState<Shown | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const swallowClick = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!SELECTOR) return undefined;
    const clear = () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = undefined;
    };
    const hide = () => {
      clear();
      restoreTitle(current.current);
      current.current = null;
      setShown(null);
    };
    const show = (el: HTMLElement, id: LessonId) => {
      if (!el.isConnected) return;
      parkTitle(el);
      current.current = el;
      setShown({ id, rect: el.getBoundingClientRect() });
    };
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const hit = targetOf(event.target);
      if (!hit || hit.el === current.current) return;
      hide();
      current.current = hit.el;
      parkTitle(hit.el);
      timer.current = window.setTimeout(() => show(hit.el, hit.id), HOVER_DELAY_MS);
    };
    const out = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const el = current.current;
      if (el && event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return;
      if (el && targetOf(event.target)?.el === el) hide();
    };
    const focusIn = (event: FocusEvent) => {
      const hit = targetOf(event.target);
      if (!hit) return;
      // Keyboard focus only: a mouse click also focuses the button.
      if (!(hit.el.matches(':focus-visible'))) return;
      hide();
      show(hit.el, hit.id);
    };
    const focusOut = (event: FocusEvent) => {
      if (targetOf(event.target)?.el === current.current) hide();
    };
    let pressStart: { x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') {
        hide();
        return;
      }
      const hit = targetOf(event.target);
      if (!hit) {
        hide();
        return;
      }
      hide();
      pressStart = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        swallowClick.current = hit.el;
        show(hit.el, hit.id);
        timer.current = window.setTimeout(hide, TOUCH_SHOW_MS);
      }, LONG_PRESS_MS);
    };
    const move = (event: PointerEvent) => {
      if (!pressStart || event.pointerType !== 'touch') return;
      if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) {
        pressStart = null;
        if (!current.current) clear();
      }
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      pressStart = null;
      // A short tap: cancel the pending long press and let the tap through.
      if (!current.current) clear();
    };
    const click = (event: MouseEvent) => {
      const swallowed = swallowClick.current;
      if (!swallowed) return;
      swallowClick.current = null;
      if (event.target instanceof Node && swallowed.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const scroll = () => hide();
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerout', out, { passive: true });
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    document.addEventListener('pointerdown', down, { capture: true, passive: true });
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerup', up, { capture: true, passive: true });
    document.addEventListener('pointercancel', up, { capture: true, passive: true });
    document.addEventListener('click', click, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('click', click, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!shown) return null;
  const lesson = LESSONS[shown.id];
  const width = 236;
  const below = shown.rect.bottom + 8 + 72 < innerHeight;
  const left = Math.max(8, Math.min(innerWidth - width - 8, shown.rect.left + shown.rect.width / 2 - width / 2));
  const top = below ? shown.rect.bottom + 8 : Math.max(8, shown.rect.top - 8 - 72);
  return createPortal(
    <div
      className={`lessons-tooltip${prefersReducedMotion() ? ' is-still' : ''}`}
      role="tooltip"
      data-lessons-tooltip={lesson.id}
      style={{ left, top, width }}
    >
      <span className="lessons-tooltip__name">
        {t(lesson.name)}
        {lesson.shortKey && <kbd>{lesson.shortKey}</kbd>}
      </span>
      <span className="lessons-tooltip__line">{t(lesson.line)}</span>
    </div>,
    document.body,
  );
}
