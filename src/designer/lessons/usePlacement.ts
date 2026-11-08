import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { placeCard } from './placement';
import { firstVisible, followFor, lessonCardRects, markSettling, protectedRects, stageBand, workRects } from './dom';

const RE_PLACE_MS = 500;

/** Keeps a fixed element where it covers no tool UI (see placement.ts). */
export function usePlacement(
  ref: RefObject<HTMLElement>,
  options: { anchors?: readonly string[]; prefer?: 'top' | 'bottom'; deps?: readonly unknown[] },
): { x: number; y: number; overlaps: boolean } | null {
  const [pos, setPos] = useState<{ x: number; y: number; overlaps: boolean } | null>(null);
  const posRef = useRef<{ x: number; y: number; overlaps: boolean } | null>(null);
  const anchors = options.anchors;
  const prefer = options.prefer;
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const size = { w: el.offsetWidth, h: el.offsetHeight };
    const ui = protectedRects(lessonCardRects(), el);
    const band = stageBand(ui);
    const anchor = anchors ? firstVisible(anchors)?.rect ?? null : null;
    const placed = placeCard({ size, viewport: { w: innerWidth, h: innerHeight }, band, anchor, protect: ui, work: workRects(), prefer });
    const prev = posRef.current;
    if (prev && Math.abs(prev.x - placed.x) < 1 && Math.abs(prev.y - placed.y) < 1 && prev.overlaps === placed.overlaps) return;
    if (!prev || Math.abs(prev.x - placed.x) >= 1 || Math.abs(prev.y - placed.y) >= 1) markSettling(el);
    posRef.current = placed;
    setPos(placed);
  }, [ref, anchors, prefer]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(place, [place, ...(options.deps ?? [])]);
  // Follow the plan while it settles after each change (see FOLLOW_MS).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => followFor(place), [place, ...(options.deps ?? [])]);
  useEffect(() => {
    const timer = window.setInterval(place, RE_PLACE_MS);
    window.addEventListener('resize', place);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', place);
    };
  }, [place]);
  return pos;
}
