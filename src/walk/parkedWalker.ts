import type { PlacementHint } from './placement';
export interface Parked {
  propertyId: string;
  hint: PlacementHint;
  detached: boolean;
  requested: boolean;
}
let parked: Parked | null = null;
export const listeners = new Set<() => void>();
export function set(next: Parked | null) {
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
export const getParked = () => parked;
