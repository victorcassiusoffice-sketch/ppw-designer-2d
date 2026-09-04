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
 * a variable-speed pool pump before a single-speed one).
 *
 * Deviations from the research table, deliberate: the bare terms `pool`,
 * `pump`, `ac`, `screen` and `wall unit` were dropped because they mis-hit
 * ordinary furniture (a pool TABLE is not a 2 kW pump, a flat SCREEN is not
 * a monitor); `indoor bike` + `tour de france` were added to the connected
 * bike row so the seeded NordicTrack Tour de France (10-inch touchscreen,
 * powered incline) is not counted as a self-powered spin bike.
 */

import type { ProductCategory } from './products.schema';

export interface ApplianceLoad {
  /** Stable key for tests + the details panel ("based on: treadmill"). */
  key: string;
  /** Lower-case whole-word terms matched against the product name. Empty = category fallback. */
  match: string[];
  /** Category this row applies to; absent = any category. */
  category?: ProductCategory;
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
    ratedW: 1800, avgW: 700, standbyW: 5, hoursPerDay: 2,
    source: 'Vision T600/T600E page: 4.2 hp AC drive (the page itself calls hp a robustness rating); in-use figure est. from the nameplate band 1800-4400 W',
  },
  {
    key: 'treadmill',
    match: ['treadmill', 'commercial 2450', 'carbon tl', 'walking pad', 'walkingpad', 'running machine'],
    ratedW: 700, avgW: 350, standbyW: 4, hoursPerDay: 1,
    source: 'WalkingPad + SOLE: home treadmills 300-900 W, most 600-700 W; average in-use about half the nameplate',
  },
  {
    key: 'rower-connected',
    match: ['hydrow', 'connected rower', 'rower with screen', 'smart rower', 'ergatta'],
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
  {
    key: 'indoor-bike-connected',
    match: ['peloton', 'smart bike', 'connected bike', 'touchscreen bike', 'exercise bike', 'spin bike with screen', 'indoor cycle with display', 'indoor bike', 'tour de france'],
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
  {
    key: 'led-strip',
    match: ['led strip', 'light strip', 'lightstrip', 'strip light', 'led tape', 'cove lighting', 'neon flex', 'rgb strip'],
    ratedW: 20, avgW: 15, standbyW: 0.5, hoursPerDay: 5,
    source: 'Philips Hue Lightstrip Plus 2 m: 20 W, 0.5 W standby, 1700 lm — about 10 W per metre',
  },
  {
    key: 'lamp',
    match: ['floor lamp', 'table lamp', 'desk lamp', 'standing lamp', 'lamp', 'arc lamp', 'reading lamp'],
    ratedW: 12, avgW: 10, standbyW: 0, hoursPerDay: 4,
    source: 'One LED bulb per lamp: Philips Hue bulb guide, 9-12 W for a 60 W equivalent (about 800 lm)',
  },
  {
    key: 'pendant',
    match: ['pendant', 'pendant light', 'hanging light', 'chandelier', 'ceiling light', 'ceiling lamp', 'drop light'],
    ratedW: 12, avgW: 10, standbyW: 0, hoursPerDay: 4,
    source: 'Per LED bulb 9-12 W (Philips Hue bulb guide); a 3-bulb chandelier is 3 x 12 W',
  },
  {
    key: 'sconce',
    match: ['sconce', 'wall sconce', 'wall light', 'wall lamp', 'uplighter', 'picture light'],
    ratedW: 12, avgW: 9, standbyW: 0, hoursPerDay: 3,
    source: 'One LED bulb 9-12 W (Philips Hue bulb guide); sconces usually run at the low end',
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

/** Find the reference row for a product, or null when nothing matches. */
export function findApplianceLoad(
  p: { name: string; category: ProductCategory },
  table: readonly ApplianceLoad[] = APPLIANCE_LOADS,
): ApplianceLoad | null {
  const name = ` ${p.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  for (const row of table) {
    if (row.category && row.category !== p.category) continue;
    if (row.match.length === 0) continue;
    if (row.match.some((term) => name.includes(` ${term.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `))) return row;
  }
  for (const row of table) {
    if (row.match.length === 0 && row.category === p.category) return row;
  }
  return null;
}
