/**
 * Sims-Parity DT-24 — Vercel Blob asset host helpers (L2.09).
 *
 * Procedural-only (V8=NO) means hero glTF assets aren't fetched yet,
 * but the contract surface is here for the future flip:
 *
 *   meshAssetUrl(slug) — returns the public Blob URL where the
 *     `${slug}.glb` would live once a hero mesh is commissioned.
 *
 *   textureAssetUrl(name) — `wood-plank-2k.ktx2`, `grass-2k.ktx2`,
 *     `sky-hdr.env`. v1 returns the placehold.co fallback so the
 *     renderer never blocks on a missing CDN asset.
 *
 * Vercel Blob limits: 5 GB free tier; assets must be public; mesh
 * cap 1 MB / file per the V8 brief.
 */

const BLOB_PREFIX = 'https://blob.vercel-storage.com/ppw-assets';

export function meshAssetUrl(slug: string): string {
  return `${BLOB_PREFIX}/meshes/${encodeURIComponent(slug)}.glb`;
}

export function textureAssetUrl(name: string): string {
  return `${BLOB_PREFIX}/textures/${encodeURIComponent(name)}`;
}

/**
 * Pre-bundle limits enforced at the Playwright budget step. Numbers
 * picked from data-flow §7 + the spec text "5 MB scene budget".
 */
export const BUDGET = {
  /** Total scene asset weight (meshes + textures combined). */
  totalSceneBytes: 5 * 1024 * 1024,
  /** Per-mesh cap (V8 = $1,800 brief specified ≤ 1 MB per glTF). */
  perMeshBytes: 1 * 1024 * 1024,
  /** Marketing-route bundle delta gate (DT-21 dynamic-import goal). */
  marketingRouteDeltaBytes: 250 * 1024,
} as const;
