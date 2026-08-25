/**
 * Sequential wrapper around slot-topdown.mjs for a generated batch.
 * Sequential on purpose: each slot run rewrites products.json, so
 * parallel runs would clobber each other (read-modify-write race).
 *
 * Usage: node scripts/slot-topdown-batch.mjs scripts/incoming/batch-manifest.json
 */
import { readFile, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from 'node:process';

const run = promisify(execFile);
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node scripts/slot-topdown-batch.mjs <manifest.json>');
const items = JSON.parse(await readFile(manifestPath, 'utf8'));

const rows = [];
for (const it of items) {
  try {
    await access(it.file);
  } catch {
    rows.push({ id: it.id, mode: 'SKIP (no file)' });
    continue;
  }
  try {
    const { stdout } = await run('node', [
      'scripts/slot-topdown.mjs',
      '--product', it.id,
      '--file', it.file,
      '--front-edge', 'bottom',
    ]);
    const modeLine = stdout.split('\n').find((l) => l.startsWith('mode')) ?? '';
    const silLine = stdout.split('\n').find((l) => l.startsWith('silhouette')) ?? '';
    rows.push({ id: it.id, mode: modeLine.replace(/^mode\s+/, ''), sil: silLine.replace(/^silhouette\s+/, '') });
  } catch (err) {
    rows.push({ id: it.id, mode: 'ERROR: ' + (err.stderr || err.message).slice(0, 120) });
  }
}
for (const r of rows) console.log(r.id.padEnd(30), (r.mode ?? '').padEnd(60), r.sil ?? '');
