// extract-link-contract.mjs: copies the link contract blocks out of the vault handoff, byte for byte.
// Usage: node extract-link-contract.mjs <handoff.md> <out-dir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const [, , source, outDir] = process.argv;
if (!source || !outDir) throw new Error('Usage: node extract-link-contract.mjs <handoff.md> <out-dir>');
const fence = String.fromCharCode(96).repeat(3);
const text = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
const blocks = [
  ['PLAN-VIEW-CONTRACT.md', 'markdown plan-view-contract-v1'],
  ['plan-view.schema.json', 'json plan-view-schema-v1'],
  ['build-tokens.css', 'css build-tokens-v1'],
  ['fixture-request.json', 'json fixture-request-v1'],
  ['fixture-plan-view.json', 'json fixture-plan-view-v1'],
];
mkdirSync(outDir, { recursive: true });
for (const [file, info] of blocks) {
  const open = fence + info + '\n';
  const start = text.indexOf(open);
  if (start < 0 || text.indexOf(open, start + 1) >= 0) throw new Error('Expected exactly one block: ' + info);
  const from = start + open.length;
  const end = text.indexOf('\n' + fence + '\n', from);
  if (end < 0) throw new Error('Block not closed: ' + info);
  const body = text.slice(from, end) + '\n';
  writeFileSync(join(outDir, file), body, 'utf8');
  console.log(createHash('sha256').update(body, 'utf8').digest('hex') + '  ' + file);
}
