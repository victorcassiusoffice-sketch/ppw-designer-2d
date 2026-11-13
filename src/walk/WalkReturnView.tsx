import { useSyncExternalStore } from 'react';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import { getParked, set, listeners, clearParkedWalker } from './parkedWalker';

export function WalkReturn() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getParked,
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
