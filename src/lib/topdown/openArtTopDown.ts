/**
 * OpenArt top-down generator — image-conditioned, provider-agnostic transport.
 *
 * The image-gen rail changed (2026-07-24): Runway ML was dropped in favour of
 * **OpenArt** (the `openart_*` connector / `ppw-image-gen` skill). This module
 * is the OpenArt sibling of `runwayTopDown.ts`. It keeps the two things that
 * made the Runway rebuild correct (WD-2D findings §4) and were the ACTUAL fix:
 *
 *   1. IMAGE-CONDITIONED, not text-to-image. The merchant's real product photo
 *      is passed as the reference so the model renders the ACTUAL product,
 *      never a hallucinated lookalike (the core failure of the dead FLUX path).
 *   2. The rewritten flat-orthographic prompt (shared with the Runway module —
 *      it is provider-neutral prompt text, not Runway-specific).
 *
 * WHY A TRANSPORT IS INJECTED (important architecture note):
 *   OpenArt in PPW is a **session-time capability** — reached via the
 *   `openart_*` MCP connector / the `ppw-image-gen` skill inside a Cowork
 *   agent session — NOT a REST endpoint with a `key_`-prefixed API key on disk
 *   the way Runway Dev was. (See vault `reference_creative_credits.md`: the
 *   OpenArt balance/route is Vic-confirmed, not a documented server key.)
 *   So this module does NOT hard-code a `fetch` to an OpenArt URL. It takes an
 *   `OpenArtTransport` the caller supplies:
 *     • session/batch path → the agent's `openart_*` tool call, or
 *     • runtime path → a REST adapter, IF/when OpenArt exposes a server key.
 *   That keeps the module honest (no guessed wire format), testable (fake
 *   transport), and safe (no network at import, no key required to load, no
 *   spend). The exact binding is finalised where the transport is provided.
 *
 * The image this returns is still fed through `normalizeToFootprint()`
 * (`normalizeFootprint.ts`) — the deterministic, provider-agnostic ratio path.
 * Footprint-exactness does NOT depend on the model; the generator is only the
 * optional beautifier.
 *
 * SECURITY (Vic Protocol HARD STOP): no key is read, logged, returned, or
 * bundled here. Any credential lives inside the injected transport.
 */

import {
  buildTopDownPrompt,
  TOPDOWN_NEGATIVE,
  type TopDownSubject,
} from './runwayTopDown.js';

export type { TopDownSubject } from './runwayTopDown.js';

/**
 * Shipped default OpenArt image model. Kept as a plain string (not a hard
 * enum) so a connector change can't silently break the type — the model id is
 * validated at the transport, against the live OpenArt model list.
 *
 * ⚠ CONFIRM against the live `openart_*` connector before first spend. Known
 * OpenArt image-model families that accept a reference/conditioning image
 * (the requirement here) — pick the current best per the connector:
 */
export const OPENART_TOPDOWN_MODEL = 'nano-banana-2';

/** Reference-capable OpenArt image models (guidance — confirm when connector live). */
export const KNOWN_OPENART_IMAGE_MODELS = [
  'nano-banana-2', // Google Nano Banana 2 — strong instruction-following + reference image
  'flux-1-dev', // FLUX.1 dev — image-to-image / reference conditioning
  'seedance', // motion-oriented; image variant only if reference-capable
] as const;

/**
 * OpenArt cost is billed in OpenArt credits, not Runway credits — do NOT reuse
 * the Runway `MODEL_CREDIT_COST` table. Exact per-image cost is unknown until
 * the connector is live + a validation image is run. Surfaced as a Vic
 * cost-tier gate (money-path) in the plan; left `null` until measured.
 */
export const OPENART_CREDIT_COST_UNKNOWN = null;

export interface OpenArtGenerateRequest {
  /** Flat-orthographic top-down prompt, binds `@product` to the reference. */
  prompt: string;
  /** The merchant's real product photo (https Blob URL or data: URI). */
  referenceImageUri: string;
  /** OpenArt model id (defaults to OPENART_TOPDOWN_MODEL). */
  model: string;
  /** Simple aspect ratio string (e.g. '4:3', '3:4', '1:1'). */
  aspectRatio: string;
}

export interface OpenArtGenerateResponse {
  /** URL (or data URI) of the generated image on success. */
  imageUrl?: string;
  /** Provider/transport error label (never contains a credential). */
  error?: string;
}

