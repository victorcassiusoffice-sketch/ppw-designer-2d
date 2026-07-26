/**
 * topdown-runway-batch — cheap validation batch for the Runway Dev top-down
 * pipeline (WD-2D rebuild 2026-07-10).
 *
 * Runs the REAL pipeline end-to-end on a SMALL set of K1 products that have
 * a real product photo + real dimensions:
 *   photo → Runway gen4_image (image-conditioned) → download → imgly bg-remove
 *   → sharp trim → footprint-exact transparent PNG.
 *
 * Emits, per product, three files into a review folder so Vic can eyeball:
 *   <id>__1-source.<ext>   the merchant's real photo (the reference)
 *   <id>__2-runway.png     the raw Runway generation
 *   <id>__3-topdown.png    the footprint-exact normalised asset
 * plus cost-log.json (per-product + total credits/USD, from live org balance)
 * and contact-sheet.html (side-by-side).
 *
 * MONEY PATH (Vic cold rule): hard est-cap; stops at LIMIT products; never
 * batches the full catalog. Prints total spend. This is the STOP-for-approval
 * gate — the full-catalog run does NOT happen here.
 *
 * FIREWALL: reads PPW's own Runway key from the vault at runtime; never echoes
 * it. Key path: 09-Local-Executor/secrets/runway_dev_api_key.md.
 *
 * Usage:
 *   npx tsx scripts/topdown-runway-batch.ts            # dry run (no spend) — lists picks + est cost
 *   APPLY=1 npx tsx scripts/topdown-runway-batch.ts    # generate (spends credits)
 *   LIMIT=3 IDS=k1-schwinn-700ic,k1-bench-adjustable-fid ...  # override selection
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { generateTopDownRunway } from '../src/lib/topdown/runwayTopDown.js';
import { normalizeToFootprint } from '../src/lib/topdown/normalizeFootprint.js';
import { GEN4_IMAGE_CREDITS_1080P, USD_PER_CREDIT } from '../src/lib/topdown/runwayTopDown.js';

const REPO = resolve(process.cwd());
const CATALOG = resolve(REPO, 'src/data/products.json');
const PHOTOS_DIR = resolve(REPO, 'public/products/photos');
const VAULT = 'C:\\Users\\Victor\\Documents\\PPW-Second-Brain';
const SECRETS = resolve(VAULT, '09-Local-Executor', 'secrets', 'runway_dev_api_key.md');
const OUT_DIR = resolve(VAULT, '06-Roadmap', 'media-dept', 'renders', 'topdown-runway-test-2026-07-10');

const API = 'https://api.dev.runwayml.com';
const VERSION = '2024-11-06';
const PROJECT_CAP_USD = 30;

interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  dimensions_cm: { length: number; width: number; height: number };
}

function loadKey(): string {
  for (const line of readFileSync(SECRETS, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('RUNWAY_API_KEY=')) return line.slice('RUNWAY_API_KEY='.length).trim();
  }
  throw new Error('RUNWAY_API_KEY not found in secrets file');
}

async function balance(key: string): Promise<number | null> {
  const res = await fetch(`${API}/v1/organization`, {
    headers: { Authorization: `Bearer ${key}`, 'X-Runway-Version': VERSION },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { creditBalance?: number };
  return j.creditBalance ?? null;
}

function photoFor(id: string): string | null {
  if (!existsSync(PHOTOS_DIR)) return null;
  const hit = readdirSync(PHOTOS_DIR).find((f) => f.replace(/\.(png|jpe?g)$/i, '') === id);
  return hit ? resolve(PHOTOS_DIR, hit) : null;
}

function toDataUri(path: string): string {
  const ext = extname(path).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

async function main(): Promise<void> {
  const apply = process.env.APPLY === '1';
  const limit = Number(process.env.LIMIT ?? '3');
  const idFilter = (process.env.IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as { products: CatalogProduct[] };
  let picks = catalog.products.filter((p) => {
    const hasDims = p.dimensions_cm && p.dimensions_cm.length > 0 && p.dimensions_cm.width > 0;
    return hasDims && photoFor(p.id);
  });
  if (idFilter.length) picks = picks.filter((p) => idFilter.includes(p.id));
  picks = picks.slice(0, limit);

  const estCredits = picks.length * GEN4_IMAGE_CREDITS_1080P;
  const estUsd = estCredits * USD_PER_CREDIT;
  console.log(`Picked ${picks.length} product(s); est ${estCredits} cr ≈ $${estUsd.toFixed(2)} (cap $${PROJECT_CAP_USD}).`);
  for (const p of picks) {
    console.log(`  • ${p.id}  ${p.dimensions_cm.length}×${p.dimensions_cm.width} cm  — ${p.name}`);
  }
  if (estUsd > PROJECT_CAP_USD) {
    console.error(`OVER-CAP: est $${estUsd.toFixed(2)} > $${PROJECT_CAP_USD}. Aborting.`);
    process.exit(1);
  }
  if (!apply) {
    console.log('\nDRY RUN — set APPLY=1 to generate (spends credits). No network, no spend.');
    return;
  }

  const key = loadKey();
  mkdirSync(OUT_DIR, { recursive: true });
  const balBefore = await balance(key);
  console.log(`\nStart balance: ${balBefore} cr (~$${((balBefore ?? 0) * USD_PER_CREDIT).toFixed(2)})\n`);

  const log: Array<Record<string, unknown>> = [];
  let totalCredits = 0;

  for (const p of picks) {
    const photo = photoFor(p.id)!;
    const widthCm = p.dimensions_cm.length;
    const depthCm = p.dimensions_cm.width;
    process.stdout.write(`[${p.id}] generating… `);
    const before = await balance(key);

    const gen = await generateTopDownRunway({
      apiKey: key,
      referenceImageUri: toDataUri(photo),
      subject: { name: p.name, category: p.category, widthCm, depthCm },
    });
    if (!gen.ok || !gen.imageUrl) {
      console.log(`FAILED (${gen.error})`);
      log.push({ id: p.id, ok: false, error: gen.error });
      continue;
    }

    // Download the raw Runway output.
    const rawRes = await fetch(gen.imageUrl);
    const rawBuf = Buffer.from(await rawRes.arrayBuffer());
    const rawPath = resolve(OUT_DIR, `${p.id}__2-runway.png`);
    writeFileSync(rawPath, rawBuf);

    // Normalise to footprint-exact transparent PNG.
    let normOk = true;
    let bgMethod = '';
    let canvasStr = '';
    try {
      const norm = await normalizeToFootprint(rawBuf, widthCm, depthCm);
      writeFileSync(resolve(OUT_DIR, `${p.id}__3-topdown.png`), norm.buffer);
      bgMethod = norm.bgMethod;
      canvasStr = `${norm.canvas.wPx}×${norm.canvas.hPx}px`;
    } catch (err) {
      normOk = false;
      console.log(`\n   normalize error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Copy the source photo for the contact sheet.
    copyFileSync(photo, resolve(OUT_DIR, `${p.id}__1-source${extname(photo)}`));

    const after = await balance(key);
    const credits = before != null && after != null ? before - after : null;
    if (credits != null) totalCredits += credits;
    console.log(`ok  ratio=${gen.ratio} canvas=${canvasStr} bgMethod=${bgMethod} credits=${credits}`);
    log.push({
      id: p.id,
      ok: gen.ok && normOk,
      name: p.name,
      footprint_cm: `${widthCm}×${depthCm}`,
      canvas_px: canvasStr,
      ratio: gen.ratio,
      taskId: gen.taskId,
      bgMethod,
      credits,
      usd: credits != null ? +(credits * USD_PER_CREDIT).toFixed(2) : null,
      source: `${p.id}__1-source${extname(photo)}`,
      runway: `${p.id}__2-runway.png`,
      topdown: `${p.id}__3-topdown.png`,
    });
  }

  const balAfter = await balance(key);
  const totalUsd = +(totalCredits * USD_PER_CREDIT).toFixed(2);
  const summary = {
    generated_at: new Date().toISOString(),
    model: 'gen4_image',
    products: picks.length,
    total_credits: totalCredits,
    total_usd: totalUsd,
    balance_before: balBefore,
    balance_after: balAfter,
    project_cap_usd: PROJECT_CAP_USD,
    firewall: 'PPW own Runway key only; never echoed',
    items: log,
  };
  writeFileSync(resolve(OUT_DIR, 'cost-log.json'), JSON.stringify(summary, null, 2));
  writeContactSheet(OUT_DIR, log);
  console.log(`\nTOTAL: ${totalCredits} cr = $${totalUsd.toFixed(2)} | balance ${balBefore} → ${balAfter}`);
  console.log(`Samples + cost-log + contact-sheet → ${OUT_DIR}`);
}

function writeContactSheet(dir: string, items: Array<Record<string, unknown>>): void {
  const rows = items
    .map((it) => {
      if (!it.ok) return `<tr><td>${it.id}</td><td colspan="3">FAILED: ${it.error}</td></tr>`;
      return `<tr>
        <td><b>${it.id}</b><br>${it.footprint_cm} cm<br>${it.canvas_px}<br>${it.credits} cr</td>
        <td><img src="${it.source}"></td>
        <td><img src="${it.runway}"></td>
        <td class="tp"><img src="${it.topdown}"></td>
      </tr>`;
    })
    .join('\n');
  const html = `<!doctype html><meta charset=utf-8><title>Top-down Runway test</title>
<style>body{font:14px system-ui;background:#232C3B;color:#F5EBD7;padding:20px}
table{border-collapse:collapse}td{border:1px solid #445;padding:8px;vertical-align:top}
img{max-width:220px;max-height:220px;display:block}
th{padding:8px}.tp{background:repeating-conic-gradient(#666 0 25%,#999 0 50%) 50%/20px 20px}</style>
<h1>Top-down Runway pipeline — test batch 2026-07-10</h1>
<p>Columns: <b>source photo (reference)</b> → <b>raw Runway gen4_image</b> → <b>footprint-exact normalised</b> (checkerboard = transparency).</p>
<table><tr><th>product</th><th>1. source</th><th>2. runway</th><th>3. top-down</th></tr>
${rows}</table>`;
  writeFileSync(resolve(dir, 'contact-sheet.html'), html);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
