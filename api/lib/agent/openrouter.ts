/**
 * OMS Phase 6 — OpenRouter LLM client.
 *
 * Routes chat requests through OpenRouter's REST API. Default model:
 * Gemini Flash 2.0 (free tier). Fallback: Claude Sonnet for complex
 * tasks. Per oms_merchant_agent_stack.md, $200/mo combined cap is
 * enforced server-side via OpenRouter dashboard.
 *
 * No SDK dependency — direct fetch keeps the lambda bundle thin.
 */

export type AgentModel = 'gemini-flash' | 'claude-sonnet';

export const MODEL_SLUGS: Record<AgentModel, string> = {
  'gemini-flash': 'google/gemini-2.0-flash-exp:free',
  'claude-sonnet': 'anthropic/claude-3.5-sonnet',
};

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: AgentModel;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface OpenRouterEnv {
  apiKey: string;
}

export function readOpenRouterEnv(): OpenRouterEnv {
  const apiKey = (process.env.OPENROUTER_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('OpenRouter not configured (OPENROUTER_API_KEY missing)');
  return { apiKey };
}

/**
 * Call OpenRouter's chat completion. Caller picks model — escalation
 * logic (Gemini → Claude on failure) lives in the agent handler, not
 * here.
 */
export async function openRouterChat(
  cfg: OpenRouterEnv,
  req: ChatRequest,
  fetchFn: typeof fetch = fetch,
): Promise<ChatResponse> {
  const model = req.model ?? 'gemini-flash';
  const slug = MODEL_SLUGS[model];
  if (!slug) throw new Error(`Unknown agent model: ${model}`);

  const body = {
    model: slug,
    messages: req.messages,
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.3,
  };

  const res = await fetchFn(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://designer.ppwellness.co',
      'X-Title': 'PPW Merchant Integration Agent',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('OpenRouter returned empty completion.');

  return {
    content,
    model: data.model ?? slug,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Helper: pick a model based on task complexity. Phase 6 simple
 * heuristic — Gemini for short conversational turns, Claude for code
 * generation or large message contexts.
 */
export function pickModel(messages: ChatMessage[]): AgentModel {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const hasCodeRequest =
    messages[messages.length - 1]?.content.toLowerCase().includes('code') ||
    messages[messages.length - 1]?.content.toLowerCase().includes('implement') ||
    messages[messages.length - 1]?.content.toLowerCase().includes('debug');
  if (totalChars > 8000 || hasCodeRequest) return 'claude-sonnet';
  return 'gemini-flash';
}

export const MERCHANT_AGENT_SYSTEM_PROMPT = `You are the PPWellness Merchant Integration Agent.
You help merchants connect their product catalog to the Peak Performance Wellness marketplace.
Be concise, friendly, and concrete. Always confirm what the merchant needs before proposing API integrations.
If the merchant asks about pricing, payouts, or legal terms, escalate to Vic (admin@ppwellness.co) — do not improvise.
The integration tiers are: Tier 1 (Shopify/WooCommerce plugin), Tier 2 (custom API), Tier 3 (manual portal upload).`;
