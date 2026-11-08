/**
 * The only lessons code on the first-picture path: a few lines that wait for
 * the first picture (the plan canvas, or the 3D picture on a 3D route), then
 * for an idle moment, and only then download the lessons layer.
 */
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

const LessonsLayer = lazy(() => import('./LessonsLayer'));

/** Longest wait for an idle moment once the picture is up. */
const IDLE_TIMEOUT_MS = 2500;
/** A view that never reports its picture (no WebGL) still gets lessons, later. */
const SAFETY_MS = 15000;

function firstPictureShown(): boolean {
  if (document.querySelector('[data-first-picture-ms]')) return true;
  const wants3d = new URLSearchParams(window.location.search).get('view') === '3d';
  return !wants3d && !!document.querySelector('.konvajs-content canvas');
}

/**
 * A fault in the lessons must never take the Designer with it: the guard
 * drops the lessons for the rest of the visit and leaves the app running.
 */
class LessonsGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.warn('Lessons switched off for this visit:', error instanceof Error ? error.message : error);
  }
  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function LessonsBoot(): JSX.Element | null {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false;
    let idle: number | undefined;
    let fallback: number | undefined;
    let done = false;
    const load = () => {
      if (stopped) return;
      setReady(true);
    };
    const afterPicture = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      window.clearTimeout(safety);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (stopped) return;
          const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
          if (w.requestIdleCallback) idle = w.requestIdleCallback(load, { timeout: IDLE_TIMEOUT_MS });
          else fallback = window.setTimeout(load, 1200);
        }),
      );
    };
    const observer = new MutationObserver(() => {
      if (firstPictureShown()) afterPicture();
    });
    const safety = window.setTimeout(afterPicture, SAFETY_MS);
    if (firstPictureShown()) afterPicture();
    else observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-first-picture-ms'] });
    return () => {
      stopped = true;
      observer.disconnect();
      window.clearTimeout(safety);
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      if (fallback !== undefined) window.clearTimeout(fallback);
    };
  }, []);
  return ready ? (
    <LessonsGuard>
      <Suspense fallback={null}>
        <LessonsLayer />
      </Suspense>
    </LessonsGuard>
  ) : null;
}
