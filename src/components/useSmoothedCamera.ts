import { useEffect, useRef, useState } from 'react';
import type { OrbitCamera } from '../designer/roomView3d';
import { cameraAtRest, dampOrbitCamera } from '../designer/cameraMotion';

/** Smooth render-only camera motion; gesture state remains immediate and exact. */
export function useSmoothedCamera(target: OrbitCamera | null): OrbitCamera | null {
  const [rendered, setRendered] = useState<OrbitCamera | null>(target);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false);
  const currentRef = useRef<OrbitCamera | null>(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const frameRef = useRef<number | null>(null);
  const previousTimeRef = useRef(0);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const cancel = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    if (!target || !currentRef.current || reducedMotion) {
      cancel();
      currentRef.current = target;
      setRendered(target);
      return;
    }
    if (cameraAtRest(currentRef.current, target)) {
      cancel();
      currentRef.current = target;
      setRendered(target);
      return;
    }
    if (frameRef.current !== null) return; // One animation reads the newest target every frame.
    previousTimeRef.current = performance.now();
    const tick = (now: number) => {
      frameRef.current = null;
      const latest = targetRef.current;
      const current = currentRef.current;
      if (!latest || !current) return;
      const elapsed = now - previousTimeRef.current;
      previousTimeRef.current = now;
      // A background tab should wake at its latest view, not animate old input.
      const next = elapsed > 250 ? latest : dampOrbitCamera(current, latest, elapsed);
      currentRef.current = next;
      setRendered(next);
      if (!cameraAtRest(next, latest)) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [target, reducedMotion]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  return !target ? null : reducedMotion || !rendered ? target : rendered;
}
