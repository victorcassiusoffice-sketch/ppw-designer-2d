/**
 * POST /api/agent-chat
 *
 * Phase 6 Merchant Integration Agent endpoint. Proxies to OpenRouter
 * with default Gemini Flash 2.0 → Claude Sonnet fallback on hard tasks.
 *
 * Body: { messages: [{role, content}, ...], model? }
 * 200:  { content, model, usage: {...} }
 * 400:  { error: '...' }
 * 503:  { error: 'OpenRouter not configured' }
 *
 * No auth gate yet — Phase 6 part 2 will add Clerk merchant auth +
 * per-merchant cost tracking (writes to admin dashboard).
 */

import { withSentry, type MinReq, type MinRes } from './_lib/sentry.js';
import {
  readOpenRouterEnv,
  openRouterChat,
  pickModel,
  estimateCostMicroUsd,
  MERCHANT_AGENT_SYSTEM_PROMPT,
  MODEL_SLUGS,
  type ChatMessage,
  type AgentModel,
} from './_lib/agent/openrouter.js';
import { applyAgentChatLockdown } from './_lib/agent/lockdown.js';
import { getClientIp } from './_lib/rateLimit.js';
import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from './_db/client.js';

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;

interface ChatReq extends MinReq {
  body?: unknown;
}

/**
 * Best-effort persistence of a chat turn to agent_sessions +
 * agent_messages. Silent on schema-missing or any other DB failure —
 * the agent endpoint must keep working even when persistence breaks.
 */
async function persistTurn(args: {
  sessionId: number;
  userMessage: string;
  assistantContent: string;
  modelUsed: AgentModel;
  promptTokens: number;
  completionTokens: number;
  fallbackReason?: string;
}): Promise<void> {
  try {
    const db = getDb();
    const cost = estimateCostMicroUsd(args.modelUsed, args.promptTokens, args.completionTokens);
    await db.insert(schema.agentMessages).values([
      { sessionId: args.sessionId, role: 'user', content: args.userMessage },
      {
        sessionId: args.sessionId,
        role: 'assistant',
        content: args.assistantContent,
        modelUsed: args.modelUsed,
        inputTokens: args.promptTokens,
        outputTokens: args.completionTokens,
        costMicroUsd: cost,
        fallbackReason: args.fallbackReason ?? null,
      },
    ]);
    await db
      .update(schema.agentSessions)
      .set({
        totalCostMicroUsd: sql`${schema.agentSessions.totalCostMicroUsd} + ${cost}`,
        geminiCostMicroUsd:
          args.modelUsed === 'gemini-flash'
            ? sql`${schema.agentSessions.geminiCostMicroUsd} + ${cost}`
            : schema.agentSessions.geminiCostMicroUsd,
        sonnetCostMicroUsd:
          args.modelUsed === 'claude-sonnet'
            ? sql`${schema.agentSessions.sonnetCostMicroUsd} + ${cost}`
            : schema.agentSessions.sonnetCostMicroUsd,
        totalInputTokens: sql`${schema.agentSessions.totalInputTokens} + ${args.promptTokens}`,
        totalOutputTokens: sql`${schema.agentSessions.totalOutputTokens} + ${args.completionTokens}`,
        messageCount: sql`${schema.agentSessions.messageCount} + 2`,
        updatedAt: new Date(),
      })
      .where(eq(schema.agentSessions.id, args.sessionId));
  } catch {
    // Persistence is best-effort; the proxy must respond regardless.
  }
}

async function readJson(req: ChatReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return null; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return null; }
  }
  return null;
}

