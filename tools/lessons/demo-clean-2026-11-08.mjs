// Shared by the lesson recorders (clips, inventory, proof, quest video).
// The clips play inside the lesson cards everywhere, the public /demo
// included, and /demo shows no price, currency or retailer name (row
// D6-DESIGNER-DEMO-CLEAN-1013). So every recording opens the designer the way
// /demo shows it: price-free through the app's own `?pitch=1` switch, and
// name-free through the /demo scrubber (`src/demo/demoScrub.ts`), loaded from
// the dev server. A recording only shows what /demo already shows.
// `dirtyText` reads what a visitor can read (text and labels) and returns any
// price or retailer name left, so a dirty recording is caught, not shipped.
// Needs the Vite dev server (it serves `/src/...` modules).

/** The designer as /demo shows it, on an empty plan. */
export const CLEAN_DESIGNER = '/designer?pitch=1';

/** Start the /demo scrubber in every page of `ctx`, as early as the body exists. */
export async function cleanContext(ctx) {
  await ctx.addInitScript(() => {
    const start = () => {
      import('/src/demo/demoScrub.ts')
        .then((m) => {
          m.startDemoScrub(document.body);
          document.documentElement.dataset.lessonsDemoClean = '1';
        })
        .catch((error) => console.error('demo scrub did not start', error));
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
  });
}

/** Wait until the scrubber runs on this page. */
export async function waitClean(page) {
  await page.waitForFunction(() => document.documentElement.dataset.lessonsDemoClean === '1', null, { timeout: 20000 });
}

// What /demo must never show. "K1-…" product codes stay on /demo itself (the
// scrubber leaves a name joined to a code), so only the shop names are listed.
const PRICE = String.raw`(?:\bRs\.?\s?\d|\bMUR\b|\bUSD\b|\bEUR\b|\bGBP\b|[$€£]\s?\d|\d\s?(?:MUR|USD|EUR|GBP)\b|\bVAT\b)`;
const NAMES = String.raw`\b(?:Sofap|TintEX|Mauvilac|Polytol|Permoglaze|Courts|K1[- ]Sport|Emcar|Duraco|Grewals|Gamma Materials|Spa Concept|Cap Tamarin|Trimetys|Kalachand|Espace Maison)\b`;

/** Every visible text or label on the page that shows a price or a retailer or client name. */
export async function dirtyText(page) {
  return page.evaluate(
    ([priceSource, namesSource]) => {
      const price = new RegExp(priceSource);
      const names = new RegExp(namesSource, 'i');
      const hits = new Set();
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
      };
      const check = (text) => {
        if (!text) return;
        const t = text.replace(/\s+/g, ' ').trim();
        if (t && (price.test(t) || names.test(t))) hits.add(t.slice(0, 120));
      };
      for (const el of document.body.querySelectorAll('*')) {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || !visible(el)) continue;
        for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) check(node.nodeValue);
        for (const name of ['title', 'aria-label', 'alt', 'placeholder']) check(el.getAttribute(name));
      }
      return [...hits];
    },
    [PRICE, NAMES],
  );
}
