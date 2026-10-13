/**
 * Price-free, name-free public demo (row D6-DESIGNER-DEMO-CLEAN-1013,
 * 2026-10-13). /demo is the live demo inside every outreach deck, so a
 * visitor must not meet a price, a currency or a retailer/client name —
 * on first load or after any tap.
 *
 * The price chips are switched off where they render (`isPitchEmbed()`).
 * This module is the safety net for everything else: product, paint and
 * supplier names arrive from the bundled catalogs AND the merchants API, and
 * reach tooltips, aria labels, swatch titles and panel copy. On /demo only,
 * a MutationObserver rewrites every text node and label attribute through
 * `scrubDemoText`. React never reads text back from the DOM, so rewriting a
 * text node it owns is safe; when React writes it again the observer
 * rewrites it again (the scrub is idempotent).
 *
 * /designer, /designer?demo=<slug>, /studio and the pitch pages are untouched.
 */

/** Clients and prospects named in the bundled demos. */
const CLIENTS = ['Spa Concept', 'Cap Tamarin', 'Trimetys', 'Kalachand Fitness', 'J ?Kalachand', 'Kalachand', 'UBP', 'Espace Maison'];

/**
 * Retailers, distributors and suppliers in the bundled catalogs and source
 * notes (src/data, src/demo, public/data). `demoScrub.test.ts` reads those
 * files and fails when a new supplier name is not covered here.
 */
const SUPPLIERS = [
  'Courts Mammouth', 'Courts', 'K1[- ]?Sport', 'K1', 'Emcar', 'Duraco(?: Lt[ée]e| Mauritius)?', 'Grewals', 'Gamma Materials',
  'Resiglas', 'Mr\\.? Bricolage(?: Mauritius)?', 'Kolos Cement', 'HPL(?: Pipes| Mauritius)?', 'Electrical\\.mu', 'Profilage Oc[ée]an Indien',
  'Joonas Steel', 'STR(?: Marketing(?: Mauritius)?)?', 'Victron Energy distributor',
  'Premix(?: Mauritius)?', 'Paving Mauritius', 'Metalite(?: Mauritius)?', 'Reneworld(?: Mauritius)?',
  'Solarex(?: Mauritius)?', 'Sofo Soler Moris', 'QBM(?: Mauritius)?', 'CMH(?: Mauritius)?',
  'Legrand(?: Mauritius)?', 'Medine Garden Cent(?:er|re)', 'Endemika(?: Mauritius)?',
];

const anyOf = (names: readonly string[]) => new RegExp(`(?<![\\w-])(?:${names.join('|')})(?![\\w-])`, 'gi');

/** Retailer and client names → neutral words. Order matters: phrases first. */
const NAME_RULES: ReadonlyArray<readonly [RegExp, string | ((m: string) => string)]> = [
  [/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.mu\b\S*/gi, ''],
  [/\bnot (?:a real )?Spa Concept(?: product)?\b/gi, (m) => `${m[0]}ot a real product`],
  [/\bPermoglaze \(Sofap\)/gi, 'Paint range A'],
  [/\bSofap\b(?:'s)?/gi, 'Paint range A'],
  [/\bTintEX\b(?:'s)?/gi, 'Paint range B'],
  [/\bMauvilac\b(?:'s)?/gi, 'Paint range C'],
  [/\bPolytol(?: Paints)?\b(?:'s)?/gi, 'Paint range D'],
  [/\bPermoglaze\b\s?/gi, ''],
  [anyOf(CLIENTS), 'a client'],
  [anyOf(SUPPLIERS), 'a local supplier'],
];

/** "· Rs 1,234", "Rs 12.5k", "$1,299", "1,299 MUR", "· VAT included" → gone. */
const PRICE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\s*[·—–-]?\s*(?:\bRs\.?|\bMUR|\bUSD|\bEUR|\bGBP|[$€£])\s?\d(?:(?:[,.]|\s(?=\d))?\d)*(?:k\b)?(?:\s?(?:\/|per)\s?[a-z²]+)?/gi, ''],
  [/\s*[·—–-]?\s*\d(?:[,.]?\d)*\s?(?:MUR|USD|EUR|GBP)\b(?:\s?(?:\/|per)\s?[a-z²]+)?/g, ''],
  [/\s*[·—–-]?\s*\(?(?:prices? )?(?:incl\.?|including|VAT included|excl\.?)\s*(?:15\s?%\s*)?VAT\)?\.?/gi, ''],
  [/\s*[·—–-]?\s*VAT included\.?/gi, ''],
  // An aside about tax or stock on a price note: "(VAT not stated; out of stock that day)".
  [/\s*\([^()]*\bVAT\b[^()]*\)/gi, ''],
  [/[^.;()]*\bVAT\b[^.;()]*[.;]?/gi, ''],
  // What a removed "Rs 12,075 on emcar.mu 2026-09-04" leaves behind.
  [/(^|[.;]\s*)on\s+\d{4}-\d{2}-\d{2}\s*[.;]?\s*/g, '$1'],
  [/\bRs\b|\bMUR\b/g, ''],
];

/** Pure: the demo-safe form of `text`. Idempotent. */
export function scrubDemoText(text: string): string {
  let out = text;
  // (Narrowed per branch: `replace` has no overload for the union.)
  for (const [re, to] of NAME_RULES) out = typeof to === 'string' ? out.replace(re, to) : out.replace(re, to);
  for (const [re, to] of PRICE_RULES) out = out.replace(re, to);
  if (out === text) return text;
  // Tidy what a removal leaves behind: doubled separators, dangling " · ".
  return out
    .replace(/\s*·\s*(?:·\s*)+/g, ' · ')
    .replace(/^\s*[·—–]\s*|\s*[·—–:]\s*$/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/\ba a\b/gi, 'a')
    .replace(/\b(a local supplier|a client)(?: \(\1\)| \1)+/gi, '$1');
}

const ATTRIBUTES = ['title', 'aria-label', 'alt', 'placeholder', 'aria-description', 'aria-valuetext'] as const;

function scrubNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) return;
    const value = node.nodeValue ?? '';
    const next = scrubDemoText(value);
    if (next !== value) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  for (const name of ATTRIBUTES) {
    const value = el.getAttribute(name);
    if (value == null) continue;
    const next = scrubDemoText(value);
    if (next !== value) el.setAttribute(name, next);
  }
  for (let child = el.firstChild; child; child = child.nextSibling) scrubNode(child);
}

/** Scrub `root` now and keep scrubbing it. Returns the stop function. */
export function startDemoScrub(root: Node = document.body): () => void {
  scrubNode(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') scrubNode(record.target);
      else if (record.type === 'attributes') scrubNode(record.target);
      else record.addedNodes.forEach(scrubNode);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
  const previousTitle = document.title;
  document.title = scrubDemoText(document.title);
  return () => { observer.disconnect(); if (document.title !== previousTitle) document.title = previousTitle; };
}