export function validateChatRequest(
  payload: unknown,
):
  | { ok: true; messages: ChatMessage[]; model?: AgentModel; sessionId?: number }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as { messages?: unknown; model?: unknown; sessionId?: unknown };
  if (!Array.isArray(p.messages) || p.messages.length === 0) {
    return { ok: false, error: 'messages array required.' };
  }
  if (p.messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Too many messages (max ${MAX_MESSAGES}).` };
  }
  const messages: ChatMessage[] = [];
  for (const m of p.messages) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Invalid message.' };
    const mm = m as Record<string, unknown>;
    if (mm.role !== 'system' && mm.role !== 'user' && mm.role !== 'assistant') {
      return { ok: false, error: 'role must be system/user/assistant.' };
    }
    if (typeof mm.content !== 'string' || !mm.content.length) {
      return { ok: false, error: 'message content required.' };
    }
    if (mm.content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `Message too long (max ${MAX_MESSAGE_CHARS} chars).` };
    }
    messages.push({ role: mm.role as ChatMessage['role'], content: mm.content });
  }
  let model: AgentModel | undefined;
  if (p.model !== undefined) {
    if (p.model !== 'gemini-flash' && p.model !== 'claude-sonnet') {
      return { ok: false, error: 'model must be gemini-flash or claude-sonnet.' };
    }
    model = p.model;
  }
  let sessionId: number | undefined;
  if (p.sessionId !== undefined) {
    if (typeof p.sessionId !== 'number' || !Number.isInteger(p.sessionId) || p.sessionId <= 0) {
      return { ok: false, error: 'sessionId must be a positive integer.' };
    }
    sessionId = p.sessionId;
  }
  return { ok: true, messages, model, sessionId };
}

/**
 * M4 (RELENTLESS_GOAL 2026-05-19): GET cold-start health probe. Returns
 * the configured model slugs + whether OPENROUTER_API_KEY is wired,
 * without burning an LLM call. Used by uptime monitors + the merchant
 * dashboard's "agent ready?" indicator.
 */
export function buildAgentHealthBody(env: { configured: boolean; error?: string }): {
  ok: boolean;
  service: string;
  models: Record<string, string>;
  openrouterConfigured: boolean;
  error?: string;
} {
  return {
    ok: env.configured,
    service: 'ppw-merchant-agent',
    models: { ...MODEL_SLUGS },
    openrouterConfigured: env.configured,
    ...(env.error ? { error: env.error } : {}),
  };
}

async function rawHandler(req: ChatReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method === 'GET') {
    // Health probe (M4). Never fires an LLM call.
    let env: { configured: boolean; error?: string };
    try {
      readOpenRouterEnv();
      env = { configured: true };
    } catch (err) {
      env = {
        configured: false,
        error: err instanceof Error ? err.message : 'OpenRouter not configured',
      };
    }
    const body = buildAgentHealthBody(env);
    res.status(env.configured ? 200 : 503);
    res.json(body);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).end();
    return;
  }

  const body = await readJson(req);
  const v = validateChatRequest(body);
  if (!v.ok) {
    res.status(400);
    res.json({ error: v.error });
    return;
  }

  let cfg;
  try {
    cfg = readOpenRouterEnv();
  } catch (err) {
    res.status(503);
    res.json({ error: err instanceof Error ? err.message : 'OpenRouter not configured' });
    return;
  }

  // Auto-prepend system prompt if the caller didn't provide one.
  const hasSystem = v.messages[0]?.role === 'system';
  const messages: ChatMessage[] = hasSystem
    ? v.messages
    : [{ role: 'system', content: MERCHANT_AGENT_SYSTEM_PROMPT }, ...v.messages];

  const model = v.model ?? pickModel(messages);

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  // V4 W1.D.6 — 3-part lockdown BEFORE any OpenRouter call.
  // Pessimistic cost ceiling: 4000 input + 2000 output tokens × Sonnet rate
  // (the most expensive model in our fallback chain). Real call typically
  // costs ~10-20% of this — over-reservation just makes us refuse one
  // extra call on the boundary.
  const pessimisticCostMicroUsd = estimateCostMicroUsd('claude-sonnet', 4000, 2000);
  const lockdown = await applyAgentChatLockdown({
    ip: getClientIp(req),
    messages,
    estimatedNextCostMicroUsd: pessimisticCostMicroUsd,
    // P3-4 — per-merchant (best-effort, via agent sessionId) daily sub-cap.
    scopeKey: v.sessionId !== undefined ? `session:${v.sessionId}` : undefined,
  });
  if (!lockdown.ok) {
    const status =
      lockdown.code === 'prompt_injection'
        ? 400
        : lockdown.code === 'rate_limit'
          ? 429
          : 503;
    res.status(status);
    res.json({ error: lockdown.error, code: lockdown.code });
    return;
  }

  try {
    const result = await openRouterChat(cfg, { messages, model });
    if (v.sessionId !== undefined) {
      await persistTurn({
        sessionId: v.sessionId,
        userMessage: lastUser,
        assistantContent: result.content,
        modelUsed: model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      });
    }
    res.status(200);
    res.json({
      content: result.content,
      model: result.model,
      modelChoice: model,
      usage: result.usage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'agent chat failed';
    // If Gemini fails, retry with Claude as fallback (per oms_merchant_agent_stack policy).
    if (model === 'gemini-flash') {
      try {
        const fallback = await openRouterChat(cfg, { messages, model: 'claude-sonnet' });
        if (v.sessionId !== undefined) {
          await persistTurn({
            sessionId: v.sessionId,
            userMessage: lastUser,
            assistantContent: fallback.content,
            modelUsed: 'claude-sonnet',
            promptTokens: fallback.usage.promptTokens,
            completionTokens: fallback.usage.completionTokens,
            fallbackReason: msg,
          });
        }
        res.setHeader('X-Agent-Fallback', 'gemini→claude');
        res.status(200);
        res.json({
          content: fallback.content,
          model: fallback.model,
          modelChoice: 'claude-sonnet',
          fallbackReason: msg,
          usage: fallback.usage,
        });
        return;
      } catch (fallbackErr) {
        const fmsg = fallbackErr instanceof Error ? fallbackErr.message : 'fallback failed';
        res.status(502);
        res.json({ error: `Both models failed. Gemini: ${msg}. Claude: ${fmsg}` });
        return;
      }
    }
    res.status(502);
    res.json({ error: msg });
  }
}

export default withSentry(rawHandler);
