/**
 * shareImage — V-RENDER-4 (2026-05-27).
 *
 * Pure, framework-free helpers for the Designer "Share render" button.
 * Kept out of RoomCanvas (and out of any react-konva import graph) so
 * the base64 decode can be unit-tested in the node vitest environment.
 *
 * Why a synchronous decode: iOS Safari only honours navigator.share()
 * when it is called inside the user-gesture tap handler with NO async
 * network round-trip preceding it. `fetch(dataUrl).then(r => r.blob())`
 * inserts a microtask/await gap that trips NotAllowedError on iOS, so we
 * decode the base64 ourselves (atob + Uint8Array) — fully synchronous.
 */

/** Decode a `data:<mime>;base64,<payload>` URL into a Blob, synchronously. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Not a data URL');
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Trigger a browser download of a data URL via a synthetic anchor click. */
export function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Mobile capture fix (2026-06-01).
 *
 * iOS Safari (and some Android WebViews) silently return a BLANK/black
 * image from `canvas.toDataURL()` once the backing canvas exceeds the
 * per-canvas pixel-area or single-dimension limit. The Konva "Share
 * render" exported at a fixed `pixelRatio: 2`, so a large room on a
 * retina device blew past the limit and the user got a blank PNG — i.e.
 * "screenshots don't work on mobile".
 *
 * These constants are the conservative floor that holds across the iOS
 * Safari fleet. Newer devices allow more, but clamping to the floor only
 * costs a little sharpness on very large stages while guaranteeing a
 * non-blank capture everywhere.
 */
export const MAX_CANVAS_AREA_PX = 16_777_216; // 4096 × 4096
export const MAX_CANVAS_DIM_PX = 4096;

/**
 * Largest pixelRatio ≤ `desired` such that the exported canvas
 * (`cssWidth*pr` × `cssHeight*pr`) stays within the iOS Safari canvas
 * area + dimension limits. Returns `desired` unchanged when it already
 * fits (the common phone/desktop case), so sharpness is only traded away
 * when a capture would otherwise come back blank. Never returns < a small
 * floor so a degenerate (0-size) stage can't produce a 0-ratio.
 */
export function clampCapturePixelRatio(
  cssWidth: number,
  cssHeight: number,
  desired = 2,
): number {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const byArea = Math.sqrt(MAX_CANVAS_AREA_PX / (w * h));
  const byDim = MAX_CANVAS_DIM_PX / Math.max(w, h);
  const limit = Math.min(byArea, byDim);
  // Don't upscale beyond the requested ratio; don't drop below 0.5 (a
  // capture is better slightly soft than not at all).
  return Math.max(0.5, Math.min(desired, limit));
}

/**
 * Konva `Stage`-shaped duck type — only the bits the capture path needs.
 * Kept structural so this stays unit-testable without importing Konva.
 */
export interface CapturableStage {
  width(): number;
  height(): number;
  toDataURL(config?: { pixelRatio?: number }): string;
}

/**
 * Capture a Konva stage to a PNG data URL, defensively.
 *
 *  - Clamps `pixelRatio` so iOS Safari doesn't return a blank image on a
 *    large retina stage.
 *  - Catches the `SecurityError` thrown when the canvas is tainted by a
 *    cross-origin image with no CORS headers (returns `null` instead of
 *    letting the throw blow up the tap handler).
 *
 * Returns the data URL on success, or `null` on any failure so the caller
 * can surface a toast instead of silently doing nothing.
 */
export function safeStageDataUrl(
  stage: CapturableStage,
  desiredPixelRatio = 2,
): string | null {
  try {
    const pixelRatio = clampCapturePixelRatio(
      stage.width(),
      stage.height(),
      desiredPixelRatio,
    );
    const url = stage.toDataURL({ pixelRatio });
    // A valid PNG data URL is well over a few hundred chars; a blank/failed
    // export shows up as an empty or truncated string on some engines.
    if (!url || url.length < 64) return null;
    return url;
  } catch {
    return null;
  }
}
