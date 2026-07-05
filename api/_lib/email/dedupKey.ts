/**
 * V4 M9.A.send.2 — deterministic email dedup-key generator.
 *
 * Returns a 32-char hex slice of SHA256 over a stable-stringified
 * `(template, recipient, payload)` triple. Same input → same key;
 * deeply-nested payload-key reorderings hash to the same value.
 *
 * Consumed by `send.ts` to:
 *   - cache the Resend message ID under `email:dedup:<key>` (KV TTL 7 days)
 *     so a double-call with the same dedupKey returns the FIRST send's id
 *     and never re-issues an email
 *   - tie the audit_log row back to a logical send (forensic forensics)
 *
 * Pure helper — no I/O, no env reads — so it composes cleanly into tests.
 */

import { createHash } from 'node:crypto';

/** Stable JSON stringify with sorted object keys (handles nested objects + arrays). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

export function computeDedupKey(template: string, recipient: string, payload: unknown): string {
  const input = `${template}|${recipient.toLowerCase()}|${stableStringify(payload ?? null)}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}
