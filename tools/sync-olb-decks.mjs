// Copies the One Live Build type decks into public/decks/<slug>/, byte for byte, from the deck
// site's source folder (the decks live on ppw-decks.vercel.app; these are duplicates served
// from onelivebuild.com/decks/<slug>/, so they open where *.vercel.app does not).
//
//   node tools/sync-olb-decks.mjs                 # copy (Node 22.18+: imports a .ts file)
//   node tools/sync-olb-decks.mjs --check         # only compare, exit 1 on any difference
//   node tools/sync-olb-decks.mjs --from <folder> # another copy of the deck site
//
// Which decks: server/olbDecks.ts. Each index.html must match the sha256 recorded there (the
// approved deck); if a deck was approved again, change that sha256 on purpose, then run this.
// Only index.html and the files it loads are copied. Nothing is ever deleted: a file left over
// from an older copy is reported, and the test suite fails until it is removed with git rm.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OLB_DECKS } from '../server/olbDecks.ts';
import { deckAssetRefs, deckBrokenRefs } from './olb-deck-refs.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const fromIndex = args.indexOf('--from');
const from = fromIndex >= 0 ? resolve(args[fromIndex + 1] ?? '') : 'C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/marketing-dept/outreach/deck-site-2026-10-13';

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
/** Every file under root, as root-relative paths with forward slashes. */
function filesUnder(root, folder = root) {
  if (!existsSync(folder)) return [];
  const out = [];
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(root, path));
    else out.push(relative(root, path).replace(/\\/g, '/'));
  }
  return out;
}

let problems = 0;
const fail = (message) => { problems += 1; console.error(`  FAIL ${message}`); };

for (const deck of OLB_DECKS) {
  const source = join(from, deck.source);
  const target = join(repo, 'public', 'decks', deck.slug);
  console.log(`${deck.slug} <- ${deck.source}`);
  const index = join(source, 'index.html');
  if (!existsSync(index)) { fail(`no ${index}`); continue; }
  const found = sha256(index);
  if (found !== deck.sha256) { fail(`${deck.source}/index.html is ${found.slice(0, 16)}, not the approved ${deck.sha256.slice(0, 16)} (server/olbDecks.ts)`); continue; }
  const html = readFileSync(index, 'utf8');
  const broken = deckBrokenRefs(html);
  if (broken.length) { fail(`links that would break under /decks/${deck.slug}/: ${broken.join(', ')}`); continue; }
  const files = ['index.html', ...deckAssetRefs(html)];
  for (const file of files) {
    const input = join(source, file);
    const output = join(target, file);
    if (!existsSync(input)) { fail(`${deck.source}/${file} is referenced but missing`); continue; }
    if (existsSync(output) && sha256(output) === sha256(input)) continue;
    if (check) { fail(`${deck.slug}/${file} differs from the source`); continue; }
    mkdirSync(dirname(output), { recursive: true });
    copyFileSync(input, output);
    console.log(`  copied ${file}`);
  }
  const extra = filesUnder(target).filter((file) => !files.includes(file));
  for (const file of extra) fail(`public/decks/${deck.slug}/${file} is not loaded by the deck (git rm it)`);
}

const known = new Set(OLB_DECKS.map((deck) => deck.slug));
for (const name of existsSync(join(repo, 'public', 'decks')) ? readdirSync(join(repo, 'public', 'decks')) : []) {
  if (!known.has(name)) fail(`public/decks/${name} is not in server/olbDecks.ts`);
}

if (problems) { console.error(`${problems} problem(s).`); process.exit(1); }
console.log(check ? 'All decks match.' : 'Done.');
