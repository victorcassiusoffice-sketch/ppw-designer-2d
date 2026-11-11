/**
 * Extra views of a product for Tripo's multiview endpoint, and the cleaner that turns a listing's
 * spec drawing (a side view with dimension arrows and callouts) back into a plain product shot.
 *
 * Why: from one three-quarter photo every generator guesses the depth, and guesses short. The test
 * run's treadmill came back 15–22 % too stubby from all three tools; two seeds of Tripo gave 19.5 %
 * and 22 %. A true side view tells the generator the length; the fit then has little to correct.
 */
import path from 'node:path';
import sharp from 'sharp';
import { publicPhotoUrl } from './catalog.mjs';
import { PUBLIC_DIR } from './paths.mjs';

/** Tripo's multiview list is positional: [front, left, back, right]. The front is required. */
export const VIEW_ORDER = ['front', 'left', 'back', 'right'];
export const VIEWS_DIR = path.join(PUBLIC_DIR, 'products', 'photos', 'views');
export const VIEWS_URL_BASE = '/products/photos/views';

/**
 * The row's extra views by name: `photo_views: { front, left, back, right }`, each a URL or a
 * `/products/...` path. "Left" is the product's own left, as a person standing where the front
 * photo was taken would call it (the side a user's left hand is on, for a treadmill).
 */
export function viewsOf(row) {
  const raw = row?.raw?.photo_views ?? row?.photo_views ?? null;
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const k of VIEW_ORDER) if (typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k].trim();
  return out;
}

/**
 * What goes to the multiview endpoint. Positions mean [front, left, back, right], so only a prefix
 * of that order can be sent: a right view in the second slot would be read as the left view. The
 * main photo stands in for a missing front (the photo side is the front). Fewer than two = no multiview.
 */
export function multiviewPlan(views, mainPhoto) {
  const front = views.front ?? mainPhoto ?? null;
  if (!front) return { use: false, names: [], photos: [], skipped: [], why: 'no front view and no photo' };
  const list = [{ name: 'front', photo: front }];
  for (const k of VIEW_ORDER.slice(1)) {
    if (!views[k]) break;
    list.push({ name: k, photo: views[k] });
  }
  const skipped = VIEW_ORDER.filter((k) => views[k] && !list.some((l) => l.name === k));
  const names = list.map((l) => l.name);
  const photos = list.map((l) => l.photo);
  if (list.length < 2) {
    return { use: false, names, photos, skipped, frontFromMain: !views.front, why: skipped.length ? `only a ${skipped.join(' and ')} view: the list cannot carry it without a left view (positions are front, left, back, right)` : 'no extra views' };
  }
  return { use: true, names, photos, skipped, frontFromMain: !views.front, why: `${list.length} views: ${names.join(' + ')}${views.front ? '' : ' (the main photo is the front)'}${skipped.length ? `; ${skipped.join(', ')} not sent (positions are front, left, back, right)` : ''}` };
}

/** Public URLs (or data URIs for files production does not serve yet) for the planned views, in order. */
export async function multiviewUrls(plan, opts) {
  return Promise.all(plan.photos.map((p) => publicPhotoUrl(p, opts)));
}

/** One pixel of dilation on a 0/1 mask (4-neighbours), for the labelling only. */
function dilate(mask, w, h) {
  const out = new Uint8Array(mask);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (mask[i]) continue;
    if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) out[i] = 1;
  }
  return out;
}

