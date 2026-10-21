#!/usr/bin/env node
/** Reviewed single-product successor to the 2026-09-17 Fal fitness pipeline.
 * Default is a dry run. A real submit needs --yes --max-usd 0.525.
 * Persist a submit-intent before the paid request; an ambiguous network failure
 * never retries submission. --resume only polls an already journalled request.
 * Output is staged under ignored models-raw. No live catalogue is published.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { optimizeGlb } from './optimize-models.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MODEL = 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d';
export const UNIT_USD = 0.525;
const KEY_FILE = 'C:\\Users\\Victor\\Documents\\junk files\\fal-ai-api-key.txt';
export function validateJob(job) {
  if (job.version !== 1 || !/^[a-z0-9][a-z0-9-]*$/.test(job.productId ?? '') || !job.sku || !job.referenceReview) throw new Error('A reviewed product identity and SKU are required.');
  if (job.model !== MODEL || job.estimatedUsd !== UNIT_USD) throw new Error('Model or estimate differs from the reviewed single-image PBR job.');
  if (JSON.stringify(job.inputOptions) !== JSON.stringify({ generate_type: 'Normal', enable_pbr: true })) throw new Error('Custom geometry, multi-view or other paid options are not approved by this job contract.');
  if (!['length', 'width', 'height'].every(axis => Number.isFinite(job.dimensions_cm?.[axis]) && job.dimensions_cm[axis] > 0)) throw new Error('Positive canonical dimensions are required.');
  const image = new URL(job.photo);
  if (image.protocol !== 'https:' || image.username || image.password || /placeholder|placehold\.co|\/preview\.(png|jpg)/i.test(image.href)) throw new Error('Use a verified public HTTPS product photo, never a placeholder or SVG.');
  if (!/\.(png|jpe?g|webp)$/i.test(image.pathname)) throw new Error('Use the reviewed single product JPG, PNG or WebP.');
  for (const reference of [job.sourcePage, job.photoReferencePage]) if (new URL(reference).protocol !== 'https:') throw new Error('Public source pages are required.');
  return { input_image_url: image.href, generate_type: 'Normal', enable_pbr: true };
}
const sha = value => createHash('sha256').update(value).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
async function writeJournal(file, data) {
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
  await fs.rename(temporary, file);
}
function safeQueueUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'queue.fal.run' || url.username || url.password) throw new Error('Unexpected provider queue URL.');
  return url.href;
}
export async function runJob({ jobFile, yes = false, maxUsd, resume = false }, fetcher = fetch) {
  const job = await json(path.resolve(jobFile));
  const input = validateJob(job);
  const jobHash = sha(JSON.stringify(job));
  const directory = path.join(ROOT, 'models-raw', 'merchant-jobs', `${job.productId}-${jobHash.slice(0, 12)}`);
  const journalPath = path.join(directory, 'request.json');
  const report = { productId: job.productId, sku: job.sku, model: MODEL, dimensions_cm: job.dimensions_cm, photo: job.photo, estimatedUsd: UNIT_USD, journalPath };
  console.log(JSON.stringify(report, null, 2));
  if (!yes && !resume) { console.log('Dry run only: no network calls, no credits, no files changed.'); return { ...report, dryRun: true }; }
  if (!resume && (!Number.isFinite(maxUsd) || maxUsd < UNIT_USD || maxUsd > 1)) throw new Error('This single submit needs an explicit --max-usd budget between 0.525 and 1.');
  let journal;
  try { journal = await json(journalPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (journal && !resume) throw new Error('A submit intent already exists. Use --resume to retrieve it; never resubmit this job automatically.');
  if (resume && (!journal?.request_id || journal.jobHash !== jobHash)) throw new Error('No matching provider receipt. Resolve an ambiguous submit in Fal dashboard before any further charge.');
  const key = process.env.FAL_KEY?.trim() || (await fs.readFile(KEY_FILE, 'utf8')).trim();
  if (!key) throw new Error('Fal credential unavailable.');
  const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
  if (!resume) {
    await fs.mkdir(directory, { recursive: true });
    journal = { jobHash, productId: job.productId, model: MODEL, estimatedUsd: UNIT_USD, state: 'submit-intent', at: new Date().toISOString() };
    // Exclusive create prevents two same-job invocations spending together.
    await fs.writeFile(journalPath, JSON.stringify(journal, null, 2) + '\n', { flag: 'wx' });
    const submitted = await fetcher(`https://queue.fal.run/${MODEL}`, { method: 'POST', headers, body: JSON.stringify(input), signal: AbortSignal.timeout(60000) });
    if (!submitted.ok) { journal.state = `submit-http-${submitted.status}`; await writeJournal(journalPath, journal); throw new Error(`Fal submit HTTP ${submitted.status}; no automatic retry.`); }
    const receipt = await submitted.json();
    if (typeof receipt.request_id !== 'string') throw new Error('Missing provider receipt. Check Fal dashboard; no automatic retry.');
    journal = { ...journal, request_id: receipt.request_id, status_url: safeQueueUrl(receipt.status_url), response_url: safeQueueUrl(receipt.response_url), state: 'submitted' };
    await writeJournal(journalPath, journal);
  }
  if (journal.state !== 'completed') {
    let complete = false;
    for (let attempt = 0; attempt < 240; attempt++) {
      const response = await fetcher(safeQueueUrl(journal.status_url), { headers, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Fal status HTTP ${response.status}; use --resume after checking availability.`);
      const status = await response.json();
      if (status.status === 'FAILED') { journal.state = 'failed'; await writeJournal(journalPath, journal); throw new Error('Provider marked generation failed; no automatic retry.'); }
      if (status.status === 'COMPLETED') { complete = true; break; }
      if (attempt % 6 === 0) console.log(`Provider ${status.status ?? 'pending'}; paid submission will not be repeated.`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    if (!complete) throw new Error('Polling timed out. The paid request is retained; use --resume.');
  }
  const result = await fetcher(safeQueueUrl(journal.response_url), { headers, signal: AbortSignal.timeout(30000) });
  if (!result.ok) throw new Error(`Fal result HTTP ${result.status}; use --resume, not a new submit.`);
  const output = await result.json();
  const modelUrl = output.model_glb?.url;
  if (!modelUrl || new URL(modelUrl).protocol !== 'https:') throw new Error('Provider did not return its supported GLB result.');
  const download = await fetcher(modelUrl, { signal: AbortSignal.timeout(90000) });
  if (!download.ok) throw new Error(`Model download HTTP ${download.status}; use --resume.`);
  const bytes = Buffer.from(await download.arrayBuffer());
  if (bytes.length < 20 || bytes.length > 80 * 1024 * 1024 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Provider response is not a valid bounded GLB 2.0.');
  const raw = path.join(directory, 'raw.glb'), candidate = path.join(directory, 'candidate.glb');
  await fs.writeFile(raw, bytes);
  const optimized = await optimizeGlb(raw, candidate);
  const served = await fs.readFile(candidate);
  if (served.length > 12 * 1024 * 1024) throw new Error('Candidate exceeds runtime size budget; no catalogue entry published.');
  const filename = `${job.productId}-${sha(served).slice(0, 16)}.glb`;
  const entry = { url: `/models/${filename}`, modelFront: '+z', modelUp: '+y', lengthAxis: 'auto', preferMesh: true,
    source: { model: MODEL, photo: job.photo, reference: job.sourcePage, photoReference: job.photoReferencePage, sku: job.sku, generated_at: journal.at,
      request_id: journal.request_id, bytes: served.length, raw_bytes: bytes.length, triangles: optimized.triangles, review: 'PENDING: orientation, likeness and dimensions must be checked before publication.' } };
  await fs.writeFile(path.join(directory, 'manifest-candidate.json'), JSON.stringify({ [job.productId]: entry }, null, 2) + '\n');
  journal = { ...journal, state: 'completed', rawBytes: bytes.length, candidateBytes: served.length, candidate, filename, completedAt: new Date().toISOString() };
  await writeJournal(journalPath, journal);
  console.log(JSON.stringify({ candidate, filename, journalPath, requestId: journal.request_id, published: false, ...optimized }, null, 2));
  return journal;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  runJob({ jobFile: option('--job'), yes: args.includes('--yes'), maxUsd: Number(option('--max-usd')), resume: args.includes('--resume') })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
