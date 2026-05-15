/**
 * OMS Wave 2.2 — Konva image cache.
 *
 * Module-level Map<url, HTMLImageElement> so concurrent placedItems
 * sharing the same product image only load the asset once. The hook
 * returns the image when ready (or null while loading / on error).
 */

import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

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
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
  pending.set(url, p);
  p.finally(() => pending.delete(url));
  return p;
}

export function useImageCache(url: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(() =>
    url ? cache.get(url) ?? null : null,
  );

  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const cached = cache.get(url);
    if (cached) {
      setImg(cached);
      return;
    }
    let cancelled = false;
    loadImage(url)
      .then((loaded) => {
        if (!cancelled) setImg(loaded);
      })
      .catch(() => {
        // Swallow — the consumer falls back to the colored rect.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return img;
}
