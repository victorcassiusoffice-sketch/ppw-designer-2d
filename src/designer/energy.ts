/**
 * energy — which products generate, store or draw power, and the whole-plan
 * balance the Energy readout shows (eco / solar 2026-09-04).
 *
 * Vic: "when a person adds something electronic it calculates the output of
 * the electric device … it can show if the solar panel is sufficiently
 * providing enough power for the current electrical products that are on
 * the canvas/room or even outside the room … how much energy is surplus or
 * lacking according to how many solar panels the person has added".
 *
 * Pure functions over the property + catalog: no store reads, no DOM. The
 * canvas / TopBar hand in the rooms and a product lookup; the sun figures
 * come from `data/mauritiusSolar.ts` (or a test override).
 */

import type { EnergyRole, Product } from '../data/products.schema';
import { findApplianceLoad, type ApplianceLoad } from '../data/applianceLoads';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from './levels';
import {
  batteryAutonomyHours,
  coveragePct,
  dailyGenerationWh,
  dailyLoadWh,
  inverterCoversPeak,
  panelsToCover,
} from './solarCalc';

/** The product fields these helpers read; a full `Product` satisfies it. */
export type EnergyProduct = Pick<Product, 'name' | 'category'> &
  Partial<
    Pick<
      Product,
      | 'power_w'
      | 'duty_hours_per_day'
      | 'pv_wp'
      | 'battery_kwh'
      | 'inverter_kw'
      | 'energy_role'
      | 'placement'
      | 'emits_light'
    >
  >;

/** The placed-item fields the balance reads. */
export interface EnergyItem {
  instanceId: string;
  productId: string;
  /** Lights: `false` = switched off (see `PlacedItem.lightOn`). */
  lightOn?: boolean;
  /** Any consumer: `false` = switched off / unplugged for the estimate. */
  powerOn?: boolean;
  /** Per-item override of the product's / reference hours per day. */
  hoursPerDay?: number;
}

export interface EnergyRoom {
  id: string;
  name: string;
  levelId?: string;
  kind?: string;
  placedItems: EnergyItem[];
}

/** Default hours/day for a consumer nothing else describes. */
export const DEFAULT_HOURS_PER_DAY = 2;
/** Depth of discharge assumed for autonomy (LiFePO4 rated 80-90 %). */
export const DEFAULT_DEPTH_OF_DISCHARGE = 0.9;

