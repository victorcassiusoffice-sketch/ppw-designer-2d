/**
 * Appliance load reference (eco / solar 2026-09-04).
 *
 * The designer's energy readout needs a wattage for every electrical product
 * on the plan. Merchants SHOULD put it on the product page (`Product.power_w`
 * — the merchant scrape reads "1.5 kW" / "750 W" off the page); when a
 * product has none, this table supplies a typical figure by NAME and
 * CATEGORY so a treadmill dropped from a catalog that never mentioned watts
 * still counts. `avgW` is the realistic in-use draw (a treadmill at walking
 * pace draws a third of its nameplate), `ratedW` the nameplate, `hoursPerDay`
 * a sensible home / wellness-room default the customer can override per item.
 *
 * SOURCED: every row comes from the 2026-09-04 research pass — manufacturer
 * nameplates, official spec sheets and energy-use datasets fetched that day
 * (one-line provenance per row in `source`; the full URLs and rationales are
 * in the research record, `docs/sims-world-2026-08-29/eco-solar-2026-09-04/`).
 * Figures marked "est." in a `source` are derived from those pages, not
 * measured. Self-powered gear (most rowers, spin bikes, plate-loaded
 * strength) is listed at 0 W EXPLICITLY so it is visibly not a consumer.
 *
 * Matching (`findApplianceLoad`): first row whose `match` list has a
 * whole-word hit in the product name wins; then a category-only row (empty
 * `match`). ORDER MATTERS — specific rows come before broad ones
 * ("sauna heater" before "infrared sauna", "mini fridge" before "fridge",
 * a variable-speed pool pump before a single-speed one, a CONNECTED rower /
 * bike before the bare self-powered row). Two refinements (electrics fix
 * 2026-09-20, audit E-02 / E-05):
 *   - `prefer`: a row tried in a FIRST pass for products of those categories
 *     — so a "Ceramic Table Lamp" in `lighting` reaches the lamp row before
 *     the accessory row's bare `table` term can call it 0 W;
 *   - `exclude`: whole-word terms that veto the row — a "TV Cabinet" is not
 *     a television, a "Treadmill Mat" is not a treadmill;
 *   - products in a PASSIVE category (flooring / decor / furniture / walls /
 *     plant) try the 0 W rows first, so a mat or a cabinet named after the
 *     machine it goes under never inherits its watts. A merchant that puts
 *     `power_w` on such a product bypasses the table entirely.
 *
 * Deviations from the research table, deliberate: the bare terms `pool`,
 * `pump`, `ac`, `screen` and `wall unit` were dropped because they mis-hit
 * ordinary furniture (a pool TABLE is not a 2 kW pump, a flat SCREEN is not
 * a monitor); `indoor bike` + `tour de france` were added to the connected
 * bike row so the seeded NordicTrack Tour de France (10-inch touchscreen,
 * powered incline) is not counted as a self-powered spin bike; `rw900` /
 * `rw700` / `rw600` / `touchscreen` / `ifit` were added to the connected
 * rows (2026-09-20) so the seeded NordicTrack RW900 (22-inch HD touchscreen)
 * is not scored as a Concept2-class 0 W rower.
 */

import type { ProductCategory } from './products.schema';

export interface ApplianceLoad {
  /** Stable key for tests + the details panel ("based on: treadmill"). */
  key: string;
  /** Lower-case whole-word terms matched against the product name. Empty = category fallback. */
  match: string[];
  /** Category this row applies to; absent = any category. */
  category?: ProductCategory;
  /** Categories whose products try this row in a first pass, before the rest of the table. */
  prefer?: ProductCategory[];
  /** Lower-case whole-word terms that VETO the row when found in the product name. */
  exclude?: string[];
  /** Nameplate watts. */
  ratedW: number;
  /** Realistic average watts while in use. */
  avgW: number;
  /** Watts when switched off but plugged in (not used in v1 totals). */
  standbyW: number;
  /** Default hours per day switched on. */
  hoursPerDay: number;
  /** Where the figures come from. */
  source: string;
}

