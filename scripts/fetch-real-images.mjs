/**
 * fetch-real-images.mjs (2026-06-09) — one-shot sourcing of REAL product
 * photos + descriptions for the 14 branded K1 catalog products.
 *
 * For each product: fetch the manufacturer/retailer page, extract the
 * primary image (og:image and friends) + a description (og:description /
 * meta description), download the image into public/products/photos/, and
 * record everything in scripts/real-image-manifest.json.
 *
 * This is dev tooling, run by hand (not part of the build). Re-runnable.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const OUT_DIR = path.resolve('public/products/photos');
const MANIFEST = path.resolve('scripts/real-image-manifest.json');

// `pages` is an ordered candidate list — the first that yields a valid
// image wins. `variant: true` flags that the closest available page is a
// near-model (image is representative, not the exact SKU) → recorded as
// status "fallback-variant".
const JOBS = [
  { slug: 'k1-nordictrack-2450', name: 'NordicTrack Commercial 2450 Treadmill', pages: ['https://www.nordictrack.com/treadmills/commercial-2450-treadmill'] },
  { slug: 'k1-nordictrack-tour-de-france', name: 'NordicTrack Tour de France Indoor Bike', pages: ['https://www.nordictrack.com/product/tour-de-france-bike'] },
  { slug: 'k1-nordictrack-gx10', name: 'NordicTrack GX 10 Recumbent Bike', pages: ['https://www.nordictrack.com/exercise-bikes/commercial-r35-recumbent-bike'], variant: true, variantNote: 'GX 10 page retired; using current Commercial R35 recumbent (closest NordicTrack recumbent).' },
  { slug: 'k1-schwinn-700ic', name: 'Schwinn 700IC Indoor Cycle', pages: ['https://www.fitstore24.com/en/schwinn-700ic', 'https://uk.johnsonfitness.com/products/schwinn-finess-700ic-indoor-cycle', 'https://global.schwinnfitness.com/en/product/700ic-indoor-cycling-bike/100737.html'] },
  { slug: 'k1-proform-carbon-tl', name: 'ProForm Carbon TL Treadmill', pages: ['https://www.dickssportinggoods.com/p/proform-carbon-tl-treadmill-2023-23pfmuprfrmcrbntltrda/23pfmuprfrmcrbntltrda', 'https://www.proform.com/product/carbon-tls-treadmill'] },
  { slug: 'k1-nordictrack-x16', name: 'NordicTrack X16 Elliptical', pages: ['https://www.nordictrack.com/product/x16-elliptical'] },
  { slug: 'k1-nordictrack-rw900', name: 'NordicTrack RW900 Rower', pages: ['https://www.nordictrack.com/product/rw900-rower'] },
  { slug: 'k1-vision-t600-03', name: 'Vision Fitness T600-03 Treadmill', pages: ['https://www.360fitnesssuperstore.com/products/vision-t600-light-commercial-treadmill'] },
  { slug: 'k1-vision-t600e-02', name: 'Vision Fitness T600E-02 Treadmill', pages: ['https://www.johnsonfitness.com/Vision-T600-Treadmill-P36110.aspx', 'https://www.360fitnesssuperstore.com/products/vision-t600-light-commercial-treadmill'], variant: true, variantNote: 'T600E-02 has no standalone retail page; using T600 (same Vision commercial line, visually near-identical).' },
  { slug: 'k1-matrix-mg-glute', name: 'Matrix Magnum MG Glute Trainer', pages: ['https://fitnessexperience.ca/products/matrix-mg-glute-trainer', 'https://www.johnsonfitness.com/Matrix-Magnum-Glute-Trainer-P36140.aspx'] },
  { slug: 'k1-matrix-versa-adabd', name: 'Matrix Versa Adductor/Abductor', pages: ['https://www.johnsonfitness.com.au/products/matrix-versa-hip-abductor-adductor', 'https://us.matrixfitness.com/eng/strength/single-station/vs-s74-hip-abductor-adductor'] },
  { slug: 'k1-vision-smith', name: 'Vision Fitness Smith Machine', pages: ['https://akfit.com/products/vision-vf-smith-machine-pl62', 'https://fitness-specialist.com/products/vision-plate-loaded-smith-machine'] },
  { slug: 'k1-bowflex-xtreme-2se', name: 'Bowflex Xtreme 2 SE Home Gym', pages: ['https://www.bowflex.com/product/x2se-home-gym/100334.html'] },
  { slug: 'k1-bench-adjustable-fid', name: 'Adjustable FID Weight Bench', pages: ['https://www.roguefitness.com/rogue-adjustable-bench-2-0'] },
];

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractImage(html, baseUrl) {
  const url = metaContent(html, [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ]);
  if (!url) return null;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

function extractDescription(html) {
  return metaContent(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  ]);
}

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];

  for (const job of JOBS) {
    const rec = { slug: job.slug, name: job.name, sourcePageUrl: null, imageSourceUrl: null, imageFile: null, description: null, status: 'fallback-none', note: '' };
    const attempts = [];
    for (const page of job.pages) {
      try {
        const res = await fetch(page, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
        if (!res.ok) {
          attempts.push(`${page} → page HTTP ${res.status}`);
          continue;
        }
        const html = await res.text();
        const finalUrl = res.url || page;
        const desc = extractDescription(html);
        const imgUrl = extractImage(html, finalUrl);
        if (!imgUrl) {
          attempts.push(`${page} → no og:image`);
          if (desc && !rec.description) rec.description = desc;
          continue;
        }
        const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA, Accept: 'image/*', Referer: finalUrl }, redirect: 'follow' });
        const ctype = (imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (!imgRes.ok || !ctype.startsWith('image/') || buf.length < 5000) {
          attempts.push(`${page} → image HTTP ${imgRes.status} type=${ctype} size=${buf.length}`);
          continue;
        }
        const ext = EXT_BY_TYPE[ctype] || 'jpg';
        const fileName = `${job.slug}.${ext}`;
        await writeFile(path.join(OUT_DIR, fileName), buf);
        rec.sourcePageUrl = page;
        rec.imageSourceUrl = imgUrl;
        rec.imageFile = `products/photos/${fileName}`;
        rec.description = desc;
        rec.status = job.variant ? 'fallback-variant' : 'real';
        if (job.variant) rec.note = job.variantNote || 'representative variant image';
        console.log(`✓ ${job.slug}: ${ctype} ${(buf.length / 1024).toFixed(0)}KB → ${fileName}${job.variant ? ' (variant)' : ''}`);
        break;
      } catch (err) {
        attempts.push(`${page} → ${err.message}`);
      }
    }
    if (!rec.imageFile) {
      rec.note = `no usable image. ${attempts.join(' | ')}`;
      console.log(`✗ ${job.slug}: ${attempts.join(' | ')}`);
    }
    results.push(rec);
  }

  await writeFile(MANIFEST, JSON.stringify({ generated: 'fetch-real-images.mjs 2026-06-09', products: results }, null, 2));
  const real = results.filter((r) => r.status === 'real').length;
  console.log(`\nDONE — ${real}/${results.length} real, ${results.length - real} fallback. Manifest: scripts/real-image-manifest.json`);
}

run();
