// Run from the product root; no clone or writes to another product checkout.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const repo = 'victorcassiusoffice-sketch/tradefolder';
const commit = 'aa810520ef0736862ea50489f065266736ba2050';
const vendor = 'src/designer/link/vendor';
const expected = {
  'src/lib/jobPack/types.ts': 'a8c327fe1b5d75e56c326bda8ea947671fcc2fc486d399344099d4b342f9d3d8',
  'src/lib/jobPack/protocol.ts': '30a39c1429b36caf210e1bffebc5dd481da62b67b744d7fc43697c51d62e2d6b',
  'src/lib/jobPack/job-pack.schema.json': 'cc1f5ba6ecbfd5e00d89ccf82991f0a4ccc37a0eb414bf972845070833c28071',
  'src/lib/links/carry.ts': '3c21aae38124b427fe9ef1dc268d0045043991e432d149b5ec0e55a96a25a328',
  'src/lib/links/signed.ts': 'f0e9e24e7d091085654de40234a786faf991325b692e70f6fdaef4a91df3ba84',
  'src/lib/money.ts': 'e1f819ecb2e94f7666db508c4b53a08c65615aade262fb91fcf8b6ff8b88482a',
  'docs/JOB-PACK-CONTRACT.md': '291aa8219917710661ffaa3ab230507f26391ed78a080e8dfd8e1cdaaffe2690',
  'docs/job-pack.schema.json': 'cc1f5ba6ecbfd5e00d89ccf82991f0a4ccc37a0eb414bf972845070833c28071',
};
function fetchSource(path, sha256) {
  const bytes = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw',
    'repos/' + repo + '/contents/' + path + '?ref=' + commit]);
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw Error('Pinned source mismatch: ' + path);
  return bytes;
}
const files = Object.entries(expected).map(([path, sha256]) => {
  const local = path.startsWith('src/') ? vendor + '/tradefolder/' + path.slice(4) : 'docs/link/' + path.slice(5);
  return { path, local, sha256, bytes: fetchSource(path, sha256) };
});
const port = { path: 'src/lib/jobPack/records.ts', sha256: '83e83e3e58dce711d84040dc472a395000ed28b114e31e8b68ef16caea4e5e40' };
const records = fetchSource(port.path, port.sha256);
for (const file of files) {
  mkdirSync(dirname(file.local), { recursive: true }); writeFileSync(file.local, file.bytes);
  console.log(file.sha256, file.local);
}
writeFileSync(vendor + '/VENDORED.json', JSON.stringify({ repo, commit,
  files: files.map(({ path, local, sha256 }) => ({ path, local, sha256 })), port }, null, 2) + '\n');
if (process.argv[2]) {
  mkdirSync(dirname(process.argv[2]), { recursive: true });
  writeFileSync(process.argv[2], records);
}
