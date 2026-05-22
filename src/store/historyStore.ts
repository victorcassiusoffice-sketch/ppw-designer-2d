/**
 * historyStore — Phase A.0 / Tweak 07 foundation.
 *
 * Unified atomic-snapshot history across the designer's content stores
 * (propertyStore + wallStore today; floorZoneStore + wallTreatmentStore
 * later for Phase C). One Ctrl+Z = one user-perceived action reversed
 * regardless of which store owned the mutation, which a per-store
 * `zundo` setup can't give us cleanly.
 *
 * Design:
 *   1. `takeSnapshot()` deep-clones the watched fields of every store.
 *   2. `installHistorySubscriptions()` subscribes to each store. On any
 *      real change (deep-equal vs. last seen), the PRIOR state is
 *      pushed into the `past` ring; the new state becomes the baseline.
 *   3. Drag/move sends many `updateItem` calls per second — we coalesce
 *      them: while changes keep arriving inside `coalesceMs`, only the
 *      *first* prior is queued; the timer commits it once idle.
 *   4. `undo()` / `redo()` apply a target snapshot back through each
 *      store's setState while a `suppress` flag prevents the subscriber
 *      from re-recording the restore itself.
 *   5. The top 10 frames of `past` serialise to sessionStorage on every
 *      commit + on `beforeunload`. Capacity stays at 50 in memory.
 *
 * Wire shape:
 *   App.tsx mounts `useHistoryBootstrap()` once at root, which calls
 *   `installHistorySubscriptions()` after the persist-hydrated stores
 *   exist. Keybinds + UNDO/REDO buttons read this store directly.
 *
 * Hooks ready for: rotate (Tweak 01), floor-paint (Tweak 02),
 * wall-treatment (Tweak 03), 3D-place (Tweak 06) — each just registers
 * its store in `WATCHED_STORES` and snapshots include it automatically.
 */

import { create } from 'zustand';
import { usePropertyStore, type Property } from './propertyStore';
import { useWallStore, type WallSegment } from './wallStore';
import { useFloorZoneStore, type FloorZone } from './floorZoneStore';
import { useWallTreatmentStore } from './wallTreatmentStore';
import type { WallTreatment } from './wallTreatmentStore';

export const HISTORY_LIMIT = 50;
export const SESSION_PERSIST_LIMIT = 10;
export const SESSION_KEY = 'ppw_history_top10_v1';
export const DEFAULT_COALESCE_MS = 250;

export interface Snapshot {
  property: Property;
  walls: WallSegment[];
  /** Tweak 02 — floor zones (in-memory mirror of Neon `placed_floor_zones`). */
  floorZones: FloorZone[];
  /** Tweak 03 — paint + panel treatments keyed by wall id. */
  wallTreatments: Record<string, Partial<Record<'paint' | 'panel', WallTreatment>>>;
  /** Optional human-readable label for the action that produced this snapshot. */
  label?: string;
}

interface HistoryState {
  past: Snapshot[];
  future: Snapshot[];
  /** Per Tweak 07 §6 — top 10 frames hydrated from sessionStorage. */
  hydratedFromSession: boolean;

  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  /** Manual push hook for non-store actions (Tweaks 01–06 hooks). */
  recordSnapshot: (label?: string) => void;
  /** Flush any pending coalesced snapshot immediately (tests + beforeunload). */
  flush: () => void;
  /** Test-only — wipe all history. */
  reset: () => void;
}

