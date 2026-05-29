/**
 * OMS Wave 2.2 — Konva image cache.
 *
 * Module-level Map<url, HTMLImageElement> so concurrent placedItems
 * sharing the same product image only load the asset once. The hook
 * returns the image when ready (or null while loading / on error).
 *
 * Polish (2026-05-29) — the hook now also exposes a load *status* via the
 * sibling `useImageCacheStatus` hook so consumers can distinguish the
 * "still hydrating" state (show a brand shimmer skeleton) from the
 * "genuinely failed / no URL" state (fall back to the coloured rect).
 * `useImageCache` keeps its original `HTMLImageElement | null` signature
 * for backward compatibility with every existing call site + test.
 */

import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();
// Polish (2026-05-29) — remember which URLs have permanently failed so a
// re-mount of the same product doesn't flash a shimmer for an asset we
// already know is a 404. Loaded URLs live in `cache`; failed ones here.
const failed = new Set<string>();

/** Image-cache load lifecycle for a single URL. */
export type ImageCacheStatus = 'idle' | 'loading' | 'loaded' | 'error';

function loadImage(url: string): Promise<HTMLImageElement> {
  const existing = pending.get(url);
  if (existing) return existing;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      failed.add(url);
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
  pending.set(url, p);
  p.finally(() => pending.delete(url));
  return p;
}

/**
 * Returns the cached image + its load status for a URL.
 *
 *  - `idle`    — no URL supplied (nothing to load).
 *  - `loading` — the asset is in-flight (show a hydrating skeleton).
 *  - `loaded`  — the image is ready (`image` is non-null).
 *  - `error`   — the asset failed (fall back to the coloured rect).
 */
export function useImageCacheStatus(url: string | null | undefined): {
  image: HTMLImageElement | null;
  status: ImageCacheStatus;
} {
  const [state, setState] = useState<{
    image: HTMLImageElement | null;
    status: ImageCacheStatus;
  }>(() => {
    if (!url) return { image: null, status: 'idle' };
    const cached = cache.get(url);
    if (cached) return { image: cached, status: 'loaded' };
    if (failed.has(url)) return { image: null, status: 'error' };
    return { image: null, status: 'loading' };
  });

  useEffect(() => {
    if (!url) {
      setState({ image: null, status: 'idle' });
      return;
    }
    const cached = cache.get(url);
    if (cached) {
      setState({ image: cached, status: 'loaded' });
      return;
    }
    if (failed.has(url)) {
      setState({ image: null, status: 'error' });
      return;
    }
    let cancelled = false;
    setState({ image: null, status: 'loading' });
    loadImage(url)
      .then((loaded) => {
        if (!cancelled) setState({ image: loaded, status: 'loaded' });
      })
      .catch(() => {
        // Swallow — surface as `error` so the consumer can fall back to
        // the coloured rect instead of an indefinite shimmer.
        if (!cancelled) setState({ image: null, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

export function useImageCache(url: string | null | undefined): HTMLImageElement | null {
  return useImageCacheStatus(url).image;
}
