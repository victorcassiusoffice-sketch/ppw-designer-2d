import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch();
for (const [name, w, h, mob] of [['desktop', 1366, 900, false], ['phone', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
  await p.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 600)); window.scrollTo(0, 0); });
  await p.waitForTimeout(500);

  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const amtLefts = await p.evaluate(() => [...document.querySelectorAll('.ratecard .amt')].map(e => Math.round(e.getBoundingClientRect().left)));
  const priceOffsets = await p.evaluate(() => [...document.querySelectorAll('#pricing .tier .setup')].map(e => Math.round(e.getBoundingClientRect().top - e.closest('.tier').getBoundingClientRect().top)));
  const smallTargets = await p.evaluate(() => [...document.querySelectorAll('a,button,label,select,input')].map(e => { const r = e.getBoundingClientRect(); return { t: e.tagName, c: (e.className || '').toString().slice(0, 18), h: Math.round(r.height), w: Math.round(r.width) }; }).filter(x => x.h > 0 && x.h < 44 && x.w > 40));
  const pdfLink = await p.evaluate(() => [...document.querySelectorAll('a')].filter(a => a.href.includes('one-pager')).map(a => a.textContent.trim()));

  // the anchor test: click the page's own demo link and measure how much the header covers
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('a[href="#video"]').first().click();
  await p.waitForTimeout(1200);
  const anchor = await p.evaluate(() => {
    const hd = document.querySelector('header.site').getBoundingClientRect();
    const v = document.querySelector('#video').getBoundingClientRect();
    return { hidden: Math.max(0, Math.round(hd.bottom - v.top)), videoH: Math.round(v.height) };
  });

  console.log(`${name.padEnd(8)} overflow=${overflow}  consoleErrors=${errs.length}  cardPriceOffsets=[${priceOffsets}]`);
  console.log(`         rateCardAmountLefts=[${amtLefts}]  (all equal = aligned)`);
  console.log(`         videoHiddenUnderHeader=${anchor.hidden}px of ${anchor.videoH}px`);
  console.log(`         subminTapTargets=${smallTargets.length} ${JSON.stringify(smallTargets.slice(0, 4))}`);
  console.log(`         onePagerLink=${JSON.stringify(pdfLink)}`);
  if (errs.length) console.log('         ERRORS', errs);
  await ctx.close();
}
await b.close();
