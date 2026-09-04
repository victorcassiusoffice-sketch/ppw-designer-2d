/**
 * scripts/scrape-energy-specs.ts (eco / solar 2026-09-04) — read the
 * electrical figures off merchant product pages.
 *
 * Vic: "when a person adds something electronic it calculates the output of
 * the electric device (where information should be on the merchant's
 * product page)". Same posture as `fetch-real-images.mjs`: dev tooling, run
 * by hand, re-runnable, never part of the build, no key needed. For each
 * URL it fetches the page, strips it to text and runs
 * `src/lib/energySpecs.ts` — the SAME parser the API / form use — then
 * prints one JSON line per URL with the values AND the page snippets they
 * came from, so a human checks the merchant page before a number ships.
 *
 * Usage:
 *   npx tsx scripts/scrape-energy-specs.ts <url> [<url> ...]
 *   npx tsx scripts/scrape-energy-specs.ts --json urls.json      # ["https://…", …]
 *   npx tsx scripts/scrape-energy-specs.ts --seed                # every products.json source_url
 *
 * Output: NDJSON on stdout — { url, ok, powerW, pvWp, batteryWh, inverterW,
 * evidence[] }. Pipe to a file and apply by hand to products.json
 * (`power_w` / `pv_wp` / `battery_kwh` / `inverter_kw`) or the merchant
 * form. Nothing is written automatically.
 */
import { readFileSync } from 'node:fs';
import { extractEnergySpecs } from '../src/lib/energySpecs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PPW-Designer-energy-scrape';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  // 2 MB is plenty for a product page; guards against a runaway download.
  return body.length > 2_000_000 ? body.slice(0, 2_000_000) : body;
}

function urlsFromArgs(argv: string[]): string[] {
  if (argv[0] === '--json' && argv[1]) {
    const arr = JSON.parse(readFileSync(argv[1], 'utf8')) as unknown;
    if (!Array.isArray(arr)) throw new Error('--json file must hold an array of URLs');
    return arr.map(String);
  }
  if (argv[0] === '--seed') {
    const seed = JSON.parse(readFileSync('src/data/products.json', 'utf8')) as { products: Array<{ source_url?: string }> };
    return Array.from(new Set(seed.products.map((p) => p.source_url).filter((u): u is string => !!u && /^https?:/.test(u))));
  }
  return argv.filter((a) => /^https?:\/\//.test(a));
}

async function main(): Promise<void> {
  const urls = urlsFromArgs(process.argv.slice(2));
  if (urls.length === 0) {
    console.error('usage: npx tsx scripts/scrape-energy-specs.ts <url> [...] | --json urls.json | --seed');
    process.exit(2);
  }
  let failures = 0;
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const specs = extractEnergySpecs(html);
      console.log(JSON.stringify({ url, ok: true, ...specs }));
    } catch (err) {
      failures += 1;
      console.log(JSON.stringify({ url, ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }
  process.exit(failures === urls.length ? 1 : 0);
}

main();
