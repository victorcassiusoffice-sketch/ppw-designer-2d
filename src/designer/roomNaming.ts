/**
 * roomNaming — ONE source of truth for what a new room is called.
 *
 * Vic 2026-08-28: "there is also no need for room 2, 3 etc."
 *
 * He was reacting to a genuine mess. There were FOUR competing auto-naming
 * schemes, two of them dead code:
 *
 *   draw a room ......... always literally "Room 1" (a hard-coded constant,
 *                         reset on every entry to draw mode — so drawing three
 *                         rooms gave three rows all reading "Room 1")
 *   quick rectangle ..... `Room ${rooms.length + 1}` → "Room 2", "Room 3"
 *   add-room modal ...... "New Room"
 *   store fallbacks ..... `Room ${n + 1}`, unreachable
 *
 * So the sidebar showed a mixture of identical and numbered names and was
 * useless as navigation. That is what made the numbered list feel pointless.
 *
 * THE FIX, per what professional floor-plan tools actually do: never ship
 * "Room 1" as a final label. Rooms get a TYPE from a domain vocabulary
 * (Treatment Room, Sauna, Recovery Lounge…), the ordinal stays hidden, and it
 * is surfaced only to disambiguate a second room of the same type. The type is
 * also the commercial keystone — it is what will let the catalog filter itself
 * to what belongs in that kind of space.
 */

/**
 * The wellness vocabulary, in the order a facility is usually laid out.
 *
 * First-come order matters: a fresh plan's first room becomes "Treatment
 * Room", which is the room PPW actually sells, rather than a meaningless
 * ordinal.
 */
export const ROOM_TYPES = [
  'Treatment Room',
  'Massage Studio',
  'Recovery Lounge',
  'Gym Floor',
  'Movement Studio',
  'Sauna',
  'Steam Room',
  'Consultation Room',
  'Reception',
  'Changing Room',
  'Storage',
  'WC',
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

/** The generic fallback, used once the vocabulary is exhausted. */
export const GENERIC_ROOM_NAME = 'Room';

interface NamedRoom {
  name: string;
}

/**
 * The name to give the next room.
 *
 * Walks the vocabulary and returns the first type not already in use. Once
 * every type is taken (or a caller asks for a specific type that is taken), it
 * falls back to numbering THAT type — "Treatment Room 2" — which is how a
 * plan actually reads, rather than a global counter that produces "Room 7"
 * next to "Sauna".
 *
 * Blank seed rooms are ignored by the caller, not here: this function only
 * needs the names already spoken for.
 */
export function nextRoomName(rooms: readonly NamedRoom[], preferred?: string): string {
  const taken = new Set(rooms.map((r) => (r.name ?? '').trim()).filter(Boolean));

  if (preferred) return disambiguate(preferred, taken);

  for (const t of ROOM_TYPES) {
    if (!taken.has(t)) return t;
  }
  return disambiguate(GENERIC_ROOM_NAME, taken);
}

/** `base`, or `base N` for the first N that is free. */
export function disambiguate(base: string, taken: ReadonlySet<string>): string {
  const trimmed = base.trim() || GENERIC_ROOM_NAME;
  if (!taken.has(trimmed)) return trimmed;
  for (let n = 2; n < 500; n++) {
    const candidate = `${trimmed} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return trimmed;
}

/**
 * Is this one of the auto-generated placeholder names?
 *
 * Used to decide whether to nudge the customer to name a room themselves —
 * and to keep the old "Room N" names recognisable as placeholders so a
 * property saved before this change is not treated as deliberately named.
 */
export function isPlaceholderName(name: string): boolean {
  const n = (name ?? '').trim();
  if (!n) return true;
  return /^(room|new room)(\s+\d+)?$/i.test(n);
}