function pos(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * True when the product is a roof-placed PV module: explicit `placement:
 * 'roof'`, or a `pv_wp` rating in the `solar` category.
 */
export function isRoofProduct(p: Pick<EnergyProduct, 'placement' | 'pv_wp' | 'category'>): boolean {
  if (p.placement === 'roof') return true;
  return p.category === 'solar' && pos(p.pv_wp) > 0;
}

/**
 * The product's role in the balance. Precedence: explicit `energy_role` ->
 * `pv_wp` (generator) -> `battery_kwh` (storage) -> `inverter_kw` (inverter)
 * -> `power_w` (consumer) -> the appliance reference table by name /
 * category (consumer when it has a positive average draw) -> 'none'.
 */
export function energyRoleOf(p: EnergyProduct, table?: readonly ApplianceLoad[]): EnergyRole {
  if (p.energy_role) return p.energy_role;
  if (pos(p.pv_wp) > 0) return 'generator';
  if (pos(p.battery_kwh) > 0) return 'storage';
  if (pos(p.inverter_kw) > 0) return 'inverter';
  if (pos(p.power_w) > 0) return 'consumer';
  const ref = findApplianceLoad(p, table);
  if (ref && ref.avgW > 0) return 'consumer';
  return 'none';
}

/** Average watts a consumer draws while on: explicit `power_w`, else the reference row's `avgW`, else 0. */
export function productPowerW(p: EnergyProduct, table?: readonly ApplianceLoad[]): number {
  if (pos(p.power_w) > 0) return p.power_w as number;
  const ref = findApplianceLoad(p, table);
  return ref ? ref.avgW : 0;
}

/** Hours per day: explicit `duty_hours_per_day`, else the reference row, else 2. */
export function productHoursPerDay(p: EnergyProduct, table?: readonly ApplianceLoad[]): number {
  if (pos(p.duty_hours_per_day) > 0) return Math.min(24, p.duty_hours_per_day as number);
  const ref = findApplianceLoad(p, table);
  return ref ? ref.hoursPerDay : DEFAULT_HOURS_PER_DAY;
}

/** The reference row a product's figures came from, for the "based on" hint. Null when explicit or unknown. */
export function productLoadReference(
  p: EnergyProduct,
  table?: readonly ApplianceLoad[],
): ApplianceLoad | null {
  if (pos(p.power_w) > 0) return null;
  return findApplianceLoad(p, table);
}

/** Is this placed consumer switched on for the estimate? Absent = on; a light obeys its light switch too. */
export function itemPowerOn(
  item: Pick<EnergyItem, 'lightOn' | 'powerOn'>,
  p?: Pick<EnergyProduct, 'emits_light' | 'category'>,
): boolean {
  if (item.powerOn === false) return false;
  const isLight = !!p && (p.emits_light === true || p.category === 'lighting');
  if (isLight && item.lightOn === false) return false;
  return true;
}

/** Hours per day for a placed item: its override, else the product's. */
export function itemHoursPerDay(
  item: Pick<EnergyItem, 'hoursPerDay'>,
  p: EnergyProduct,
  table?: readonly ApplianceLoad[],
): number {
  if (pos(item.hoursPerDay) > 0) return Math.min(24, item.hoursPerDay as number);
  return productHoursPerDay(p, table);
}

export interface EnergyConsumerLine {
  instanceId: string;
  productId: string;
  name: string;
  roomId: string;
  roomName: string;
  levelId: string;
  /** Watts while on. */
  powerW: number;
  hoursPerDay: number;
  on: boolean;
  /** Wh/day this item adds (0 while off). */
  whDay: number;
  /** Key of the reference row when the watts were inferred, else null. */
  referenceKey: string | null;
}

export interface EnergyGeneratorLine {
  instanceId: string;
  productId: string;
  name: string;
  wp: number;
  onRoof: boolean;
}

export interface EnergyReport {
  /** Sun + loss assumptions used. */
  pshHoursPerDay: number;
  performanceRatio: number;
  /** Installed PV. */
  panelCount: number;
  totalWp: number;
  /** Panels NOT on a roof slab — counted, but flagged. */
  panelsOffRoof: number;
  generationWhDay: number;
  /** Consumers. */
  consumers: EnergyConsumerLine[];
  generators: EnergyGeneratorLine[];
  loadWhDay: number;
  /** Everything switched on at once, watts. */
  peakLoadW: number;
  /** generation - load, Wh/day (+ surplus / - shortfall). */
  netWhDay: number;
  coveragePct: number;
  /** Extra panels (of the plan's typical panel) that would close the gap. */
  panelsToCover: number;
  /** Wp of the panel `panelsToCover` counts in. */
  coverPanelWp: number;
  batteryKwh: number;
  batteryAutonomyHours: number;
  inverterKw: number;
  inverterOk: boolean;
  /** 'none' no panels + no load; 'covered'; 'partial' (>= 50 %); 'short' */
  status: 'none' | 'covered' | 'partial' | 'short';
}

export interface EnergyReportInput {
  rooms: readonly EnergyRoom[];
  productById: (id: string) => EnergyProduct | undefined;
  pshHoursPerDay: number;
  performanceRatio: number;
  /** Panel Wp to size the "add N panels" hint with when the plan has none. */
  defaultPanelWp?: number;
  table?: readonly ApplianceLoad[];
}

/**
 * The whole-plan balance: every room on every level (outdoors + roof
 * included), every placed item classified once.
 */
export function energyReport(input: EnergyReportInput): EnergyReport {
  const { rooms, productById, table } = input;
  const psh = pos(input.pshHoursPerDay);
  const pr = Math.min(1, pos(input.performanceRatio));
  const consumers: EnergyConsumerLine[] = [];
  const generators: EnergyGeneratorLine[] = [];
  let totalWp = 0;
  let panelsOffRoof = 0;
  let batteryKwh = 0;
  let inverterKw = 0;
  let peakLoadW = 0;
  let loadWhDay = 0;
  const wpHistogram = new Map<number, number>();

  for (const room of rooms) {
    const onRoof = isRoofRoom(room);
    for (const item of room.placedItems) {
      const p = productById(item.productId);
      if (!p) continue;
      const role = energyRoleOf(p, table);
      if (role === 'generator') {
        const wp = pos(p.pv_wp);
        totalWp += wp;
        if (!onRoof) panelsOffRoof += 1;
        wpHistogram.set(wp, (wpHistogram.get(wp) ?? 0) + 1);
        generators.push({ instanceId: item.instanceId, productId: item.productId, name: p.name, wp, onRoof });
      } else if (role === 'storage') {
        batteryKwh += pos(p.battery_kwh);
      } else if (role === 'inverter') {
        inverterKw += pos(p.inverter_kw);
      } else if (role === 'consumer') {
        const powerW = productPowerW(p, table);
        const hours = itemHoursPerDay(item, p, table);
        const on = itemPowerOn(item, p);
        const whDay = on ? dailyLoadWh(powerW, hours) : 0;
        if (on) peakLoadW += powerW;
        loadWhDay += whDay;
        const ref = productLoadReference(p, table);
        consumers.push({
          instanceId: item.instanceId,
          productId: item.productId,
          name: p.name,
          roomId: room.id,
          roomName: isOutdoorRoom(room) ? 'Outdoors' : room.name,
          levelId: roomLevelId(room),
          powerW,
          hoursPerDay: hours,
          on,
          whDay,
          referenceKey: ref ? ref.key : null,
        });
      }
    }
  }

  const generationWhDay = dailyGenerationWh({ wp: totalWp, pshHoursPerDay: psh, performanceRatio: pr });
  const netWhDay = Math.round((generationWhDay - loadWhDay) * 10) / 10;
  // The panel to count the gap in: the plan's most common Wp, else the default.
  let coverPanelWp = pos(input.defaultPanelWp);
  let best = 0;
  for (const [wp, n] of wpHistogram) {
    if (n > best && wp > 0) {
      best = n;
      coverPanelWp = wp;
    }
  }
  const cov = coveragePct(generationWhDay, loadWhDay);
  const panelCount = generators.length;
  let status: EnergyReport['status'];
  if (panelCount === 0 && loadWhDay <= 0) status = 'none';
  else if (netWhDay >= 0 && loadWhDay > 0) status = 'covered';
  else if (panelCount > 0 && loadWhDay <= 0) status = 'covered';
  else if (cov >= 50) status = 'partial';
  else status = 'short';

  return {
    pshHoursPerDay: psh,
    performanceRatio: pr,
    panelCount,
    totalWp,
    panelsOffRoof,
    generationWhDay,
    consumers,
    generators,
    loadWhDay: Math.round(loadWhDay * 10) / 10,
    peakLoadW: Math.round(peakLoadW),
    netWhDay,
    coveragePct: cov,
    panelsToCover: netWhDay < 0 ? panelsToCover(-netWhDay, coverPanelWp, psh, pr) : 0,
    coverPanelWp,
    batteryKwh: Math.round(batteryKwh * 100) / 100,
    batteryAutonomyHours: batteryAutonomyHours(batteryKwh, DEFAULT_DEPTH_OF_DISCHARGE, loadWhDay),
    inverterKw: Math.round(inverterKw * 100) / 100,
    inverterOk: inverterCoversPeak(inverterKw, peakLoadW),
    status,
  };
}

/** The words for the chip / panel headline; numbers are formatted by the caller. */
export function energyStatusLabel(r: Pick<EnergyReport, 'status' | 'netWhDay' | 'coveragePct'>): string {
  switch (r.status) {
    case 'none':
      return 'No power use yet';
    case 'covered':
      return r.netWhDay > 0 ? 'Surplus' : 'Covered';
    default:
      return `${r.coveragePct}% covered`;
  }
}
