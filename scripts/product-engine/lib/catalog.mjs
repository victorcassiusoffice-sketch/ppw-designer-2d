/** Catalogue rows in, one normalised shape out; the manifests the engine writes. */
import fs from 'node:fs';
import path from 'node:path';
import { COURTS_JSON, MANIFEST, PHOTO_BASE, PRODUCTS_JSON, PUBLIC_DIR, THUMBS_MANIFEST } from './paths.mjs';

export function readJson(file, fallback) {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** The indent and line ends a JSON file already uses, so a one-field edit stays a one-line diff. */
export function jsonStyle(text) {
  const m = text.match(/^(\{|\[)\r?\n([ \t]+)/);
  return { indent: m ? m[2] : '  ', eol: /\r\n/.test(text) ? '\r\n' : '\n', finalNewline: /\r?\n$/.test(text) || !text.length };
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const style = fs.existsSync(file) ? jsonStyle(fs.readFileSync(file, 'utf8')) : { indent: '  ', eol: '\n', finalNewline: true };
  const text = JSON.stringify(data, null, style.indent).replace(/\n/g, style.eol);
  fs.writeFileSync(file, style.finalNewline ? `${text}${style.eol}` : text);
}

const rowsOf = (data) => (Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : Array.isArray(data?.rows) ? data.rows : []);

/**
 * A row as the engine sees it. Three shapes arrive: a catalogue row (`dimensions_cm`, `front_edge`,
 * `photo_image_url`/`image_url`), a merchant add-product row (`widthMm` = footprint left→right,
 * `depthMm` = front→back, `heightMm`, `imageUrl`), and a connect-wizard row (snake or camel case).
 * The plan's convention: `length` runs along plan x (left→right), `width` along plan y (front→back).
 */
export function normaliseRow(row, source = 'input') {
  if (!row || typeof row !== 'object') throw new Error('a row must be an object');
  const id = String(row.id ?? row.productId ?? row.sku ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!id) throw new Error('a row needs an id (or a sku)');
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  let dims = null;
  if (row.dimensions_cm) dims = { length: num(row.dimensions_cm.length), width: num(row.dimensions_cm.width), height: num(row.dimensions_cm.height) };
  else if (row.widthMm !== undefined || row.width_mm !== undefined) {
    const w = num(row.widthMm ?? row.width_mm);
    const d = num(row.depthMm ?? row.depth_mm);
    const h = num(row.heightMm ?? row.height_mm);
    dims = { length: w === null ? null : w / 10, width: d === null ? null : d / 10, height: h === null ? null : h / 10 };
  } else if (row.length_cm !== undefined || row.lengthCm !== undefined) {
    dims = { length: num(row.length_cm ?? row.lengthCm), width: num(row.width_cm ?? row.widthCm), height: num(row.height_cm ?? row.heightCm) };
  }
  const dimsOk = dims && ['length', 'width', 'height'].every((k) => Number.isFinite(dims[k]) && dims[k] > 0);
  const frontEdge = row.front_edge ?? row.frontEdge ?? null;
  const photo = row.photo_image_url ?? row.photoUrl ?? row.photo_url ?? row.imageUrl ?? row.image_url ?? row.photo ?? null;
  return {
    id,
    sku: row.sku ?? null,
    name: row.name ?? id,
    category: row.category ?? null,
    dimensions_cm: dimsOk ? dims : null,
    dimsProblem: dimsOk ? null : 'length, width and height must all be positive numbers (cm; the merchant form sends mm)',
    front_edge: ['top', 'bottom', 'left', 'right'].includes(frontEdge) ? frontEdge : 'bottom',
    frontEdgeDeclared: ['top', 'bottom', 'left', 'right'].includes(frontEdge),
    photo: typeof photo === 'string' && photo.trim() ? photo.trim() : null,
    source,
    raw: row,
  };
}

/** The seed catalogue plus the Courts show-flat rows (the same two sources the SketchUp importer reads). */
export function loadCatalogue() {
  const products = rowsOf(readJson(PRODUCTS_JSON)).map((r) => normaliseRow(r, 'products.json'));
  const courts = rowsOf(readJson(COURTS_JSON, { products: [] })).map((r) => normaliseRow(r, 'courts'));
  return { products, courts, all: [...products, ...courts] };
}

export function loadInputRows(file) {
  return rowsOf(readJson(path.resolve(file))).map((r) => normaliseRow(r, path.basename(file)));
}

/** A real photo or nothing: placeholders, SVG drawings and data-URI drawings never feed the generator. */
export function photoUrlOf(photo) {
  if (!photo) return null;
  if (/placehold\.co|placeholder/i.test(photo)) return null;
  if (/^data:image\/svg/i.test(photo) || /\.svg(\?|$)/i.test(photo)) return null;
  return photo;
}

/** The local file behind a `/products/...` path, if it exists. */
export function localPhotoPath(photo) {
  if (!photo || !photo.startsWith('/')) return photo && fs.existsSync(photo) ? path.resolve(photo) : null;
  const p = path.join(PUBLIC_DIR, photo.replace(/^\/+/, '').split('/').join(path.sep));
  return fs.existsSync(p) ? p : null;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/**
 * The URL fal receives: an absolute http(s) URL as is; a `/products/...` path as the production URL
 * when production serves it, else the local file as a data URI (a merchant's photo that is not live yet).
 */
export async function publicPhotoUrl(photo, { fetchImpl = fetch } = {}) {
  if (!photo) return null;
  if (/^https?:/i.test(photo)) return photo;
  if (/^data:image\//i.test(photo)) return photo;
  const local = localPhotoPath(photo);
  if (photo.startsWith('/products/')) {
    const url = `${PHOTO_BASE}${photo}`;
    try {
      const head = await fetchImpl(url, { method: 'HEAD' });
      if (head.ok) return url;
    } catch {
      /* fall through to the data URI */
    }
  }
  if (!local) return null;
  const mime = MIME[path.extname(local).toLowerCase()];
  if (!mime) return null;
  return `data:${mime};base64,${fs.readFileSync(local).toString('base64')}`;
}

export const readManifest = () => readJson(MANIFEST, {});
export const writeManifest = (m) => writeJson(MANIFEST, m);
export const readThumbs = () => readJson(THUMBS_MANIFEST, {});
export const writeThumbs = (t) => writeJson(THUMBS_MANIFEST, t);

/** Set fields on a products.json row, touching nothing else in the file. */
export function setRowFields(productId, fields, file = PRODUCTS_JSON) {
  const data = readJson(file);
  const row = rowsOf(data).find((r) => r.id === productId);
  if (!row) return false;
  Object.assign(row, fields);
  writeJson(file, data);
  return true;
}

/** Set `topdown_image_url` on a products.json row, touching nothing else in the file. */
export function setTopdownUrl(productId, url) {
  return setRowFields(productId, { topdown_image_url: url });
}
