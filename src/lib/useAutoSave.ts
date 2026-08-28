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
import { flushCurrentPage } from './pages';

export function useAutoSave(debounceMs = 250): void {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const unsub = usePropertyStore.subscribe(() => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        // Write into the CURRENT PAGE, not always `__draft__`.
        //
        // Autosave used to target the draft slot unconditionally, so edits to
        // a NAMED plan were never saved back to it and switching away silently
        // discarded them. flushCurrentPage falls back to the draft slot when
        // nothing is named, so the unsaved-work behaviour is unchanged.
        flushCurrentPage();
      }, debounceMs);
    });
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [debounceMs]);
}
