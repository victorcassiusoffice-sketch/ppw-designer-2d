#!/usr/bin/env node
/**
 * product-engine — a product photo → a real 3D body at its exact size, facing the right way, a
 * lighter copy for phones, a plan picture and a catalogue picture made from that body, and a pass
 * or fail report; and real-looking people for Walk mode. One command (`npm run products:engine`).
 *
 *   node scripts/product-engine/index.mjs audit                       # $0: every catalogue photo, usable / wrong / missing
 *   node scripts/product-engine/index.mjs gate [--make-phone|--remake-phone]   # $0: the gate on the bodies that exist today
 *   node scripts/product-engine/index.mjs run --tool tripo --only a,b --dry-run   # the bill, no calls
 *   node scripts/product-engine/index.mjs run --tool all --only a,b,c --yes --cap 10 --run test-2026-11-08
 *   node scripts/product-engine/index.mjs reprocess --run test-2026-11-08 [--tool tripo] [--only a]   # $0: redo everything after the Fal call from the raw download
 *   node scripts/product-engine/index.mjs adopt --run test-2026-11-08 --tool tripo
 *   node scripts/product-engine/index.mjs run --tool tripo --remake --yes --cap 12 --adopt   # the batch, straight to the catalogue
 *   node scripts/product-engine/index.mjs people --only nadia --dry-run | --yes
 *   node scripts/product-engine/index.mjs views --only <id> --front <url|file> --left <url|file> [--back …] [--right …] [--page <listing url>]   # $0: a listing's side shots, cleaned, on the row
 *
 * ⛔ Nothing spends without `--yes`, and never past `--cap` (USD). Run `--dry-run` first and show the
 * bill. The Fal key is read at run time from its path by lib/fal.mjs and never printed.
 * Everything runs through Fal on the key PPW already has: no new account, no new subscription.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { loadCatalogue, loadInputRows, photoUrlOf, publicPhotoUrl, readJson, readManifest, readThumbs, setRowFields, writeJson, writeManifest, writeThumbs } from './lib/catalog.mjs';
import { VIEW_ORDER, cleanProductShot, multiviewPlan, multiviewUrls, viewFile, viewsOf } from './lib/views.mjs';
import { auditAll } from './lib/photo.mjs';
import { CANDIDATES_DIR, CATALOG_MODELS_DIR, CHARACTERS_JSON, COURTS_JSON, MODELS_DIR, PRODUCTS_JSON, PUBLIC_DIR, RAW_DIR, ROOT, SPEND_LOG, TOPDOWN_DIR, WALK_THUMBS_DIR, runDir } from './lib/paths.mjs';
import { PERSON_TOOL, PICTURE_TOOL, PRICES_READ_ON, TOOLS, TOOL_KEYS, money } from './lib/prices.mjs';
import * as fal from './lib/fal.mjs';
import { bakeTransform, bakeYaw, baseTilt, catalogueIsFlat, detectUp, footprintYaw, frontAfterYaw, headDirection, levelCorrection, photoFaceSign, pitchedExtents, rawShapeCheck, readBody } from './lib/shape.mjs';
import { ART_HEAD, headAgreesWithArt, pickModelFront, swappedFor } from './lib/orient.mjs';
import { BUDGETS, makeCopies } from './lib/optimize.mjs';
import { measureCharacter, measureProduct, openBrowser, renderHtml, startDevServer } from './lib/browser.mjs';
import { GATE_LIMITS, evaluateGate, rerollWorth } from './lib/gate.mjs';
import { gateSheetHtml, personSheetHtml, photoAuditHtml, productSheetHtml } from './lib/review.mjs';
import { CHARACTER_BYTE_CAP, PEOPLE, PERSON_LICENCE, characterPaths, drawPicture, makeBody, mergeClips, optimiseCharacter, rawPersonFiles } from './lib/people.mjs';
import { optimizeGlb } from '../optimize-models.mjs';

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const command = args._[0] ?? 'help';
const flag = (k) => args[k] === true || args[k] === 'true';
const list = (k) => (typeof args[k] === 'string' ? args[k].split(',').map((s) => s.trim()).filter(Boolean) : null);
const today = () => new Date().toISOString().slice(0, 10);
const log = (...m) => console.log(...m);

const RUN_NAME = typeof args.run === 'string' ? args.run : `${today()}-${command}`;
const RUN_DIR = runDir(RUN_NAME);
const RAW_RUN_DIR = path.join(RAW_DIR, 'runs', RUN_NAME);
const DRY = flag('dry-run');
const YES = flag('yes');
const CAP = Number(args.cap ?? 10);
const GPU = args.gpu === 'd3d11' ? 'd3d11' : 'swiftshader';

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }
const dataUrlBuffer = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
async function saveEvidence(dir, name, dataUrl, { webp = true, quality = 82 } = {}) {
  if (!dataUrl) return null;
  ensureDir(dir);
  const file = path.join(dir, `${name}.${webp ? 'webp' : 'png'}`);
  const buf = dataUrlBuffer(dataUrl);
  if (webp) await sharp(buf).webp({ quality, alphaQuality: 90 }).toFile(file);
  else fs.writeFileSync(file, buf);
  return path.relative(ROOT, file).split(path.sep).join('/');
}
const toDataUrl = (file, mime) => (file && fs.existsSync(file) ? `data:${mime ?? (file.endsWith('.png') ? 'image/png' : 'image/webp')};base64,${fs.readFileSync(file).toString('base64')}` : null);
const strip = (measure) => (measure ? { ...measure, plan: measure.plan ? { width: measure.plan.width, height: measure.plan.height, coverage: measure.plan.coverage } : null, catalogue: undefined, front: undefined, eye: undefined } : null);

// ---------------------------------------------------------------- shared pieces
let server = null;
let browserHandle = null;
let measureQueue = Promise.resolve();
async function browser({ needServer = true } = {}) {
  if (!browserHandle) {
    if (needServer && !server) server = await startDevServer({ log, port: Number(args.port ?? 5178) });
    browserHandle = await openBrowser(server ? server.base : null, { gpu: GPU });
  }
  return browserHandle;
}
/** One measurement at a time on the one page (the renderer is shared). */
function serialMeasure(fn) {
  const next = measureQueue.then(fn, fn);
  measureQueue = next.catch(() => {});
  return next;
}
async function shutdown() {
  try { await browserHandle?.close(); } catch { /* closing */ }
  server?.stop();
}

/** The facing check: the art law where art exists; a flat product's photo face; else the photo side, for the eye. */
function facingFor({ id, body, up, dims, frontEdge, entry }) {
  const pitched = pitchedExtents(body.extents, up);
  if (catalogueIsFlat(dims)) {
    const ok = up === '+z' || up === '-z' || pitched[1] <= pitched[0] * 0.25;
    return { pass: ok, kind: 'flat', detail: ok ? `flat product lies down (modelUp ${up}); the plan picture shows the top face` : 'flat product still stands upright' };
  }
  const head = headDirection(body, up);
  const swapped = swappedFor({ ex: pitched[0], ez: pitched[2], lengthCm: dims.length, widthCm: dims.width, lengthAxis: entry.lengthAxis ?? 'auto' });
  const art = ART_HEAD[id];
  if (art) {
    const check = headAgreesWithArt({ head, art, modelFront: entry.modelFront ?? '+z', swapped, frontEdge });
    if (check.weak) return { pass: true, kind: 'art-weak', detail: `art law: no clear head (|head| ${Math.hypot(head.x, head.z).toFixed(2)} < 0.15), symmetric body; confirm on the sheet`, head, swapped };
    return { pass: check.agrees, kind: 'art', detail: `art law: head lands ${check.agrees ? 'on' : 'OFF'} the art's ${art} side (score ${check.score.toFixed(2)}) with modelFront ${entry.modelFront ?? '+z'}${swapped ? ', axes swapped' : ''}`, head, swapped };
  }
  return { pass: true, kind: 'photo-side', assumed: true, detail: `no plan art for this product: the front is the photo side (tool default modelFront ${entry.modelFront ?? '+z'}); the eye confirms it on the sheet`, head, swapped };
}

/** For a product with art, pick the modelFront that lands the head on the art side (the September law). */
function orientNewBody({ id, body, up, dims, frontEdge, defaultFront = '+z' }) {
  const art = ART_HEAD[id];
  if (!art) return { modelFront: defaultFront, why: 'photo side (tool default)' };
  const pitched = pitchedExtents(body.extents, up);
  const head = headDirection(body, up);
  const swapped = swappedFor({ ex: pitched[0], ez: pitched[2], lengthCm: dims.length, widthCm: dims.width });
  const pick = pickModelFront({ head, art, swapped, frontEdge });
  if (pick.weak) return { modelFront: defaultFront, why: `art ${art}: weak head signal, default kept`, head, swapped };
  return { modelFront: pick.front, why: `art ${art}: head (${head.x.toFixed(2)}, ${head.z.toFixed(2)}) → modelFront ${pick.front}`, head, swapped };
}

