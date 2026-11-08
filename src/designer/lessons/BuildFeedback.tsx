/**
 * Game feel on top of the existing build code, without changing it:
 *   - quiet sounds (place, snap, remove, paint, undo) when sounds are on;
 *   - a short landing ring where an object lands;
 *   - a snap pulse where a wall corner drops.
 * Everything listens to the stores and to where the last press was; nothing
 * here touches the canvas, and every ring ignores the pointer.
 *
 * The placement ghost (green / red) and the selection outline already exist
 * on the canvas (`blueprintTheme.ts`), so they are not redrawn here.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePropertyStore } from '../../store/propertyStore';
import { useDrawProgressStore } from '../../store/drawProgressStore';
import { useHistoryStore } from '../../store/historyStore';
import { useDragPointerStore } from '../../store/dragPointerStore';
import { useLessonsStore } from './lessonsStore';
import { playBuildSound, type BuildSound } from './sound';
import { buildCounts, soundForChange } from './buildCounts';
import { isStageTarget, prefersReducedMotion } from './dom';

interface Ring {
  id: number;
  x: number;
  y: number;
  kind: 'land' | 'snap';
}

let ringSeq = 0;

export function BuildFeedback(): JSX.Element | null {
  const [rings, setRings] = useState<Ring[]>([]);

  useEffect(() => {
    let lastPress: { x: number; y: number; at: number } | null = null;
    let undoAt = -Infinity;
    const addRing = (kind: Ring['kind'], x: number, y: number) => {
      if (prefersReducedMotion()) return;
      ringSeq += 1;
      const id = ringSeq;
      setRings((list) => [...list.slice(-6), { id, x, y, kind }]);
      window.setTimeout(() => setRings((list) => list.filter((r) => r.id !== id)), kind === 'land' ? 520 : 320);
    };
    const sound = (kind: BuildSound) => {
      if (useLessonsStore.getState().soundOn) playBuildSound(kind);
    };
    const recentPress = () => (lastPress && performance.now() - lastPress.at < 900 ? lastPress : null);

    const up = (event: PointerEvent) => {
      if (isStageTarget(event.target)) lastPress = { x: event.clientX, y: event.clientY, at: performance.now() };
    };
    document.addEventListener('pointerup', up, { capture: true, passive: true });

    // A drag from the catalogue lands where its ghost was.
    let lastDrop: { x: number; y: number; at: number } | null = null;
    const unDrop = useDragPointerStore.subscribe((s, prev) => {
      if (s.drop && s.drop !== prev.drop) lastDrop = { x: s.drop.clientX, y: s.drop.clientY, at: performance.now() };
    });

    const unHistory = useHistoryStore.subscribe((s, prev) => {
      if (s.future.length > prev.future.length) {
        undoAt = performance.now();
        sound('undo');
      }
    });

    let counts = buildCounts(usePropertyStore.getState().property);
    const unProperty = usePropertyStore.subscribe((s, prev) => {
      if (s.property === prev.property) return;
      const next = buildCounts(s.property);
      const change = soundForChange(counts, next);
      const placedMore = next.items > counts.items;
      counts = next;
      if (!change || performance.now() - undoAt < 120) return;
      sound(change);
      if (placedMore) {
        const drop = lastDrop && performance.now() - lastDrop.at < 900 ? lastDrop : null;
        const at = drop ?? recentPress();
        if (at) addRing('land', at.x, at.y);
      }
    });

    let vertices = useDrawProgressStore.getState().vertices.length;
    const unDraw = useDrawProgressStore.subscribe((s) => {
      const n = s.vertices.length;
      if (n > vertices && s.enabled) {
        sound('snap');
        const at = recentPress();
        if (at) addRing('snap', at.x, at.y);
      } else if (n < vertices && s.enabled && n > 0) {
        sound('undo');
      }
      vertices = n;
    });

    return () => {
      document.removeEventListener('pointerup', up, true);
      unDrop();
      unHistory();
      unProperty();
      unDraw();
    };
  }, []);

  if (!rings.length) return null;
  return createPortal(
    <>
      {rings.map((ring) => (
        <span key={ring.id} className={`lessons-ring lessons-ring--${ring.kind}`} style={{ left: ring.x, top: ring.y }} aria-hidden="true" />
      ))}
    </>,
    document.body,
  );
}
