/**
 * Slug generator for merchant URLs (e.g. /suppliers/{slug}).
 *
 * Phase 1 keeps it simple: lower-case, replace non-ASCII-alphanum with
 * hyphens, collapse runs, trim. Uniqueness is the caller's
 * responsibility — they pass an `isTaken` predicate and we append a
 * short suffix until we find a free slot.
 *
 * Phase 2 may switch to ULIDs once we have an externally-visible
 * merchant directory; for now slugs are mostly internal so collision
 * pressure is low.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Generate a slug that isn't yet taken according to `isTaken`. Tries
 * the bare slug first; on collision appends a 4-char random suffix.
 * Bails after 5 attempts and throws — callers should treat that as a
 * 500 (extremely unlikely in practice).
 */
export async function uniqueSlug(
  raw: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(raw) || 'merchant';
  if (!(await isTaken(base))) return base;
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error('Could not generate unique slug after 5 attempts');
}