function findProduct(rows, id) {
  return rows.find((r) => r.id === id) ?? null;
}

function manifestEntryFor({ model, servedUrl, phoneUrl, source }) {
  return { url: servedUrl, phoneUrl, modelFront: model.modelFront ?? '+z', lengthAxis: 'auto', ...(model.modelUp && model.modelUp !== '+y' ? { modelUp: model.modelUp } : {}), source };
}

/** The spend so far in this run and in the log, for the cap and the summary. */
let spentThisRun = 0;
function chargeOrStop(price, label) {
  if (spentThisRun + price > CAP + 1e-9) throw new Error(`cap ${money(CAP)} would be passed by ${label} (${money(price)}; spent ${money(spentThisRun)}). Stop and ask.`);
  spentThisRun += price;
}

// ---------------------------------------------------------------- audit
async function cmdAudit() {
  const cat = loadCatalogue();
  const rows = args.input ? loadInputRows(args.input) : cat.all;
  const audits = await auditAll(rows);
  ensureDir(RUN_DIR);
  writeJson(path.join(RUN_DIR, 'photo-audit.json'), { at: new Date().toISOString(), rows: rows.length, audits: audits.map((a) => ({ ...a, thumb: undefined })) });
  const b = await browser({ needServer: false });
  await renderHtml(b, photoAuditHtml({ title: `Photo audit, ${today()}`, subtitle: `${rows.length} catalogue rows (${cat.products.length} products.json + ${cat.courts.length} Courts${args.input ? ` + ${args.input}` : ''}). usable = a real photo the generator can use; wrong = a photo of something else; missing = no photo on the row; vector = a drawing.`, audits }), path.join(RUN_DIR, 'photo-audit.png'), { width: 1500 });
  const counts = {};
  for (const a of audits) counts[a.status] = (counts[a.status] ?? 0) + 1;
  log(`photo audit: ${JSON.stringify(counts)} → ${path.relative(ROOT, RUN_DIR)}/photo-audit.png`);
  for (const a of audits) log(`  ${a.status.padEnd(12)} ${a.id.padEnd(34)} ${a.why}`);
  return audits;
}

