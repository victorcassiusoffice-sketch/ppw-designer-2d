/**
 * The dev server and the headless browser the engine measures in. Every request the page makes
 * is same-origin GET/HEAD or it is blocked; nothing is written anywhere by the page.
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT } from './paths.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startDevServer({ port = 5178, timeoutMs = 180000, log = () => {} } = {}) {
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1', '--clearScreen', 'false'], {
    cwd: ROOT,
    env: { ...process.env, BROWSER: 'none', PPW_PRODUCT_ENGINE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  const started = Date.now();
  let ready = false;
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`vite exited (${child.exitCode}): ${output.slice(-1200)}`);
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { ready = true; break; }
    } catch { /* not up yet */ }
    await sleep(500);
  }
  if (!ready) { stopProcess(child); throw new Error(`vite did not answer on ${base} within ${timeoutMs / 1000} s: ${output.slice(-800)}`); }
  log(`dev server ${base}`);
  return { base, stop: () => stopProcess(child), output: () => output };
}

function stopProcess(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else child.kill('SIGTERM');
}

/**
 * A headless Chromium on software GL (the same flags the e2e suite uses), one page on the dev
 * server, same-origin reads only. `gpu: 'd3d11'` uses the laptop's GPU instead.
 */
export async function openBrowser(base, { gpu = 'swiftshader' } = {}) {
  const args = gpu === 'd3d11' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await chromium.launch({ headless: true, args });
  const origin = base ? new URL(base).origin : null;
  const errors = [];
  const blocked = [];
  async function newPage(viewport = { width: 1280, height: 900 }) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    if (!origin) return page;
    await page.route('**/*', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== origin || !['GET', 'HEAD'].includes(req.method())) { blocked.push(`${req.method()} ${url.href}`); return route.abort(); }
      if (url.pathname === '/__engine.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>product engine</title><body></body>' });
      return route.continue();
    });
    return page;
  }
  const page = await newPage();
  if (origin) await page.goto(`${base}/__engine.html`, { waitUntil: 'load' });
  return { browser, page, newPage, errors, blocked, close: () => browser.close() };
}

export function measureProduct(page, args) {
  return page.evaluate(async (a) => {
    const m = await import('/scripts/product-engine/page/engine-page.js');
    return m.measureProduct(a);
  }, args);
}

export function measureCharacter(page, args) {
  return page.evaluate(async (a) => {
    const m = await import('/scripts/product-engine/page/engine-page.js');
    return m.measureCharacter(a);
  }, args);
}

/** An HTML sheet to a PNG: fonts, layout and labels come from the browser, not from a raster library. */
export async function renderHtml(browserHandle, html, outPng, { width = 1600 } = {}) {
  const page = await browserHandle.browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.route('**/*', (route) => (route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: outPng, fullPage: true });
  } finally {
    await page.close();
  }
}
