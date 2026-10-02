import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGuidedDesign } from '../../src/designer/aiDesignContract';
import {
  resolveDesignRequest,
  allowedDesignOrigin,
  readDesignBody,
  designAssistantReadiness,
  designCatalog,
  designPromptMessages,
  type DesignAssistantDependencies,
} from '../_lib/designAssistant';
import { dispatchDesignMcp, handleDesignMcp, DESIGN_MCP_TOOLS } from '../_lib/designMcp';
import type { MinReq, MinRes } from '../_lib/sentry';
import { openRouterChat } from '../_lib/agent/openrouter';
import agentHandler from '../agent-chat';
import { DesignBriefSchema } from '../../src/designer/aiDesignContract';

const req: MinReq = {
  method: 'POST',
  headers: { authorization: 'Bearer signed-user-token', 'x-forwarded-for': '127.0.0.1' },
};
function dependencies(): DesignAssistantDependencies {
  return {
    verify: vi.fn(async () => ({ sub: 'user-own-id' })),
    reserve: vi.fn(async () => true),
    generate: vi.fn(async () => createGuidedDesign({})),
  };
}
afterEach(() => vi.unstubAllEnvs());
describe('design assistant authentication and boundaries', () => {
  it('retains published placement metadata and rejects roof products in room drafts', async () => {
    const catalog = designCatalog(),
      panel = catalog.find((p) => p.placement === 'roof');
    expect(panel).toBeDefined();
    const draft = createGuidedDesign({});
    const room = draft.rooms[1];
    room.products = [
      {
        productId: panel!.id,
        xM: room.xM + room.widthM / 2,
        yM: room.yM + room.depthM / 2,
        rotation: 0,
      },
    ];
    const output = await resolveDesignRequest({ mode: 'validate', draft }, req, dependencies());
    expect(output.status).toBe(422);
    expect(output.body).toMatchObject({
      details: expect.arrayContaining([expect.stringContaining('needs a roof host')]),
    });
    const prompt = JSON.stringify(
      designPromptMessages(
        DesignBriefSchema.parse({ brief: 'Add solar panels to my roof' }),
        catalog,
      ),
    );
    expect(prompt).not.toContain(panel!.id);
  });
  it('uses the verified design model, JSON format and a bounded provider timeout', async () => {
    const fetcher = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
        status: 200,
      });
    });
    await openRouterChat(
      { apiKey: 'test-only' },
      {
        messages: [{ role: 'user', content: 'House concept' }],
        providerModel: 'google/gemini-2.5-flash',
        responseFormat: { type: 'json_object' },
        timeoutMs: 24000,
      },
      fetcher as typeof fetch,
    );
    const init = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'google/gemini-2.5-flash',
      response_format: { type: 'json_object' },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it('routes designer aliases through the existing function without opening merchant chat', async () => {
    const state = { status: 0, body: undefined as unknown };
    const res: MinRes = {
      setHeader() {},
      status(s) {
        state.status = s;
        return res;
      },
      end() {},
      json(b) {
        state.body = b;
      },
    };
    await agentHandler(
      {
        url: '/api/design-assistant',
        method: 'POST',
        headers: {},
        body: { mode: 'ai', brief: {} },
      },
      res,
    );
    expect(state.status).toBe(401);
    expect(state.body).toMatchObject({ code: 'sign_in_required' });
    await agentHandler({ url: '/api/mcp', method: 'GET', headers: {} }, res);
    expect(state.status).toBe(405);
    await agentHandler(
      {
        url: '/api/agent-chat',
        method: 'POST',
        headers: {},
        body: { messages: [{ role: 'user', content: 'hello' }] },
      },
      res,
    );
    expect(state.status).toBe(400);
    expect(state.body).toMatchObject({ error: 'sessionId required.' });
  });
  it('guides anonymously without a provider request or saved-plan write', async () => {
    const deps = dependencies();
    const result = await resolveDesignRequest({ mode: 'guided', brief: {} }, { headers: {} }, deps);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ mode: 'guided', draft: { units: 'm' } });
    expect(deps.verify).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
  });
  it('refuses anonymous and invalid tokens before invoking AI', async () => {
    const deps = dependencies();
    expect(
      (await resolveDesignRequest({ mode: 'ai', brief: {} }, { headers: {} }, deps)).status,
    ).toBe(401);
    expect(deps.generate).not.toHaveBeenCalled();
    deps.verify = vi.fn(async () => null);
    expect((await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps)).status).toBe(401);
    expect(deps.reserve).not.toHaveBeenCalled();
  });
  it('keys quotas to verified identity rather than caller-supplied identity', async () => {
    const deps = dependencies();
    expect((await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps)).status).toBe(200);
    expect(deps.reserve).toHaveBeenCalledWith('user-own-id', '127.0.0.1', expect.any(Object));
    expect(
      (await resolveDesignRequest({ mode: 'ai', brief: {}, userId: 'other' }, req, deps)).status,
    ).toBe(400);
  });
  it('fails closed when quota cannot be reserved', async () => {
    const deps = dependencies();
    deps.reserve = vi.fn(async () => false);
    expect((await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps)).status).toBe(429);
    expect(deps.generate).not.toHaveBeenCalled();
    deps.reserve = vi.fn(async () => {
      throw new Error('KV down');
    });
    expect((await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps)).status).toBe(429);
  });
  it('does not release invalid or wrong-plot AI designs', async () => {
    const deps = dependencies();
    deps.generate = vi.fn(async () => ({ commands: ['delete all'] }));
    expect((await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps)).status).toBe(422);
    deps.generate = vi.fn(async () => createGuidedDesign({ plotWidthM: 25 }));
    expect((await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps)).status).toBe(422);
    deps.generate = vi.fn(async () => createGuidedDesign({ bedrooms: 2 }));
    expect((await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps)).status).toBe(422);
  });
  it('keeps advisory warnings separate so a valid 16-warning draft remains importable', async () => {
    const deps = dependencies();
    const d = createGuidedDesign({});
    d.warnings = Array.from({ length: 16 }, (_, i) => `Review note ${i}`);
    deps.generate = vi.fn(async () => d);
    const output = await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps);
    expect(output.status).toBe(200);
    expect(output.body).toMatchObject({
      draft: { warnings: d.warnings },
      warnings: expect.any(Array),
    });
  });
  it('never leaks upstream errors or API credentials', async () => {
    const deps = dependencies();
    deps.generate = vi.fn(async () => {
      throw new Error('secret private provider response');
    });
    const result = await resolveDesignRequest({ mode: 'ai', brief: {} }, req, deps);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain('secret');
  });
  it('validates supplied proposals without any account lookup', async () => {
    const deps = dependencies();
    const result = await resolveDesignRequest(
      { mode: 'validate', draft: createGuidedDesign({}) },
      req,
      deps,
    );
    expect(result.status).toBe(200);
    expect(deps.verify).not.toHaveBeenCalled();
  });
  it('reports configuration booleans without secret values', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'secret-provider');
    vi.stubEnv('CLERK_SECRET_KEY', 'secret-auth');
    vi.stubEnv('KV_REST_API_URL', '');
    const result = designAssistantReadiness();
    expect(result.aiConfigured).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret-');
  });
  it('bounds incoming bytes and rejects malformed JSON', () => {
    expect(readDesignBody('broken')).toMatchObject({ ok: false, status: 400 });
    expect(readDesignBody({ brief: 'x'.repeat(140000) })).toMatchObject({ ok: false, status: 413 });
  });
  it('validates origins against exact configured origins, not the Host header', () => {
    expect(allowedDesignOrigin('https://designer.ppwellness.co')).toBe(true);
    expect(allowedDesignOrigin('https://designer.ppwellness.co.evil.test')).toBe(false);
    expect(allowedDesignOrigin('https://evil.vercel.app')).toBe(false);
    expect(allowedDesignOrigin(undefined)).toBe(true);
  });
});
describe('public proposal-only MCP', () => {
  const call = (method: string, params?: Record<string, unknown>) =>
    dispatchDesignMcp({ jsonrpc: '2.0', id: 1, method, params });
  it('negotiates supported protocol and lists only safe public tools', () => {
    expect(call('initialize', { protocolVersion: '2025-06-18' }).body).toMatchObject({
      result: { protocolVersion: '2025-06-18', capabilities: { tools: {} } },
    });
    expect(call('tools/list').body).toMatchObject({ result: { tools: expect.any(Array) } });
    expect(
      DESIGN_MCP_TOOLS.every((t) => t.annotations.readOnlyHint && !t.annotations.destructiveHint),
    ).toBe(true);
    expect(DESIGN_MCP_TOOLS.map((t) => t.name)).not.toContain('save_design');
  });
  it('generates and validates a connected multi-floor concept', () => {
    expect(
      call('tools/call', { name: 'generate_guided_design', arguments: { storeys: 2 } }).body,
    ).toMatchObject({
      result: { isError: false, structuredContent: { draft: { stairs: expect.any(Array) } } },
    });
    expect(
      call('tools/call', { name: 'validate_design', arguments: { draft: createGuidedDesign({}) } })
        .body,
    ).toMatchObject({ result: { isError: false, structuredContent: { ok: true } } });
  });
  it('exposes exact catalogue dimensions without customers or stock promises', () => {
    expect(
      call('tools/call', { name: 'search_catalog', arguments: { query: 'mistral' } }).body,
    ).toMatchObject({
      result: {
        structuredContent: {
          products: [expect.objectContaining({ id: 'mrbricolage-mistral-70', widthM: 0.7 })],
        },
      },
    });
  });
  it('returns tool errors for invalid layouts and protocol errors for unknown tools', () => {
    expect(
      call('tools/call', { name: 'generate_guided_design', arguments: { storeys: 200 } }).body,
    ).toMatchObject({ result: { isError: true } });
    expect(
      call('tools/call', { name: 'read_customer_design', arguments: { id: 1 } }).body,
    ).toMatchObject({ error: { code: -32602 } });
  });
  it('accepts initialized notifications without execution and rejects batch messages', () => {
    expect(dispatchDesignMcp({ jsonrpc: '2.0', method: 'notifications/initialized' })).toEqual({
      status: 202,
    });
    expect(dispatchDesignMcp([{ jsonrpc: '2.0', id: 1, method: 'ping' }]).status).toBe(400);
    expect(dispatchDesignMcp({ jsonrpc: '2.0', method: 'tools/call' }).status).toBe(400);
  });
  it('supports schema resources and rejects unrecognized resources', () => {
    expect(call('resources/read', { uri: 'ppw://design/contract/v1' }).body).toMatchObject({
      result: { contents: [{ mimeType: 'application/json' }] },
    });
    expect(call('resources/read', { uri: 'file:///private' }).body).toMatchObject({
      error: { code: -32002 },
    });
  });
  it('enforces Origin, HTTP media negotiation and protocol version on transport', async () => {
    const response = () => {
      const state = {
        status: 0,
        body: undefined as unknown,
        headers: {} as Record<string, string>,
      };
      const res: MinRes = {
        setHeader(k, v) {
          state.headers[k] = v;
        },
        status(s) {
          state.status = s;
          return res;
        },
        end() {},
        json(b) {
          state.body = b;
        },
      };
      return { state, res };
    };
    for (const [headers, status] of [
      [{ origin: 'https://evil.example' }, 403],
      [{ 'content-type': 'text/plain' }, 415],
      [{ 'content-type': 'application/json', accept: 'application/json' }, 406],
      [{ 'mcp-protocol-version': 'bogus' }, 400],
    ] as const) {
      const r = response();
      await handleDesignMcp(
        { method: 'POST', headers, body: { jsonrpc: '2.0', id: 1, method: 'ping' } },
        r.res,
      );
      expect(r.state.status).toBe(status);
    }
    const r = response();
    await handleDesignMcp({ method: 'GET', headers: {} }, r.res);
    expect(r.state.status).toBe(405);
  });
});
