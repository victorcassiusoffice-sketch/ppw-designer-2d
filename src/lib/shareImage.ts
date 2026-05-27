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
