// Build the round's compact evidence folder (docs/world/finish/evidence/) from the
// result folders: every formal campaign's JSON, the controlled-build attribution,
// the CI and Lighthouse collection, a few review images, a SOURCE-MANIFEST with the
// SHA-256 of every original file the package was made from, and a PACKAGE-MANIFEST
// with every packaged file's bytes. Large raw JSON is kept lossless as .gz beside
// a small index. The combined docs/world folder must stay under 5,000,000 bytes.
// Usage: node tools/world/evidence-package.mjs --inputs=<json> --out=<docs/world/finish/evidence> [--limit=5000000]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const argument = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputsPath = argument('inputs'), out = argument('out');
if (!inputsPath || !out) throw Error('Pass --inputs=<json> --out=<folder>');
const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8'));
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const sources = [], packaged = [];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
function record(file, buffer) { sources.push({ file: path.resolve(file).replace(/\\/g, '/'), bytes: buffer.length, sha256: sha(buffer) }); }
function write(name, buffer) {
  const destination = path.join(out, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buffer);
  packaged.push({ file: name.replace(/\\/g, '/'), bytes: buffer.length, sha256: sha(buffer) });
}
/** Copy a JSON file; above the threshold keep a lossless gzip beside a readable index. */
function json(name, file, threshold = 200000) {
  const buffer = fs.readFileSync(file); record(file, buffer);
  if (buffer.length <= threshold) { write(name, buffer); return; }
  const gz = gzipSync(buffer, { level: 9 });
  write(name + '.gz', gz);
  write(name, Buffer.from(JSON.stringify({ index: true, note: 'Lossless gzip of the complete file beside this index; decompress to read every row. Nothing is truncated.', original: path.basename(file), originalBytes: buffer.length, originalSha256: sha(buffer), gzipBytes: gz.length, gzipSha256: sha(gz) }, null, 2) + '\n'));
}
async function image(name, file, { quality = 72, maxWidth = 1280 } = {}) {
  const buffer = fs.readFileSync(file); record(file, buffer);
  const jpeg = await sharp(buffer).resize({ width: maxWidth, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  write(name.replace(/\.png$/i, '.jpg'), jpeg);
}
for (const entry of inputs.json ?? []) json(entry.as, entry.from, entry.threshold);
for (const entry of inputs.images ?? []) await image(entry.as, entry.from, entry);
for (const entry of inputs.text ?? []) { const buffer = fs.readFileSync(entry.from); record(entry.from, buffer); write(entry.as, buffer); }
for (const file of inputs.hashOnly ?? []) { const buffer = fs.readFileSync(file); record(file, buffer); }
if (inputs.report) write('REPORT.md', Buffer.from(fs.readFileSync(inputs.report, 'utf8')));
write('SOURCE-MANIFEST.json', Buffer.from(JSON.stringify({ at: new Date().toISOString(), note: 'Every original file this package was made from, with its byte count and SHA-256. hashOnly entries are retained outside the package unchanged.', sources }, null, 2) + '\n'));
const total = packaged.reduce((s, f) => s + f.bytes, 0);
write('PACKAGE-MANIFEST.json', Buffer.from(JSON.stringify({ at: new Date().toISOString(), files: packaged, totalBytes: total }, null, 2) + '\n'));
const docsRoot = path.resolve(out, '../..');
const size = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
const docsBytes = size(docsRoot), limit = Number(argument('limit') ?? 5000000);
console.log(JSON.stringify({ packagedFiles: packaged.length, packageBytes: total, docsWorldBytes: docsBytes, limit, withinLimit: docsBytes < limit }));
if (docsBytes >= limit) process.exitCode = 1;
