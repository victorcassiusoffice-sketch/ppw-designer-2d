/**
 * Fresh-eyes probe of the wall-drawing journey (Vic 2026-09-08: "the wall
 * draw feature doesn't work properly, it needs to be user friendly; don't
 * give the option at the beginning to select draw or the sample room, just
 * straight to draw").
 *
 * Walks a FIRST-TIME customer through: open the designer → whatever the app
 * shows → draw a rectangle → what it takes to finish it. Records the screen
 * and the persisted store after every step so the report is behavioural, not
 * a reading of the code.
 *
 *   node tools/wall-tool-ux-probe-2026-09-08.mjs <base> <outDir> [phone]
 */
import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const [base, outDir, mode = 'desktop'] = process.argv.slice(2);
if (!base || !outDir) throw new Error('usage: base outDir [phone]');
fs.mkdirSync(outDir, { recursive: true });
const phone = mode === 'phone';

const browser = await chromium.launch();
const ctx = await browser.newContext(
  phone ? { ...devices['iPhone 12'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1366, height: 800 } },
);
const page = await ctx.newPage();
const log = [];
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push('console: ' + t.slice(0, 160));
  if (/\[draw-mode\]|\[draw-close\]|\[wall-draw\]/.test(t)) log.push(t.slice(0, 200));
});

await page.addInitScript(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
});

const steps = [];
async function snap(name, note) {
  const file = path.join(outDir, `${mode}-${String(steps.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  const state = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const txt = (sel) => q(sel)?.textContent?.trim().slice(0, 200) ?? null;
    let store = null;
    try {
      const raw = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}');
      const p = raw.state?.property;
      store = p ? { rooms: (p.rooms || []).map((r) => ({ id: r.id, pts: (r.polygon || []).length })), walls: (p.walls || []).length } : null;
    } catch {}
    return {
      startPrompt: !!q('[data-testid="start-room-prompt"]'),
      startButtons: [...document.querySelectorAll('[data-testid^="start-"]')].map((e) => e.dataset.testid),
      drawHud: !!q('[data-testid="room-draw-hud"]'),
      hudText: txt('[data-testid="room-draw-hud"]'),
      hudButtons: [...document.querySelectorAll('[data-testid="room-draw-hud"] button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
      wallToggleOn: q('[data-testid="wall-tool-toggle"]')?.getAttribute('aria-pressed') ?? null,
      coach: !!q('[data-testid="coach-mark"], [data-testid="coachmark"]'),
      itemsPlaced: txt('[data-testid="items-placed"]'),
      store,
    };
  });
  steps.push({ step: steps.length + 1, name, note, file: path.basename(file), ...state });
  return state;
}

await page.goto(base + '/designer', { waitUntil: 'networkidle' });
await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
await page.waitForTimeout(1200);
await snap('landing', 'what a first-time customer sees');

// Dismiss a coach mark if one is in the way (a real user would).
for (const label of [/got it/i, /start/i, /skip/i, /close/i]) {
  const b = page.getByRole('button', { name: label }).first();
  if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(300); break; }
}

// If the start prompt is still up, take the "Draw walls" route (the honest one).
const drawBtn = page.locator('[data-testid="start-draw-room"]');
if (await drawBtn.isVisible().catch(() => false)) {
  await drawBtn.click();
  await page.waitForTimeout(600);
  await snap('after-draw-walls-button', 'clicked "Draw walls" on the start card');
}

// Where is the canvas, and is the pen actually armed?
const box = await page.locator('.konvajs-content').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const S = phone ? 60 : 110; // px per side of the test rectangle

async function clickAt(dx, dy, label) {
  await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
  await page.waitForTimeout(120);
  await page.mouse.click(cx + dx, cy + dy);
  await page.waitForTimeout(450);
  return snap(label, `click at (${dx},${dy}) from canvas centre`);
}

await clickAt(-S, -S, 'point-1');
await clickAt(S, -S, 'point-2');
await clickAt(S, S, 'point-3');
await clickAt(-S, S, 'point-4');
// Close by clicking the first point again — the HUD's own instruction.
await clickAt(-S, -S, 'point-5-close-on-first');

const afterClose = await snap('after-close-attempt', 'did clicking the first point commit a room?');
if (!afterClose.store?.rooms?.length) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await snap('after-enter', 'fallback: pressed Enter');
}

console.log(JSON.stringify({ mode, base, steps, drawLog: log.slice(-25), errors: errors.slice(0, 10) }, null, 1));
await browser.close();
