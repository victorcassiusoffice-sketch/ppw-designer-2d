#!/usr/bin/env node
/**
 * gen-3d-models — product photo → textured 3D body via Fal (2026-09-17).
 *
 * Vic: "the objects would need to be 3D … AI art tools … we need this
 * embedded … aesthetically identical to the product." OpenArt offers no
 * image-to-3D (checked 2026-09-17: images + video only); Fal does, and the
 * key already exists on this machine. Live prices read from fal.ai the same
 * day: trellis $0.02 · hunyuan3d/v2/multi-view $0.16 · hunyuan3d-v21 $0.30
 * (PBR-textured, the default here) · hyper3d/rodin $0.40 per generation.
 *
 *   node scripts/gen-3d-models.mjs --dry-run              # what would be sent + the bill, no calls
 *   node scripts/gen-3d-models.mjs --only k1-nordictrack-2450
 *   node scripts/gen-3d-models.mjs --limit 5 --model fal-ai/trellis
 *   node scripts/gen-3d-models.mjs --all                  # every product with a real photo
 *
 * ⛔ SPEND GATE: every real call costs money. The script refuses to run
 * without `--yes` (Vic's written Y for THIS batch), and never without
 * `--dry-run` first having been read. The key is read from
 * `C:\Users\Victor\Documents\junk files\fal-ai-api-key.txt` at runtime and is
 * never printed.
 *
 * Output per product: `public/models/<id>.glb` (the model as delivered;
 * run `npm run models:optimize` after a batch to draco-compress) and a row
 * in `src/data/productModels.json` (url + the fit hints the stage needs).
 * The stage fits every body to `dimensions_cm` exactly (designer/fitToSize),
 * so the model's own size never matters — its LOOK does.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { optimizeGlb } from './optimize-models.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
/** The generator's output as delivered (ignored by git, OUTSIDE public/ so no build copies 5 MB bodies); the served body is the optimised one. */
const RAW_DIR = path.join(ROOT, 'models-raw');
const KEY_FILE = 'C:\\Users\\Victor\\Documents\\junk files\\fal-ai-api-key.txt';
const CATALOG = path.join(ROOT, 'src', 'data', 'products.json');
const MANIFEST = path.join(ROOT, 'src', 'data', 'productModels.json');
const OUT_DIR = path.join(ROOT, 'public', 'models');
/** Photos are served from production; Fal needs a public URL. */
const PHOTO_BASE = 'https://designer.ppwellness.co';

const PRICES = {
  'fal-ai/hunyuan3d-v21': 0.3,
  'fal-ai/hunyuan3d/v2/multi-view': 0.16,
  'fal-ai/trellis': 0.02,
  'fal-ai/hyper3d/rodin': 0.4,
};

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const dryRun = flag('--dry-run');
const yes = flag('--yes');
const model = opt('--model', 'fal-ai/hunyuan3d-v21');
const only = opt('--only');
const limit = Number(opt('--limit', '0'));
const all = flag('--all');
/**
 * Requests in flight at once. The first run showed 53 s of inference behind
 * 14 min of queue: sequential submission would turn 21 models into hours,
 * so the batch submits several and polls them together.
 */
const parallel = Math.max(1, Number(opt('--parallel', '6')));