/**
 * Deep-clone helper. Snapshot payloads are pure data (no functions, no
 * cycles, no Dates) so JSON round-trip is exact.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function takeSnapshot(label?: string): Snapshot {
  return {
    property: clone(usePropertyStore.getState().property),
    walls: clone(useWallStore.getState().walls),
    floorZones: clone(useFloorZoneStore.getState().zones),
    wallTreatments: clone(useWallTreatmentStore.getState().treatments),
    label,
  };
}

function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  // Pure-data payloads — JSON identity is exact for our object shapes.
  if (JSON.stringify(a.property) !== JSON.stringify(b.property)) return false;
  if (JSON.stringify(a.walls) !== JSON.stringify(b.walls)) return false;
  if (JSON.stringify(a.floorZones) !== JSON.stringify(b.floorZones)) return false;
  if (JSON.stringify(a.wallTreatments) !== JSON.stringify(b.wallTreatments)) return false;
  return true;
}

function readSessionFrames(): Snapshot[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Snapshot =>
        s && typeof s === 'object' && 'property' in s && 'walls' in s,
    );
  } catch {
    return [];
  }
}

function writeSessionFrames(past: Snapshot[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const top = past.slice(-SESSION_PERSIST_LIMIT);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(top));
  } catch {
    // sessionStorage may be unavailable in some embeds — degrade
    // silently to in-memory only.
  }
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: readSessionFrames(),
  future: [],
  hydratedFromSession: readSessionFrames().length > 0,

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    flushPendingPush();
    const { past } = get();
    if (past.length === 0) return;
    const target = past[past.length - 1];
    const currentSnap = takeSnapshot();
    const newPast = past.slice(0, -1);
    set((s) => ({ past: newPast, future: [...s.future, currentSnap] }));
    applySnapshotInternal(target);
    writeSessionFrames(newPast);
    // Fix 2.3 (Vic 2026-05-22): undo is silent — no toast. The Ctrl+Z
    // hotkey is its own feedback; the stack of toasts during fast
    // repeated undos was visual spam.
  },

  redo: () => {
    flushPendingPush();
    const { future } = get();
    if (future.length === 0) return;
    const target = future[future.length - 1];
    const currentSnap = takeSnapshot();
    const newFuture = future.slice(0, -1);
    set((s) => ({ past: [...s.past, currentSnap], future: newFuture }));
    applySnapshotInternal(target);
    writeSessionFrames(get().past);
    // Fix 2.3 (Vic 2026-05-22): redo is silent for parity with undo.
  },

  recordSnapshot: (label) => {
    // External callers (rotate / floor-paint / wall-treatment / 3D-place
    // future hooks) snapshot the PRIOR state explicitly. Each call is
    // treated as one user-perceived action — no coalescing.
    const snap = takeSnapshot(label);
    set((s) => ({
      past: capPast([...s.past, snap]),
      future: [],
    }));
    writeSessionFrames(get().past);
  },

  flush: () => {
    flushPendingPush();
  },

  reset: () => {
    cancelPendingPush();
    set({ past: [], future: [], hydratedFromSession: false });
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    }
  },
}));

function capPast(past: Snapshot[]): Snapshot[] {
  if (past.length <= HISTORY_LIMIT) return past;
  return past.slice(past.length - HISTORY_LIMIT);
}

// ---------------------------------------------------------------------------
// Subscription machinery
// ---------------------------------------------------------------------------

let installed = false;
let suppressRecording = false;
let lastSeenSnapshot: Snapshot = takeSnapshot();
let pendingPrior: Snapshot | null = null;
let pendingLabel: string | undefined;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
let coalesceMsActive = DEFAULT_COALESCE_MS;
let unsubscribers: Array<() => void> = [];

function applySnapshotInternal(snap: Snapshot): void {
  suppressRecording = true;
  try {
    usePropertyStore.setState({
      property: clone(snap.property),
      selectedInstanceId: null,
    });
    useWallStore.getState().replace(clone(snap.walls));
    useFloorZoneStore.getState().replace(clone(snap.floorZones ?? []));
    useWallTreatmentStore.getState().replace(clone(snap.wallTreatments ?? {}));
    lastSeenSnapshot = takeSnapshot();
  } finally {
    suppressRecording = false;
  }
}

function commitPending(): void {
  if (pendingPrior === null) return;
  const newCurrent = takeSnapshot();
  if (!snapshotsEqual(pendingPrior, newCurrent)) {
    const prior = pendingPrior;
    prior.label = pendingLabel;
    useHistoryStore.setState((s) => ({
      past: capPast([...s.past, prior]),
      future: [],
    }));
    writeSessionFrames(useHistoryStore.getState().past);
  }
  pendingPrior = null;
  pendingLabel = undefined;
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
}

function flushPendingPush(): void {
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
  commitPending();
}

function cancelPendingPush(): void {
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
  pendingPrior = null;
  pendingLabel = undefined;
}

function onPotentialChange(label?: string): void {
  if (suppressRecording) return;
  const nextSnap = takeSnapshot();
  if (snapshotsEqual(lastSeenSnapshot, nextSnap)) return;

  if (pendingPrior === null) {
    pendingPrior = lastSeenSnapshot;
    pendingLabel = label;
  }
  lastSeenSnapshot = nextSnap;

  if (coalesceMsActive <= 0) {
    commitPending();
    return;
  }

  if (coalesceTimer) clearTimeout(coalesceTimer);
  coalesceTimer = setTimeout(() => {
    coalesceTimer = null;
    commitPending();
  }, coalesceMsActive);
}

/**
 * Wire propertyStore + wallStore subscriptions to the snapshot recorder.
 *
 * Call once on app mount (idempotent). Returns a tear-down for tests.
 * `coalesceMs = 0` makes every change a separate frame — used by tests
 * so they don't have to advance timers.
 */
export function installHistorySubscriptions(
  options: { coalesceMs?: number } = {},
): () => void {
  coalesceMsActive = options.coalesceMs ?? DEFAULT_COALESCE_MS;
  if (installed) return () => uninstallHistorySubscriptions();
  installed = true;
  lastSeenSnapshot = takeSnapshot();

  unsubscribers.push(
    usePropertyStore.subscribe(() => onPotentialChange()),
  );
  unsubscribers.push(
    useWallStore.subscribe(() => onPotentialChange()),
  );
  // Phase C — floor zones + wall treatments join the same atomic
  // history so a paint-flood or floor-zone-paint is undoable from day
  // one alongside place/move/draw-wall.
  unsubscribers.push(
    useFloorZoneStore.subscribe(() => onPotentialChange()),
  );
  unsubscribers.push(
    useWallTreatmentStore.subscribe(() => onPotentialChange()),
  );

  if (typeof window !== 'undefined') {
    const onBeforeUnload = () => flushPendingPush();
    window.addEventListener('beforeunload', onBeforeUnload);
    unsubscribers.push(() => window.removeEventListener('beforeunload', onBeforeUnload));
  }

  return () => uninstallHistorySubscriptions();
}

function uninstallHistorySubscriptions(): void {
  for (const fn of unsubscribers) fn();
  unsubscribers = [];
  installed = false;
  cancelPendingPush();
}

// ---------------------------------------------------------------------------
// Test-only exports — internal harness for unit tests.
// ---------------------------------------------------------------------------

export const __test = {
  applySnapshot: applySnapshotInternal,
  flushPendingPush,
  resetSubscriptions: () => {
    uninstallHistorySubscriptions();
    useHistoryStore.getState().reset();
    lastSeenSnapshot = takeSnapshot();
  },
  isInstalled: () => installed,
};
