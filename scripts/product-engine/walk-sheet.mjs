#!/usr/bin/env node
/**
 * walk-sheet — one side-by-side per product for Victor: today's body / Tripo / Meshy / Hunyuan, each
 * seen in Walk mode first person on a laptop (1280×800) and a phone (390×844), plus the plan picture
 * and the catalogue picture made from that body, with the price, size, triangles and the gate under
 * each column. $0: it only reads a run's records (run.json + walk-shots-<label>.json) and draws.
 *
 *   node scripts/product-engine/walk-shots.mjs --only <ids> [--bodies tripo|meshy|hunyuan] --run <run>   (first)
 *   node scripts/product-engine/walk-sheet.mjs --run test-2026-11-08 --only k1-nordictrack-2450,emcar-jinko-475
 *
 * Writes docs/product-engine/runs/<run>/walk-sheet-<id>.png.
 *
 * `--person <id>` draws one sheet for a new Walk-mode person instead: the drawn picture, the body and its
 * clips (from people.json), and the walker standing, walking, running and in first person on the laptop
 * and the phone (from `walk-shots --character <id> --moving --label person-<id>`) → walk-sheet-person-<id>.png.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { loadCatalogue } from './lib/catalog.mjs';
import { openBrowser, renderHtml } from './lib/browser.mjs';
import { ROOT, runDir } from './lib/paths.mjs';
import { PEOPLE } from './lib/people.mjs';
import { PERSON_TOOL, PICTURE_TOOL, TOOLS } from './lib/prices.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RUN_NAME = opt('--run', null);
if (!RUN_NAME) { console.error('--run <name>'); process.exit(2); }
const RUN_DIR = runDir(RUN_NAME);
const only = (opt('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const run = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'run.json'), 'utf8'));
const cat = loadCatalogue();
const ids = only.length ? only : [...new Set(run.results.map((r) => r.id))];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : '');
const kb = (b) => (typeof b === 'number' ? `${Math.round(b / 1024)} KB` : '');
const tris = (t) => (typeof t === 'number' ? `${t.toLocaleString()} tris` : '');

/** A picture file → a data URL, resized to what the sheet shows (the sheet is a PNG screenshot itself). */
async function pic(rel, width) {
  if (!rel) return null;
  const file = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!fs.existsSync(file)) return null;
  const buf = await sharp(file).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