if (!PRICES[model]) {
  console.error(`unknown model ${model}; one of ${Object.keys(PRICES).join(', ')}`);
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const products = Array.isArray(catalog) ? catalog : catalog.products;
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

/** The photo a model is generated from: the real product photo, never a placeholder. */
function photoOf(p) {
  const cands = [p.photo_image_url, p.image_url].filter(Boolean).filter((u) => !/placehold\.co/i.test(u));
  if (!cands.length) return null;
  const u = cands[0];
  return /^https?:/i.test(u) ? u : `${PHOTO_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
}

let todo = products.filter((p) => photoOf(p));
if (only) todo = todo.filter((p) => p.id === only);
else if (!all) todo = todo.filter((p) => !manifest[p.id]);
if (limit > 0) todo = todo.slice(0, limit);

const bill = (todo.length * PRICES[model]).toFixed(2);
console.log(`model ${model} · $${PRICES[model]} each · ${todo.length} product(s) · bill $${bill}`);
for (const p of todo) console.log(`  ${p.id.padEnd(34)} ${JSON.stringify(p.dimensions_cm).padEnd(44)} ${photoOf(p)}`);
const skipped = products.filter((p) => !photoOf(p)).map((p) => p.id);
if (skipped.length) console.log(`no real photo (skipped, need one first): ${skipped.join(', ')}`);

if (dryRun) {
  console.log('\n--dry-run: nothing sent, nothing spent.');
  process.exit(0);
}
if (!yes) {
  console.error('\n⛔ Refusing to spend without --yes (Vic\'s written Y for this batch). Run with --dry-run to see the bill.');
  process.exit(3);
}
if (!fs.existsSync(KEY_FILE)) {
  console.error(`key file missing: ${KEY_FILE}`);
  process.exit(4);
}
const KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

async function falQueue(endpoint, input) {
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!submit.ok) throw new Error(`submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const { request_id, status_url, response_url } = await submit.json();
  let metrics = null;
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(`${status_url}?logs=1`, { headers: { Authorization: `Key ${KEY}` } });
    const s = await st.json();
    if (s.metrics) metrics = s.metrics;
    if (s.status === 'COMPLETED') break;
    if (s.status === 'FAILED') throw new Error(`fal FAILED ${request_id}: ${JSON.stringify(s).slice(0, 300)}`);
    if (i % 6 === 0) process.stdout.write(`   … ${s.status} (${s.queue_position ?? '-'})\n`);
  }
  const res = await fetch(response_url, { headers: { Authorization: `Key ${KEY}` } });
  if (!res.ok) throw new Error(`result ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = await res.json();
  return { out, request_id, metrics };
}

/** Where the GLB lives in each model's response — the PBR-textured one first. */
function glbUrlOf(model, out) {
  return out.model_glb_pbr?.url ?? out.model_glb?.url ?? out.model_mesh?.url ?? out.glb?.url ?? out.model?.url ?? null;
}

/**
 * Spend log (Vic 2026-09-17: "note the average spend and fluctuations, both
 * API and Hunyuan3D"): one row per call — unit price, wall seconds, the
 * generator's own inference metrics when it reports them, bytes, outcome.
 */
const SPEND_LOG = path.join(ROOT, 'docs', 'designer-3d-mode-2026-09-17', 'fal-spend-log.json');
function logSpend(row) {
  const rows = fs.existsSync(SPEND_LOG) ? JSON.parse(fs.readFileSync(SPEND_LOG, 'utf8')) : [];
  rows.push(row);
  fs.writeFileSync(SPEND_LOG, JSON.stringify(rows, null, 2) + '\n');
}
/** A balance / quota refusal from Fal: stop the batch so Vic can top up. */
function isBalanceError(e) {
  return /402|insufficient|balance|exhausted|quota|payment/i.test(String(e));
}

function inputFor(model, photoUrl) {
  switch (model) {
    case 'fal-ai/hunyuan3d-v21':
      return { input_image_url: photoUrl, textured_mesh: true, num_inference_steps: 50, octree_resolution: 256 };
    case 'fal-ai/hunyuan3d/v2/multi-view':
      return { front_image_url: photoUrl, textured_mesh: true };
    case 'fal-ai/trellis':
      return { image_url: photoUrl, texture_size: 1024 };
    case 'fal-ai/hyper3d/rodin':
      return { input_image_urls: [photoUrl], geometry_file_format: 'glb' };
    default:
      return { image_url: photoUrl };
  }
}

let spent = 0;
let first = true;
let stop = false;

async function generate(p) {
  const photo = photoOf(p);
  process.stdout.write(`→ ${p.id} from ${photo}\n`);
  const t0 = Date.now();
  try {
    const { out, request_id, metrics } = await falQueue(model, inputFor(model, photo));
    if (first) {
      console.log(`   response keys: ${Object.keys(out).join(', ')}`);
      first = false;
    }
    const url = glbUrlOf(model, out);
    if (!url) throw new Error(`no glb in response: ${JSON.stringify(out).slice(0, 300)}`);
    const glb = Buffer.from(await (await fetch(url)).arrayBuffer());
    const raw = path.join(RAW_DIR, `${p.id}.glb`);
    fs.writeFileSync(raw, glb);
    const file = path.join(OUT_DIR, `${p.id}.glb`);
    const opt = await optimizeGlb(raw, file);
    const seconds = Math.round((Date.now() - t0) / 1000);
    manifest[p.id] = {
      url: `/models/${p.id}.glb`,
      source: { model, photo, generated_at: new Date().toISOString(), bytes: opt.outBytes, raw_bytes: glb.length, triangles: opt.triangles, request_id, seconds },
      // Fit hints the stage may need; the generator's output is y-up, front unknown — QA sets these.
      modelFront: '+z',
      lengthAxis: 'auto',
    };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    spent += PRICES[model];
    logSpend({ id: p.id, model, price_usd: PRICES[model], seconds, metrics, bytes: glb.length, served_bytes: opt.outBytes, request_id, at: new Date().toISOString(), ok: true });
    console.log(`   ✓ ${p.id} ${(glb.length / 1024).toFixed(0)} KB → ${(opt.outBytes / 1024).toFixed(0)} KB in ${seconds}s (inference ${metrics?.inference_time ? metrics.inference_time.toFixed(0) + 's' : '?'})   (spent so far $${spent.toFixed(2)})`);
  } catch (e) {
    const seconds = Math.round((Date.now() - t0) / 1000);
    logSpend({ id: p.id, model, price_usd: 0, seconds, at: new Date().toISOString(), ok: false, error: String(e).slice(0, 300) });
    console.error(`   ✗ ${p.id}: ${String(e).slice(0, 200)}`);
    if (isBalanceError(e)) {
      console.error('\n⛔ Fal refused on balance/quota — stopping the batch. Vic: top up, then re-run (already-generated products are skipped).');
      stop = true;
    }
  }
}

// A small pool: `parallel` requests in flight, the next one submitted as one lands.
const queue = [...todo];
async function worker() {
  while (queue.length && !stop) await generate(queue.shift());
}
await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker));
console.log(`done · $${spent.toFixed(2)} spent this run · manifest ${path.relative(ROOT, MANIFEST)} · log ${path.relative(ROOT, SPEND_LOG)}`);
