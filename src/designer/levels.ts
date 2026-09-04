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

/**
 * The roof (eco / solar 2026-09-04). ONE per property, always the topmost
 * level: its slabs mirror the drawn rooms of the storey beneath it (see
 * `designer/roof.ts`), it has no walls of its own, and solar panels,
 * air-con units, planters and flooring sit on it. Absent until the customer
 * presses Roof or arms a roof-placed product, so every property saved before
 * this shipped is unchanged.
 */
export const ROOF_LEVEL_ID = 'roof';
export const ROOF_LEVEL_NAME = 'Roof';

export interface Level {
  id: string;
  name: string;
  /** Storey order, ground = 0. Sorting key; gaps are allowed after a removal. */
  index: number;
  /**
   * `'roof'` marks the roof level. Absent = a storey (the canonical form, so
   * a pre-roof save is byte-identical). Read through `isRoofLevel()`.
   */
  kind?: 'roof';
}

/** True for the roof level. */
export function isRoofLevel(l: { id?: string; kind?: string } | null | undefined): boolean {
  return !!l && (l.kind === 'roof' || l.id === ROOF_LEVEL_ID);
}

/** The property's roof level, or null when it has none. */
export function roofLevelOf(p: { levels?: Level[] }): Level | null {
  return levelsOf(p).find((l) => isRoofLevel(l)) ?? null;
}

/** Every level that is NOT the roof — the storeys a customer builds on. */
export function storeyLevels(levels: readonly Level[]): Level[] {
  return levels.filter((l) => !isRoofLevel(l));
}

/** A fresh roof level sitting on top of `levels` (index = next storey index). */
export function roofLevel(levels: readonly Level[]): Level {
  return { id: ROOF_LEVEL_ID, name: ROOF_LEVEL_NAME, index: nextLevelIndex(levels), kind: 'roof' };
}

/**
 * A roof slab is a Room of `kind: 'roof'` on the roof level whose polygon
 * mirrors a drawn room on the storey beneath. It renders as a slab (no
 * walls), takes items and flooring, and is rebuilt by `syncRoofRooms`.
 */
export function isRoofRoom(r: { kind?: string } | null | undefined): boolean {
  return !!r && r.kind === 'roof';
}

/** A fresh copy each call so callers can never mutate a shared default. */
export function groundLevel(): Level {
  return { id: GROUND_LEVEL_ID, name: 'Ground floor', index: 0 };
}

/**
 * Sorted by index, ties broken so the ROOF is always last, then by id so the
 * order is stable across reloads.
 */
export function sortLevels(levels: readonly Level[]): Level[] {
  return [...levels].sort(
    (a, b) =>
      a.index - b.index
      || Number(isRoofLevel(a)) - Number(isRoofLevel(b))
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
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

/**
 * Next free STOREY index — max storey index + 1, never a re-used slot after
 * a removal. The roof is not a storey: it always sits at this index and is
 * bumped up by one when a storey is added beneath it (`addLevel`).
 */
export function nextLevelIndex(levels: readonly Level[]): number {
  const storeys = storeyLevels(levels);
  if (storeys.length === 0) return 0;
  return Math.max(...storeys.map((l) => l.index)) + 1;
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
  taken.add(ROOF_LEVEL_NAME);
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
    && (l.kind === undefined || l.kind === 'roof')
  );
}

/**
 * The storey whose rooms the roof sits on: the highest storey that has at
 * least one drawn, non-outdoor room — null when nothing is drawn anywhere.
 * (The roof of a house with an empty first floor is the ground floor's.)
 */
export function roofSourceLevelId(
  levels: readonly Level[],
  rooms: ReadonlyArray<{ levelId?: string; kind?: string; polygon: ReadonlyArray<unknown> }>,
): string | null {
  const storeys = sortLevels(storeyLevels(levels));
  for (let i = storeys.length - 1; i >= 0; i--) {
    const id = storeys[i].id;
    const has = rooms.some(
      (r) => roomLevelId(r) === id && !isOutdoorRoom(r) && !isRoofRoom(r) && r.polygon.length >= 3,
    );
    if (has) return id;
  }
  return null;
}
