/**
 * `true` below Tailwind's `md` (768 px) — the phone tier, where the tool
 * HUD cards own the bottom of the screen and the DetailsPanel is a bottom
 * sheet rather than a right-hand column.
 *
 * Phone pass (2026-09-16): lifted out of HelpOverlay so App, the Sims strip
 * and the launcher agree on ONE definition of "phone". Falls back to "not
 * below md" where `matchMedia` is missing (jsdom / SSR) — tests that want
 * the phone tier stub `window.matchMedia`.
 */
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767.98px)';

export function useBelowMd(): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return matches;
}
