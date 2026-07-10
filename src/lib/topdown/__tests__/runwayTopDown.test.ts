/**
 * runwayTopDown — image-conditioned generator coverage.
 *
 * Uses an injected fetch + sleep so no real network / delay. Verifies:
 *  • the request is image-conditioned (referenceImages carries the photo),
 *  • the prompt is a flat top-down that names the reference (@product),
 *  • the create→poll→SUCCEEDED happy path returns the output URL,
 *  • FAILED / missing-key / create-error degrade to { ok:false } (never throw),
 *  • the API key never appears in an error string.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  generateTopDownRunway,
  buildTopDownPrompt,
  RUNWAY_API_VERSION,
  type TopDownSubject,
} from '../runwayTopDown';

const SUBJECT: TopDownSubject = {
  name: 'NordicTrack Commercial 2450 Treadmill',
  category: 'cardio',
  widthCm: 90,
  depthCm: 200,
};

const noSleep = async (): Promise<void> => undefined;

describe('buildTopDownPrompt', () => {
  it('is a flat overhead orthographic prompt that binds the reference image', () => {
    const p = buildTopDownPrompt(SUBJECT);
    expect(p).toContain('@product');
    expect(p).toMatch(/top-down|overhead|straight down/i);
    expect(p).toMatch(/no cast shadow|no reflections/i);
    expect(p).toContain(SUBJECT.name);
  });
});

describe('generateTopDownRunway', () => {
  it('sends an image-conditioned create then polls to SUCCEEDED', async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (url.endsWith('/v1/text_to_image')) {
        return new Response(JSON.stringify({ id: 'task-123' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ status: 'SUCCEEDED', output: ['https://cdn.runway/img.png'] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const res = await generateTopDownRunway({
      apiKey: 'sk-secret',
      referenceImageUri: 'https://blob.example/photo.png',
      subject: SUBJECT,
      fetchImpl,
      sleepImpl: noSleep,
    });

    expect(res.ok).toBe(true);
    expect(res.imageUrl).toBe('https://cdn.runway/img.png');
    expect(res.taskId).toBe('task-123');

    const create = calls[0];
    const body = create.body as { model: string; referenceImages: Array<{ uri: string; tag: string }>; ratio: string };
    expect(body.model).toBe('gen4_image');
    expect(body.referenceImages[0].uri).toBe('https://blob.example/photo.png');
    expect(body.referenceImages[0].tag).toBe('product');
    // 90×200 → portrait ratio.
    expect(body.ratio).toBe('1080:1920');
  });

  it('routes the model override + its ratio enum through the create body', async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (url.endsWith('/v1/text_to_image')) return new Response(JSON.stringify({ id: 't' }), { status: 200 });
      return new Response(JSON.stringify({ status: 'SUCCEEDED', output: ['u'] }), { status: 200 });
    }) as unknown as typeof fetch;
    // Landscape footprint (width ≥ depth) + gemini → its landscape ratio enum.
    const res = await generateTopDownRunway({
      apiKey: 'k',
      referenceImageUri: 'u',
      subject: { name: 'Bench', category: 'fitness', widthCm: 120, depthCm: 55 },
      model: 'gemini_image3_pro',
      fetchImpl,
      sleepImpl: noSleep,
    });
    expect(res.ok).toBe(true);
    const body = calls[0].body as { model: string; ratio: string };
    expect(body.model).toBe('gemini_image3_pro');
    expect(body.ratio).toBe('1248:832');
  });

  it('sets the Runway version header on requests', async () => {
    const headersSeen: Array<Record<string, string>> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      headersSeen.push(init?.headers as Record<string, string>);
      if (url.endsWith('/v1/text_to_image')) return new Response(JSON.stringify({ id: 't' }), { status: 200 });
      return new Response(JSON.stringify({ status: 'SUCCEEDED', output: ['u'] }), { status: 200 });
    }) as unknown as typeof fetch;
    await generateTopDownRunway({
      apiKey: 'k',
      referenceImageUri: 'u',
      subject: SUBJECT,
      fetchImpl,
      sleepImpl: noSleep,
    });
    expect(headersSeen[0]['X-Runway-Version']).toBe(RUNWAY_API_VERSION);
  });

  it('returns ok:false (never throws) on a FAILED task and leaks no key', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/text_to_image')) return new Response(JSON.stringify({ id: 't' }), { status: 200 });
      return new Response(JSON.stringify({ status: 'FAILED', failureCode: 'CONTENT' }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await generateTopDownRunway({
      apiKey: 'sk-secret',
      referenceImageUri: 'u',
      subject: SUBJECT,
      fetchImpl,
      sleepImpl: noSleep,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('task_FAILED');
    expect(JSON.stringify(res)).not.toContain('sk-secret');
  });

  it('degrades when no key / no reference image', async () => {
    const noKey = await generateTopDownRunway({ apiKey: '', referenceImageUri: 'u', subject: SUBJECT });
    expect(noKey).toMatchObject({ ok: false, error: 'no_api_key' });
    const noRef = await generateTopDownRunway({ apiKey: 'k', referenceImageUri: '', subject: SUBJECT });
    expect(noRef).toMatchObject({ ok: false, error: 'no_reference_image' });
  });

  it('maps a non-2xx create to create_failed_<status>', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
    const res = await generateTopDownRunway({
      apiKey: 'k',
      referenceImageUri: 'u',
      subject: SUBJECT,
      fetchImpl,
      sleepImpl: noSleep,
    });
    expect(res).toMatchObject({ ok: false, error: 'create_failed_429' });
  });
});
