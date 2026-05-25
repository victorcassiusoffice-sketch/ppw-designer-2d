/**
 * generateTopDownImage — Phase 5 of the mobile Sims rebuild.
 *
 * Turns a product's 3/4 perspective catalog photo into a top-down
 * orthographic asset for the inventory thumbnails + the on-canvas
 * footprint, using Fal.ai FLUX.1 [schnell] (free tier — already in the
 * PPW stack via the Image Blaster skill).
 *
 * SECURITY (Vic Protocol HARD STOP — credentials never in plain text /
 * never in the client bundle):
 *   • The Fal.ai key is read from `process.env.FAL_KEY` and is ONLY ever
 *     available to the Node backfill script (scripts/backfill-topdown-images.ts).
 *   • In the browser there is NO key. Unless a same-origin proxy endpoint
 *     is explicitly passed (`opts.endpoint`), the util DOES NOT call Fal —
 *     it returns the original image (graceful fallback). The client never
 *     holds or transmits the key, and never hits Fal's paid tier.
 *
 * The primary path is the backfill script: generate at build/backfill
 * time, write `topdown_image_url` into products.json, ship static. Live
 * client-side generation needs a server proxy lambda (flagged to Vic —
 * gated by the Vercel 12-fn cap).
 */
import type { Product } from '../data/products.schema';

/** Fal.ai FLUX.1 [schnell] text-to-image endpoint. */
export const FAL_FLUX_SCHNELL_ENDPOINT = 'https://fal.run/fal-ai/flux/schnell';

/** Free-tier ceiling — at most 5 generations per rolling minute. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const callTimestamps: number[] = [];

/** Minimal async store interface so tests can inject an in-memory cache. */
export interface TopDownCache {
  get(key: string): Promise<string | null>;
  set(key: string, url: string): Promise<void>;
}

export interface GenerateTopDownOptions {
  /** Injectable fetch (tests / Node). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Fal.ai API key. Server/script side ONLY. Leave undefined in the
   * browser — without it (and without `endpoint`) the util falls back.
   */
  apiKey?: string;
  /**
   * Endpoint override. A same-origin proxy (e.g. `/api/topdown`) lets the
   * browser request a generation without ever seeing the key. Defaults to
   * the Fal endpoint (only reachable when `apiKey` is also supplied).
   */
  endpoint?: string;
  /** Cache override (defaults to IndexedDB in browser, in-memory in Node). */
  cache?: TopDownCache;
  /** Skip the rate-limiter (tests / trusted batch with own pacing). */
  skipRateLimit?: boolean;
  signal?: AbortSignal;
}

/** The prompt template from the brief (§5.1). */
export function topDownPrompt(product: Product): string {
  const dims = product.dimensions_cm;
  return (
    `Top-down orthographic view of: ${product.name}, ${product.category}. ` +
    `Studio white background, soft shadow. Match scale to ` +
    `${dims.length}×${dims.width}×${dims.height} cm. Show top surface only. ` +
    `Cinematic crispness. No watermark.`
  );
}

function cacheKeyFor(product: Product): string {
  return `${product.image_url || product.id}__topdown`;
}

/** Original 3/4 image (or SVG placeholder) — the graceful fallback. */
function fallbackImage(product: Product): string {
  return product.topdown_image_url || product.image_url || '';
}

async function acquireRateLimit(signal?: AbortSignal): Promise<void> {
  // Drop timestamps outside the rolling window.
  const now = Date.now();
  while (callTimestamps.length && now - callTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= RATE_LIMIT_MAX) {
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - callTimestamps[0]) + 10;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, waitMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
    return acquireRateLimit(signal);
  }
  callTimestamps.push(Date.now());
}

// ── IndexedDB cache (browser) ─────────────────────────────────────────
const DB_NAME = 'ppw-topdown';
const STORE = 'images';

function idbCache(): TopDownCache {
  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return {
    async get(key) {
      const db = await open();
      return new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = () => resolve((r.result as string) ?? null);
        r.onerror = () => resolve(null);
      });
    },
    async set(key, url) {
      const db = await open();
      return new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(url, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    },
  };
}

const memoryStore = new Map<string, string>();
const memoryCache: TopDownCache = {
  async get(key) {
    return memoryStore.get(key) ?? null;
  },
  async set(key, url) {
    memoryStore.set(key, url);
  },
};

function defaultCache(opts: GenerateTopDownOptions): TopDownCache {
  if (opts.cache) return opts.cache;
  if (typeof indexedDB !== 'undefined') return idbCache();
  return memoryCache;
}

interface FalImageResponse {
  images?: { url: string }[];
}

/**
 * Generate (or fetch cached) a top-down image URL for a product.
 * Never throws — on any error, quota hit, missing key, or aborted call it
 * returns the original-image fallback so the UI always has something.
 */
export async function generateTopDownImage(
  product: Product,
  opts: GenerateTopDownOptions = {},
): Promise<string> {
  const cache = defaultCache(opts);
  const key = cacheKeyFor(product);

  const cached = await cache.get(key).catch(() => null);
  if (cached) return cached;

  const endpoint = opts.endpoint ?? FAL_FLUX_SCHNELL_ENDPOINT;
  const callingFalDirect = endpoint === FAL_FLUX_SCHNELL_ENDPOINT;

  // No key + hitting Fal directly = browser with no proxy → never call,
  // never expose. Fall back to the original image.
  if (callingFalDirect && !opts.apiKey) {
    return fallbackImage(product);
  }

  const doFetch = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!doFetch) return fallbackImage(product);

  try {
    if (!opts.skipRateLimit) await acquireRateLimit(opts.signal);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Authorization only when talking to Fal directly with a key (script).
    if (callingFalDirect && opts.apiKey) headers.Authorization = `Key ${opts.apiKey}`;

    const res = await doFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: topDownPrompt(product),
        image_size: 'square_hd',
        num_images: 1,
        // Free-tier safe: schnell defaults; never pass paid-tier flags.
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      // 402/429 = quota/rate; anything non-2xx → graceful fallback.
      return fallbackImage(product);
    }
    const data = (await res.json()) as FalImageResponse;
    const url = data.images?.[0]?.url;
    if (!url) return fallbackImage(product);

    await cache.set(key, url).catch(() => undefined);
    return url;
  } catch {
    return fallbackImage(product);
  }
}

/** Test/maintenance helper — clears the in-memory rate-limit window. */
export function __resetRateLimitForTests(): void {
  callTimestamps.length = 0;
  memoryStore.clear();
}
