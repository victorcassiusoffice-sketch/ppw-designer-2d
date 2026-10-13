/** Pitch pages pass `?pitch=1` on /embed and /demo. Read once at boot.
 * Absent flag leaves /studio, /embed and ?client= unchanged. */
export function readPitchEmbed(search: string): boolean {
  try {
    return new URLSearchParams(search).get('pitch') === '1';
  } catch {
    return false;
  }
}

/**
 * The public /demo is the live demo inside every outreach deck, so it is
 * price-free and name-free without the flag (row D6-DESIGNER-DEMO-CLEAN-1013,
 * 2026-10-13): no price, currency, cart count, retailer or client name.
 * /designer, /designer?demo=<slug>, /studio and /embed/designer are unchanged.
 */
export function isPriceFreeDemoPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === '/demo';
}

let cached: boolean | null = null;

/** True on /demo, and on any route opened with `?pitch=1`. */
export function isPitchEmbed(): boolean {
  if (cached === null) {
    cached = typeof window !== 'undefined'
      && (readPitchEmbed(window.location.search) || isPriceFreeDemoPath(window.location.pathname));
  }
  return cached;
}

/** Tests only. The app reads the flag once and keeps that answer. */
export function resetPitchEmbedCache(): void {
  cached = null;
}