export const APPLIANCE_LOADS: ApplianceLoad[] = [
  // ---- cardio -------------------------------------------------------------
  {
    key: 'treadmill-commercial',
    match: ['t600', 't600e', 'vision fitness treadmill', 'commercial treadmill', 'ac drive', 'light commercial treadmill'],
    exclude: ['mat', 'cover'],
    ratedW: 1800, avgW: 700, standbyW: 5, hoursPerDay: 2,
    source: 'Vision T600/T600E page: 4.2 hp AC drive (the page itself calls hp a robustness rating); in-use figure est. from the nameplate band 1800-4400 W',
  },
  {
    key: 'treadmill',
    match: ['treadmill', 'commercial 2450', 'carbon tl', 'walking pad', 'walkingpad', 'running machine'],
    // A "Treadmill Mat" / "Treadmill Cover" goes under or over the machine.
    exclude: ['mat', 'cover'],
    ratedW: 700, avgW: 350, standbyW: 4, hoursPerDay: 1,
    source: 'WalkingPad + SOLE: home treadmills 300-900 W, most 600-700 W; average in-use about half the nameplate',
  },
  {
    key: 'elliptical-self-powered',
    match: ['self-powered elliptical', 'self powered', 'generator elliptical', 'manual elliptical', 'stepper', 'stair climber', 'arc trainer'],
    ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 0.75,
    source: 'Self-powered ellipticals/steppers run their console off a flywheel generator (6-24 V) — no outlet',
  },
  {
    key: 'elliptical',
    match: ['elliptical', 'cross trainer', 'crosstrainer', 'e95', 'nordictrack elliptical'],
    ratedW: 150, avgW: 100, standbyW: 3, hoursPerDay: 0.75,
    source: 'Bikemarts: auto-incline models (Sole E95, ProForm Pro HIIT H14) draw 100-150 W plugged in',
  },
  // The CONNECTED rower / bike rows sit before their bare self-powered
  // siblings on purpose: a "NordicTrack RW900 Rower" must reach `rw900`
  // before the bare `rower` term calls it 0 W. The generic `touchscreen` /
  // `ifit` terms are shared by both connected rows, so each excludes the
  // other family's words — a "Peloton touchscreen bike" is a bike.
  {
    key: 'rower-connected',
    match: ['hydrow', 'connected rower', 'rower with screen', 'smart rower', 'ergatta', 'rw900', 'rw700', 'rw600', 'touchscreen', 'ifit rower'],
    exclude: ['bike', 'cycle', 'treadmill', 'elliptical'],
    ratedW: 210, avgW: 35, standbyW: 5, hoursPerDay: 0.5,
    source: 'Hydrow published electrical spec (120 V, 60 Hz): 210 W max, screen-dominated draw',
  },
  {
    key: 'rower',
    match: ['concept2', 'rowerg', 'rower', 'rowing machine', 'air rower', 'water rower', 'waterrower', 'skierg', 'bikeerg', 'magnetic rower'],
    ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 0.5,
    source: 'Concept2 PM5 runs on two D cells and is powered by the flywheel while rowing — no mains draw',
  },
  {
    key: 'indoor-bike-connected',
    match: ['peloton', 'smart bike', 'connected bike', 'touchscreen bike', 'exercise bike', 'spin bike with screen', 'indoor cycle with display', 'indoor bike', 'tour de france', 'touchscreen', 'ifit'],
    exclude: ['rower', 'rowing'],
    ratedW: 144, avgW: 60, standbyW: 12, hoursPerDay: 0.75,
    source: 'Peloton official compare page: 100-240 V, 1.2 A max (144 W at 120 V); screen dominates the draw',
  },
  {
    key: 'indoor-bike',
    match: ['keiser', 'm3i', 'spin bike', 'indoor cycle', 'air bike', 'assault bike', 'magnetic bike', 'upright bike', 'recumbent bike'],
    ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 0.75,
    source: 'Keiser M3i and studio bikes: battery console powered by pedalling — no mains',
  },
  {
    key: 'strength-equipment',
    match: ['smith machine', 'smith', 'bench', 'weight bench', 'rack', 'power rack', 'squat rack', 'cable machine', 'functional trainer', 'dumbbell', 'kettlebell', 'barbell', 'plate', 'weights', 'multi gym', 'home gym', 'pull-up bar', 'dip station', 'leg press', 'glute', 'adductor', 'abductor'],
    ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 1,
    source: 'Purely mechanical — smith machines, benches, racks, cable stacks and free weights have no electrics',
  },
  {
    key: 'accessory',
    match: ['mat', 'yoga mat', 'foam roller', 'roller', 'resistance band', 'band', 'exercise ball', 'stability ball', 'yoga block', 'balance board', 'rug', 'cushion', 'towel', 'shelf', 'mirror', 'stool', 'table'],
    ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 0,
    source: 'Mats, rollers, bands, balls, mirrors, shelves and rugs draw no power — 0 W by definition',
  },
  {
    // Case goods and seating that carry an appliance's name — a "TV Cabinet",
    // a "TV Stand", a "Lamp Table" — are the thing UNDER the appliance.
    key: 'furniture',
    match: ['cabinet', 'stand', 'unit', 'sideboard', 'dresser', 'wardrobe', 'bookcase', 'bookshelf', 'console', 'desk', 'shelving', 'bench', 'ottoman', 'sofa', 'couch', 'bed', 'mattress', 'headboard', 'chest', 'drawers', 'rack', 'trolley', 'cart'],
    ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 0,
    source: 'Cabinets, stands, sideboards, desks, sofas and beds draw no power — 0 W by definition (the appliance on them is its own product)',
  },

  // ---- recovery ------------------------------------------------------------
  {
    key: 'sauna-heater',
    match: ['sauna heater', 'electric sauna', 'traditional sauna', 'finnish sauna', 'harvia', 'sauna stove', 'steam sauna', 'dry sauna'],
    ratedW: 6000, avgW: 4200, standbyW: 0, hoursPerDay: 1,
    source: 'Harvia Spirit 6 kW (240 V, 25 A) for a 2-4 person cabin; 8 kW / 33 A for larger. Duty-cycled once up to temperature (est.)',
  },
  {
    key: 'sauna-infrared',
    match: ['infrared sauna', 'infrared', 'ir sauna', 'far infrared', 'sunlighten', 'clearlight', 'sauna cabin', 'sauna'],
    ratedW: 2400, avgW: 1800, standbyW: 0, hoursPerDay: 1,
    source: 'Sunlighten nameplates: Solo 960 W, Signature 1-person 1673 W, mPulse up to 4200 W; average allows for thermostat cycling (est.)',
  },
  {
    key: 'ice-bath-chiller',
    match: ['ice bath', 'cold plunge', 'plunge', 'chiller', 'cold tub', 'ice barrel', 'cold water immersion'],
    ratedW: 520, avgW: 250, standbyW: 0, hoursPerDay: 24,
    source: 'Titan Wellness chiller input power: 1/3 hp 330 W, 1/2 hp 520 W, 1 hp 750 W; runs all day but cycles (est.)',
  },
  {
    key: 'massage-chair',
    match: ['massage chair', 'massage recliner', 'zero gravity chair', 'osaki', 'real relax', 'shiatsu chair'],
    ratedW: 220, avgW: 180, standbyW: 1, hoursPerDay: 1,
    source: 'Real Relax + Massage Chair Heaven: rated 150-300 W, typical consumption 180-220 W',
  },
  {
    key: 'sleep-pod',
    match: ['sleep pod', 'nap pod', 'energypod', 'metronaps', 'rest pod', 'napping pod', 'relaxation pod'],
    ratedW: 100, avgW: 60, standbyW: 2, hoursPerDay: 2,
    source: 'MetroNaps EnergyPod spec: one 120 V outlet, max draw 100 W; average allows for the idle cycle (est.)',
  },

  // ---- lighting -------------------------------------------------------------
  // `prefer: ['lighting']` — a product the merchant filed under lighting
  // tries these rows FIRST, so "Ceramic Table Lamp" is a lamp, not a table.
  {
    key: 'led-strip',
    match: ['led strip', 'light strip', 'lightstrip', 'strip light', 'led tape', 'cove lighting', 'neon flex', 'rgb strip'],
    prefer: ['lighting'],
    ratedW: 20, avgW: 15, standbyW: 0.5, hoursPerDay: 5,
    source: 'Philips Hue Lightstrip Plus 2 m: 20 W, 0.5 W standby, 1700 lm — about 10 W per metre',
  },
  {
    key: 'lamp',
    match: ['floor lamp', 'table lamp', 'desk lamp', 'standing lamp', 'lamp', 'arc lamp', 'reading lamp'],
    prefer: ['lighting'],
    ratedW: 12, avgW: 10, standbyW: 0, hoursPerDay: 4,
    source: 'One LED bulb per lamp: Philips Hue bulb guide, 9-12 W for a 60 W equivalent (about 800 lm)',
  },
  {
    key: 'pendant',
    match: ['pendant', 'pendant light', 'hanging light', 'chandelier', 'ceiling light', 'ceiling lamp', 'drop light'],
    prefer: ['lighting'],
    ratedW: 12, avgW: 10, standbyW: 0, hoursPerDay: 4,
    source: 'Per LED bulb 9-12 W (Philips Hue bulb guide); a 3-bulb chandelier is 3 x 12 W',
  },
  {
    key: 'sconce',
    match: ['sconce', 'wall sconce', 'wall light', 'wall lamp', 'uplighter', 'picture light'],
    prefer: ['lighting'],
    ratedW: 12, avgW: 9, standbyW: 0, hoursPerDay: 3,
    source: 'One LED bulb 9-12 W (Philips Hue bulb guide); sconces usually run at the low end',
  },
  {
    // Category fallback: a `lighting` product whose name says nothing the
    // rows above know ("Nordic Glow") is still one LED bulb, not 0 W.
    key: 'lighting-generic',
    match: [],
    category: 'lighting',
    ratedW: 12, avgW: 10, standbyW: 0, hoursPerDay: 4,
    source: 'One LED bulb per fitting: Philips Hue bulb guide, 9-12 W for a 60 W equivalent (about 800 lm)',
  },

  // ---- decor / greenery ------------------------------------------------------
  {
    key: 'diffuser',
    match: ['diffuser', 'aroma diffuser', 'essential oil diffuser', 'aromatherapy', 'ultrasonic diffuser', 'humidifier', 'mist'],
    ratedW: 32, avgW: 15, standbyW: 0, hoursPerDay: 2,
    source: 'MUJI ultrasonic aroma diffuser 100 mL nameplate 32 W; small USB units about 3 W — midpoint used (est.)',
  },
  {
    key: 'plant',
    match: ['plant', 'planter', 'pot plant', 'monstera', 'fern', 'palm', 'fiddle', 'succulent', 'bamboo', 'tree', 'greenery', 'moss wall', 'hedge'],
    ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 0,
    source: 'Living and artificial plants draw no power — 0 W by definition (grow lights would be a lighting row)',
  },

  // ---- office / tech / building services -------------------------------------
  {
    key: 'mini-fridge',
    match: ['mini fridge', 'mini-fridge', 'bar fridge', 'compact fridge', 'beverage cooler', 'drinks fridge', 'wine fridge', 'undercounter fridge'],
    ratedW: 100, avgW: 35, standbyW: 0, hoursPerDay: 24,
    source: 'EnergyBot: mini-fridges 50-100 W, compressor running about a third of the day',
  },
  {
    key: 'refrigerator',
    match: ['fridge', 'refrigerator', 'fridge freezer', 'french door', 'side by side', 'top freezer', 'bottom freezer'],
    ratedW: 168, avgW: 56, standbyW: 0, hoursPerDay: 24,
    source: 'BKV analysis of 2,450 ENERGY STAR models: 493 kWh/yr = about 56 W continuous, 168 W while the compressor runs',
  },
  {
    key: 'pool-pump-variable',
    match: ['variable speed pump', 'variable-speed', 'vs pump', 'energy star pool pump', 'inverter pool pump'],
    ratedW: 2000, avgW: 593, standbyW: 0, hoursPerDay: 8,
    source: 'PNNL Building America: dropping 3,450 to 2,400 rpm takes a 2,000 W pump to 593 W',
  },
  {
    key: 'pool-pump',
    match: ['pool pump', 'swimming pool', 'filter pump'],
    ratedW: 2000, avgW: 2000, standbyW: 0, hoursPerDay: 6,
    source: 'PNNL Building America: a typical 1.5 hp pool pump draws about 2,000 W at 3,450 rpm',
  },
  {
    key: 'air-conditioner',
    match: ['air conditioner', 'aircon', 'split ac', 'mini split', 'air conditioning', 'inverter ac', 'ac unit', '9000 btu', '12000 btu', '18000 btu', '24000 btu'],
    ratedW: 1079, avgW: 800, standbyW: 2, hoursPerDay: 6,
    source: 'Premium Levella 12,000 BTU inverter split: rated power input 1,079 W cooling; inverters modulate below that (est.)',
  },
  {
    key: 'water-heater',
    match: ['water heater', 'geyser', 'hot water', 'boiler', 'immersion', 'storage heater', 'ariston', 'hot water tank', 'chauffe-eau'],
    ratedW: 2000, avgW: 2000, standbyW: 0, hoursPerDay: 1.5,
    source: 'Ariston PRO1 R 50 V 2K (50 L): 2 kW element, 230 V; larger models 2.5-3 kW',
  },
  {
    key: 'water-dispenser',
    match: ['water dispenser', 'water cooler', 'hot and cold', 'bottle dispenser', 'drinking fountain', 'bottled water cooler'],
    ratedW: 600, avgW: 117, standbyW: 32, hoursPerDay: 24,
    source: 'Ace Water Shop guide: 400-700 W heating element plus cooling; duty-cycled average about 117 W',
  },
  {
    key: 'ev-charger',
    match: ['ev charger', 'wallbox', 'wall box', 'car charger', 'electric vehicle', 'charging point', 'charging station', 'type 2', 'evse'],
    ratedW: 7400, avgW: 7000, standbyW: 5, hoursPerDay: 2,
    source: 'Zencar / Wallbox 7 kW single-phase 32 A: 6-8 h for a 60 kWh battery from empty',
  },
  {
    key: 'dehumidifier',
    match: ['dehumidifier', 'dehumidifer', 'moisture', 'damp', '50 pint', 'humidity control'],
    ratedW: 483, avgW: 480, standbyW: 1, hoursPerDay: 6,
    source: 'ecocostsavings survey of 573 dehumidifiers: average 483 W, most common 600 W, range 214-970 W',
  },
  {
    key: 'air-purifier',
    match: ['air purifier', 'purifier', 'hepa', 'levoit', 'air cleaner', 'air filter unit', 'dyson purifier'],
    ratedW: 56, avgW: 24, standbyW: 0.1, hoursPerDay: 12,
    source: 'Levoit Core 300-P: rated 56 W; HouseFresh plug-meter test shows about 24 W on medium',
  },
  {
    key: 'mini-pc',
    match: ['mini pc', 'mac mini', 'nuc', 'desktop', 'computer', 'workstation', 'thin client', 'media pc'],
    ratedW: 65, avgW: 20, standbyW: 4, hoursPerDay: 8,
    source: 'Apple Mac mini power table measured at the wall: M4 idle 4 W, CPU max 65 W; office duty about 20 W (est.)',
  },
  {
    key: 'monitor',
    match: ['monitor', 'display', 'computer monitor', 'ultrawide'],
    ratedW: 21, avgW: 21, standbyW: 0.3, hoursPerDay: 8,
    source: 'Dell 27 Plus QHD S2725DS spec sheet: 21.4 W on-mode, 57 W maximum, 0.3 W standby',
  },
  {
    key: 'tv',
    match: ['tv', 'television', 'smart tv', '55 inch', '65 inch', 'oled', 'qled', 'flat screen', 'wall tv'],
    // "TV Cabinet" / "TV Stand" / "TV Unit" / "TV Bench" hold the set; they are not it.
    exclude: ['cabinet', 'stand', 'unit', 'bench', 'console', 'table', 'mount', 'bracket', 'wall bracket'],
    ratedW: 77, avgW: 77, standbyW: 1.4, hoursPerDay: 3,
    source: 'ecocostsavings dataset of 107 ENERGY STAR TVs: 55-inch average 77 W on-mode, 1.4 W standby',
  },
  {
    key: 'speaker',
    match: ['speaker', 'sonos', 'bluetooth speaker', 'smart speaker', 'soundbar', 'sound bar', 'hifi', 'audio', 'era 100', 'bookshelf speaker'],
    ratedW: 20, avgW: 15, standbyW: 2, hoursPerDay: 4,
    source: 'Energy-monitor readings on Sonos units at 240 V: 14-17 W playing softly, about 19-20 W loud',
  },
  {
    key: 'fan',
    match: ['ceiling fan', 'fan', 'pedestal fan', 'dc fan', 'stand fan', 'wall fan'],
    ratedW: 30, avgW: 20, standbyW: 1, hoursPerDay: 8,
    source: 'Beacon Lighting Moto 52-inch DC fan: 30 W motor at high speed, 6,615 CFM',
  },
];

