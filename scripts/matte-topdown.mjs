/**
 * ML background matte for top-down renders (2026-08-25).
 *
 * The flood-fill white key in slot-topdown.mjs cannot remove: (a) studio
 * slabs darker than the threshold, (b) near-white regions enclosed inside
 * frame gaps (not border-connected). This uses @imgly/background-removal-node
 * (already a repo dependency — see normalizeFootprint.ts "imgly is available
 * as an opt-in heavier alternative") to produce a proper alpha matte.
 *
 * Usage: node scripts/matte-topdown.mjs <in.jpg|png> <out.png>
 * Then slot with the key disabled:
 *   node scripts/slot-topdown.mjs --product <id> --file <out.png> --white-threshold 256
 */
import { removeBackground } from '@imgly/background-removal-node';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) throw new Error('Usage: node scripts/matte-topdown.mjs <in> <out.png>');

const buf = await readFile(inPath);
const blob = new Blob([buf], { type: inPath.endsWith('.png') ? 'image/png' : 'image/jpeg' });
const result = await removeBackground(blob, { output: { format: 'image/png' } });
await writeFile(outPath, Buffer.from(await result.arrayBuffer()));
console.log('matted', path.basename(inPath), '->', path.basename(outPath));
