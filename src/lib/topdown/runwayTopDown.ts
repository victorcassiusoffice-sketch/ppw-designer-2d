/**
 * Runway Dev API top-down generator — image-conditioned.
 *
 * Replaces the dead Fal.ai FLUX *schnell* text-to-image path
 * (`src/lib/generateTopDownImage.ts`, deprecated). The core flaw of the
 * old pipeline (findings §4) was that it was PURE text-to-image: it never
 * passed the merchant's real product photo, so it hallucinated a generic
 * lookalike from a thin prompt. This module feeds the actual product photo
 * to Runway `gen4_image` as a `referenceImages` conditioning image, and
 * asks for a flat orthographic top-down on a plain background.
 *
 * Runway Dev API shape (proven by media-dept/runway_master_runner.py):
 *   POST https://api.dev.runwayml.com/v1/text_to_image
 *     headers: Authorization: Bearer <key>, X-Runway-Version: 2024-11-06
 *     body: { model, promptText, ratio, referenceImages: [{ uri, tag }] }
 *   → { id }  then poll GET /v1/tasks/{id} until SUCCEEDED → output[0] = URL
 *
 * SECURITY (Vic Protocol HARD STOP): the key is read from the environment
 * / passed in by the caller (server + scripts ONLY). It is never logged,
 * never returned, never shipped in the client bundle. This module makes NO
 * network call unless a caller supplies `apiKey` — there is no browser path.
 *
 * COST: gen4_image is 5 cr (720p) / 8 cr (1080p) ≈ $0.05–$0.08/image. The
 * caller tracks spend against the $30 project cap; this module surfaces the
 * task id so credit deltas can be reconciled against the org balance.
 */

import {
  type Gen4ImageRatio,
  type GeminiImageRatio,
  type RunwayImageModel,
  nearestRatioForModel,
} from './footprintCanvas.js';

export const RUNWAY_API_BASE = 'https://api.dev.runwayml.com';
export const RUNWAY_API_VERSION = '2024-11-06';
/**
 * Shipped default. `gemini_image3_pro` is RECOMMENDED for viewpoint fidelity
 * (see RECOMMENDED_TOPDOWN_MODEL) but is a paid-tier / cost-gate decision —
 * pass `model` to override once approved.
 */
export const RUNWAY_TOPDOWN_MODEL: RunwayImageModel = 'gen4_image';

/** Approx credit cost of one gen4_image at 1080p — for est-cost gating. */
export const GEN4_IMAGE_CREDITS_1080P = 8;
export const USD_PER_CREDIT = 0.01;

export interface TopDownSubject {
  name: string;
  category: string;
  widthCm: number;
  depthCm: number;
}

/**
 * The rewritten prompt (findings §4). Flat orthographic plan asset, product
 * photographed directly from above, centred, filling the frame, plain
 * background for clean matte extraction, no perspective / props / shadow /
 * reflections / text. `@product` binds the reference image so the model
 * renders the ACTUAL product, not a generic lookalike.
 */
export function buildTopDownPrompt(subject: TopDownSubject): string {
  return (
    `A true bird's-eye plan view of @product — the ${subject.name} (${subject.category}) — ` +
    `photographed from a camera mounted on the ceiling looking straight down at the floor. ` +
    `Overhead orthographic floor-plan view, zero perspective, we see only the top surfaces and the ` +
    `floor footprint outline; the front face is NOT visible. Same object as @product with identical ` +
    `shape, colour, materials and proportions. Product centred and filling the frame. ` +
    `Flat even studio lighting, no cast shadow, no reflections, no props, no people, no packaging. ` +
    `Isolated on a pure solid WHITE seamless background (#FFFFFF), no floor texture, no surface, no scenery. ` +
    `No text, no watermark, no logo overlay.`
  );
}

/** Negative-intent guidance folded into the prompt tail (gen4 has no separate field). */
export const TOPDOWN_NEGATIVE =
  'front view, perspective, angle, 3/4 view, side view, tilt, drop shadow, grey background, floor, ground, surface texture, background scene, text, watermark';

