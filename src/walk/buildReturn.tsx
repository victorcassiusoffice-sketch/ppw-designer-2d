import { useSyncExternalStore } from 'react';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import type { PlacementHint } from './placement';

interface Parked {
  propertyId: string;
  hint: PlacementHint;
  detached: boolean;
  requested: boolean;
}
let parked: Parked | null = null;
const listeners = new Set<() => void>();
function set(next: Parked | null) {
  parked = next;
  document.documentElement.toggleAttribute('data-walk-parked', !!next);
  window.dispatchEvent(new Event('olb:walk-parked'));
  listeners.forEach((f) => f());
}
export function parkWalker(propertyId: string, hint: PlacementHint) {
  set({ propertyId, hint, detached: false, requested: false });
}
export function detachWalker() {
  if (parked) set({ ...parked, detached: true });
}
export function clearParkedWalker() {
  if (parked) set(null);
}
export function takeResume(propertyId: string) {
  if (parked?.propertyId !== propertyId || !parked.requested) return;
  const hint = parked.hint;
  set(null);
  return hint;
}
export function WalkReturn() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => parked,
  );
  const id = usePropertyStore((s) => s.property.id);
  if (!state?.detached || state.propertyId !== id) return null;
  return (
    <div className="walk-build-return">
      <button
        onClick={() => {
          set({ ...state, requested: true });
          useDesignerUIStore.getState().setViewMode('3d');
          window.dispatchEvent(new Event('olb:resume-walk'));
        }}
      >
        Resume walking
      </button>
      <button onClick={clearParkedWalker}>End visit</button>
    </div>
  );
}
