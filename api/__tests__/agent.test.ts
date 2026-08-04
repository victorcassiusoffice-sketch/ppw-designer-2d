import { describe, it, expect, vi } from 'vitest';
import { pickModel, MODEL_SLUGS, openRouterChat } from '../_lib/agent/openrouter';
import { validateChatRequest, buildAgentHealthBody } from '../agent-chat';

describe('pickModel', () => {
  it('picks gemini-flash for short conversational input', () => {
    expect(pickModel([{ role: 'user', content: 'Hi, how do I sign up?' }])).toBe('gemini-flash');
  });

  it('picks claude-sonnet when message contains "code"', () => {
    expect(pickModel([{ role: 'user', content: 'Can you write some code for me?' }])).toBe(
      'claude-sonnet',
    );
  });

  it('picks claude-sonnet when message contains "implement"', () => {
    expect(pickModel([{ role: 'user', content: 'How do I implement the API?' }])).toBe(
      'claude-sonnet',
    );
  });

  it('picks claude-sonnet when message contains "debug"', () => {
    expect(pickModel([{ role: 'user', content: 'Help me debug this' }])).toBe('claude-sonnet');
  });

  it('picks claude-sonnet for long total context (>8000 chars)', () => {
    const huge = 'a'.repeat(9000);
    expect(pickModel([{ role: 'user', content: huge }])).toBe('claude-sonnet');
  });
});

describe('MODEL_SLUGS', () => {
  it('exposes Gemini Flash 2.5 free slug (M4 RELENTLESS_GOAL 2026-05-19)', () => {
    expect(MODEL_SLUGS['gemini-flash']).toBe('google/gemini-2.5-flash:free');
  });
  it('exposes Claude Sonnet 4.6 slug (M4 RELENTLESS_GOAL 2026-05-19)', () => {
    expect(MODEL_SLUGS['claude-sonnet']).toBe('anthropic/claude-sonnet-4-6');
  });
});

describe('buildAgentHealthBody (M4 GET /api/agent-chat)', () => {
  it('returns ok:true + both model slugs when OpenRouter is configured', () => {
    const body = buildAgentHealthBody({ configured: true });
    expect(body.ok).toBe(true);
    expect(body.service).toBe('ppw-merchant-agent');
    expect(body.openrouterConfigured).toBe(true);
    expect(body.models['gemini-flash']).toBe('google/gemini-2.5-flash:free');
    expect(body.models['claude-sonnet']).toBe('anthropic/claude-sonnet-4-6');
    expect(body.error).toBeUndefined();
  });

  it('returns ok:false + error reason when env is missing', () => {
    const body = buildAgentHealthBody({
      configured: false,
      error: 'OpenRouter not configured (OPENROUTER_API_KEY missing)',
    });
    expect(body.ok).toBe(false);
    expect(body.openrouterConfigured).toBe(false);
    expect(body.error).toMatch(/OPENROUTER_API_KEY missing/);
    // Slugs still surface so dashboards can render the intended config.
    expect(body.models['gemini-flash']).toBe('google/gemini-2.5-flash:free');
  });
});

