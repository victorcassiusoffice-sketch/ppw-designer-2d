/**
 * Renders the Room Designer one-pager (email attachment) from the template
 * in the session scratchpad: inlines the pitch-page captures as data URIs,
 * writes the self-contained HTML + an A4 PDF via Chromium, then checks the
 * PDF is one page and carries no PPW prices (outreach-email-spec).
 *
 *   node tools/one-pager-2026-09-07.mjs <template.html> <imgDir> <outDir>
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const [template, imgDir, outDir] = process.argv.slice(2);
if (!template || !imgDir || !outDir) throw new Error('usage: template imgDir outDir');
mkdirSync(outDir, { recursive: true });

const mime = (f) => (f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
let html = readFileSync(template, 'utf8');
const used = [];
html = html.replace(/\{\{img:([^}]+)\}\}/g, (_, name) => {
  const p = join(imgDir, name);
  used.push(`${name} ${statSync(p).size} B`);
  return `data:${mime(name)};base64,${readFileSync(p).toString('base64')}`;
});
const htmlPath = join(outDir, 'ROOM-DESIGNER-ONE-PAGER-2026-09-07.html');
writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const pdfPath = join(outDir, 'ROOM-DESIGNER-ONE-PAGER-2026-09-07.pdf');
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
// Proof frame at print width.
await page.setViewportSize({ width: 794, height: 1123 });
await page.screenshot({ path: join(outDir, 'one-pager-proof.png'), fullPage: true });
const overflow = await page.evaluate(() => ({ bodyH: document.body.scrollHeight, pageH: document.querySelector('.page').getBoundingClientRect().height }));
await browser.close();

const pdf = readFileSync(pdfPath);
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const text = html.replace(/<style[\s\S]*?<\/style>/, '').replace(/data:[^"]+/g, '');
const ppwPrices = (text.match(/Rs\s?\d[\d,]*/g) || []).filter((m) => !['Rs 1,520', 'Rs 59,200'].includes(m));
console.log(JSON.stringify({ htmlPath, pdfPath, htmlBytes: statSync(htmlPath).size, pdfBytes: pdf.length, pdfPages: pages, overflow, imagesInlined: used, priceMentionsOutsideWorkedExamples: ppwPrices, nameRegister: /Victor Cassius Bhatoolaul/.test(text) && !/\bVic\b/.test(text) }, null, 1));
