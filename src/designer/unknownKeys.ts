/**
 * Keys of a stored design that this build does not know.
 *
 * The loader of a design copies the fields it knows, one by one, and cleans each. Until now a key it did not
 * know was dropped on every open and save: a field written by a newer build of this app, or by the desktop game,
 * was lost the first time an older build touched the design. This keeper carries such a key through as it is.
 *
 * It is careful about what it carries: the name must be a plain word, the value must be plain JSON of a bounded
 * size, and it is copied, never shared. A key the build knows is never touched here: the loader's own cleaning
 * decides about it, and a known key with a bad value stays dropped.
 */

/** A plain word: a letter, then letters, digits or underscores. No dash, no dot, no leading underscore. */
const PLAIN_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** Names that are never carried, whatever they hold: object machinery, and what belongs to one screen only. */
const NEVER_KEPT: ReadonlySet<string> = new Set(['constructor', 'prototype', 'selectedItemId']);

/** The most values (objects, lists, texts, numbers) one unknown key may hold, and how deep they may nest. */
export const UNKNOWN_KEY_LIMITS = { values: 20000, depth: 12 } as const;

function isPlainJson(value: unknown, budget: { left: number }, depth: number): boolean {
  if (--budget.left < 0 || depth > UNKNOWN_KEY_LIMITS.depth) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((entry) => isPlainJson(entry, budget, depth + 1));
  if (typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, entry]) => key !== '__proto__' && isPlainJson(entry, budget, depth + 1),
  );
}

/**
 * Copies into `into` every own key of `raw` that `known` does not name, when its name is a plain word and its
 * value is plain JSON within the limits. A key already present in `into` is left alone.
 * Returns the names it kept, in order of the alphabet.
 */
export function keepUnknownKeys(
  raw: unknown,
  known: ReadonlySet<string>,
  into: Record<string, unknown>,
): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
  const kept: string[] = [];
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (known.has(name) || NEVER_KEPT.has(name) || !PLAIN_NAME.test(name)) continue;
    if (value === undefined || Object.prototype.hasOwnProperty.call(into, name)) continue;
    if (!isPlainJson(value, { left: UNKNOWN_KEY_LIMITS.values }, 0)) continue;
    into[name] = JSON.parse(JSON.stringify(value)) as unknown;
    kept.push(name);
  }
  return kept.sort();
}
