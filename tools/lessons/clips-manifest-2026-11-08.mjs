// Writes docs/lessons/clips-manifest.json from the files in public/lessons:
// codec, size, length, audio streams (must be 0), bytes, poster bytes.
// Usage: node tools/lessons/clips-manifest-2026-11-08.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dir = 'public/lessons';
const rows = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.webm')).sort()) {
  const full = path.join(dir, file);
  const probe = (args) => execFileSync('ffprobe', ['-v', 'error', ...args, full]).toString().trim();
  const [codec, width, height] = probe(['-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'csv=p=0']).split(',');
  const seconds = Number(probe(['-show_entries', 'format=duration', '-of', 'csv=p=0']));
  const audioStreams = probe(['-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0']).split('\n').filter(Boolean).length;
  const bytes = fs.statSync(full).size;
  const poster = full.replace(/\.webm$/, '.webp');
  rows.push({
    id: file.replace(/\.webm$/, ''),
    codec,
    width: Number(width),
    height: Number(height),
    seconds: +seconds.toFixed(2),
    audioStreams,
    bytes,
    sha256: createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 16),
    posterBytes: fs.existsSync(poster) ? fs.statSync(poster).size : null,
  });
}
const total = rows.reduce((sum, r) => sum + r.bytes, 0);
const out = { at: new Date().toISOString(), recorder: 'tools/lessons/record-clips-2026-11-08.mjs', clips: rows.length, totalBytes: total, maxBytes: Math.max(...rows.map((r) => r.bytes)), rows };
fs.writeFileSync('docs/lessons/clips-manifest.json', JSON.stringify(out, null, 2));
console.log(`${rows.length} clips, ${total} bytes, largest ${out.maxBytes}, any audio: ${rows.some((r) => r.audioStreams > 0)}`);
