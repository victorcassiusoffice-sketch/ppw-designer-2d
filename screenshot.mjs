// PPW screenshot capture helper — canonical for CLAUDE-frontend.md workflow
// Authored: 2026-05-21 (Mammoth Upgrade P1.3)
// Drop into repo root. Usage: `node screenshot.mjs <url> [label]`
// Auto-increments to ./temporary screenshots/screenshot-N[-label].png

import puppeteer from 'puppeteer';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = 'temporary screenshots';
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2 };

async function nextIndex(dir) {
  try {
    const files = await readdir(dir);
    const nums = files
      .map(f => f.match(/^screenshot-(\d+)/))
      .filter(Boolean)
      .map(m => Number(m[1]));
    return (nums.length ? Math.max(...nums) : 0) + 1;
  } catch {
    return 1;
  }
}

(async () => {
  const url = process.argv[2];
  const label = process.argv[3];
  const isMobile = process.argv.includes('--mobile');
  if (!url) {
    console.error('Usage: node screenshot.mjs <url> [label] [--mobile]');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const idx = await nextIndex(OUT_DIR);
  const suffix = label ? `-${label}` : '';
  const filename = `screenshot-${idx}${suffix}${isMobile ? '-mobile' : ''}.png`;
  const filepath = join(OUT_DIR, filename);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport(isMobile ? MOBILE : VIEWPORT);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 600)); // brief settle for animations / fonts
  await page.screenshot({ path: filepath, fullPage: true });
  await browser.close();

  console.log(`Captured: ${filepath}`);
})();
