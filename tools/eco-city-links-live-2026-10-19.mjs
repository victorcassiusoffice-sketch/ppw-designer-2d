/** Read-only pinned-preview directory checks; no credentials or mutations. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const base = process.argv[2];
if (!/^https:\/\/ppw-designer-2d-[a-z0-9-]+\.vercel\.app$/.test(base ?? '')) throw new Error('Unique preview origin required');
const document = readFileSync('docs/ECO-CITY-BUILD-LINKS-2026-10-19.md', 'utf8');
const urls = [...new Set([...document.matchAll(/https:\/\/ppw-designer-2d-[a-z0-9-]+\.vercel\.app[^\s)\]]*/g)].map(m => m[0].replace(/[.,]+$/, '')).filter(url => new URL(url).origin === base))];
const rows = []; let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const index = next++; if (index >= urls.length) return;
    const url = urls[index];
    try {
      const { stdout } = await run('curl.exe', ['--silent', '--show-error', '--max-time', '30', '--location', '--output', 'NUL', '--write-out', '%{http_code}', url]);
      rows.push({ url, status: Number(stdout.trim()) });
    } catch (error) { rows.push({ url, status: 0, error: String(error.message) }); }
  }
}));
rows.sort((a, b) => a.url.localeCompare(b.url));
writeFileSync('docs/qa-eco-city-live-2026-10-19/links.json', JSON.stringify({ base, at: new Date().toISOString(), rows }, null, 2));
const failures = rows.filter(r => r.status !== 200);
console.log(JSON.stringify({ checked: rows.length, failures }));
if (failures.length) process.exitCode = 1;