describe('validateChatRequest', () => {
  it('accepts a valid single-message payload', () => {
    const r = validateChatRequest({ messages: [{ role: 'user', content: 'hi' }] });
    expect(r.ok).toBe(true);
  });

  it('rejects empty messages array', () => {
    expect(validateChatRequest({ messages: [] }).ok).toBe(false);
  });

  it('rejects too many messages', () => {
    const messages = Array.from({ length: 31 }, () => ({ role: 'user' as const, content: 'x' }));
    expect(validateChatRequest({ messages }).ok).toBe(false);
  });

  it('rejects message that exceeds char limit', () => {
    const messages = [{ role: 'user', content: 'x'.repeat(4001) }];
    expect(validateChatRequest({ messages }).ok).toBe(false);
  });

  it('rejects bad role', () => {
    expect(validateChatRequest({ messages: [{ role: 'admin', content: 'hi' }] }).ok).toBe(false);
  });

  it('accepts model override', () => {
    const r = validateChatRequest({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'claude-sonnet',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model).toBe('claude-sonnet');
  });

  it('rejects unknown model', () => {
    expect(
      validateChatRequest({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-5' }).ok,
    ).toBe(false);
  });
});

describe('openRouterChat', () => {
  it('builds correct request body and parses response', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> | null = null;
    const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hello!' } }],
          model: 'google/gemini-2.5-flash:free',
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const result = await openRouterChat(
      { apiKey: 'sk-test' },
      { messages: [{ role: 'user', content: 'hi' }] },
      fakeFetch as never,
    );
    expect(capturedUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(capturedBody).toMatchObject({
      model: 'google/gemini-2.5-flash:free',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.content).toBe('Hello!');
    expect(result.usage.totalTokens).toBe(12);
  });

  it('throws on non-2xx response', async () => {
    const fakeFetch = vi.fn(
      async () => new Response('rate limited', { status: 429 }),
    );
    await expect(
      openRouterChat(
        { apiKey: 'sk-test' },
        { messages: [{ role: 'user', content: 'hi' }] },
        fakeFetch as never,
      ),
    ).rejects.toThrow(/OpenRouter 429/);
  });

  it('throws on empty completion', async () => {
    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    await expect(
      openRouterChat(
        { apiKey: 'sk-test' },
        { messages: [{ role: 'user', content: 'hi' }] },
        fakeFetch as never,
      ),
    ).rejects.toThrow(/empty completion/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// IMPL-2 — POST /api/agent-chat merchant-session auth gate.
// ─────────────────────────────────────────────────────────────────────

import { authoriseAgentChatRequest, type AgentSessionMerchantLookup } from '../agent-chat';
import { signMerchantSession, DEFAULT_TTL_MS } from '../_lib/merchantSession';

function bearerFor(slug: string): Record<string, string> {
  const token = signMerchantSession({
    slug,
    email: `info@${slug}.test`,
    exp: Date.now() + DEFAULT_TTL_MS,
  });
  return { authorization: `Bearer ${token}` };
}

function lookupReturning(slug: string): AgentSessionMerchantLookup {
  return async () => ({ ok: true, merchantSlug: slug });
}

describe('authoriseAgentChatRequest (IMPL-2 auth gate)', () => {
  it('400s when sessionId is missing (auth is per-session)', async () => {
    const r = await authoriseAgentChatRequest(
      bearerFor('k1-sport'),
      undefined,
      lookupReturning('k1-sport'),
    );
    expect(r).toMatchObject({ ok: false, status: 400, error: 'sessionId required.' });
  });

  it('401s when there is no Authorization header', async () => {
    const r = await authoriseAgentChatRequest({}, 42, lookupReturning('k1-sport'));
    expect(r).toMatchObject({ ok: false, status: 401, error: 'missing_session' });
  });

  it('401s on a garbage Bearer token', async () => {
    const r = await authoriseAgentChatRequest(
      { authorization: 'Bearer garbage.token' },
      42,
      lookupReturning('k1-sport'),
    );
    expect(r).toMatchObject({ ok: false, status: 401, error: 'invalid_session' });
  });

  it('401s on an expired session token', async () => {
    const expired = signMerchantSession({
      slug: 'k1-sport',
      email: 'info@k1-sport.test',
      exp: Date.now() - 1_000,
    });
    const r = await authoriseAgentChatRequest(
      { authorization: `Bearer ${expired}` },
      42,
      lookupReturning('k1-sport'),
    );
    expect(r).toMatchObject({ ok: false, status: 401, error: 'invalid_session' });
  });

  it("403s when the session belongs to a DIFFERENT merchant", async () => {
    const r = await authoriseAgentChatRequest(
      bearerFor('other-merchant'),
      42,
      lookupReturning('k1-sport'),
    );
    expect(r).toMatchObject({ ok: false, status: 403, error: 'session_merchant_mismatch' });
  });

  it('404s when the sessionId does not exist', async () => {
    const lookup: AgentSessionMerchantLookup = async () => ({
      ok: false,
      status: 404,
      error: 'agent session not found',
    });
    const r = await authoriseAgentChatRequest(bearerFor('k1-sport'), 42, lookup);
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it('503s when the agent tables are not migrated', async () => {
    const lookup: AgentSessionMerchantLookup = async () => ({
      ok: false,
      status: 503,
      error: 'agent sessions schema not migrated',
    });
    const r = await authoriseAgentChatRequest(bearerFor('k1-sport'), 42, lookup);
    expect(r).toMatchObject({ ok: false, status: 503 });
  });

  it('passes when the Bearer slug owns the session', async () => {
    const r = await authoriseAgentChatRequest(
      bearerFor('k1-sport'),
      42,
      lookupReturning('k1-sport'),
    );
    expect(r).toMatchObject({ ok: true, slug: 'k1-sport', email: 'info@k1-sport.test' });
  });

  it('cannot be forged by re-signing the payload with a wrong secret', async () => {
    const forged = signMerchantSession(
      { slug: 'k1-sport', email: 'attacker@x.test', exp: Date.now() + DEFAULT_TTL_MS },
      'attacker-controlled-secret',
    );
    const r = await authoriseAgentChatRequest(
      { authorization: `Bearer ${forged}` },
      42,
      lookupReturning('k1-sport'),
    );
    expect(r).toMatchObject({ ok: false, status: 401, error: 'invalid_session' });
  });
});
