/**
 * useAutoSave - Week 2.5: subscribes to the propertyStore and
 * writes a Property snapshot to the `__draft__` slot on every mutation.
 * Debounced 250 ms so a flurry of rotations/drags doesn't thrash
 * localStorage.
 *
 * Auto-draft scope is the whole property (all rooms + items), so the
 * draft survives room switches too.
 */
import { useEffect, useRef } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignsStore } from '../store/designsStore';

export function useAutoSave(debounceMs = 250): void {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const unsub = usePropertyStore.subscribe((state) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        useDesignsStore.getState().savePropertyDraft(state.property);
      }, debounceMs);
    });
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [debounceMs]);
}
