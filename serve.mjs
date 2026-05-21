// PPW frontend dev server — canonical helper for CLAUDE-frontend.md screenshot workflow
// Authored: 2026-05-21 (Mammoth Upgrade P1.3)
// Drop into repo root alongside CLAUDE.md. Run: `node serve.mjs`
// Serves CWD at http://localhost:3000

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
    const fsPath = resolve(ROOT + urlPath);
    if (!fsPath.startsWith(ROOT)) {
      res.writeHead(403); return res.end('Forbidden');
    }
    try {
      const s = await stat(fsPath);
      if (s.isDirectory()) {
        res.writeHead(404); return res.end('Not Found');
      }
    } catch {
      res.writeHead(404); return res.end('Not Found');
    }
    const ext = extname(fsPath).toLowerCase();
    const data = await readFile(fsPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (err) {
    res.writeHead(500); res.end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`PPW dev server on http://localhost:${PORT}  (root: ${ROOT})`);
});
