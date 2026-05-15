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

import { withSentry, type MinReq, type MinRes } from './lib/sentry.js';
import {
  readOpenRouterEnv,
  openRouterChat,
  pickModel,
  MERCHANT_AGENT_SYSTEM_PROMPT,
  type ChatMessage,
  type AgentModel,
} from './lib/agent/openrouter.js';

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;

interface ChatReq extends MinReq {
  body?: unknown;
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
): { ok: true; messages: ChatMessage[]; model?: AgentModel } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as { messages?: unknown; model?: unknown };
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
  return { ok: true, messages, model };
}

async function rawHandler(req: ChatReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
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

  try {
    const result = await openRouterChat(cfg, { messages, model });
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
