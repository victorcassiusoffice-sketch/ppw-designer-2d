/**
 * levels — storeys ("floors") of a property, Sims world 2026-08-29.
 *
 * Pure helpers only; no store reads. Everything here is defensive about
 * ABSENT fields because every property persisted before levels existed has
 * none of them:
 *
 *   • `Property.levels` absent/empty  ⇒ a single ground floor.
 *   • `Property.activeLevelId` absent ⇒ ground.
 *   • `Room.levelId` absent           ⇒ ground.
 *
 * That "absent means ground" rule is the canonical form, not a fallback: a
 * ground-floor room is stored WITHOUT a levelId, so a single-storey design
 * saved today is byte-identical to one saved before this shipped. Never test
 * `room.levelId === 'ground'` — go through `roomLevelId()`.
 */

export const GROUND_LEVEL_ID = 'ground';

export interface Level {
  id: string;
  name: string;
  /** Storey order, ground = 0. Sorting key; gaps are allowed after a removal. */
  index: number;
}

/** A fresh copy each call so callers can never mutate a shared default. */
export function groundLevel(): Level {
  return { id: GROUND_LEVEL_ID, name: 'Ground floor', index: 0 };
}

/** Sorted by index, ties broken by id so the order is stable across reloads. */
export function sortLevels(levels: readonly Level[]): Level[] {
  return [...levels].sort((a, b) => a.index - b.index || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The property's levels, sorted; a lone ground floor when it has none. */
export function levelsOf(p: { levels?: Level[] }): Level[] {
  if (!p.levels || p.levels.length === 0) return [groundLevel()];
  return sortLevels(p.levels);
}

/**
 * The level currently in focus. Falls back to the lowest level when the
 * stored id is absent or points at a level that no longer exists.
 */
export function activeLevelIdOf(p: { levels?: Level[]; activeLevelId?: string }): string {
  const levels = levelsOf(p);
  if (p.activeLevelId && levels.some((l) => l.id === p.activeLevelId)) return p.activeLevelId;
  return levels[0].id;
}

/** Which level a room (or a free wall) sits on. Absent means ground. */
export function roomLevelId(r: { levelId?: string }): string {
  return r.levelId || GROUND_LEVEL_ID;
}

export function roomsOnLevel<T extends { levelId?: string }>(
  rooms: readonly T[],
  levelId: string,
): T[] {
  return rooms.filter((r) => roomLevelId(r) === levelId);
}

export function isOutdoorRoom(r: { kind?: string }): boolean {
  return r.kind === 'outdoor';
}

/**
 * Rooms that draw as rooms — i.e. NOT the per-level outdoor container. The
 * outdoor room is a bucket for items placed outside every polygon; it has no
 * walls of its own, so any list that renders or counts rooms goes through
 * here rather than filtering on `polygon.length`.
 */
export function visibleRooms<T extends { kind?: string }>(rooms: readonly T[]): T[] {
  return rooms.filter((r) => !isOutdoorRoom(r));
}

const ORDINAL_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor'];

/** Display name for a storey index: ordinal for 0..3, then `Level N`. */
export function levelNameForIndex(index: number): string {
  return ORDINAL_NAMES[index] ?? `Level ${index}`;
}

/** Next free index — max + 1, never a re-used slot after a removal. */
export function nextLevelIndex(levels: readonly Level[]): number {
  if (levels.length === 0) return 0;
  return Math.max(...levels.map((l) => l.index)) + 1;
}

/**
 * Name for the level `addLevel` is about to create. Ordinal for the next
 * index; if that name is somehow already taken (a rename, or a hand-edited
 * save), fall back to `Level N` and then a numbered suffix so two tabs can
 * never read the same.
 */
export function nextLevelName(levels: readonly Level[]): string {
  const index = nextLevelIndex(levels);
  const taken = new Set(levels.map((l) => l.name.trim()));
  const ordinal = levelNameForIndex(index);
  if (!taken.has(ordinal)) return ordinal;
  const generic = `Level ${index}`;
  if (!taken.has(generic)) return generic;
  for (let n = 2; ; n++) {
    const candidate = `${generic} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The storey directly beneath `id` (highest index strictly below it), or null. */
export function levelBelow(levels: readonly Level[], id: string): Level | null {
  const me = levels.find((l) => l.id === id);
  if (!me) return null;
  let best: Level | null = null;
  for (const l of levels) {
    if (l.id === id || l.index >= me.index) continue;
    if (best === null || l.index > best.index) best = l;
  }
  return best;
}

/** Validator for persisted payloads — anything that is not a Level is dropped. */
export function isLevelLike(x: unknown): x is Level {
  if (!x || typeof x !== 'object') return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.id === 'string'
    && l.id.length > 0
    && typeof l.name === 'string'
    && typeof l.index === 'number'
    && Number.isFinite(l.index)
  );
}