export interface GenerateTopDownRunwayOptions {
  /** Runway Dev API key (server/script only — never the browser). */
  apiKey: string;
  /**
   * Reference image the model conditions on: the merchant's real product
   * photo. An https URL (Vercel Blob) or a `data:image/...;base64,` URI.
   */
  referenceImageUri: string;
  subject: TopDownSubject;
  /** Runway image model. Defaults to RUNWAY_TOPDOWN_MODEL (gen4_image). */
  model?: RunwayImageModel;
  /** Override generation ratio; defaults to nearest-footprint-aspect for the model. */
  ratio?: Gen4ImageRatio | GeminiImageRatio;
  /** Injectable fetch (tests / Node). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable sleep (tests). Defaults to real setTimeout. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** Poll interval + ceiling. */
  pollIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GenerateTopDownRunwayResult {
  ok: boolean;
  /** Ephemeral Runway CDN URL of the generated image (download promptly). */
  imageUrl?: string;
  taskId?: string;
  ratio: string;
  error?: string;
}

interface TaskResponse {
  id?: string;
  status?: 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  output?: string[];
  failure?: string;
  failureCode?: string;
}

async function realSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Generate a top-down image conditioned on the product photo. Returns the
 * ephemeral Runway image URL on success. NEVER throws for API/quota errors —
 * returns `{ ok: false, error }` so the caller can log + fall back to the
 * original photo. The key is never included in any error string.
 */
export async function generateTopDownRunway(
  opts: GenerateTopDownRunwayOptions,
): Promise<GenerateTopDownRunwayResult> {
  const model = opts.model ?? RUNWAY_TOPDOWN_MODEL;
  const ratio = opts.ratio ?? nearestRatioForModel(model, opts.subject.widthCm, opts.subject.depthCm);
  const doFetch = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const sleep = opts.sleepImpl ?? realSleep;
  const pollIntervalMs = opts.pollIntervalMs ?? 4000;
  const timeoutMs = opts.timeoutMs ?? 240_000;

  if (!opts.apiKey) return { ok: false, ratio, error: 'no_api_key' };
  if (!opts.referenceImageUri) return { ok: false, ratio, error: 'no_reference_image' };
  if (!doFetch) return { ok: false, ratio, error: 'no_fetch' };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    'X-Runway-Version': RUNWAY_API_VERSION,
    'Content-Type': 'application/json',
  };
  const body = {
    model,
    promptText: `${buildTopDownPrompt(opts.subject)} Avoid: ${TOPDOWN_NEGATIVE}.`,
    ratio,
    referenceImages: [{ uri: opts.referenceImageUri, tag: 'product' }],
  };

  let taskId: string;
  try {
    const res = await doFetch(`${RUNWAY_API_BASE}/v1/text_to_image`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    const json = (await res.json().catch(() => ({}))) as TaskResponse;
    if (!res.ok || !json.id) {
      return { ok: false, ratio, error: `create_failed_${res.status}` };
    }
    taskId = json.id;
  } catch (err) {
    return { ok: false, ratio, error: `create_error:${errName(err)}` };
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    let task: TaskResponse;
    try {
      const res = await doFetch(`${RUNWAY_API_BASE}/v1/tasks/${taskId}`, { headers, signal: opts.signal });
      task = (await res.json().catch(() => ({}))) as TaskResponse;
    } catch (err) {
      return { ok: false, ratio, taskId, error: `poll_error:${errName(err)}` };
    }
    if (task.status === 'SUCCEEDED') {
      const url = task.output?.[0];
      if (!url) return { ok: false, ratio, taskId, error: 'succeeded_no_output' };
      return { ok: true, imageUrl: url, taskId, ratio };
    }
    if (task.status === 'FAILED' || task.status === 'CANCELLED') {
      return { ok: false, ratio, taskId, error: `task_${task.status}:${task.failureCode ?? ''}` };
    }
  }
  return { ok: false, ratio, taskId, error: 'timeout' };
}

/** Extract an error class/name without leaking any message that might echo inputs. */
function errName(err: unknown): string {
  if (err instanceof Error) return err.name || 'Error';
  return 'unknown';
}
