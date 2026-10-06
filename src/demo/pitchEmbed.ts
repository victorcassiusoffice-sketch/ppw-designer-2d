/** Pitch pages pass `?pitch=1` on /embed and /demo. Read once at boot.
 * Absent flag leaves /demo, /studio, /embed and ?client= unchanged. */
export function readPitchEmbed(search: string): boolean {
  try {
    return new URLSearchParams(search).get('pitch') === '1';
  } catch {
    return false;
  }
}

let cached: boolean | null = null;

export function isPitchEmbed(): boolean {
  if (cached === null) cached = typeof window !== 'undefined' && readPitchEmbed(window.location.search);
  return cached;
}

/** Tests only. The app reads the flag once and keeps that answer. */
export function resetPitchEmbedCache(): void {
  cached = null;
}
