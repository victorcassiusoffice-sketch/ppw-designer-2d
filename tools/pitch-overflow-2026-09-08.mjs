import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
const wide = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      out.push({ tag: el.tagName, cls: el.className.toString().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50) });
    }
  }
  return out.slice(0, 12);
});
console.log('console errors:', JSON.stringify(errs));
console.table(wide);
await b.close();
