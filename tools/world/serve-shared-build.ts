/** Run with vite-node. A standalone private build host using an isolated, durable PostgreSQL-compatible database. */
import { createServer as httpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { createReadStream, readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { PGlite } from '@electric-sql/pglite';
import { handleLiveBuild } from '../../api/_lib/sharedBuild/handler';
import { makeRoomStore } from '../../api/_db/liveBuildStore';

const arg = (name: string) =>
  process.argv.find((v) => v.startsWith('--' + name + '='))?.slice(name.length + 3);
const port = Number(arg('port') || 4199),
  bind = arg('bind') || '127.0.0.1',
  data = arg('data'),
  staticRoot = path.resolve(arg('dist') || 'dist');
const localAddress = (ip?: string) =>
  ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
const cert = arg('cert'),
  privateKey = arg('key'),
  tls = !!cert && !!privateKey;
if (!data || !Number.isInteger(port) || port < 1 || port > 65535)
  throw Error('Supply --data=<private directory> and a valid --port.');
if (!localAddress(bind) && !tls)
  throw Error('Supply TLS certificate and key paths to accept remote connections.');
const dbDirectory = path.resolve(data);
if (dbDirectory === staticRoot || dbDirectory.startsWith(staticRoot + path.sep))
  throw Error('Keep the database outside the served files.');
if (!existsSync(path.join(staticRoot, 'olb.html')))
  throw Error('Build the designer first or supply --dist=<release directory>.');
mkdirSync(dbDirectory, { recursive: true });
const db = new PGlite(dbDirectory);
if (
  !(
    await db.query<{ installed: boolean }>(
      "SELECT to_regclass('public.olb_shared_projects') IS NOT NULL AS installed",
    )
  ).rows[0]?.installed
)
  await db.exec(readFileSync('api/_db/migrations/0032_shared_project_specs.sql', 'utf8'));
const store = makeRoomStore(
  async (text, parameters) => (await db.query<Record<string, unknown>>(text, parameters)).rows,
);
const names = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  ...Object.values(networkInterfaces()).flatMap((list) => (list ?? []).map((i) => i.address)),
  ...(arg('hostname') ? [arg('hostname')!] : []),
]);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm',
};
async function serve(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? '',
    protocol = tls ? 'https:' : 'http:';
  let uri: URL;
  try {
    uri = new URL(req.url || '/', protocol + '//' + host);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (
    !names.has(uri.hostname) ||
    uri.host !== host ||
    Number(uri.port || (tls ? 443 : 80)) !== port
  ) {
    res.writeHead(400).end();
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (uri.pathname.startsWith('/api/shared-projects/live/')) {
    const suffix = uri.pathname.slice('/api/shared-projects/live/'.length).split('/');
    const read = async () => {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const b = Buffer.from(chunk);
        size += b.length;
        if (size > 780000) throw Error('Invalid oversized request.');
        chunks.push(b);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    };
    await handleLiveBuild(
      suffix,
      req,
      {
        status(n) {
          res.statusCode = n;
        },
        setHeader(n, v) {
          res.setHeader(n, v);
        },
        json(v) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(v));
        },
      },
      read,
      {
        store: () => store,
        now: Date.now,
        allowHost: async () =>
          localAddress(req.socket.remoteAddress) &&
          ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname),
        allowOrigin: (origin) => origin === uri.origin,
      },
    );
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  // Only the designer demo is served. The hosted studio, orders and accounts are separate.
  if (uri.pathname === '/api/products') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ products: [] }));
    return;
  }
  if (uri.pathname === '/api/healthcheck') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'local-shared-build' }));
    return;
  }
  const pathname = decodeURIComponent(uri.pathname);
  const publicPath = pathname === '/' || pathname === '/demo' ? '/olb.html' : pathname;
  if (
    publicPath !== '/olb.html' &&
    (!/\.[a-z0-9]+$/i.test(publicPath) ||
      publicPath.includes('/.') ||
      publicPath.includes('/studio/') ||
      publicPath.startsWith('/api/'))
  ) {
    res.writeHead(404).end();
    return;
  }
  const file = path.resolve(staticRoot, '.' + publicPath);
  if (!file.startsWith(staticRoot + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Content-Length': statSync(file).size,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
}
const callback = (req: IncomingMessage, res: ServerResponse) =>
  void serve(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
const server = tls
  ? httpsServer({ cert: readFileSync(cert!), key: readFileSync(privateKey!) }, callback)
  : httpServer(callback);
await new Promise<void>((resolve, reject) =>
  server.once('error', reject).listen(port, bind, resolve),
);
console.log('Shared build host listening on ' + bind + ':' + port + ' · open /demo');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    server.closeAllConnections();
    server.close(() => void db.close().then(() => process.exit(0)));
  });
