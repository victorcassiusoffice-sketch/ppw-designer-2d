/**
 * Tests for src/lib/designsApi.ts — the typed fetch wrappers around
 * /api/designs (M1.C.6) and /api/leads (M1.C.7).
 *
 * Stubs `globalThis.fetch` rather than relying on a real network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveDesignToApi,
  listDesignsByEmail,
  submitLead,
  type ApiDesign,
  type ApiLead,
} from '../designsApi';
import type { Property } from '../../store/propertyStore';

type FetchInit = RequestInit | undefined;
type FetchInput = string | URL | Request;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(handler: (input: FetchInput, init: FetchInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(handler) as unknown as typeof fetch;
}

const sampleProperty: Property = {
  id: 'p',
  name: 'Sample',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Main',
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
      placedItems: [],
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('designsApi.saveDesignToApi', () => {
  it('POSTs to /api/designs and returns the design row', async () => {
    const apiDesign: ApiDesign = {
      id: 42,
      userId: null,
      customerEmail: 'a@b.co',
      name: 'Test',
      property: sampleProperty,
      cart: null,
      status: 'draft',
      createdAt: '2026-05-16T00:00:00Z',
      updatedAt: '2026-05-16T00:00:00Z',
    };
    let capturedUrl: FetchInput | null = null;
    let capturedInit: RequestInit | undefined;
    stubFetch((input, init) => {
      capturedUrl = input;
      capturedInit = init;
      return jsonResponse({ design: apiDesign }, 201);
    });

    const result = await saveDesignToApi({
      customerEmail: 'a@b.co',
      name: 'Test',
      property: sampleProperty,
    });

    expect(result.id).toBe(42);
    expect(result.name).toBe('Test');
    expect(String(capturedUrl)).toBe('/api/designs');
    expect(capturedInit?.method).toBe('POST');
    const body = JSON.parse((capturedInit?.body as string) ?? '{}');
    expect(body.customerEmail).toBe('a@b.co');
    expect(body.property.id).toBe('p');
  });

  it('throws the server error message on 4xx', async () => {
    stubFetch(() => jsonResponse({ error: 'customerEmail required.' }, 400));
    await expect(
      saveDesignToApi({ name: 'X', property: sampleProperty }),
    ).rejects.toThrow(/customerEmail required/);
  });

  it('throws a generic message when the server omits an error string', async () => {
    stubFetch(() => new Response('', { status: 500 }));
    await expect(
      saveDesignToApi({ customerEmail: 'a@b.co', name: 'X', property: sampleProperty }),
    ).rejects.toThrow(/Save failed \(500\)/);
  });
});

describe('designsApi.listDesignsByEmail', () => {
  it('GETs /api/designs?email=… and returns the array', async () => {
    let capturedUrl: FetchInput | null = null;
    stubFetch((input) => {
      capturedUrl = input;
      return jsonResponse({ designs: [{ id: 1 } as unknown as ApiDesign] });
    });
    const rows = await listDesignsByEmail('Vic@PPWellness.co');
    expect(rows).toHaveLength(1);
    expect(String(capturedUrl)).toBe('/api/designs?email=Vic%40PPWellness.co');
  });

  it('returns [] when the server payload is malformed', async () => {
    stubFetch(() => jsonResponse({ ok: true }));
    const rows = await listDesignsByEmail('x@y.co');
    expect(rows).toEqual([]);
  });
});

describe('designsApi.submitLead', () => {
  it('POSTs to /api/leads with the lead payload', async () => {
    const apiLead: ApiLead = {
      id: 7,
      customerEmail: 'a@b.co',
      customerName: null,
      customerPhone: null,
      designId: null,
      property: sampleProperty,
      cartQuote: null,
      message: 'Hi',
      source: 'designer',
      createdAt: '2026-05-16T00:00:00Z',
    };
    let capturedInit: RequestInit | undefined;
    stubFetch((_input, init) => {
      capturedInit = init;
      return jsonResponse({ lead: apiLead }, 201);
    });
    const result = await submitLead({
      customerEmail: 'a@b.co',
      property: sampleProperty,
      message: 'Hi',
      source: 'designer',
    });
    expect(result.id).toBe(7);
    const body = JSON.parse((capturedInit?.body as string) ?? '{}');
    expect(body.customerEmail).toBe('a@b.co');
    expect(body.source).toBe('designer');
  });

  it('throws when the response omits a lead', async () => {
    stubFetch(() => jsonResponse({}, 201));
    await expect(
      submitLead({ customerEmail: 'a@b.co' }),
    ).rejects.toThrow(/no lead payload/);
  });
});
