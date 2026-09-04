/**
 * energySpecs — pull the electrical figures off a merchant's product page
 * (eco / solar 2026-09-04).
 *
 * Vic: "when a person adds something electronic it calculates the output of
 * the electric device (where information should be on the merchant's
 * product page)". The merchant scrape (`scripts/scrape-energy-specs.ts`,
 * same posture as `fetch-real-images.mjs`) hands this the page text and
 * gets back the watts to store on the product row / seed:
 *
 *   powerW     — rated DRAW of an appliance ("1.5 kW motor", "750 W")
 *   pvWp       — PV module rating ("450 Wp", "Rated power (Pmax) 455 W")
 *   batteryWh  — storage ("5 kWh", "48 V 100 Ah" → 4800 Wh)
 *   inverterW  — inverter AC output ("5 kW hybrid inverter", "3000 VA")
 *
 * Context-scored: the same "450 W" means a panel on a LONGi page and a
 * heater on a sauna page, so each candidate is weighed by the words around
 * it. Every accepted value carries the snippet it came from (`evidence`) so
 * a human can check the merchant page before trusting it. Pure text — no
 * DOM, no fetch — so it runs in Node scripts, the API and the browser.
 */

export interface EnergySpecs {
  powerW?: number;
  pvWp?: number;
  batteryWh?: number;
  inverterW?: number;
  /** Which snippets each value came from, in the order they were accepted. */
  evidence: string[];
}

/** Strip HTML to text: scripts/styles gone, tags → spaces, entities decoded, whitespace collapsed. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|td|th|h[1-6]|dt|dd)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function num(s: string): number {
  return Number(s.replace(',', '.').replace(/\s/g, ''));
}

function window(text: string, index: number, before = 60, after = 60): string {
  return text.slice(Math.max(0, index - before), Math.min(text.length, index + after));
}

interface Candidate {
  value: number;
  score: number;
  snippet: string;
}

const PANEL_WORDS = /\b(panel|module|solar|photovoltaic|pv|mono|monocrystalline|perc|topcon|bifacial|half[- ]cut|hi-?mo|deepblue|pmax|maximum power|rated power|nominal power|stc)\b/i;
const BATTERY_WORDS = /\b(battery|batteries|storage|lifepo4|lithium|luna|pylontech|powerwall|capacity|usable energy)\b/i;
const INVERTER_WORDS = /\b(inverter|hybrid|multiplus|sun2000|charger|ac output|rated output|output power|nominal output|max\.? output)\b/i;
const APPLIANCE_WORDS = /\b(motor|power|rated|input|consumption|wattage|watts|heater|element|compressor|chiller|drive|continuous duty|chp|hp|voltage|amps?|plug|mains|electrical)\b/i;
/** A "3 kW system / kit / array" is a PV system size, not an appliance. */
const KIT_WORDS = /\b(system|kit|array|installation)\b/i;

/** Highest score wins, then the larger figure; nothing at or below zero is ever picked. */
function pick(cands: Candidate[]): Candidate | null {
  const live = cands.filter((c) => c.score > 0);
  if (live.length === 0) return null;
  return [...live].sort((a, b) => b.score - a.score || b.value - a.value)[0];
}