// ---------------------------------------------------------------- gate ($0, the bodies that exist)
async function cmdGate() {
  const cat = loadCatalogue();
  const manifest = readManifest();
  const only = list('only');
  const ids = Object.keys(manifest).filter((id) => !only || only.includes(id));
  const audits = Object.fromEntries((await auditAll(cat.all.filter((r) => ids.includes(r.id)))).map((a) => [a.id, a]));
  const b = await browser();
  const results = [];
  const madePhone = [];
  for (const id of ids) {
    const entry = manifest[id];
    const product = findProduct(cat.all, id);
    if (!product) { results.push({ id, error: 'not in the catalogue' }); continue; }
    const servedPath = path.join(PUBLIC_DIR, entry.url.replace(/^\//, ''));
    if (!fs.existsSync(servedPath)) { results.push({ id, error: `served body missing: ${entry.url}` }); continue; }
    log(`→ ${id}`);
    const body = await readBody(servedPath);
    const up = entry.modelUp ?? '+y';
    const shape = rawShapeCheck(pitchedExtents(body.extents, up), product.dimensions_cm);
    let phoneUrl = entry.phoneUrl ?? null;
    if ((!phoneUrl && flag('make-phone')) || flag('remake-phone')) {
      const phonePath = path.join(MODELS_DIR, `${id}-phone.glb`);
      const r = await optimizeGlb(servedPath, phonePath, { target: BUDGETS.phone.target, base: BUDGETS.phone.base, mr: BUDGETS.phone.mr, error: BUDGETS.phone.error });
      phoneUrl = `/models/${id}-phone.glb`;
      madePhone.push({ id, phoneUrl, bytes: fs.statSync(phonePath).size, triangles: Math.round(r.triangles) });
      manifest[id] = { ...entry, phoneUrl };
    }
    const copies = {
      served: { bytes: fs.statSync(servedPath).size, triangles: body.triangles },
      phone: phoneUrl && fs.existsSync(path.join(PUBLIC_DIR, phoneUrl.replace(/^\//, ''))) ? { bytes: fs.statSync(path.join(PUBLIC_DIR, phoneUrl.replace(/^\//, ''))).size, triangles: (await readBody(path.join(PUBLIC_DIR, phoneUrl.replace(/^\//, '')))).triangles } : null,
    };
    const facing = facingFor({ id, body, up, dims: product.dimensions_cm, frontEdge: product.front_edge, entry });
    const measure = await serialMeasure(() => measureProduct(b.page, { product: { id, dimensions_cm: product.dimensions_cm, front_edge: product.front_edge }, model: entry, servedUrl: entry.url, phoneUrl }));
    const gate = evaluateGate({ photo: audits[id], shape, measure, copies, facing });
    const evDir = path.join(RUN_DIR, 'evidence', id);
    const evidence = {
      front: await saveEvidence(evDir, 'old-front', measure.front),
      catalogue: await saveEvidence(evDir, 'old-catalogue', measure.catalogue),
      plan: await saveEvidence(evDir, 'old-plan', measure.plan?.png),
      eye: await saveEvidence(evDir, 'old-eye', measure.eye),
    };
    results.push({ id, entry, served: { bytes: copies.served.bytes, triangles: body.triangles, textures: body.textures }, phone: copies.phone, shape, facing, measure: strip(measure), gate, evidence });
    log(`   ${gate.pass ? 'PASS' : 'FAIL'}${gate.pass ? '' : `: ${gate.failed.join(' · ')}`}`);
  }
  if (madePhone.length) { writeManifest(manifest); log(`phone copies made for ${madePhone.length} bodies, manifest updated`); }
  ensureDir(RUN_DIR);
  writeJson(path.join(RUN_DIR, 'gate.json'), { at: new Date().toISOString(), main: gitHead(), results, madePhone });
  const rowsForSheet = results.filter((r) => !r.error).map((r) => ({
    label: r.id, note: `${findProduct(cat.all, r.id)?.name ?? ''}\n${findProduct(cat.all, r.id)?.dimensions_cm.length}×${findProduct(cat.all, r.id)?.dimensions_cm.width}×${findProduct(cat.all, r.id)?.dimensions_cm.height} cm`,
    front: toDataUrl(path.join(ROOT, r.evidence.front ?? '')), catalogue: toDataUrl(path.join(ROOT, r.evidence.catalogue ?? '')), plan: toDataUrl(path.join(ROOT, r.evidence.plan ?? '')),
    numbers: [['served', `${Math.round(r.served.bytes / 1024)} KB · ${r.served.triangles.toLocaleString()} tris`], ['phone', r.phone ? `${Math.round(r.phone.bytes / 1024)} KB · ${r.phone.triangles.toLocaleString()} tris` : 'none'], ['facing', r.facing.kind]],
    gate: r.gate,
  }));
  await renderHtml(b, gateSheetHtml({ title: `Gate on the bodies that exist, ${today()}`, subtitle: `${results.length} bodies on main ${gitHead().slice(0, 7)}; $0 spent. Each row: the served body as the stage fits it (front, three-quarter, plan picture) and every gate check.`, rows: rowsForSheet }), path.join(RUN_DIR, 'gate-sheet.png'), { width: 1500 });
  writeSummary(path.join(RUN_DIR, 'SUMMARY.md'), `# Gate on the existing bodies, ${today()}\n\n$0 spent. main ${gitHead()}.\n\n| product | gate | failed checks | served | phone | facing |\n|---|---|---|---|---|---|\n${results.map((r) => (r.error ? `| ${r.id} | error | ${r.error} | | | |` : `| ${r.id} | ${r.gate.pass ? 'PASS' : 'FAIL'} | ${r.gate.failed.join(', ')} | ${Math.round(r.served.bytes / 1024)} KB · ${r.served.triangles} tris | ${r.phone ? `${Math.round(r.phone.bytes / 1024)} KB · ${r.phone.triangles} tris` : 'none'} | ${r.facing.kind}: ${r.facing.detail} |`)).join('\n')}\n`);
  const passed = results.filter((r) => r.gate?.pass).length;
  log(`gate: ${passed}/${results.length} pass → ${path.relative(ROOT, RUN_DIR)}/gate-sheet.png`);
  return results;
}

function gitHead() {
  try { return fs.readFileSync(path.join(ROOT, '.git', fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim().replace(/^ref: /, '')), 'utf8').trim(); } catch { return 'unknown'; }
}
function writeSummary(file, text) { ensureDir(path.dirname(file)); fs.writeFileSync(file, text); }

// ---------------------------------------------------------------- run (the engine)
async function cmdRun() {
  const toolKeys = args.tool === 'all' ? TOOL_KEYS : list('tool') ?? [];
  if (!toolKeys.length || toolKeys.some((k) => !TOOLS[k])) throw new Error(`--tool one of ${TOOL_KEYS.join(', ')} or all`);
  const cat = loadCatalogue();
  const manifest = readManifest();
  const inputRows = args.input ? loadInputRows(args.input) : [];
  const pool = [...cat.all, ...inputRows];
  const only = list('only');
  let rows = only ? only.map((id) => findProduct(pool, id) ?? (() => { throw new Error(`unknown product ${id}`); })()) : pool.filter((r) => !manifest[r.id] || flag('remake'));
  const audits = Object.fromEntries((await auditAll(rows)).map((a) => [a.id, a]));
  const skipped = rows.filter((r) => audits[r.id].status !== 'usable' || !r.dimensions_cm);
  rows = rows.filter((r) => audits[r.id].status === 'usable' && r.dimensions_cm);
  const adopt = flag('adopt');
  const parallel = Math.max(1, Number(args.parallel ?? 3));

  // A row with extra views (a listing's front and side shots) goes to a tool's multiview endpoint when it has one.
  const plans = Object.fromEntries(rows.map((row) => [row.id, multiviewPlan(viewsOf(row), photoUrlOf(row.photo))]));
  const jobs = [];
  for (const row of rows) for (const key of toolKeys) jobs.push({ row, tool: TOOLS[key], multiview: Boolean(TOOLS[key].multiview && plans[row.id].use) });
  const bill = jobs.reduce((s, j) => s + j.tool.price, 0);
  log(`\nproduct engine · prices read on fal.ai ${PRICES_READ_ON} · run ${RUN_NAME}${adopt ? ' · ADOPT (writes the catalogue)' : ' · candidates'}`);
  for (const key of toolKeys) log(`  ${TOOLS[key].label.padEnd(44)} ${money(TOOLS[key].price)} each  (${TOOLS[key].endpoint}${TOOLS[key].multiview ? `; with views ${TOOLS[key].multiview.endpoint}, the same price` : ''})`);
  log(`\n${jobs.length} generation(s) for ${rows.length} product(s):`);
  for (const row of rows) log(`  ${row.id.padEnd(34)} ${`${row.dimensions_cm.length}×${row.dimensions_cm.width}×${row.dimensions_cm.height} cm`.padEnd(20)} photo ${audits[row.id].width}×${audits[row.id].height} ${audits[row.id].format}  → ${toolKeys.map((k) => money(TOOLS[k].price)).join(' + ')}${plans[row.id].use ? `  · ${plans[row.id].why}` : plans[row.id].skipped?.length ? `  · ${plans[row.id].why}` : ''}`);
  if (skipped.length) { log(`\nskipped (listed for Victor):`); for (const r of skipped) log(`  ${r.id.padEnd(34)} ${audits[r.id].status}: ${audits[r.id].why || r.dimsProblem || ''}`); }
  log(`\nBILL ${money(bill)} (cap ${money(CAP)}, re-rolls come out of the cap)`);
  if (DRY) { log('--dry-run: nothing sent, nothing spent.'); return { bill, jobs: jobs.length, skipped }; }
  if (!YES) { console.error("\n⛔ Refusing to spend without --yes (Victor's own word for this run). Run with --dry-run to see the bill."); process.exit(3); }
  if (bill > CAP) throw new Error(`the bill ${money(bill)} is above the cap ${money(CAP)}; raise --cap only on Victor's word`);
  fal.readKey();

  ensureDir(RUN_DIR);
  ensureDir(RAW_RUN_DIR);
  const b = await browser();
  const results = [];
  let stop = null;

  async function one(job) {
    const { row, tool } = job;
    const dims = row.dimensions_cm;
    const rawDir = ensureDir(path.join(RAW_RUN_DIR, tool.key));
    const photoUrl = await publicPhotoUrl(photoUrlOf(row.photo));
    if (!photoUrl) return { id: row.id, tool: tool.key, error: 'the photo could not be given a public URL' };
    // Several views → the multiview endpoint (the same price); a view that cannot be given a URL drops the job back to the one photo.
    const plan = plans[row.id];
    let views = null;
    let viewUrls = null;
    if (job.multiview) {
      viewUrls = await multiviewUrls(plan);
      if (viewUrls.every(Boolean)) views = plan.names;
      else log(`   ! ${row.id}/${tool.key}: a view has no public URL (${plan.names.filter((_, i) => !viewUrls[i]).join(', ')}); the one photo is used`);
    }
    const endpoint = views ? tool.multiview.endpoint : tool.endpoint;
    const result = { id: row.id, tool: tool.key, endpoint, price: 0, attempts: [], views };
    let bodyFile = null;
    let prep = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      chargeOrStop(tool.price, `${row.id} via ${tool.key}`);
      log(`→ ${row.id} via ${tool.label}${views ? ` with ${views.length} views (${views.join(' + ')})` : ''} (attempt ${attempt})`);
      const t0 = Date.now();
      const seed = attempt === 1 ? undefined : Math.floor(Math.random() * 1e9);
      const input = views ? tool.multiview.input(viewUrls, seed) : tool.input(photoUrl, seed);
      let t;
      try {
        t = await fal.run(endpoint, input, { label: `${row.id} ${tool.key} a${attempt}${views ? ` views ${views.join('+')}` : ''}`, onStatus: (s, q) => log(`   … ${row.id}/${tool.key} ${s}${q !== null ? ` (queue ${q})` : ''}`) });
      } catch (e) {
        spentThisRun -= tool.price;
        const seconds = Math.round((Date.now() - t0) / 1000);
        fal.logSpend({ id: row.id, tool: tool.key, endpoint, views, price_usd: 0, seconds, ok: false, error: String(e).slice(0, 400), attempt });
        result.attempts.push({ attempt, ok: false, error: String(e).slice(0, 400), seconds });
        if (fal.isBalanceError(e)) { stop = 'Fal refused on balance: Victor tops up on his Fal login, then the run resumes'; }
        return { ...result, error: `fal: ${String(e).slice(0, 300)}` };
      }
      const url = tool.glbUrl(t.out);
      if (!url) {
        fal.logSpend({ id: row.id, tool: tool.key, endpoint, views, price_usd: tool.price, seconds: t.seconds, request_id: t.request_id, ok: false, error: 'no glb in the answer', keys: Object.keys(t.out ?? {}), attempt });
        return { ...result, price: result.price + tool.price, error: `no glb in the answer (keys ${Object.keys(t.out ?? {}).join(', ')})` };
      }
      const bytes = await fal.download(url);
      const downloaded = path.join(rawDir, `${row.id}.a${attempt}.download.glb`);
      fs.writeFileSync(downloaded, bytes);
      result.price += tool.price;
      bodyFile = path.join(rawDir, `${row.id}.a${attempt}.glb`);
      prep = await prepareBody(downloaded, bodyFile, dims);
      const { raw, shape, up, detected, squared, level } = prep;
      fal.logSpend({ id: row.id, tool: tool.key, endpoint, views, price_usd: tool.price, seconds: t.seconds, metrics: t.metrics, bytes: bytes.length, raw_triangles: raw.triangles, request_id: t.request_id, ok: true, attempt, shape_pass: shape.pass });
      result.attempts.push({ attempt, ok: true, request_id: t.request_id, seconds: t.seconds, inference_s: t.metrics?.inference_time ?? null, rawBytes: bytes.length, rawTriangles: raw.triangles, rawExtents: raw.extents, up, photoFace: prep.face, bakeYaw: detected.bakeYaw, squaredDeg: squared?.degrees ?? 0, level, shape });
      log(`   ✓ ${row.id}/${tool.key} ${(bytes.length / 1048576).toFixed(1)} MB, ${raw.triangles.toLocaleString()} tris in ${t.seconds}s · shape ${shape.pass ? 'ok' : `WRONG (aspect ${(shape.aspectError * 100).toFixed(0)} %, height ${(shape.heightError * 100).toFixed(0)} %)`} · up ${up}${detected.bakeYaw ? ' (quarter turn baked)' : ''}${squared ? ` · turned ${squared.degrees.toFixed(1)}° to square the footprint` : ''}${level?.corrected ? ` · levelled ${level.corrected.pitchDeg.toFixed(1)}° / ${level.corrected.rollDeg.toFixed(1)}°` : ''}   (spent ${money(spentThisRun)})`);
      if (shape.pass) break;
      if (attempt === 2) log(`   ✗ ${row.id}/${tool.key}: wrong shape twice; listed for Victor, no body`);
      else if (!rerollWorth(shape)) { log(`   ✗ ${row.id}/${tool.key}: wrong shape by more than ${Math.round((GATE_LIMITS.rawShapeTolerance + 0.05) * 100)} %: a new seed does not close such a gap (no re-roll); listed for Victor${views ? '' : ', a side photo of it would'}`); break; }
      else if (spentThisRun + tool.price > CAP) { log(`   ✗ ${row.id}/${tool.key}: wrong shape and no room under the cap for a re-roll`); break; }
      else log(`   ↻ ${row.id}/${tool.key}: wrong shape, a near miss, one re-roll`);
    }
    if (!prep) return { ...result, error: 'no body' };
    return finishBody({ row, tool, bodyFile, prep, result, audit: audits[row.id], adopt, b, photoUrl });
  }

  // A small pool: `parallel` requests in flight; Fal's queue is the wall-time cost.
  const queue = [...jobs];
  async function worker() {
    while (queue.length && !stop) {
      const job = queue.shift();
      try { results.push(await one(job)); } catch (e) { results.push({ id: job.row.id, tool: job.tool.key, error: String(e).slice(0, 400) }); if (/cap .* would be passed/.test(String(e))) stop = String(e); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker));
  if (stop) log(`\n⛔ stopped: ${stop}`);

  // The old bodies, measured the same way, for the side-by-side.
  const olds = {};
  for (const row of rows) {
    const entry = manifest[row.id];
    if (!entry) continue;
    const servedPath = path.join(PUBLIC_DIR, entry.url.replace(/^\//, ''));
    if (!fs.existsSync(servedPath)) continue;
    const oldBody = await readBody(servedPath);
    const oldUp = entry.modelUp ?? '+y';
    const measure = await serialMeasure(() => measureProduct(b.page, { product: { id: row.id, dimensions_cm: row.dimensions_cm, front_edge: row.front_edge }, model: entry, servedUrl: entry.url, phoneUrl: entry.phoneUrl ?? null }));
    const evDir = path.join(RUN_DIR, 'evidence', row.id);
    olds[row.id] = {
      entry, bytes: fs.statSync(servedPath).size, triangles: oldBody.triangles, measure: strip(measure),
      gate: evaluateGate({ photo: audits[row.id], shape: rawShapeCheck(pitchedExtents(oldBody.extents, oldUp), row.dimensions_cm), measure, copies: { served: { bytes: fs.statSync(servedPath).size, triangles: oldBody.triangles }, phone: entry.phoneUrl && fs.existsSync(path.join(PUBLIC_DIR, entry.phoneUrl.replace(/^\//, ''))) ? { bytes: fs.statSync(path.join(PUBLIC_DIR, entry.phoneUrl.replace(/^\//, ''))).size, triangles: (await readBody(path.join(PUBLIC_DIR, entry.phoneUrl.replace(/^\//, '')))).triangles } : null }, facing: facingFor({ id: row.id, body: oldBody, up: oldUp, dims: row.dimensions_cm, frontEdge: row.front_edge, entry }), level: oldUp === '+y' ? baseTilt(oldBody) : undefined }),
      evidence: { front: await saveEvidence(evDir, 'old-front', measure.front), catalogue: await saveEvidence(evDir, 'old-catalogue', measure.catalogue), eye: await saveEvidence(evDir, 'old-eye', measure.eye), plan: await saveEvidence(evDir, 'old-plan', measure.plan?.png) },
    };
  }

  // Records: run.json, the candidates manifest (or the catalogue itself), the sheets, the summary.
  const runRecord = { run: RUN_NAME, at: new Date().toISOString(), main: gitHead(), mode: adopt ? 'adopt' : 'candidates', prices_read_on: PRICES_READ_ON, cap_usd: CAP, bill_usd: bill, spent_usd: spentThisRun, tools: toolKeys, skipped: skipped.map((r) => ({ id: r.id, status: audits[r.id].status, why: audits[r.id].why || r.dimsProblem })), results, olds, stop };
  await writeRunOutputs({ runRecord, rows, audits, cat, manifest, adopt, b });
  log(`\nrun ${RUN_NAME}: ${money(spentThisRun)} spent of ${money(CAP)} · ${results.filter((r) => r.gate?.pass).length}/${results.length} gate passes → ${path.relative(ROOT, RUN_DIR)}/`);
  return runRecord;
}

/**
 * From a raw download to a body ready to fit, $0: which way is up (a flat product's photo face),
 * a squared footprint (a generator that aligns the body to a three-quarter photo hands it back
 * turned; the smallest box around the footprint finds the turn, which is baked in), a level base
 * (a body handed back tilted is levelled by the plane through its lowest vertices), and the raw
 * shape check. `photoFront` is the axis the photo side faces after that turn.
 */
async function prepareBody(downloaded, bodyFile, dims) {
  let raw = await readBody(downloaded);
  let face = { sign: -1, why: 'not flat' };
  if (catalogueIsFlat(dims)) face = await photoFaceSign(raw);
  const detected = detectUp(raw.extents, dims, face.sign);
  const up = detected.up;
  let squared = null;
  let level = null;
  if (detected.bakeYaw) await bakeYaw(downloaded, bodyFile);
  else if (!catalogueIsFlat(dims)) {
    const yaw = footprintYaw(raw);
    const yawRad = Math.abs(yaw.degrees) >= 2 ? yaw.yaw : 0;
    if (yawRad) squared = yaw;
    // The base plane, measured after the yaw; a tilt past 1° is baked out with it.
    const tilt = baseTilt(yawRad ? await rotatedView(raw, yawRad) : raw);
    const tilted = Math.abs(tilt.pitchDeg) > 1 || Math.abs(tilt.rollDeg) > 1;
    if (yawRad || tilted) await bakeTransform(downloaded, bodyFile, { yawRad, ...(tilted ? levelCorrection(tilt) : {}) });
    else fs.copyFileSync(downloaded, bodyFile);
    if (yawRad || tilted) raw = await readBody(bodyFile);
    level = { ...baseTilt(raw), ...(tilted ? { corrected: { pitchDeg: tilt.pitchDeg, rollDeg: tilt.rollDeg } } : {}) };
  } else fs.copyFileSync(downloaded, bodyFile);
  if (detected.bakeYaw) raw = await readBody(bodyFile);
  const shape = rawShapeCheck(pitchedExtents(raw.extents, up), dims);
  return { raw, face, detected, up, squared, level, shape, photoFront: frontAfterYaw(squared?.yaw ?? 0) };
}

/** The body's vertices as they would sit after a yaw about y, for a measurement before anything is written. */
async function rotatedView(body, yawRad) {
  const c = Math.cos(yawRad);
  const s = Math.sin(yawRad);
  // world matrices are column-major 4×4; a yaw about y on the left: R · M.
  const rot = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) for (let k = 0; k < 4; k++) o[col * 4 + r] += a[k * 4 + r] * b[col * 4 + k]; return o; };
  return { ...body, prims: body.prims.map((p) => ({ ...p, world: mul(rot, p.world) })) };
}

/** Everything after the body exists: facing, the two copies, the measurement in the browser, the gate, the evidence, the manifest row. */
async function finishBody({ row, tool, bodyFile, prep, result, audit, adopt, b, photoUrl }) {
  const dims = row.dimensions_cm;
  const { raw: body, up, detected: bake, squared, shape, level } = prep;
  const rawDir = path.dirname(bodyFile);
  const orient = orientNewBody({ id: row.id, body, up, dims, frontEdge: row.front_edge, defaultFront: prep.photoFront ?? '+z' });
  const model = { modelFront: orient.modelFront, modelUp: up === '+y' ? undefined : up, lengthAxis: 'auto' };
  const outDir = adopt ? MODELS_DIR : ensureDir(path.join(CANDIDATES_DIR, tool.key));
  const servedPath = path.join(outDir, `${row.id}.glb`);
  const phonePath = path.join(outDir, `${row.id}-phone.glb`);
  const servedUrl = `/${path.relative(PUBLIC_DIR, servedPath).split(path.sep).join('/')}`;
  const phoneUrl = `/${path.relative(PUBLIC_DIR, phonePath).split(path.sep).join('/')}`;
  const copies = await makeCopies(bodyFile, servedPath, phonePath);
  const servedBody = await readBody(servedPath);
  const facing = facingFor({ id: row.id, body: servedBody, up, dims, frontEdge: row.front_edge, entry: model });
  const measure = await serialMeasure(() => measureProduct(b.page, { product: { id: row.id, dimensions_cm: dims, front_edge: row.front_edge }, model, servedUrl, phoneUrl }));
  const gate = evaluateGate({ photo: audit, shape, measure, copies: { served: copies.served, phone: copies.phone }, facing, level: level ?? undefined });
  const evDir = path.join(RUN_DIR, 'evidence', row.id);
  const evidence = {
    front: await saveEvidence(evDir, `${tool.key}-front`, measure.front),
    catalogue: await saveEvidence(evDir, `${tool.key}-catalogue`, measure.catalogue),
    eye: await saveEvidence(evDir, `${tool.key}-eye`, measure.eye),
    plan: await saveEvidence(evDir, `${tool.key}-plan`, measure.plan?.png),
  };
  // Full-size plan and catalogue pictures stay out of docs (raw area) until adopt copies them in.
  const picDir = ensureDir(path.join(rawDir, 'pictures'));
  if (measure.plan?.png) fs.writeFileSync(path.join(picDir, `${row.id}-plan.png`), dataUrlBuffer(measure.plan.png));
  if (measure.catalogue) fs.writeFileSync(path.join(picDir, `${row.id}-catalogue.png`), dataUrlBuffer(measure.catalogue));
  const last = result.attempts[result.attempts.length - 1] ?? {};
  const entry = manifestEntryFor({ model, servedUrl, phoneUrl, source: {
    engine: 'scripts/product-engine', run: RUN_NAME, tool: tool.key, endpoint: result.endpoint ?? tool.endpoint, ...(result.views ? { views: result.views, view_photos: viewsOf(row) } : {}), price_usd: result.price, seconds: last.seconds, inference_s: last.inference_s, request_id: last.request_id,
    photo: photoUrl ? (photoUrl.startsWith('data:') ? row.photo : photoUrl) : row.photo, generated_at: result.generated_at ?? new Date().toISOString(), reprocessed_at: result.reprocessed_at, raw_bytes: last.rawBytes, raw_triangles: last.rawTriangles, bytes: copies.served.bytes, triangles: copies.served.triangles,
    phone_bytes: copies.phone.bytes, phone_triangles: copies.phone.triangles, orient: { ...orient, head: orient.head ? { x: +orient.head.x.toFixed(3), z: +orient.head.z.toFixed(3) } : undefined, up, bakeYaw: bake?.bakeYaw ?? false, squaredDeg: squared?.degrees ?? 0, level: level ? { pitchDeg: +level.pitchDeg.toFixed(2), rollDeg: +level.rollDeg.toFixed(2), corrected: level.corrected ?? undefined } : undefined, upWhy: bake?.why }, gate: { pass: gate.pass, failed: gate.failed },
  } });
  log(`   ${gate.pass ? 'GATE PASS' : `GATE FAIL: ${gate.failed.join(' · ')}`} · served ${Math.round(copies.served.bytes / 1024)} KB/${copies.served.triangles} tris · phone ${Math.round(copies.phone.bytes / 1024)} KB/${copies.phone.triangles} tris · plan ${(measure.plan?.coverage.x * 100).toFixed(0)}×${(measure.plan?.coverage.y * 100).toFixed(0)} %`);
  return { ...result, servedUrl, phoneUrl, copies, model, orient: { ...orient, head: undefined }, up, bake, squared, level, shape, facing: { ...facing, head: undefined }, measure: strip(measure), gate, evidence, entry, pictures: { plan: path.relative(ROOT, path.join(picDir, `${row.id}-plan.png`)), catalogue: path.relative(ROOT, path.join(picDir, `${row.id}-catalogue.png`)) } };
}

/** run.json, the candidates manifest (or the catalogue), one sheet per product, SUMMARY.md. */
async function writeRunOutputs({ runRecord, rows, audits, cat, manifest, adopt, b }) {
  const { results, olds } = runRecord;
  writeJson(path.join(RUN_DIR, 'run.json'), runRecord);
  if (adopt) adoptResults(results.filter((r) => r.gate?.pass), { cat, manifest });
  else {
    const candFile = path.join(ROOT, 'src', 'data', 'productModelCandidates.json');
    const cand = readJson(candFile, {});
    for (const r of results) if (r.entry) { cand[r.tool] = cand[r.tool] ?? {}; cand[r.tool][r.id] = r.entry; }
    writeJson(candFile, cand);
  }
  for (const row of rows) {
    const sheetRows = [];
    const old = olds?.[row.id];
    if (old) sheetRows.push({ label: 'today (September body)', note: `${old.entry.source?.model ?? ''}\n${Math.round(old.bytes / 1024)} KB · ${old.triangles.toLocaleString()} tris`, photo: audits[row.id].thumb, front: toDataUrl(path.join(ROOT, old.evidence.front ?? '')), catalogue: toDataUrl(path.join(ROOT, old.evidence.catalogue ?? '')), eye: toDataUrl(path.join(ROOT, old.evidence.eye ?? '')), plan: toDataUrl(path.join(ROOT, old.evidence.plan ?? '')), gate: old.gate });
    for (const r of results.filter((x) => x.id === row.id)) {
      const last = r.attempts?.[r.attempts.length - 1];
      sheetRows.push({ label: `${TOOLS[r.tool].label}${r.views ? ` · ${r.views.length} views (${r.views.join(' + ')})` : ''}`, note: r.error ? `ERROR: ${r.error}` : `${money(r.price)} · ${last?.seconds ?? '?'} s (model ${last?.inference_s ? `${Math.round(last.inference_s)} s` : '?'})${r.attempts?.length > 1 ? ` · ${r.attempts.length} tries` : ''}\nraw ${last ? `${(last.rawBytes / 1048576).toFixed(1)} MB · ${last.rawTriangles.toLocaleString()} tris` : ''}\nserved ${r.copies ? `${Math.round(r.copies.served.bytes / 1024)} KB · ${r.copies.served.triangles.toLocaleString()} tris` : ''}\nphone ${r.copies ? `${Math.round(r.copies.phone.bytes / 1024)} KB · ${r.copies.phone.triangles.toLocaleString()} tris` : ''}\n${r.squared ? `turned ${r.squared.degrees.toFixed(1)}° to square the footprint\n` : ''}${r.level?.corrected ? `levelled from ${r.level.corrected.pitchDeg.toFixed(1)}° / ${r.level.corrected.rollDeg.toFixed(1)}°\n` : ''}${r.orient?.why ?? ''}`, photo: audits[row.id].thumb, front: toDataUrl(path.join(ROOT, r.evidence?.front ?? '')), catalogue: toDataUrl(path.join(ROOT, r.evidence?.catalogue ?? '')), eye: toDataUrl(path.join(ROOT, r.evidence?.eye ?? '')), plan: toDataUrl(path.join(ROOT, r.evidence?.plan ?? '')), gate: r.gate });
    }
    await renderHtml(b, productSheetHtml({ title: `${row.name} (${row.id})`, subtitle: `run ${RUN_NAME} · every row is the same product fitted to its catalogue size by the app's own code; the eye-level picture is an engine render at the Walk camera height`, product: row, rows: sheetRows }), path.join(RUN_DIR, `sheet-${row.id}.png`), { width: 1700 });
  }
  writeSummary(path.join(RUN_DIR, 'SUMMARY.md'), summaryMarkdown(runRecord, rows));
}

// ---------------------------------------------------------------- reprocess ($0: the raw downloads, through the engine again)
async function cmdReprocess() {
  const toolKeys = args.tool === 'all' || !args.tool ? TOOL_KEYS : list('tool');
  const runFile = path.join(RUN_DIR, 'run.json');
  if (!fs.existsSync(runFile)) throw new Error(`no run.json in ${path.relative(ROOT, RUN_DIR)}`);
  const run = readJson(runFile);
  const cat = loadCatalogue();
  const manifest = readManifest();
  const pool = [...cat.all, ...(args.input ? loadInputRows(args.input) : [])];
  const only = list('only');
  const picked = run.results.filter((r) => toolKeys.includes(r.tool) && (!only || only.includes(r.id)));
  if (!picked.length) throw new Error('nothing to reprocess: no result for those ids and tools in this run');
  const rows = [...new Set(picked.map((r) => r.id))].map((id) => findProduct(pool, id) ?? (() => { throw new Error(`unknown product ${id}`); })());
  const audits = Object.fromEntries((await auditAll(rows)).map((a) => [a.id, a]));
  log(`\nreprocess · run ${RUN_NAME} · ${picked.length} result(s) · $0 (no Fal call; the raw downloads go through the engine again)`);
  const b = await browser();
  const done = [];
  for (const old of picked) {
    const row = findProduct(rows, old.id);
    const tool = TOOLS[old.tool];
    const rawDir = path.join(RAW_RUN_DIR, tool.key);
    const okAttempts = (old.attempts ?? []).filter((a) => a.ok);
    const attemptNo = args.attempt ? Number(args.attempt) : okAttempts.length ? okAttempts[okAttempts.length - 1].attempt : null;
    const downloaded = attemptNo ? path.join(rawDir, `${row.id}.a${attemptNo}.download.glb`) : null;
    if (!downloaded || !fs.existsSync(downloaded)) { log(`✗ ${old.id}/${old.tool}: no raw download to reprocess (${old.error ?? 'no successful attempt'})`); continue; }
    log(`→ ${old.id} via ${tool.label}: attempt ${attemptNo} from ${path.relative(ROOT, downloaded)}`);
    const bodyFile = path.join(rawDir, `${row.id}.a${attemptNo}.glb`);
    const prep = await prepareBody(downloaded, bodyFile, row.dimensions_cm);
    log(`   shape ${prep.shape.pass ? 'ok' : `WRONG (aspect ${(prep.shape.aspectError * 100).toFixed(0)} %, height ${(prep.shape.heightError * 100).toFixed(0)} %)`} · up ${prep.up}${prep.detected.bakeYaw ? ' (quarter turn baked)' : ''}${prep.squared ? ` · turned ${prep.squared.degrees.toFixed(1)}° to square the footprint` : ''}`);
    const result = {
      id: row.id, tool: tool.key, endpoint: old.endpoint ?? tool.endpoint, views: old.views ?? null, price: old.price ?? 0, generated_at: old.entry?.source?.generated_at, reprocessed_at: new Date().toISOString(), reprocessed_attempt: attemptNo,
      attempts: (old.attempts ?? []).map((a) => (a.attempt === attemptNo ? { ...a, up: prep.up, bakeYaw: prep.detected.bakeYaw, squaredDeg: prep.squared?.degrees ?? 0, level: prep.level, shape: prep.shape, rawExtents: prep.raw.extents } : a)),
    };
    const fresh = await finishBody({ row, tool, bodyFile, prep, result, audit: audits[row.id], adopt: false, b, photoUrl: old.entry?.source?.photo ?? null });
    const i = run.results.findIndex((r) => r.id === old.id && r.tool === old.tool);
    run.results[i] = fresh;
    done.push(fresh);
  }
  run.reprocessed = [...(run.reprocessed ?? []), { at: new Date().toISOString(), main: gitHead(), results: done.map((r) => `${r.id}/${r.tool}`) }];
  await writeRunOutputs({ runRecord: run, rows, audits, cat, manifest, adopt: false, b });
  log(`\nreprocess ${RUN_NAME}: ${done.length} result(s) redone, $0 · ${run.results.filter((r) => r.gate?.pass).length}/${run.results.length} gate passes → ${path.relative(ROOT, RUN_DIR)}/`);
}

function summaryMarkdown(run, rows) {
  const lines = [`# Product engine run ${run.run}`, '', `${run.mode} · ${run.at} · main ${run.main} · prices read ${run.prices_read_on} · bill ${money(run.bill_usd)} · spent ${money(run.spent_usd)} of cap ${money(run.cap_usd)}${run.stop ? ` · STOPPED: ${run.stop}` : ''}`, ''];
  lines.push('| product | body | price | seconds (model) | raw | laptop copy | phone copy | envelope worst err | plan footprint | facing | gate |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const old = run.olds[row.id];
    if (old) lines.push(`| ${row.id} | today | | | | ${Math.round(old.bytes / 1024)} KB · ${old.triangles} | ${old.entry.phoneUrl ? 'yes' : 'none'} | ${old.measure?.envelope ? Math.max(...Object.values(old.measure.envelope.errCm)).toFixed(2) : '?'} cm | ${old.measure?.plan ? `${(old.measure.plan.coverage.x * 100).toFixed(0)}×${(old.measure.plan.coverage.y * 100).toFixed(0)} %` : '?'} | ${old.gate.checks.find((c) => c.name === 'facing')?.detail ?? ''} | ${old.gate.pass ? 'PASS' : `FAIL: ${old.gate.failed.join(', ')}`} |`);
    for (const r of run.results.filter((x) => x.id === row.id)) {
      if (r.error) { lines.push(`| ${row.id} | ${r.tool} | ${money(r.price ?? 0)} | | | | | | | | ERROR: ${r.error} |`); continue; }
      const last = r.attempts[r.attempts.length - 1];
      lines.push(`| ${row.id} | ${r.tool}${r.attempts.length > 1 ? ` (${r.attempts.length} attempts)` : ''} | ${money(r.price)} | ${last.seconds} (${last.inference_s ? Math.round(last.inference_s) : '?'}) | ${(last.rawBytes / 1048576).toFixed(1)} MB · ${last.rawTriangles} | ${Math.round(r.copies.served.bytes / 1024)} KB · ${r.copies.served.triangles} | ${Math.round(r.copies.phone.bytes / 1024)} KB · ${r.copies.phone.triangles} | ${r.measure?.envelope ? Math.max(...Object.values(r.measure.envelope.errCm)).toFixed(2) : '?'} cm | ${r.measure?.plan ? `${(r.measure.plan.coverage.x * 100).toFixed(0)}×${(r.measure.plan.coverage.y * 100).toFixed(0)} %` : '?'} | ${r.facing.kind}: ${r.facing.detail} | ${r.gate.pass ? 'PASS' : `FAIL: ${r.gate.failed.join(', ')}`} |`);
    }
  }
  if (run.skipped.length) { lines.push('', '## Skipped (listed for Victor)', ''); for (const s of run.skipped) lines.push(`- ${s.id}: ${s.status}, ${s.why}`); }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- adopt (promote candidates into the catalogue)
function adoptResults(results, { cat, manifest }) {
  const thumbs = readThumbs();
  const adopted = [];
  for (const r of results) {
    const row = findProduct(cat.all, r.id);
    if (!row) continue;
    const servedFinal = path.join(MODELS_DIR, `${r.id}.glb`);
    const phoneFinal = path.join(MODELS_DIR, `${r.id}-phone.glb`);
    const servedSrc = path.join(PUBLIC_DIR, r.servedUrl.replace(/^\//, ''));
    const phoneSrc = path.join(PUBLIC_DIR, r.phoneUrl.replace(/^\//, ''));
    if (path.resolve(servedSrc) !== path.resolve(servedFinal)) { fs.copyFileSync(servedSrc, servedFinal); fs.copyFileSync(phoneSrc, phoneFinal); }
    const entry = { ...r.entry, url: `/models/${r.id}.glb`, phoneUrl: `/models/${r.id}-phone.glb` };
    if (row.sku) entry.source = { ...entry.source, sku: row.sku };
    manifest[r.id] = entry;
    // The plan picture, from the body: WebP with alpha, the exact L × W frame.
    const planPng = path.join(ROOT, r.pictures.plan);
    if (fs.existsSync(planPng)) {
      ensureDir(TOPDOWN_DIR);
      const planOut = path.join(TOPDOWN_DIR, `${r.id}.webp`);
      sharp.cache(false);
      const buf = fs.readFileSync(planPng);
      // sync-ish: write via a deferred promise collected below
      adopted.push({ id: r.id, planPng: buf, planOut, row });
    } else adopted.push({ id: r.id, planPng: null, planOut: null, row });
    // The catalogue picture, hash-named like the October bake, the previous file of this product removed.
    const catPng = path.join(ROOT, r.pictures.catalogue);
    if (fs.existsSync(catPng)) {
      const glb = fs.readFileSync(servedFinal);
      const hash = createHash('sha256').update(glb).update(JSON.stringify({ dimensions: row.dimensions_cm, front: row.front_edge, model: entry, rig: 'engine-v2' })).digest('hex').slice(0, 16);
      ensureDir(CATALOG_MODELS_DIR);
      for (const f of fs.readdirSync(CATALOG_MODELS_DIR)) if (f.startsWith(`${r.id}-`) && f.endsWith('.png') && f !== `${r.id}-${hash}.png`) fs.unlinkSync(path.join(CATALOG_MODELS_DIR, f));
      const url = `/products/catalog-models/${r.id}-${hash}.png`;
      fs.copyFileSync(catPng, path.join(PUBLIC_DIR, url.replace(/^\//, '')));
      thumbs[r.id] = { url, sku: row.sku, hash, modelUrl: entry.url, width: 512, height: 512, rigVersion: 2 };
    }
  }
  writeManifest(manifest);
  writeThumbs(thumbs);
  // Plan pictures (async writes), then the catalogue rows.
  return Promise.all(adopted.map(async (a) => {
    if (!a.planPng) return;
    await sharp(a.planPng).webp({ quality: 88, alphaQuality: 95, effort: 5 }).toFile(a.planOut);
    const url = `/products/topdown/${a.id}.webp`;
    for (const file of [PRODUCTS_JSON, COURTS_JSON]) {
      const data = readJson(file, null);
      if (!data) continue;
      const rows = Array.isArray(data) ? data : data.products;
      const target = rows.find((x) => x.id === a.id);
      if (target) { target.topdown_image_url = url; writeJson(file, data); }
    }
  })).then(() => { log(`adopted ${results.length} bod${results.length === 1 ? 'y' : 'ies'} into the catalogue`); removeCandidates(results.map((r) => r.id)); });
}

function removeCandidates(ids) {
  const candFile = path.join(ROOT, 'src', 'data', 'productModelCandidates.json');
  const cand = readJson(candFile, {});
  for (const tool of Object.keys(cand)) {
    for (const id of ids) {
      if (!cand[tool][id]) continue;
      for (const f of [`${id}.glb`, `${id}-phone.glb`]) { const p = path.join(CANDIDATES_DIR, tool, f); if (fs.existsSync(p)) fs.unlinkSync(p); }
      delete cand[tool][id];
    }
    if (!Object.keys(cand[tool]).length) delete cand[tool];
    const dir = path.join(CANDIDATES_DIR, tool);
    if (fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
  writeJson(candFile, cand);
  if (fs.existsSync(CANDIDATES_DIR) && !fs.readdirSync(CANDIDATES_DIR).length) fs.rmdirSync(CANDIDATES_DIR);
}

async function cmdAdopt() {
  const toolKey = args.tool;
  if (!TOOLS[toolKey]) throw new Error(`--tool one of ${TOOL_KEYS.join(', ')}`);
  const run = readJson(path.join(RUN_DIR, 'run.json'));
  const only = list('only');
  const picked = run.results.filter((r) => r.tool === toolKey && r.entry && (!only || only.includes(r.id)) && (r.gate?.pass || flag('force')));
  if (!picked.length) throw new Error('nothing to adopt: no gate-passing result for that tool in this run (use --force to adopt a failed one on Victor\'s word)');
  const cat = loadCatalogue();
  await adoptResults(picked, { cat, manifest: readManifest() });
  log(`adopted: ${picked.map((r) => r.id).join(', ')} (${toolKey})`);
}

// ---------------------------------------------------------------- people
async function cmdPeople() {
  const only = list('only');
  const people = PEOPLE.filter((p) => !only || only.includes(p.id));
  // --from-raw: a person whose paid files are on disk is finished again at $0 (after a fix downstream of Fal).
  const fromRaw = flag('from-raw');
  const reuse = Object.fromEntries(people.map((p) => [p.id, fromRaw ? rawPersonFiles(p) : null]));
  const bill = people.filter((p) => !reuse[p.id]).length * (PICTURE_TOOL.price + PERSON_TOOL.price);
  log(`\npeople · prices read on fal.ai ${PRICES_READ_ON} · run ${RUN_NAME}${fromRaw ? ' · from raw files where they exist ($0)' : ''}`);
  log(`  picture: ${PICTURE_TOOL.label} ${money(PICTURE_TOOL.price)}`);
  log(`  body:    ${PERSON_TOOL.label} ${money(PERSON_TOOL.price)}`);
  for (const p of people) log(`  ${p.label.padEnd(8)} ${p.heightM} m  ${p.look}${reuse[p.id] ? '  (raw files on disk: $0)' : ''}`);
  log(`\nBILL ${money(bill)} (cap ${money(CAP)})`);
  if (DRY) { log('--dry-run: nothing sent, nothing spent.'); return { bill }; }
  if (bill > 0 && !YES) { console.error("\n⛔ Refusing to spend without --yes (Victor's own word). Run with --dry-run to see the bill."); process.exit(3); }
  if (bill > CAP) throw new Error(`the bill ${money(bill)} is above the cap ${money(CAP)}`);
  if (bill > 0) fal.readKey();
  ensureDir(RUN_DIR);
  const b = await browser();
  const generated = readJson(CHARACTERS_JSON, []);
  // The run's earlier people record, if any: a from-raw finish carries the paid call's ids and spend over.
  const previous = readJson(path.join(RUN_DIR, 'people.json'), null);
  const sheet = [];
  const records = [];
  for (const person of people) {
    const rec = { id: person.id, label: person.label, heightM: person.heightM };
    try {
      let picture;
      let made;
      if (reuse[person.id]) {
        const raw = reuse[person.id];
        const meta = await sharp(raw.picture).metadata();
        // The paid run's record (request ids, prompt, seed, seconds) is carried over; only the finishing is new.
        const paid = previous?.people?.find((r) => r.id === person.id) ?? null;
        const paidPicture = { ...(paid?.picture ?? {}) };
        delete paidPicture.file;
        const paidBody = { ...(paid?.body ?? {}) };
        delete paidBody.files;
        picture = { ...paidPicture, file: raw.picture, bytes: fs.statSync(raw.picture).size, width: meta.width, height: meta.height, reused: true };
        made = { ...paidBody, files: raw.files, rawBytes: Object.values(raw.files).reduce((n, f) => n + fs.statSync(f).size, 0), reused: true };
        log(`→ ${person.label}: raw files on disk, finishing at $0${paid ? ` (paid ${money(PICTURE_TOOL.price + PERSON_TOOL.price)} in this run on ${previous.at})` : ''}`);
        rec.reused = true;
        rec.paid_at = paid ? previous.at : null;
      } else {
        chargeOrStop(PICTURE_TOOL.price, `${person.id} picture`);
        picture = await drawPicture(person, { log });
        chargeOrStop(PERSON_TOOL.price, `${person.id} body`);
        made = await makeBody(person, picture.url, { log });
      }
      rec.picture = { ...picture, file: path.relative(ROOT, picture.file) };
      rec.body = { ...made, files: Object.fromEntries(Object.entries(made.files).map(([k, v]) => [k, path.relative(ROOT, v)])) };
      const merged = path.join(path.dirname(made.files.rigged), `${person.id}-merged.glb`);
      rec.clips = await mergeClips(made.files.rigged, [{ name: 'idle', file: made.files.idle }, { name: 'walk', file: made.files.walk }, { name: 'run', file: made.files.run }], merged);
      const paths = characterPaths(person);
      rec.served = await optimiseCharacter(merged, paths.glb);
      const measure = await serialMeasure(() => measureCharacter(b.page, { url: paths.url, clips: { idle: 'idle', walk: 'walk', run: 'run' }, heightM: 1.7 }));
      rec.measure = { bindHeightM: measure.bindHeightM, footprint: measure.footprint, stats: measure.stats, clips: measure.clips, errors: measure.errors };
      if (measure.thumbnail) { fs.writeFileSync(paths.png, dataUrlBuffer(measure.thumbnail)); ensureDir(WALK_THUMBS_DIR); fs.writeFileSync(path.join(WALK_THUMBS_DIR, `${person.id}.png`), dataUrlBuffer(measure.thumbnail)); }
      const evDir = path.join(RUN_DIR, 'people');
      rec.evidence = {
        picture: await (async () => { ensureDir(evDir); const f = path.join(evDir, `${person.id}-picture.webp`); await sharp(picture.file).resize(384, 512, { fit: 'inside' }).webp({ quality: 80 }).toFile(f); return path.relative(ROOT, f).split(path.sep).join('/'); })(),
        full: await saveEvidence(evDir, `${person.id}-full`, measure.full),
        walk: await saveEvidence(evDir, `${person.id}-walk`, measure.frames?.walk),
        run: await saveEvidence(evDir, `${person.id}-run`, measure.frames?.run),
        idle: await saveEvidence(evDir, `${person.id}-idle`, measure.frames?.idle),
        thumbnail: await saveEvidence(evDir, `${person.id}-thumb`, measure.thumbnailLarge),
      };
      const checks = [
        { name: 'under the 1.5 MB character cap', pass: rec.served.bytes < CHARACTER_BYTE_CAP, detail: `${(rec.served.bytes / 1024).toFixed(0)} KB` },
        { name: 'three clips idle / walk / run', pass: ['idle', 'walk', 'run'].every((n) => measure.clips.some((c) => c.name === n)), detail: measure.clips.map((c) => `${c.name} ${c.duration.toFixed(2)} s`).join(', ') },
        { name: 'rigged (a skin)', pass: rec.served.skins >= 1, detail: `${rec.served.skins} skin(s)` },
        { name: 'textures load', pass: measure.stats.texturesTotal > 0 && measure.stats.texturesLoaded === measure.stats.texturesTotal, detail: `${measure.stats.texturesLoaded}/${measure.stats.texturesTotal}` },
        { name: 'no load or clip errors', pass: !measure.errors.length, detail: measure.errors.join('; ') || 'none' },
        { name: 'height sane', pass: measure.bindHeightM > 0.5 && measure.bindHeightM < 3, detail: `bind pose ${measure.bindHeightM.toFixed(2)} m, scaled to 1.70 m in Walk` },
      ];
      rec.gate = { pass: checks.every((c) => c.pass), checks, failed: checks.filter((c) => !c.pass).map((c) => c.name) };
      const entry = { id: person.id, label: person.label, url: paths.url, thumbnailUrl: paths.thumbnailUrl, thumbnailDataUrl: measure.thumbnail ?? '', clips: { idle: 'idle', walk: 'walk', run: 'run' }, heightM: measure.bindHeightM, bytes: rec.served.bytes, licence: PERSON_LICENCE, source: `docs/product-engine/runs/${RUN_NAME}/people.json`, realHeightM: person.heightM };
      const i = generated.findIndex((g) => g.id === person.id);
      if (i >= 0) generated[i] = entry; else generated.push(entry);
      rec.entry = entry;
      sheet.push({ label: person.label, note: `${person.look}\n${money(PICTURE_TOOL.price + PERSON_TOOL.price)}${rec.reused ? ' (paid in the earlier run; finished again at $0)' : ` · picture ${picture.seconds} s · body ${made.seconds} s`}`, numbers: [['served', `${(rec.served.bytes / 1024).toFixed(0)} KB · ${rec.served.triangles.toLocaleString()} tris`], ['bind height', `${measure.bindHeightM.toFixed(2)} m`], ['clips', measure.clips.map((c) => c.name).join(', ')]], picture: toDataUrl(path.join(ROOT, rec.evidence.picture)), full: toDataUrl(path.join(ROOT, rec.evidence.full ?? '')), frames: { walk: toDataUrl(path.join(ROOT, rec.evidence.walk ?? '')), run: toDataUrl(path.join(ROOT, rec.evidence.run ?? '')) }, thumbnail: toDataUrl(path.join(ROOT, rec.evidence.thumbnail ?? '')), gate: rec.gate });
      log(`   ${rec.gate.pass ? 'GATE PASS' : `GATE FAIL: ${rec.gate.failed.join(' · ')}`} · ${(rec.served.bytes / 1024).toFixed(0)} KB · ${rec.served.triangles.toLocaleString()} tris · clips ${measure.clips.map((c) => c.name).join('/')}`);
    } catch (e) {
      rec.error = String(e).slice(0, 500);
      log(`   ✗ ${person.label}: ${rec.error}`);
      if (fal.isBalanceError(e)) { log('⛔ Fal refused on balance; stopping. Victor tops up on his Fal login.'); records.push(rec); break; }
    }
    records.push(rec);
  }
  writeJson(CHARACTERS_JSON, generated);
  // The run's record is cumulative: people finished earlier in this run stay, the spend adds up.
  const spentInRun = (previous?.spent_usd ?? 0) + spentThisRun;
  const kept = (previous?.people ?? []).filter((r) => !records.some((n) => n.id === r.id));
  writeJson(path.join(RUN_DIR, 'people.json'), { run: RUN_NAME, at: new Date().toISOString(), spent_usd: spentInRun, spent_this_time_usd: spentThisRun, cap_usd: CAP, people: [...kept, ...records].map((r) => ({ ...r, entry: r.entry ? { ...r.entry, thumbnailDataUrl: undefined } : undefined })) });
  if (sheet.length) await renderHtml(b, personSheetHtml({ title: `People for Walk mode, ${today()}`, subtitle: `run ${RUN_NAME} · ${money(spentInRun)} spent in this run (${money(spentThisRun)} this time) · made-up people drawn from words, then rigged and animated; shown at 1.70 m as Walk mode scales them` , people: sheet }), path.join(RUN_DIR, 'people-sheet.png'), { width: 1700 });
  log(`\npeople: ${money(spentThisRun)} spent this time (${money(spentInRun)} in the run) of ${money(CAP)} → ${path.relative(ROOT, RUN_DIR)}/people-sheet.png`);
}

// ---------------------------------------------------------------- resume an interrupted fal request
async function cmdResume() {
  const id = args.request;
  if (!id) throw new Error('--request <request_id> from models-raw/fal-journal.jsonl');
  const r = await fal.resume(id);
  const out = path.join(RAW_DIR, 'resumed', `${id}.json`);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, JSON.stringify(r, null, 2));
  log(`resumed ${id}: keys ${Object.keys(r.out ?? {}).join(', ')} → ${path.relative(ROOT, out)}`);
}

// ---------------------------------------------------------------- views ($0: a listing's front and side shots onto the row)
/**
 * A listing's extra shots of a product, cleaned (dimension arrows and callouts painted out, cropped
 * to the product, squared, 1024 px WebP) into `public/products/photos/views/<id>-<view>.webp`, and
 * named on the row as `photo_views` (with the source URLs in `photo_views_source`). From then on a
 * Tripo run of that product uses the multiview endpoint, the same price. A before/after sheet lands
 * in the run folder so the eye can check that only arrows and text went.
 */
async function cmdViews() {
  const only = list('only');
  if (!only || only.length !== 1) throw new Error('--only <one product id>');
  const id = only[0];
  const cat = loadCatalogue();
  const row = findProduct(cat.all, id);
  if (!row) throw new Error(`unknown product ${id}`);
  const given = VIEW_ORDER.filter((v) => typeof args[v] === 'string');
  if (!given.length) throw new Error(`give at least one of --${VIEW_ORDER.join(' --')} <url|file>`);
  ensureDir(RUN_DIR);
  const prev = viewsOf(row);
  const prevSource = row.raw?.photo_views_source ?? {};
  const views = { ...prev };
  const source = { ...prevSource, page: typeof args.page === 'string' ? args.page : prevSource.page, at: new Date().toISOString(), cleaned: !flag('no-clean') };
  const tiles = [];
  for (const view of given) {
    const where = args[view];
    const bytes = /^https?:/i.test(where) ? await fal.download(where) : fs.readFileSync(path.resolve(where));
    const { file, url } = viewFile(id, view);
    ensureDir(path.dirname(file));
    let note;
    if (flag('no-clean')) {
      await sharp(bytes).rotate().flatten({ background: '#ffffff' }).resize(1024, 1024, { fit: 'contain', background: '#ffffff' }).webp({ quality: 90 }).toFile(file);
      note = 'as given (no cleaning)';
    } else {
      const r = await cleanProductShot(bytes);
      fs.writeFileSync(file, r.buffer);
      note = `${r.source.width}×${r.source.height} → product ${r.product.width}×${r.product.height} px; ${r.patches - 1} other patch(es) painted out (${r.paintedPixels.toLocaleString()} px, ${((1 - r.keptFraction) * 100).toFixed(1)} % of the ink)`;
    }
    views[view] = url;
    source[view] = where.startsWith('/') || /^[a-zA-Z]:/.test(where) ? path.basename(where) : where;
    log(`→ ${id} ${view}: ${note} → ${path.relative(ROOT, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
    tiles.push({ view, before: await sharp(bytes).rotate().flatten({ background: '#ffffff' }).resize(420, 420, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), after: await sharp(file).resize(420, 420, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), note });
  }
  const sheet = path.join(RUN_DIR, `views-${id}.png`);
  const comps = tiles.flatMap((t, i) => [{ input: t.before, left: 0, top: i * 420 }, { input: t.after, left: 420, top: i * 420 }]);
  await sharp({ create: { width: 840, height: 420 * tiles.length, channels: 3, background: '#ffffff' } }).composite(comps).png().toFile(sheet);
  const ok = setRowFields(id, { photo_views: views, photo_views_source: source }, row.source === 'courts' ? COURTS_JSON : PRODUCTS_JSON);
  if (!ok) throw new Error(`the row ${id} was not found in its file`);
  const plan = multiviewPlan(views, photoUrlOf(row.photo));
  log(`\n${id}: views on the row: ${Object.keys(views).join(', ')} · Tripo would use ${plan.use ? plan.why : `one photo (${plan.why})`} · before/after ${path.relative(ROOT, sheet)}`);
  return { id, views, plan };
}

// ---------------------------------------------------------------- main
function help() {
  log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 18).join('\n'));
}

try {
  if (command === 'audit') await cmdAudit();
  else if (command === 'gate') await cmdGate();
  else if (command === 'run') await cmdRun();
  else if (command === 'views') await cmdViews();
  else if (command === 'reprocess') await cmdReprocess();
  else if (command === 'adopt') await cmdAdopt();
  else if (command === 'people') await cmdPeople();
  else if (command === 'resume') await cmdResume();
  else help();
} catch (e) {
  console.error(`\n✗ ${e?.stack ?? e}`);
  process.exitCode = 1;
} finally {
  await shutdown();
  if (fs.existsSync(SPEND_LOG) && command !== 'help') {
    const rows = fal.readSpendLog();
    const total = rows.reduce((s, r) => s + (r.price_usd ?? 0), 0);
    log(`spend log ${path.relative(ROOT, SPEND_LOG)}: ${rows.length} call(s), ${money(total)} in all`);
  }
}
