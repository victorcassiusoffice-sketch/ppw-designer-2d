/**
 * V4 W1.D.6 — agent-chat 3-part lockdown (per IH §04.1).
 *
 * Three guards composed into `applyAgentChatLockdown(ip, messages,
 * estimatedNextCostMicroUsd)`:
 *
 *   1. detectPromptInjection(messages) — refuse jailbreak / system-
 *      prompt-override / role-confusion attempts. Pure regex pass over
 *      user messages; no LLM call needed. Cheap, deterministic, low
 *      false-positive cost for our merchant onboarding use case.
 *
 *   2. agentChatLimiter — Upstash KV sliding-window 20 requests / IP /
 *      minute (matches the existing rateLimit.ts pattern). Burst-cap
 *      keeps a single malicious IP from blowing the daily cost budget.
 *
 *   3. checkDailyCostBudget(currentSpendMicroUsd?) — atomic INCR on
 *      `openrouter:cost:<UTC-date>` in KV with $5/day hard cap
 *      (5_000_000 micro-USD per V4-IH-2 CLOSED). Returns the running
 *      total + a verdict. The caller passes the OpenRouter call's
 *      MAX estimated cost (input+output token ceiling × model rate)
 *      so we refuse BEFORE making a call that would tip us over —
 *      after-the-fact tracking would always overshoot by exactly one
 *      call.
 *
 * Each guard is independently testable + composable. Wired at the
 * top of `api/agent-chat.ts` handler before any OpenRouter call.
 *
 * Free-tier fail-open posture (matches rateLimit.ts): if KV is down,
 * we LOG + ALLOW. A KV outage must not silence the agent for valid
 * merchant traffic; the rate-limit + budget guards become best-effort
 * during the outage but the prompt-rejection regex still runs (pure).
 */

import { Redis } from '@upstash/redis';

import { buildLimiter, type Verdict } from '../rateLimit.js';

export const DAILY_COST_CAP_MICRO_USD = 5_000_000; // $5/day (global backstop)
/**
 * P3-4 — per-merchant (per-agent-session) daily sub-cap. One merchant's
 * onboarding session can't consume more than $2/day, leaving headroom under
 * the $5 global cap for everyone else. This is BEST-EFFORT until the Phase 6
 * pt2 Clerk merchant-auth gate lands: the scope key is the client-supplied
 * agent `sessionId`, so it bounds accidental runaway + honest per-merchant
 * usage, but a malicious caller rotating sessionIds is still caught by the
 * global cap + the per-IP rate limit. Real per-merchant enforcement needs the
 * authenticated merchant id (tracker p3-agent-costcap notes the dependency).
 */
export const PER_SCOPE_DAILY_CAP_MICRO_USD = 2_000_000; // $2/day per session
export const RATE_LIMIT_PER_MINUTE = 20;

/** Reuses the existing rateLimit.ts builder for the agent-chat namespace. */
export const agentChatLimiter = buildLimiter('agent-chat', RATE_LIMIT_PER_MINUTE, 60);

/**
 * Heuristic prompt-injection detector. Returns the FIRST match if any
 * user message looks like a jailbreak / system-prompt override /
 * role-confusion attempt. Pure + deterministic; no LLM.
 *
 * Pattern source: V4-IH-2 lockdown spec + common red-team primers
 * (OWASP LLM Top 10 LLM01). The set is intentionally short + focused
 * on the patterns merchants would never type in legitimate onboarding;
 * we're more worried about false negatives than false positives here
 * because merchants describing their products use natural language
 * and won't hit "ignore previous instructions" / "you are now" by
 * accident.
 */
const INJECTION_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'ignore-prior-instructions', re: /\bignore\s+(?:all\s+)?(?:previous|prior|above|the\s+above)\s+(?:instructions|context|rules|prompt)/i },
  { name: 'role-override', re: /\byou\s+are\s+(?:now|actually)\s+(?:a|an|the)\b/i },
  { name: 'system-prompt-bracket', re: /<\s*(?:system|sys|admin|root)\s*>/i },
  { name: 'reveal-system-prompt', re: /\b(?:reveal|show|print|repeat|display)\s+(?:your|the)\s+(?:system|initial|hidden)\s+prompt/i },
  { name: 'jailbreak-keyword', re: /\b(?:DAN|do\s+anything\s+now|jailbreak\s+mode|developer\s+mode\s+enabled)\b/i },
  { name: 'role-claim', re: /^\s*(?:system|assistant|user)\s*:/im },
  { name: 'instruction-injection', re: /\bnew\s+(?:instructions|directives|rules)\s*:\s*/i },
];

export interface InjectionMatch {
  pattern: string;
  excerpt: string;
}

export function detectPromptInjection(messages: Array<{ role: string; content: string }>): InjectionMatch | null {
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const content = String(msg.content ?? '');
    for (const { name, re } of INJECTION_PATTERNS) {
      const m = re.exec(content);
      if (m) {
        return {
          pattern: name,
          excerpt: content.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12),
        };
      }
    }
  }
  return null;
}

// ─── Daily cost budget ────────────────────────────────────────────────

interface MinimalRedis {
  incrby(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  get<T = unknown>(key: string): Promise<T | null>;
}

let _redis: MinimalRedis | null = null;
let _redisResolved = false;

function getBudgetRedis(): MinimalRedis | null {
  if (_redisResolved) return _redis;
  _redisResolved = true;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token }) as unknown as MinimalRedis;
  return _redis;
}

/** Test hooks. */
export function _resetLockdownForTests(): void {
  _redis = null;
  _redisResolved = false;
}

export function _setLockdownRedisForTests(client: MinimalRedis | null): void {
  _redis = client;
  _redisResolved = true;
}

