/** The photo check: is there a real product photo to generate from? Usable, missing, a drawing, a placeholder, too small, or hand-flagged wrong. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { localPhotoPath, photoUrlOf } from './catalog.mjs';

const FLAGS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'photo-flags.json');
export function readFlags() {
  const data = JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf8'));
  delete data._about;
  return data;
}

export const MIN_LONG_SIDE = 512;

/** One row's verdict. `thumb` is a small data URL for the contact sheet. */
export async function auditPhoto(row, { flags = readFlags(), thumbPx = 240 } = {}) {
  const out = { id: row.id, name: row.name, source: row.source, dims: row.dimensions_cm ? `${row.dimensions_cm.length}×${row.dimensions_cm.width}×${row.dimensions_cm.height} cm` : null, photo: row.photo ?? null, status: 'missing', why: '' };
  if (!row.photo) { out.why = 'no photo on the row'; return out; }
  if (/placehold\.co|placeholder/i.test(row.photo)) { out.status = 'placeholder'; out.why = 'a placeholder, not a photo'; return out; }
  if (!photoUrlOf(row.photo)) { out.status = 'vector'; out.why = 'a drawing (SVG), not a photo'; return out; }
  let bytes = null;
  if (/^https?:/i.test(row.photo)) {
    try {
      const res = await fetch(row.photo);
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer());
      else { out.why = `photo URL answers ${res.status}`; return out; }
    } catch (e) { out.why = `photo URL unreachable: ${String(e).slice(0, 80)}`; return out; }
  } else {
    const local = localPhotoPath(row.photo);
    if (!local) { out.why = `file not found under public/: ${row.photo}`; return out; }
    bytes = fs.readFileSync(local);
    out.file = local;
  }
  try {
    const meta = await sharp(bytes).metadata();
    out.width = meta.width;
    out.height = meta.height;
    out.format = meta.format;
    out.bytes = bytes.length;
    out.thumb = `data:image/webp;base64,${(await sharp(bytes).resize(thumbPx, thumbPx, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toBuffer()).toString('base64')}`;
    if (Math.max(meta.width, meta.height) < MIN_LONG_SIDE) { out.status = 'small'; out.why = `long side ${Math.max(meta.width, meta.height)} px, under ${MIN_LONG_SIDE}`; return out; }
  } catch (e) {
    out.why = `not an image sharp can read: ${String(e).slice(0, 80)}`;
    return out;
  }
  out.status = 'usable';
  const flag = flags[row.id];
  if (flag) { out.status = flag.status; out.why = flag.why; }
  return out;
}

export async function auditAll(rows, opts) {
  const flags = readFlags();
  const out = [];
  for (const row of rows) out.push(await auditPhoto(row, { ...opts, flags }));
  return out;
}
