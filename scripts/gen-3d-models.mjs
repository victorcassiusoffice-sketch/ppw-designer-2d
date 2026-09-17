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

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
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

async function falQueue(endpoint, input) {
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!submit.ok) throw new Error(`submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const { request_id, status_url, response_url } = await submit.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(status_url, { headers: { Authorization: `Key ${KEY}` } });
    const s = await st.json();
    if (s.status === 'COMPLETED') break;
    if (s.status === 'FAILED') throw new Error(`fal FAILED ${request_id}: ${JSON.stringify(s).slice(0, 300)}`);
    if (i % 6 === 0) process.stdout.write(`   … ${s.status} (${s.queue_position ?? '-'})\n`);
  }
  const res = await fetch(response_url, { headers: { Authorization: `Key ${KEY}` } });
  if (!res.ok) throw new Error(`result ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Where the GLB lives in each model's response. */
function glbUrlOf(model, out) {
  return out.model_glb?.url ?? out.model_mesh?.url ?? out.glb?.url ?? out.model?.url ?? null;
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
for (const p of todo) {
  const photo = photoOf(p);
  process.stdout.write(`→ ${p.id} from ${photo}\n`);
  try {
    const out = await falQueue(model, inputFor(model, photo));
    const url = glbUrlOf(model, out);
    if (!url) throw new Error(`no glb in response: ${JSON.stringify(out).slice(0, 300)}`);
    const glb = Buffer.from(await (await fetch(url)).arrayBuffer());
    const file = path.join(OUT_DIR, `${p.id}.glb`);
    fs.writeFileSync(file, glb);
    manifest[p.id] = {
      url: `/models/${p.id}.glb`,
      source: { model, photo, generated_at: new Date().toISOString(), bytes: glb.length },
      // Fit hints the stage may need; the generator's output is y-up, front unknown — QA sets these.
      modelFront: '+z',
      lengthAxis: 'auto',
    };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    spent += PRICES[model];
    console.log(`   ✓ ${(glb.length / 1024).toFixed(0)} KB → ${path.relative(ROOT, file)}   (spent so far $${spent.toFixed(2)})`);
  } catch (e) {
    console.error(`   ✗ ${p.id}: ${String(e).slice(0, 200)}`);
  }
}
console.log(`done · $${spent.toFixed(2)} spent · manifest ${path.relative(ROOT, MANIFEST)}`);