/** The walk captures of one label, keyed by id → device → shots. */
function walkShots(label) {
  const file = path.join(RUN_DIR, `walk-shots-${label}.json`);
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const r of JSON.parse(fs.readFileSync(file, 'utf8')).results) {
    out[r.id] = out[r.id] ?? {};
    out[r.id][r.device] = r;
  }
  return out;
}
const shotsByLabel = { catalogue: walkShots('catalogue'), tripo: walkShots('tripo'), meshy: walkShots('meshy'), hunyuan: walkShots('hunyuan') };

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f6f4ef; color: #1d2430; font: 15px/1.4 "Segoe UI", Inter, Arial, sans-serif; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  .sub { color: #5a6270; margin: 0 0 18px; }
  .sheet { display: grid; grid-template-columns: 150px repeat(4, 1fr); gap: 12px; align-items: start; }
  .head { background: #fff; border: 1px solid #ddd8cc; border-radius: 10px; padding: 12px; min-height: 150px; }
  .head b.name { font-size: 17px; display: block; margin-bottom: 4px; }
  .head .nums { font-size: 13px; color: #3a4350; white-space: pre-wrap; }
  .pass { color: #176b3a; font-weight: 700; }
  .fail { color: #a8231b; font-weight: 700; }
  .head ul { margin: 4px 0 0; padding-left: 16px; font-size: 12px; color: #a8231b; }
  .rowlabel { font-weight: 600; padding-top: 6px; color: #3a4350; }
  .rowlabel small { display: block; color: #5a6270; font-weight: 400; margin-top: 4px; }
  .pic { background: repeating-conic-gradient(#e9e6df 0 25%, #f8f7f3 0 50%) 0 0 / 20px 20px; border: 1px solid #ddd8cc; border-radius: 8px; overflow: hidden; display: grid; place-items: center; }
  .pic.laptop { aspect-ratio: 16 / 10; }
  .pic.phone { aspect-ratio: 390 / 844; width: 46%; margin: 0 auto; }
  .pic.square { aspect-ratio: 1; }
  .pic img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .pic span { color: #9aa; font-size: 13px; padding: 8px; text-align: center; }
  .missing { color: #a8231b; font-size: 12px; }
`;

function cell(dataUrl, kind, why) {
  return `<div class="pic ${kind}">${dataUrl ? `<img src="${dataUrl}" alt="">` : `<span>${esc(why ?? 'no capture')}</span>`}</div>`;
}

// --person <id>: one sheet for a new Walk-mode person.
const personId = opt('--person', null);
if (personId) {
  const peopleFile = path.join(RUN_DIR, 'people.json');
  const rec = (fs.existsSync(peopleFile) ? JSON.parse(fs.readFileSync(peopleFile, 'utf8')).people : []).find((p) => p.id === personId);
  if (!rec) { console.error(`no ${personId} in ${path.relative(ROOT, peopleFile)}`); process.exit(2); }
  const person = PEOPLE.find((p) => p.id === personId) ?? { label: rec.label, heightM: rec.heightM, look: '' };
  const shotsFile = path.join(RUN_DIR, `walk-shots-person-${personId}.json`);
  const byDevice = {};
  if (fs.existsSync(shotsFile)) for (const r of JSON.parse(fs.readFileSync(shotsFile, 'utf8')).results) byDevice[r.device] = r;
  const g = rec.gate ?? null;
  const nums = rec.error
    ? `ERROR: ${rec.error}`
    : `${money(PICTURE_TOOL.price + PERSON_TOOL.price)}${rec.reused ? ' (paid earlier in the run; finished again at $0)' : ''}\nserved ${kb(rec.served?.bytes)} · ${tris(rec.served?.triangles)} · ${rec.served?.skins ?? '?'} skin(s)\nbind height ${rec.measure?.bindHeightM?.toFixed(2) ?? '?'} m, shown at 1.70 m\nclips ${(rec.measure?.clips ?? []).map((c) => `${c.name} ${c.duration.toFixed(1)} s`).join(', ')}`;
  const head = `<div class="head"><b class="name">${esc(person.label)} · ${esc(person.heightM)} m</b><div class="nums">${esc(person.look)}</div><div class="nums" style="margin-top:6px">${esc(nums)}</div>${g ? `<div class="${g.pass ? 'pass' : 'fail'}">${g.pass ? 'GATE PASS' : 'GATE FAIL'}</div>${g.failed?.length ? `<ul>${g.failed.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}` : ''}</div>`;
  const stills = [
    ['the drawn picture (made-up person)', await pic(rec.evidence?.picture, 420)],
    ['the 3D body, idle', await pic(rec.evidence?.full, 420)],
    ['walk clip', await pic(rec.evidence?.walk, 420)],
    ['run clip', await pic(rec.evidence?.run, 420)],
  ];
  const rows = [['Standing', 'third person, Walk mode', 'third'], ['Walking', 'W held', 'walking'], ['Running', 'Shift + W', 'running'], ['First person', 'V', 'first']];
  const cells = [];
  for (const [title, sub, key] of rows) {
    cells.push(`<div class="rowlabel">${esc(title)}<small>${esc(sub)}</small></div>`);
    for (const device of ['laptop', 'phone']) {
      const r = byDevice[device];
      cells.push(cell(await pic(r?.shots?.[key], device === 'laptop' ? 760 : 400), device, r?.error ? `Walk capture failed: ${r.error.slice(0, 120)}` : 'no Walk capture'));
    }
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(personId)}</title><style>${CSS}
    .person { display: grid; grid-template-columns: 150px 1fr 1fr; gap: 12px; align-items: start; }
    .stills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0 18px; }
    .stills .cap { font-size: 12px; color: #5a6270; text-align: center; margin-top: 4px; }
    .pic.portrait { aspect-ratio: 3 / 4; }
  </style></head><body>
    <h1>${esc(person.label)} <span style="color:#5a6270;font-weight:400">(a made-up person for Walk mode)</span></h1>
    <p class="sub">run ${esc(RUN_NAME)} · drawn from words, never from a photo of anyone · rigged and animated by Meshy, merged into one body with idle / walk / run · seen in Walk mode on a laptop 1280×800 and a phone 390×844</p>
    ${head}
    <div class="stills">${stills.map(([cap, url]) => `<div>${cell(url, 'portrait', 'no picture')}<div class="cap">${esc(cap)}</div></div>`).join('')}</div>
    <div class="person"><div></div><div class="rowlabel">Laptop<small>1280 × 800</small></div><div class="rowlabel">Phone<small>390 × 844</small></div>${cells.join('')}</div>
  </body></html>`;
  const b = await openBrowser(null, { gpu: 'swiftshader' });
  try {
    const out = path.join(RUN_DIR, `walk-sheet-person-${personId}.png`);
    await renderHtml(b, html, out, { width: 1300 });
    console.log(`→ ${path.relative(ROOT, out)}`);
  } finally {
    await b.close();
  }
  process.exit(0);
}

for (const id of ids) {
  const product = cat.all.find((r) => r.id === id);
  const old = run.olds?.[id] ?? null;
  const columns = [];
  // Column 1: today's body (the September one), if the product has one.
  columns.push({
    key: 'catalogue', title: 'Today (September body)',
    nums: old ? `${old.entry?.source?.model ?? old.entry?.source?.tool ?? 'Hunyuan3D 2.1'}\nserved ${kb(old.bytes)} · ${tris(old.triangles)}` : 'no body today: a measured box in its own photo',
    gate: old?.gate ?? null,
    plan: old?.evidence?.plan ?? null, catalogue: old?.evidence?.catalogue ?? null,
  });
  for (const key of ['tripo', 'meshy', 'hunyuan']) {
    const r = run.results.find((x) => x.id === id && x.tool === key);
    const last = r?.attempts?.[r.attempts.length - 1];
    columns.push({
      key, title: TOOLS[key].label,
      nums: r ? (r.error ? `ERROR: ${r.error}` : `${money(r.price)} · ${last?.seconds ?? '?'} s${r.attempts.length > 1 ? ` · ${r.attempts.length} tries` : ''}\nserved ${kb(r.copies?.served?.bytes)} · ${tris(r.copies?.served?.triangles)}\nphone ${kb(r.copies?.phone?.bytes)} · ${tris(r.copies?.phone?.triangles)}\nraw ${last ? `${(last.rawBytes / 1048576).toFixed(1)} MB · ${tris(last.rawTriangles)}` : ''}`) : 'not run',
      gate: r?.gate ?? null,
      plan: r?.evidence?.plan ?? null, catalogue: r?.evidence?.catalogue ?? null,
    });
  }
  const heads = [];
  const laptop = [];
  const phone = [];
  const plans = [];
  const cats = [];
  for (const c of columns) {
    const g = c.gate;
    heads.push(`<div class="head"><b class="name">${esc(c.title)}</b><div class="nums">${esc(c.nums)}</div>${g ? `<div class="${g.pass ? 'pass' : 'fail'}">${g.pass ? 'GATE PASS' : 'GATE FAIL'}</div>${g.failed?.length ? `<ul>${g.failed.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}` : ''}</div>`);
    const shots = shotsByLabel[c.key]?.[id] ?? {};
    const lap = shots.laptop;
    const ph = shots.phone;
    laptop.push(cell(await pic(lap?.shots?.first, 760), 'laptop', lap?.error ? `Walk capture failed: ${lap.error.slice(0, 120)}` : 'no Walk capture'));
    phone.push(cell(await pic(ph?.shots?.first, 400), 'phone', ph?.error ? `Walk capture failed: ${ph.error.slice(0, 120)}` : 'no Walk capture'));
    plans.push(cell(await pic(c.plan, 420), 'square', c.key === 'catalogue' && !old ? 'no body today' : 'no plan picture'));
    cats.push(cell(await pic(c.catalogue, 420), 'square', c.key === 'catalogue' && !old ? 'no body today' : 'no catalogue picture'));
  }
  const dims = product ? `${product.dimensions_cm.length} × ${product.dimensions_cm.width} × ${product.dimensions_cm.height} cm, front edge ${product.front_edge}` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(id)}</title><style>${CSS}</style></head><body>
    <h1>${esc(product?.name ?? id)} <span style="color:#5a6270;font-weight:400">(${esc(id)})</span></h1>
    <p class="sub">run ${esc(RUN_NAME)} · ${esc(dims)} · every body fitted to that size by the app's own code · Walk mode first person, 2.2 m in front, laptop 1280×800 and phone 390×844 · plan and catalogue pictures made from each body</p>
    <div class="sheet">
      <div></div>${heads.join('')}
      <div class="rowlabel">Walk mode<small>first person, laptop</small></div>${laptop.join('')}
      <div class="rowlabel">Walk mode<small>first person, phone</small></div>${phone.join('')}
      <div class="rowlabel">Plan picture<small>top down, from the body</small></div>${plans.join('')}
      <div class="rowlabel">Catalogue picture<small>three-quarter, studio light</small></div>${cats.join('')}
    </div></body></html>`;
  const b = await openBrowser(null, { gpu: 'swiftshader' });
  try {
    const out = path.join(RUN_DIR, `walk-sheet-${id}.png`);
    await renderHtml(b, html, out, { width: 1700 });
    console.log(`→ ${path.relative(ROOT, out)}`);
  } finally {
    await b.close();
  }
}
