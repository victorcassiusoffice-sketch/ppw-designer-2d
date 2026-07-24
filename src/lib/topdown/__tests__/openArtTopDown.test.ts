/**
 * openArtTopDown — image-conditioned OpenArt generator coverage.
 *
 * Uses an INJECTED transport (no real network / connector). Verifies:
 *  • the request is image-conditioned (referenceImageUri carries the photo),
 *  • the prompt is a flat top-down that binds the reference (@product),
 *  • aspect ratio tracks the footprint (landscape / portrait / square),
 *  • the happy path returns the transport's imageUrl,
 *  • missing transport / reference / output degrade to { ok:false } (never throw),
 *  • a throwing transport is caught and never leaks a credential.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  generateTopDownOpenArt,
  buildOpenArtTopDownRequest,
  nearestOpenArtAspect,
  OPENART_TOPDOWN_MODEL,
  type OpenArtTransport,
  type TopDownSubject,
} from '../openArtTopDown';

const SUBJECT: TopDownSubject = {
  name: 'NordicTrack Commercial 2450 Treadmill',
  category: 'cardio',
  widthCm: 90,
  depthCm: 200,
};

describe('buildOpenArtTopDownRequest', () => {
  it('is a flat overhead prompt that binds the reference image', () => {
    const req = buildOpenArtTopDownRequest(SUBJECT, 'https://blob.example/photo.png');
    expect(req.prompt).toContain('@product');
    expect(req.prompt).toMatch(/top-down|overhead|straight down/i);
    expect(req.prompt).toMatch(/no cast shadow|no reflections/i);
    expect(req.prompt).toContain(SUBJECT.name);
    expect(req.referenceImageUri).toBe('https://blob.example/photo.png');
    expect(req.model).toBe(OPENART_TOPDOWN_MODEL);
    // 90×200 → portrait footprint.
    expect(req.aspectRatio).toBe('3:4');
  });

  it('passes a model + aspect override through', () => {
    const req = buildOpenArtTopDownRequest(SUBJECT, 'u', { model: 'flux-1-dev', aspectRatio: '1:1' });
    expect(req.model).toBe('flux-1-dev');
    expect(req.aspectRatio).toBe('1:1');
  });
});

describe('nearestOpenArtAspect', () => {
  it('classifies landscape / portrait / square from footprint', () => {
    expect(nearestOpenArtAspect(120, 55)).toBe('4:3'); // wide bench
    expect(nearestOpenArtAspect(90, 200)).toBe('3:4'); // treadmill
    expect(nearestOpenArtAspect(100, 100)).toBe('1:1'); // square mat
    expect(nearestOpenArtAspect(0, 0)).toBe('1:1'); // guard
  });
});

describe('generateTopDownOpenArt', () => {
  it('calls the transport image-conditioned and returns its imageUrl', async () => {
    const seen: unknown[] = [];
    const transport: OpenArtTransport = vi.fn(async (req) => {
      seen.push(req);
      return { imageUrl: 'https://cdn.openart/img.png' };
    });

    const res = await generateTopDownOpenArt({
      transport,
      referenceImageUri: 'https://blob.example/photo.png',
      subject: SUBJECT,
    });

    expect(res.ok).toBe(true);
    expect(res.imageUrl).toBe('https://cdn.openart/img.png');
    expect(res.model).toBe(OPENART_TOPDOWN_MODEL);
    expect(res.aspectRatio).toBe('3:4');

    const req = seen[0] as { referenceImageUri: string; prompt: string };
    expect(req.referenceImageUri).toBe('https://blob.example/photo.png');
    expect(req.prompt).toContain('@product');
  });

  it('degrades when no transport / no reference image (never throws)', async () => {
    // @ts-expect-error deliberately omitting transport to test the guard
    const noTransport = await generateTopDownOpenArt({ referenceImageUri: 'u', subject: SUBJECT });
    expect(noTransport).toMatchObject({ ok: false, error: 'no_transport' });

    const noRef = await generateTopDownOpenArt({
      transport: async () => ({ imageUrl: 'x' }),
      referenceImageUri: '',
      subject: SUBJECT,
    });
    expect(noRef).toMatchObject({ ok: false, error: 'no_reference_image' });
  });

  it('maps a provider error / empty output to ok:false', async () => {
    const providerErr = await generateTopDownOpenArt({
      transport: async () => ({ error: 'quota_exceeded' }),
      referenceImageUri: 'u',
      subject: SUBJECT,
    });
    expect(providerErr).toMatchObject({ ok: false, error: 'provider:quota_exceeded' });

    const empty = await generateTopDownOpenArt({
      transport: async () => ({}),
      referenceImageUri: 'u',
      subject: SUBJECT,
    });
    expect(empty).toMatchObject({ ok: false, error: 'no_output' });
  });

  it('catches a throwing transport and leaks no credential', async () => {
    const transport: OpenArtTransport = async () => {
      throw new Error('secret-key-abc123 blew up');
    };
    const res = await generateTopDownOpenArt({
      transport,
      referenceImageUri: 'u',
      subject: SUBJECT,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('transport_error:Error');
    expect(JSON.stringify(res)).not.toContain('secret-key-abc123');
  });
});
