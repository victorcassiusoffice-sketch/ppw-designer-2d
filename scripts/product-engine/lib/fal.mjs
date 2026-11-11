/**
 * Fal queue calls, the spend log and the journal. The key is read here, at run time, from its
 * path, and goes into one header. Nothing in this module prints, copies or stores it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JOURNAL, KEY_FILE, SPEND_LOG } from './paths.mjs';

let key = null;
export function readKey() {
  if (key) return key;
  if (!fs.existsSync(KEY_FILE)) throw new Error(`the Fal key file is missing at its path (name only): ${path.basename(KEY_FILE)}`);
  key = fs.readFileSync(KEY_FILE, 'utf8').trim();
  if (!key) throw new Error('the Fal key file is empty');
  return key;
}

/** A balance or quota refusal: the batch stops so Victor can top up on his Fal login. */
export function isBalanceError(e) {
  return /\b402\b|insufficient|balance|exhausted|quota|payment|credits?\b.*(low|out|insufficient)/i.test(String(e));
}

/** Data URIs out of anything that is written to disk. */
export function sanitizeInput(input) {
  const out = {};
  for (const [k, v] of Object.entries(input ?? {})) out[k] = typeof v === 'string' && v.startsWith('data:') ? `<data uri, ${v.length} chars>` : v;
  return out;
}

function journal(row) {
  fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
  fs.appendFileSync(JOURNAL, `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`);
}

const headers = () => ({ Authorization: `Key ${readKey()}`, 'Content-Type': 'application/json' });

export async function submit(endpoint, input) {
  const res = await fetch(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: headers(), body: JSON.stringify(input) });
  if (!res.ok) throw new Error(`fal submit ${res.status} (${endpoint}): ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

/**
 * Poll until COMPLETED or FAILED. Fal's queue, not the model, is the wall-time cost (September:
 * 14 min queue for 53 s of inference), so callers submit several and poll together.
 */
export async function waitFor(statusUrl, { onStatus, timeoutMs = 45 * 60 * 1000, everyMs = 5000 } = {}) {
  const started = Date.now();
  let metrics = null;
  let i = 0;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, everyMs));
    const res = await fetch(`${statusUrl}?logs=1`, { headers: headers() });
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`fal status ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const s = await res.json();
    if (s.metrics) metrics = s.metrics;
    if (s.status === 'COMPLETED') return { status: s.status, metrics };
    if (s.status === 'FAILED') throw new Error(`fal FAILED: ${JSON.stringify(s).slice(0, 400)}`);
    if (onStatus && i % 6 === 0) onStatus(s.status, s.queue_position ?? null);
    i++;
  }
  throw new Error(`fal timed out after ${Math.round(timeoutMs / 60000)} min`);
}

export async function fetchResult(responseUrl) {
  const res = await fetch(responseUrl, { headers: headers() });
  if (!res.ok) throw new Error(`fal result ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/**
 * One call end to end: submit → journal → wait → result. Returns the answer, the request id,
 * fal's own metrics (inference seconds) and the wall seconds.
 */
export async function run(endpoint, input, { label = endpoint, onStatus } = {}) {
  const t0 = Date.now();
  const { request_id, status_url, response_url } = await submit(endpoint, input);
  journal({ endpoint, label, request_id, status_url, response_url, input: sanitizeInput(input) });
  const { metrics } = await waitFor(status_url, { onStatus });
  const out = await fetchResult(response_url);
  return { out, request_id, metrics, seconds: Math.round((Date.now() - t0) / 1000) };
}

/** Pick up a journaled request whose run was interrupted (`--resume <request_id>`). */
export async function resume(requestId) {
  if (!fs.existsSync(JOURNAL)) throw new Error('no journal to resume from');
  const rows = fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const row = rows.reverse().find((r) => r.request_id === requestId);
  if (!row) throw new Error(`request ${requestId} is not in the journal`);
  const t0 = Date.now();
  const { metrics } = await waitFor(row.status_url);
  const out = await fetchResult(row.response_url);
  return { out, request_id: requestId, metrics, seconds: Math.round((Date.now() - t0) / 1000), journaled: row };
}

export async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}: ${url.slice(0, 120)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** One row per call, success or failure: what it cost, how long, what came back. */
export function logSpend(row) {
  fs.mkdirSync(path.dirname(SPEND_LOG), { recursive: true });
  const rows = fs.existsSync(SPEND_LOG) ? JSON.parse(fs.readFileSync(SPEND_LOG, 'utf8')) : [];
  rows.push({ at: new Date().toISOString(), ...row });
  fs.writeFileSync(SPEND_LOG, `${JSON.stringify(rows, null, 2)}\n`);
}

export function readSpendLog() {
  return fs.existsSync(SPEND_LOG) ? JSON.parse(fs.readFileSync(SPEND_LOG, 'utf8')) : [];
}