/** Extract the electrical figures from plain page text (or HTML — it is stripped first). */
export function extractEnergySpecs(input: string): EnergySpecs {
  const text = /<[a-z][\s\S]*>/i.test(input) ? htmlToText(input) : input;
  const out: EnergySpecs = { evidence: [] };

  const panel: Candidate[] = [];
  const battery: Candidate[] = [];
  const inverter: Candidate[] = [];
  const appliance: Candidate[] = [];

  // ---- kWh / Wh / V×Ah → battery ------------------------------------------
  for (const m of text.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s?kWh\b/gi)) {
    const wh = num(m[1]) * 1000;
    const ctx = window(text, m.index ?? 0);
    // "generates 6 kWh per day" is a yield, not a battery.
    const yieldish = /\b(per day|daily|per year|annual|yield|generat|produc|save)/i.test(ctx);
    const score = (BATTERY_WORDS.test(ctx) ? 3 : 1) - (yieldish ? 4 : 0);
    if (wh >= 500 && wh <= 200_000) battery.push({ value: wh, score, snippet: ctx.trim() });
  }
  for (const m of text.matchAll(/(\d{3,6})\s?Wh\b/gi)) {
    const wh = num(m[1]);
    const ctx = window(text, m.index ?? 0);
    const score = BATTERY_WORDS.test(ctx) ? 3 : 1;
    if (wh >= 500 && wh <= 200_000) battery.push({ value: wh, score, snippet: ctx.trim() });
  }
  for (const m of text.matchAll(/(\d{1,3})\s?V\b[^.\n]{0,25}?(\d{1,4})\s?Ah\b/gi)) {
    const wh = num(m[1]) * num(m[2]);
    const ctx = window(text, m.index ?? 0);
    if (wh >= 500 && wh <= 200_000) battery.push({ value: wh, score: 2 + (BATTERY_WORDS.test(ctx) ? 2 : 0), snippet: ctx.trim() });
  }

  // ---- Wp / "W" with panel context → pv ------------------------------------
  for (const m of text.matchAll(/(\d{2,4})\s?(?:Wp|W(?:att)?s?[- ]?peak)\b/gi)) {
    const wp = num(m[1]);
    const ctx = window(text, m.index ?? 0);
    if (wp >= 50 && wp <= 1000) panel.push({ value: wp, score: 5 + (PANEL_WORDS.test(ctx) ? 2 : 0), snippet: ctx.trim() });
  }

  // ---- kW (inverter or big appliance) ---------------------------------------
  for (const m of text.matchAll(/(\d{1,2}(?:[.,]\d{1,2})?)\s?kW\b(?!h)/gi)) {
    const w = num(m[1]) * 1000;
    const ctx = window(text, m.index ?? 0);
    if (w < 100 || w > 100_000) continue;
    if (INVERTER_WORDS.test(ctx)) inverter.push({ value: w, score: 3, snippet: ctx.trim() });
    if (PANEL_WORDS.test(ctx) && !INVERTER_WORDS.test(ctx) && w <= 1000) panel.push({ value: w, score: 2, snippet: ctx.trim() });
    if (!INVERTER_WORDS.test(ctx) && !PANEL_WORDS.test(ctx) && !KIT_WORDS.test(ctx)) {
      // A kW figure is deliberate — it outranks a plain W and any hp guess.
      appliance.push({ value: w, score: 3 + (APPLIANCE_WORDS.test(ctx) ? 1 : 0), snippet: ctx.trim() });
    }
  }
  // ---- VA (inverters quote apparent power) ----------------------------------
  for (const m of text.matchAll(/(\d{3,5})\s?VA\b/gi)) {
    const w = num(m[1]);
    const ctx = window(text, m.index ?? 0);
    if (w >= 300 && w <= 50_000) inverter.push({ value: w, score: 2 + (INVERTER_WORDS.test(ctx) ? 2 : 0), snippet: ctx.trim() });
  }
  for (const m of text.matchAll(/(\d{1,2}(?:[.,]\d{1,2})?)\s?kVA\b/gi)) {
    const w = num(m[1]) * 1000;
    const ctx = window(text, m.index ?? 0);
    if (w >= 300 && w <= 50_000) inverter.push({ value: w, score: 2 + (INVERTER_WORDS.test(ctx) ? 2 : 0), snippet: ctx.trim() });
  }

  // ---- plain W ---------------------------------------------------------------
  for (const m of text.matchAll(/(\d{1,5})\s?W\b(?!h|p)/gi)) {
    const w = num(m[1]);
    const ctx = window(text, m.index ?? 0);
    if (w < 3 || w > 50_000) continue;
    const isPanel = PANEL_WORDS.test(ctx);
    const isInverter = INVERTER_WORDS.test(ctx);
    if (isPanel && w >= 50 && w <= 1000) panel.push({ value: w, score: 3, snippet: ctx.trim() });
    if (isInverter && w >= 300) inverter.push({ value: w, score: 2, snippet: ctx.trim() });
    if (!isPanel && !isInverter && !KIT_WORDS.test(ctx)) {
      appliance.push({ value: w, score: 2 + (APPLIANCE_WORDS.test(ctx) ? 1 : 0), snippet: ctx.trim() });
    }
  }
  // ---- horsepower (treadmill motors) → watts ----------------------------------
  for (const m of text.matchAll(/(\d{1,2}(?:[.,]\d{1,2})?)\s?(?:CHP|HP)\b/gi)) {
    const w = Math.round(num(m[1]) * 746);
    const ctx = window(text, m.index ?? 0);
    if (w >= 100 && w <= 20_000) appliance.push({ value: w, score: 1, snippet: `${ctx.trim()} (hp × 746)` });
  }

  const pv = pick(panel);
  const bat = pick(battery);
  const inv = pick(inverter);
  const app = pick(appliance);
  if (pv) { out.pvWp = pv.value; out.evidence.push(`pvWp ← "${pv.snippet}"`); }
  if (bat) { out.batteryWh = Math.round(bat.value); out.evidence.push(`batteryWh ← "${bat.snippet}"`); }
  if (inv) { out.inverterW = Math.round(inv.value); out.evidence.push(`inverterW ← "${inv.snippet}"`); }
  // An appliance figure only when the page is not a panel / inverter / battery page.
  if (app && !pv && !inv && !bat) { out.powerW = Math.round(app.value); out.evidence.push(`powerW ← "${app.snippet}"`); }
  return out;
}