/**
 * Categories whose products are furniture, finishes or greenery: never a
 * consumer by NAME alone (a "Treadmill Mat" is flooring), only by an explicit
 * `power_w` — which `energyRoleOf` reads before it ever asks this table.
 */
export const PASSIVE_CATEGORIES: ReadonlySet<ProductCategory> = new Set<ProductCategory>([
  'flooring',
  'decor',
  'furniture',
  'walls',
  'plant',
]);

function normaliseTerm(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
}

function nameHas(name: string, term: string): boolean {
  return name.includes(normaliseTerm(term).replace(/^ +| +$/g, ' '));
}

/** Does the row's match list hit the name, with none of its exclusions present? */
function rowHits(row: ApplianceLoad, name: string, category: ProductCategory): boolean {
  if (row.category && row.category !== category) return false;
  if (row.match.length === 0) return false;
  if (!row.match.some((term) => nameHas(name, term))) return false;
  if (row.exclude && row.exclude.some((term) => nameHas(name, term))) return false;
  return true;
}

/**
 * Find the reference row for a product, or null when nothing matches.
 *
 * Passes, in order: (1) rows that `prefer` the product's category; (2) for a
 * PASSIVE category, the 0 W rows — furniture, mats and plants named after an
 * appliance are still not one; (3) every named row in table order; (4) the
 * category-only fallback row.
 */
export function findApplianceLoad(
  p: { name: string; category: ProductCategory },
  table: readonly ApplianceLoad[] = APPLIANCE_LOADS,
): ApplianceLoad | null {
  const name = normaliseTerm(p.name);
  for (const row of table) {
    if (row.prefer?.includes(p.category) && rowHits(row, name, p.category)) return row;
  }
  if (PASSIVE_CATEGORIES.has(p.category)) {
    for (const row of table) {
      if (row.avgW === 0 && rowHits(row, name, p.category)) return row;
    }
  }
  for (const row of table) {
    if (rowHits(row, name, p.category)) return row;
  }
  for (const row of table) {
    if (row.match.length === 0 && row.category === p.category) return row;
  }
  return null;
}
