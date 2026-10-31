// World measurement harness: browser helpers shared by every script in this folder.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { TARGETS, BASE_COMMIT, LABEL, OUTPUT, PIN_IP, acquireRun } from './run-config.mjs';
export { TARGETS, BASE_COMMIT, LABEL, OUTPUT, PIN_IP };
const require = createRequire(import.meta.url);
let playwright;
/** WORLD_PLAYWRIGHT=studio selects the ppw-tutorial-studio Playwright (the browser GPT's rounds used); default = this repo's. */
const studio = () => createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-tutorial-studio/package.json')('playwright');
if (process.env.WORLD_PLAYWRIGHT === 'studio') playwright = studio();
else { try { playwright = require('playwright'); } catch { playwright = studio(); } }
export const { chromium } = playwright;
export const PLAYWRIGHT_VERSION = (() => { try { return (process.env.WORLD_PLAYWRIGHT === 'studio' ? createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-tutorial-studio/package.json') : require)('playwright/package.json').version; } catch { return 'unknown'; } })();
export const BROWSER_EXECUTABLE = chromium.executablePath();
export const OUT = OUTPUT + path.sep;
mkdirSync(OUTPUT, { recursive: true });
export const PIN = Object.values(TARGETS).filter(u => u.startsWith('https:')).map(u => `MAP ${new URL(u).hostname} ${PIN_IP}`).join(',');
export const DEVICES = { desktop: { viewport: { width: 1280, height: 800 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } };
export function launch(extraArgs = []) {
  acquireRun('browser');
  return chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--host-resolver-rules=${PIN}`, ...extraArgs] });
}
/** Fresh context: coach mark dismissed, every non-read request blocked and counted. */
export async function newCtx(browser, device, options = {}) {
  const context = await browser.newContext({ ...DEVICES[device], ...options }), log = { blockedWrites: [] };
  await context.route('**/*', route => { const r = route.request(); if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) { log.blockedWrites.push({ method: r.method(), url: r.url() }); return route.abort('blockedbyclient'); } return route.continue(); });
  await context.addInitScript(() => { localStorage.setItem('ppw_designer_coach_v1', '1'); });
  return { context, log };
}
export function watch(page, row) {
  row.pageErrors = []; row.consoleErrors = []; row.httpErrors = [];
  page.on('pageerror', e => row.pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') row.consoleErrors.push(m.text().slice(0, 500)); });
  page.on('response', r => { if (r.status() >= 400) row.httpErrors.push({ status: r.status(), url: r.url() }); });
}
const ownedFiles = new Set();
/** Each result file is written by one experiment; an earlier experiment is never overwritten. */
export function save(name, data) {
  const destination = path.join(OUTPUT, name);
  if (!ownedFiles.has(destination) && existsSync(destination)) throw Error('Refusing to overwrite a previous experiment: ' + destination);
  ownedFiles.add(destination); writeFileSync(destination, JSON.stringify(data, null, 2) + '\n');
}
export const wait3d = async page => { await page.waitForFunction(() => Number(document.querySelector('[data-testid="wallpaint-3d-gl"]')?.getAttribute('data-first-picture-ms')) > 0, {}, { timeout: 90000 }); };
/** Separate Node HTTPS connection: health verification never warms the measured Chromium profile. */
export function health(target) {
  const base = TARGETS[target];
  if (!base.startsWith('https:')) return Promise.resolve({ at: new Date().toISOString(), target, url: base, status: null, body: { env: 'local', commit: null }, note: 'local server: no healthcheck function' });
  const url = new URL('/api/healthcheck', base);
  return new Promise((resolve, reject) => {
    const request = https.get(url, { lookup: (_host, options, callback) => options.all ? callback(null, [{ address: PIN_IP, family: 4 }]) : callback(null, PIN_IP, 4) }, response => {
      let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => {
        try { resolve({ at: new Date().toISOString(), target, url: url.href, status: response.statusCode, body: JSON.parse(body) }); }
        catch { reject(Error('Health response was not JSON: ' + target + ' ' + response.statusCode)); }
      });
    });
    request.setTimeout(30000, () => request.destroy(Error('Health request timed out: ' + target)));
    request.on('error', reject);
  });
}
/** Window-capture recorder for touch, pointer, mouse and click events; the harness reads window.__tapRecord. */
export function installTapRecorder(context) {
  return context.addInitScript(() => {
    const record = window.__tapRecord = { events: [], maxTouches: 0 };
    const identities = new WeakMap(); let next = 1;
    const describe = node => {
      if (!(node instanceof Element)) return null;
      if (!identities.has(node)) identities.set(node, next++);
      return { nodeId: identities.get(node), connected: node.isConnected, tag: node.tagName, className: node.getAttribute('class'), text: node.closest('button')?.textContent?.trim().slice(0, 80) ?? null };
    };
    window.__tapDescribe = describe;
    const push = (event, fields) => {
      const value = { type: event.type, eventAt: event.timeStamp, listenerAt: performance.now(), trusted: event.isTrusted, cancelable: event.cancelable, defaultPrevented: event.defaultPrevented, target: describe(event.target), ...fields };
      record.events.push(value);
      queueMicrotask(() => { value.afterDispatchDefaultPrevented = event.defaultPrevented; });
    };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) window.addEventListener(type, event => {
      record.maxTouches = Math.max(record.maxTouches, event.touches.length);
      push(event, { touches: [...event.touches].map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY })) });
    }, { capture: true, passive: true });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) window.addEventListener(type, event => {
      push(event, { pointerId: event.pointerId, pointerType: event.pointerType, isPrimary: event.isPrimary, x: event.clientX, y: event.clientY, captureAtTarget: event.target instanceof Element ? event.target.hasPointerCapture(event.pointerId) : null });
    }, { capture: true, passive: true });
    for (const type of ['mousedown', 'mouseup', 'mousemove', 'click', 'contextmenu']) window.addEventListener(type, event => {
      push(event, { pointerType: event.pointerType ?? null, buttons: event.buttons, detail: event.detail, x: event.clientX, y: event.clientY });
    }, { capture: true, passive: true });
  });
}