export function utcDateStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function budgetKey(now: Date = new Date()): string {
  return `openrouter:cost:${utcDateStamp(now)}`;
}

/** Per-scope (per-agent-session) daily budget key. */
export function scopedBudgetKey(scope: string, now: Date = new Date()): string {
  return `openrouter:cost:${utcDateStamp(now)}:scope:${scope}`;
}

export interface BudgetVerdict {
  allowed: boolean;
  spentMicroUsd: number;
  capMicroUsd: number;
  /** Per-scope running total (only set when a scopeKey was supplied). */
  scopeSpentMicroUsd?: number;
  scopeCapMicroUsd?: number;
  reason?: 'no-redis' | 'over-budget' | 'over-scope-budget';
}

async function incrBudget(
  redis: MinimalRedis,
  key: string,
  amount: number,
): Promise<number> {
  const total = await redis.incrby(key, amount);
  if (total === amount) {
    await redis.expire(key, 90_000); // 25h — keeps yesterday's bucket viewable for diagnostics
  }
  return total;
}

/**
 * INCRBY the running daily spend by the estimated cost of the upcoming call.
 * Enforces the GLOBAL $5/day cap and, when `scopeKey` is supplied (the agent
 * sessionId — P3-4 per-merchant best-effort), an additional per-scope $2/day
 * sub-cap. Refuses if EITHER cap would be exceeded. Caller MUST NOT proceed
 * on `{allowed: false}`.
 *
 * Failing open on KV outage (matches rateLimit.ts posture) — we'd rather
 * accept the per-call cap risk during a KV outage than silence the agent for
 * valid merchant traffic.
 */
export async function checkDailyCostBudget(
  estimatedNextCostMicroUsd: number,
  scopeKey?: string,
): Promise<BudgetVerdict> {
  const redis = getBudgetRedis();
  if (!redis) {
    return {
      allowed: true,
      spentMicroUsd: 0,
      capMicroUsd: DAILY_COST_CAP_MICRO_USD,
      reason: 'no-redis',
    };
  }
  const amount = Math.max(0, Math.floor(estimatedNextCostMicroUsd));
  let total: number;
  let scopeTotal: number | undefined;
  try {
    total = await incrBudget(redis, budgetKey(), amount);
    if (scopeKey) {
      scopeTotal = await incrBudget(redis, scopedBudgetKey(scopeKey), amount);
    }
  } catch {
    return {
      allowed: true,
      spentMicroUsd: 0,
      capMicroUsd: DAILY_COST_CAP_MICRO_USD,
      reason: 'no-redis',
    };
  }
  if (total > DAILY_COST_CAP_MICRO_USD) {
    return { allowed: false, spentMicroUsd: total, capMicroUsd: DAILY_COST_CAP_MICRO_USD, reason: 'over-budget', scopeSpentMicroUsd: scopeTotal, scopeCapMicroUsd: scopeKey ? PER_SCOPE_DAILY_CAP_MICRO_USD : undefined };
  }
  if (scopeKey && scopeTotal !== undefined && scopeTotal > PER_SCOPE_DAILY_CAP_MICRO_USD) {
    return {
      allowed: false,
      spentMicroUsd: total,
      capMicroUsd: DAILY_COST_CAP_MICRO_USD,
      scopeSpentMicroUsd: scopeTotal,
      scopeCapMicroUsd: PER_SCOPE_DAILY_CAP_MICRO_USD,
      reason: 'over-scope-budget',
    };
  }
  return {
    allowed: true,
    spentMicroUsd: total,
    capMicroUsd: DAILY_COST_CAP_MICRO_USD,
    scopeSpentMicroUsd: scopeTotal,
    scopeCapMicroUsd: scopeKey ? PER_SCOPE_DAILY_CAP_MICRO_USD : undefined,
  };
}

// ─── Composed verdict ─────────────────────────────────────────────────

export type LockdownCode =
  | 'prompt_injection'
  | 'rate_limit'
  | 'cost_budget_exceeded';

export type LockdownVerdict =
  | { ok: true; rateLimit: Verdict; budget: BudgetVerdict }
  | {
      ok: false;
      code: LockdownCode;
      error: string;
      details?: InjectionMatch | Verdict | BudgetVerdict;
    };

export async function applyAgentChatLockdown(args: {
  ip: string;
  messages: Array<{ role: string; content: string }>;
  estimatedNextCostMicroUsd: number;
  /** P3-4 — per-merchant (per-agent-session) budget scope, e.g. `session:42`. */
  scopeKey?: string;
}): Promise<LockdownVerdict> {
  // 1. Prompt-injection (pure; runs even in KV outage).
  const injection = detectPromptInjection(args.messages);
  if (injection) {
    return {
      ok: false,
      code: 'prompt_injection',
      error: `prompt_injection_detected: ${injection.pattern}`,
      details: injection,
    };
  }
  // 2. Rate-limit (KV; fails open on KV outage per rateLimit.ts).
  const rl = await agentChatLimiter.check(args.ip);
  if (!rl.success) {
    return {
      ok: false,
      code: 'rate_limit',
      error: `rate_limited: retry after ${rl.retryAfterSec}s`,
      details: rl,
    };
  }
  // 3. Daily cost budget (KV; fails open on KV outage) — global + per-scope.
  const budget = await checkDailyCostBudget(args.estimatedNextCostMicroUsd, args.scopeKey);
  if (!budget.allowed) {
    return {
      ok: false,
      code: 'cost_budget_exceeded',
      error: `daily_cost_budget_exceeded: ${budget.spentMicroUsd} / ${budget.capMicroUsd} micro-USD`,
      details: budget,
    };
  }
  return { ok: true, rateLimit: rl, budget };
}
