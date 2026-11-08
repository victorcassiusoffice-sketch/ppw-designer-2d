/**
 * One tip on each loading screen (the 3D load, Walk's load, City's 3D load).
 *
 * The tip is drawn beside the loading panel, never inside it, so the panels'
 * own files stay untouched. It ignores the pointer. The very first loading
 * screen of a visit comes before this code loads (the lessons load after the
 * first picture), so it shows no tip: speed comes first.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LOADING_TIPS } from './lessonData';
import { useLessonsStore } from './lessonsStore';
import { useLessonText } from './useLessonText';
import { rectOf } from './dom';

export const LOADING_SELECTORS = ['[data-testid="loading-3d"]', '.world-walk-loading', '.city-loading'] as const;

export function LoadingTips(): JSX.Element | null {
  const t = useLessonText();
  const [shown, setShown] = useState<{ tip: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);
  const currentPanel = useRef<Element | null>(null);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      let panel: Element | null = null;
      for (const selector of LOADING_SELECTORS) {
        const found = document.querySelector(selector);
        if (found && rectOf(found)) {
          panel = found;
          break;
        }
      }
      if (!panel) {
        currentPanel.current = null;
        setShown(null);
        return;
      }
      const rect = rectOf(panel)!;
      if (panel !== currentPanel.current) {
        currentPanel.current = panel;
        const tip = useLessonsStore.getState().nextTipIndex() % LOADING_TIPS.length;
        setShown({ tip, rect });
      } else {
        setShown((prev) => (prev ? { ...prev, rect } : prev));
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (!shown) return null;
  const width = Math.min(320, Math.max(220, shown.rect.w - 24));
  const left = Math.max(8, Math.min(innerWidth - width - 8, shown.rect.x + shown.rect.w / 2 - width / 2));
  // Under the panel's centre line, inside its box when it is tall enough.
  const top = Math.min(innerHeight - 64, shown.rect.y + Math.max(shown.rect.h * 0.72, 110));
  return createPortal(
    <p className="lessons-loading-tip" data-lessons-loading-tip={LOADING_TIPS[shown.tip]} style={{ left, top, width }}>
      <span>{t('lesson.ui.tip')}</span> {t(LOADING_TIPS[shown.tip])}
    </p>,
    document.body,
  );
}
