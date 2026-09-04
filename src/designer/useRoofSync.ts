/**
 * useRoofSync — keep the roof slabs mirroring the storey beneath (eco /
 * solar 2026-09-04).
 *
 * Mounted once at the App root. Whenever the property's rooms change and
 * a roof level exists, `syncRoof` rebuilds the slabs; `syncRoofRooms` is
 * idempotent and returns the same reference when nothing moved, so the
 * nested set it triggers settles in one step. Undo: the history store
 * coalesces the draw and the slab refresh that follows it into ONE frame
 * (they land inside its coalesce window), so Ctrl+Z reverts both together.
 */
import { useEffect } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { roofLevelOf } from './levels';

export function useRoofSync(): void {
  useEffect(
    () =>
      usePropertyStore.subscribe((s, prev) => {
        if (s.property === prev.property) return;
        if (s.property.rooms === prev.property.rooms) return;
        if (!roofLevelOf(s.property)) return;
        s.syncRoof();
      }),
    [],
  );
}