/**
 * The pluggable OpenArt call. Whatever actually invokes OpenArt (a session
 * `openart_*` tool, or a REST adapter) implements this. It must NEVER throw a
 * credential in its message; on failure return `{ error }`.
 */
export type OpenArtTransport = (
  req: OpenArtGenerateRequest,
  signal?: AbortSignal,
) => Promise<OpenArtGenerateResponse>;

/**
 * Pick a coarse aspect ratio nearest the real footprint aspect (width/depth).
 * The normaliser fixes the EXACT final aspect regardless, so a
 * landscape/portrait/square split is all the generator needs — it only reduces
 * pre-trim distortion. OpenArt takes simple `w:h` strings, not Runway's pixel
 * enums, so this is intentionally separate from `footprintCanvas` ratios.
 */
export function nearestOpenArtAspect(widthCm: number, depthCm: number): string {
  if (!Number.isFinite(widthCm) || !Number.isFinite(depthCm) || widthCm <= 0 || depthCm <= 0) {
    return '1:1';
  }
  const r = widthCm / depthCm;
  if (r >= 1.3) return '4:3'; // clearly landscape
  if (r <= 1 / 1.3) return '3:4'; // clearly portrait
  return '1:1'; // near-square
}

/**
 * Build the exact OpenArt generation request for a product top-down. PURE —
 * no I/O, no transport — so the prompt/model/aspect contract is unit tested in
 * isolation. Reuses the provider-neutral rewritten prompt + negative guidance.
 */
export function buildOpenArtTopDownRequest(
  subject: TopDownSubject,
  referenceImageUri: string,
  opts: { model?: string; aspectRatio?: string } = {},
): OpenArtGenerateRequest {
  return {
    prompt: `${buildTopDownPrompt(subject)} Avoid: ${TOPDOWN_NEGATIVE}.`,
    referenceImageUri,
    model: opts.model ?? OPENART_TOPDOWN_MODEL,
    aspectRatio: opts.aspectRatio ?? nearestOpenArtAspect(subject.widthCm, subject.depthCm),
  };
}

export interface GenerateTopDownOpenArtOptions {
  /** The pluggable OpenArt call (session tool or REST adapter). */
  transport: OpenArtTransport;
  /** The merchant's real product photo — the reference image. */
  referenceImageUri: string;
  subject: TopDownSubject;
  model?: string;
  aspectRatio?: string;
  signal?: AbortSignal;
}

export interface GenerateTopDownOpenArtResult {
  ok: boolean;
  /** URL/data-URI of the generated image (feed to normalizeToFootprint). */
  imageUrl?: string;
  model: string;
  aspectRatio: string;
  error?: string;
}

/**
 * Generate an image-conditioned top-down via OpenArt. NEVER throws for
 * provider/quota errors — returns `{ ok: false, error }` so the caller can log
 * and fall back to the merchant's original photo (which the deterministic
 * normaliser can still make footprint-exact). No key is handled here; the
 * transport owns any credential.
 */
export async function generateTopDownOpenArt(
  opts: GenerateTopDownOpenArtOptions,
): Promise<GenerateTopDownOpenArtResult> {
  const model = opts.model ?? OPENART_TOPDOWN_MODEL;
  const aspectRatio = opts.aspectRatio ?? nearestOpenArtAspect(opts.subject.widthCm, opts.subject.depthCm);

  if (typeof opts.transport !== 'function') {
    return { ok: false, model, aspectRatio, error: 'no_transport' };
  }
  if (!opts.referenceImageUri) {
    return { ok: false, model, aspectRatio, error: 'no_reference_image' };
  }

  const req = buildOpenArtTopDownRequest(opts.subject, opts.referenceImageUri, { model, aspectRatio });

  let res: OpenArtGenerateResponse;
  try {
    res = await opts.transport(req, opts.signal);
  } catch (err) {
    return { ok: false, model, aspectRatio, error: `transport_error:${errName(err)}` };
  }

  if (!res || !res.imageUrl) {
    return { ok: false, model, aspectRatio, error: res?.error ? `provider:${res.error}` : 'no_output' };
  }
  return { ok: true, imageUrl: res.imageUrl, model, aspectRatio };
}

/** Error class/name only — never a message that could echo inputs/credentials. */
function errName(err: unknown): string {
  if (err instanceof Error) return err.name || 'Error';
  return 'unknown';
}