/** Connected components (4-neighbours) of a 0/1 mask: labels 1..n and each label's pixel count. */
export function components(mask, w, h) {
  const labels = new Int32Array(w * h);
  const sizes = [];
  const queue = new Int32Array(w * h);
  let next = 1;
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s]) continue;
    const label = next++;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    labels[s] = label;
    let size = 0;
    while (head < tail) {
      const i = queue[head++];
      size++;
      const x = i % w;
      if (x > 0 && mask[i - 1] && !labels[i - 1]) { labels[i - 1] = label; queue[tail++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && !labels[i + 1]) { labels[i + 1] = label; queue[tail++] = i + 1; }
      if (i >= w && mask[i - w] && !labels[i - w]) { labels[i - w] = label; queue[tail++] = i - w; }
      if (i + w < w * h && mask[i + w] && !labels[i + w]) { labels[i + w] = label; queue[tail++] = i + w; }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/**
 * A listing's spec drawing back to a plain product shot: keep the largest connected patch of
 * non-background pixels (the product), paint everything else white (dimension arrows, callouts,
 * stray text), crop to the product with a margin, pad to a square, resize. Background = transparent
 * or near-white (every channel ≥ `white`; a studio floor gradient counts as background). The
 * labelling runs on a copy no longer than `work` px; the painting is done on the full picture.
 * Returns the WebP and what was done, so the record says how much was painted out.
 */
export async function cleanProductShot(input, { size = 1024, margin = 0.05, white = 228, work = 1000, quality = 90 } = {}) {
  const base = sharp(input).rotate();
  const meta = await base.metadata();
  const W = meta.width;
  const H = meta.height;
  if (!W || !H) throw new Error('not a picture sharp can measure');
  const scale = Math.min(1, work / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const { data } = await sharp(input).rotate().resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const fg = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    if (data[p + 3] < 24) continue;
    if (Math.min(data[p], data[p + 1], data[p + 2]) >= white) continue;
    fg[i] = 1;
  }
  const { labels, sizes } = components(dilate(fg, w, h), w, h);
  if (!sizes.length) throw new Error('no product found in the picture (all background)');
  const main = sizes.indexOf(Math.max(...sizes)) + 1;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  let kept = 0;
  let removed = 0;
  const erase = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!fg[i]) continue;
    if (labels[i] === main) {
      kept++;
      const x = i % w;
      const y = (i - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    } else { removed++; erase[i] = 1; }
  }
  // Paint the other patches white, with a one-pixel halo so no grey rim of an arrow survives the upscale.
  const eraseWide = dilate(erase, w, h);
  const paint = Buffer.alloc(w * h * 4);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    if (!eraseWide[i] || labels[i] === main) continue;
    paint[p] = 255; paint[p + 1] = 255; paint[p + 2] = 255; paint[p + 3] = 255;
  }
  const paintLayer = await sharp(paint, { raw: { width: w, height: h, channels: 4 } }).resize(W, H, { fit: 'fill', kernel: 'nearest' }).png().toBuffer();
  // The product's box at full size, with a margin, then a square.
  const bx0 = Math.max(0, Math.floor(x0 / scale));
  const by0 = Math.max(0, Math.floor(y0 / scale));
  const bx1 = Math.min(W - 1, Math.ceil((x1 + 1) / scale));
  const by1 = Math.min(H - 1, Math.ceil((y1 + 1) / scale));
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  const side = Math.ceil(Math.max(bw, bh) * (1 + 2 * margin));
  const cx = bx0 + bw / 2;
  const cy = by0 + bh / 2;
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);
  // Flatten onto white, paint, then extract the square (extending with white where the square leaves the picture).
  const flat = await sharp(input).rotate().flatten({ background: '#ffffff' }).composite([{ input: paintLayer, blend: 'over' }]).png().toBuffer();
  const padL = Math.max(0, -left);
  const padT = Math.max(0, -top);
  const padR = Math.max(0, left + side - W);
  const padB = Math.max(0, top + side - H);
  // Two steps: sharp runs an extract before an extend when both sit in one chain, so the padding goes first.
  const padded = padL || padT || padR || padB ? await sharp(flat).extend({ left: padL, top: padT, right: padR, bottom: padB, background: '#ffffff' }).png().toBuffer() : flat;
  const buffer = await sharp(padded)
    .extract({ left: left + padL, top: top + padT, width: side, height: side })
    .resize(size, size, { fit: 'fill' })
    .webp({ quality })
    .toBuffer();
  return {
    buffer,
    source: { width: W, height: H },
    product: { left: bx0, top: by0, width: bw, height: bh },
    square: { left, top, side },
    patches: sizes.length,
    keptFraction: kept / Math.max(1, kept + removed),
    paintedPixels: Math.round(removed / (scale * scale)),
  };
}

/** Where a cleaned view lands and how the row names it. */
export function viewFile(productId, view) {
  return { file: path.join(VIEWS_DIR, `${productId}-${view}.webp`), url: `${VIEWS_URL_BASE}/${productId}-${view}.webp` };
}
