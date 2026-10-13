/** City-scale coordination and measured takeoff. No infrastructure design approval.
 * All geometry uses the same metre x-right/y-down frame as the house editor.
 * Depths/elevations are metres; diameters alone are millimetres. */
export interface CityPoint {
  x: number;
  y: number;
}
export interface CityNetworkPoint extends CityPoint {
  z: number;
}
export type CityNetworkSystem = 'water' | 'sewer' | 'stormwater' | 'power' | 'fibre';
export type CityAssetKind =
  | 'solar-light'
  | 'pv-array'
  | 'battery'
  | 'water-tank'
  | 'transformer'
  | 'ev-charger'
  | 'park'
  | 'data-centre'
  | 'building';
export interface CityRoad {
  id: string;
  name: string;
  presetId: string;
  points: CityPoint[];
  widthM: number;
  surfaceDepthM: number;
  baseDepthM: number;
  supplierRef?: string;
}
export interface CityNetwork {
  id: string;
  name: string;
  system: CityNetworkSystem;
  points: CityNetworkPoint[];
  /** Outside/envelope diameter for spatial coordination, not a hydraulic or cable rating. */
  diameterMm: number;
  trenchWidthM: number;
  trenchDepthM: number;
  supplierRef?: string;
  stockLengthM?: number;
}
export interface CityAsset {
  id: string;
  name: string;
  kind: CityAssetKind;
  /** Centre in plan metres. Rotation is clockwise degrees. */
  x: number;
  y: number;
  widthM: number;
  lengthM: number;
  heightM: number;
  rotation: number;
  supplierRef?: string;
  buildingLink?: 'current';
  powerW?: number;
  solarKWp?: number;
  batteryKWh?: number;
  tankCapacityL?: number;
  hoursPerDay?: number;
}
export interface CityDataCentre {
  racks: number;
  kWPerRack: number;
  utilisation: number;
  pue: number;
  annualHours: number;
  pvKWp: number;
  yieldKWhPerKWp: number;
  batteryKWh: number;
  batteryUsableFraction: number;
  /** Water per IT kWh; optional, no default water performance is invented. */
  wueLPerKWh?: number;
}
export interface CityModel {
  version: 1;
  enabled: boolean;
  site: { originM: CityPoint; widthM: number; lengthM: number };
  roads: CityRoad[];
  networks: CityNetwork[];
  assets: CityAsset[];
  dataCentre?: CityDataCentre;
}
export const CITY_LIMITS = {
  coordinateM: 10000,
  siteM: 10000,
  roads: 64,
  networks: 128,
  assets: 300,
  roadSegments: 128,
  networkSegments: 128,
  buildingAssets: 64,
  pointsPerRoute: 65,
  distinctTrenchDepths: 16,
} as const;
/** Editable sample sections only. They are not road-class or pavement-design standards. */
export const CITY_ROAD_PRESETS = [
  {
    id: 'local-access',
    label: 'Local access — planning section',
    widthM: 6,
    surfaceDepthM: 0.05,
    baseDepthM: 0.2,
  },
  {
    id: 'shared-street',
    label: 'Shared street — planning section',
    widthM: 4,
    surfaceDepthM: 0.08,
    baseDepthM: 0.2,
  },
  {
    id: 'cycle-path',
    label: 'Cycle / walking path — planning section',
    widthM: 3,
    surfaceDepthM: 0.05,
    baseDepthM: 0.15,
  },
  {
    id: 'industrial-access',
    label: 'Industrial access — planning section',
    widthM: 8,
    surfaceDepthM: 0.08,
    baseDepthM: 0.3,
  },
] as const;
export const CITY_NETWORK_SYSTEMS: { id: CityNetworkSystem; label: string; colour: string }[] = [
  { id: 'water', label: 'Water main', colour: '#3277a4' },
  { id: 'sewer', label: 'Wastewater', colour: '#8c6550' },
  { id: 'stormwater', label: 'Stormwater', colour: '#438d88' },
  { id: 'power', label: 'Power duct', colour: '#c48c35' },
  { id: 'fibre', label: 'Fibre duct', colour: '#8764a7' },
];
export const CITY_ASSET_KINDS: { id: CityAssetKind; label: string; colour: string }[] = [
  { id: 'solar-light', label: 'Solar streetlight', colour: '#e0ad4f' },
  { id: 'pv-array', label: 'Solar array', colour: '#527892' },
  { id: 'battery', label: 'Battery enclosure', colour: '#799985' },
  { id: 'water-tank', label: 'Water tank', colour: '#6aa0ad' },
  { id: 'transformer', label: 'Substation envelope', colour: '#a28e65' },
  { id: 'ev-charger', label: 'EV charger', colour: '#73a78f' },
  { id: 'park', label: 'Green space', colour: '#88a379' },
  { id: 'data-centre', label: 'Data centre', colour: '#687f7d' },
  { id: 'building', label: 'Building envelope', colour: '#b9b3a5' },
];
export function emptyCity(): CityModel {
  return {
    version: 1,
    enabled: true,
    site: { originM: { x: -50, y: -50 }, widthM: 300, lengthM: 240 },
    roads: [],
    networks: [],
    assets: [],
  };
}
const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const number = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const key = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 128;
const point = (v: unknown): v is CityPoint => {
  const p = record(v);
  return (
    !!p &&
    number(p.x, -CITY_LIMITS.coordinateM, CITY_LIMITS.coordinateM) &&
    number(p.y, -CITY_LIMITS.coordinateM, CITY_LIMITS.coordinateM)
  );
};
const optionalKey = (v: unknown) => v === undefined || key(v);
const EPS = 1e-7;
export function cityPlanLengthM(points: readonly CityPoint[]): number {
  return points
    .slice(1)
    .reduce((n, p, i) => n + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
}
export function cityNetworkLengthM(points: readonly CityNetworkPoint[]): number {
  return points
    .slice(1)
    .reduce(
      (n, p, i) => n + Math.hypot(p.x - points[i].x, p.y - points[i].y, p.z - points[i].z),
      0,
    );
}

/** Whole-model rejection: a malformed route must never disappear from a quotation. */
export function normaliseCity(value: unknown): CityModel | undefined {
  const r = record(value),
    s = record(r?.site);
  if (
    !r ||
    r.version !== 1 ||
    typeof r.enabled !== 'boolean' ||
    !s ||
    !point(s.originM) ||
    !number(s.widthM, 1, CITY_LIMITS.siteM) ||
    !number(s.lengthM, 1, CITY_LIMITS.siteM) ||
    !Array.isArray(r.roads) ||
    r.roads.length > CITY_LIMITS.roads ||
    !Array.isArray(r.networks) ||
    r.networks.length > CITY_LIMITS.networks ||
    !Array.isArray(r.assets) ||
    r.assets.length > CITY_LIMITS.assets
  )
    return undefined;
  if (
    s.originM.x + s.widthM > CITY_LIMITS.coordinateM ||
    s.originM.y + s.lengthM > CITY_LIMITS.coordinateM
  )
    return undefined;
  const ids = new Set<string>();
  const identity = (e: Record<string, unknown>) => {
    if (!key(e.id) || !key(e.name) || ids.has(e.id) || !optionalKey(e.supplierRef)) return false;
    ids.add(e.id);
    return true;
  };
  const roads: CityRoad[] = [],
    networks: CityNetwork[] = [],
    assets: CityAsset[] = [];
  let roadSegments = 0,
    networkSegments = 0,
    linkedBuildings = 0,
    buildingAssets = 0;
  for (const raw of r.roads) {
    const e = record(raw);
    if (
      !e ||
      !identity(e) ||
      !key(e.presetId) ||
      !number(e.widthM, 0.5, 100) ||
      !number(e.surfaceDepthM, 0.001, 2) ||
      !number(e.baseDepthM, 0, 5) ||
      !Array.isArray(e.points) ||
      e.points.length < 2 ||
      e.points.length > CITY_LIMITS.pointsPerRoute ||
      !e.points.every(point)
    )
      return undefined;
    const points = e.points.map((p) => ({ x: p.x, y: p.y }));
    if (
      points.some(
        (p, i) => i > 0 && Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) < 0.01,
      )
    )
      return undefined;
    roadSegments += points.length - 1;
    if (roadSegments > CITY_LIMITS.roadSegments) return undefined;
    roads.push({
      id: e.id as string,
      name: e.name as string,
      presetId: e.presetId,
      points,
      widthM: e.widthM,
      surfaceDepthM: e.surfaceDepthM,
      baseDepthM: e.baseDepthM,
      ...(e.supplierRef ? { supplierRef: e.supplierRef as string } : {}),
    });
  }
  for (const raw of r.networks) {
    const e = record(raw);
    if (
      !e ||
      !identity(e) ||
      !CITY_NETWORK_SYSTEMS.some((system) => system.id === e.system) ||
      !number(e.diameterMm, 1, 5000) ||
      !number(e.trenchWidthM, 0.05, 20) ||
      !number(e.trenchDepthM, 0.05, 30) ||
      e.diameterMm / 1000 > e.trenchWidthM ||
      e.diameterMm / 1000 > e.trenchDepthM ||
      (e.stockLengthM !== undefined && !number(e.stockLengthM, 0.1, 10000)) ||
      !Array.isArray(e.points) ||
      e.points.length < 2 ||
      e.points.length > CITY_LIMITS.pointsPerRoute ||
      !e.points.every((p) => point(p) && number(record(p)?.z, -30, 100))
    )
      return undefined;
    const points = e.points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    if (
      points.some(
        (p, i) =>
          i > 0 &&
          Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y, p.z - points[i - 1].z) < 0.01,
      )
    )
      return undefined;
    networkSegments += points.length - 1;
    if (networkSegments > CITY_LIMITS.networkSegments) return undefined;
    networks.push({
      id: e.id as string,
      name: e.name as string,
      system: e.system as CityNetworkSystem,
      points,
      diameterMm: e.diameterMm,
      trenchWidthM: e.trenchWidthM,
      trenchDepthM: e.trenchDepthM,
      ...(e.supplierRef ? { supplierRef: e.supplierRef as string } : {}),
      ...(e.stockLengthM !== undefined ? { stockLengthM: e.stockLengthM as number } : {}),
    });
  }
  for (const raw of r.assets) {
    const e = record(raw);
    if (
      !e ||
      !identity(e) ||
      !CITY_ASSET_KINDS.some((kind) => kind.id === e.kind) ||
      !point(e) ||
      !number(e.widthM, 0.05, 1000) ||
      !number(e.lengthM, 0.05, 1000) ||
      !number(e.heightM, 0.01, 500) ||
      !number(e.rotation, -36000, 36000) ||
      (e.buildingLink !== undefined && (e.buildingLink !== 'current' || e.kind !== 'building')) ||
      ['powerW', 'solarKWp', 'batteryKWh', 'tankCapacityL'].some(
        (k) => e[k] !== undefined && !number(e[k], 0, 1e9),
      ) ||
      (e.hoursPerDay !== undefined && !number(e.hoursPerDay, 0, 24))
    )
      return undefined;
    if (e.buildingLink && ++linkedBuildings > 1) return undefined;
    if (
      (e.kind === 'building' || e.kind === 'data-centre') &&
      ++buildingAssets > CITY_LIMITS.buildingAssets
    )
      return undefined;
    const a: CityAsset = {
      id: e.id as string,
      name: e.name as string,
      kind: e.kind as CityAssetKind,
      x: e.x as number,
      y: e.y as number,
      widthM: e.widthM,
      lengthM: e.lengthM,
      heightM: e.heightM,
      rotation: ((e.rotation % 360) + 360) % 360,
    };
    if (e.supplierRef) a.supplierRef = e.supplierRef as string;
    if (e.buildingLink) a.buildingLink = 'current';
    for (const k of ['powerW', 'solarKWp', 'batteryKWh', 'tankCapacityL', 'hoursPerDay'] as const)
      if (e[k] !== undefined) a[k] = e[k] as number;
    assets.push(a);
  }
  let dataCentre: CityDataCentre | undefined;
  if (r.dataCentre !== undefined) {
    const d = record(r.dataCentre);
    if (
      !d ||
      !number(d.racks, 0, 100000) ||
      !Number.isInteger(d.racks) ||
      !number(d.kWPerRack, 0, 1000) ||
      !number(d.utilisation, 0, 1) ||
      !number(d.pue, 1, 5) ||
      !number(d.annualHours, 0, 8784) ||
      !number(d.pvKWp, 0, 1e9) ||
      !number(d.yieldKWhPerKWp, 0, 8760) ||
      !number(d.batteryKWh, 0, 1e9) ||
      !number(d.batteryUsableFraction, 0, 1) ||
      (d.wueLPerKWh !== undefined && !number(d.wueLPerKWh, 0, 100))
    )
      return undefined;
    dataCentre = {
      racks: d.racks,
      kWPerRack: d.kWPerRack,
      utilisation: d.utilisation,
      pue: d.pue,
      annualHours: d.annualHours,
      pvKWp: d.pvKWp,
      yieldKWhPerKWp: d.yieldKWhPerKWp,
      batteryKWh: d.batteryKWh,
      batteryUsableFraction: d.batteryUsableFraction,
      ...(d.wueLPerKWh !== undefined ? { wueLPerKWh: d.wueLPerKWh } : {}),
    };
  }
  return {
    version: 1,
    enabled: r.enabled,
    site: { originM: { x: s.originM.x, y: s.originM.y }, widthM: s.widthM, lengthM: s.lengthM },
    roads,
    networks,
    assets,
    ...(dataCentre ? { dataCentre } : {}),
  };
}

/** Butt-ended strip footprints are shared by takeoff and both renderers. */
export function cityCorridorPolygons(points: readonly CityPoint[], widthM: number): CityPoint[][] {
  return points.slice(1).flatMap((b, i) => {
    const a = points[i],
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < EPS) return [];
    const dx = ((-(b.y - a.y) / length) * widthM) / 2,
      dy = (((b.x - a.x) / length) * widthM) / 2;
    return [
      [
        { x: a.x + dx, y: a.y + dy },
        { x: b.x + dx, y: b.y + dy },
        { x: b.x - dx, y: b.y - dy },
        { x: a.x - dx, y: a.y - dy },
      ],
    ];
  });
}
export function cityRoadPolygons(road: CityRoad): CityPoint[][] {
  return cityCorridorPolygons(road.points, road.widthM);
}
export function cityAssetPolygon(a: CityAsset): CityPoint[] {
  const angle = (a.rotation * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => ({
    x: a.x + ((x * a.widthM) / 2) * cos - ((y * a.lengthM) / 2) * sin,
    y: a.y + ((x * a.widthM) / 2) * sin + ((y * a.lengthM) / 2) * cos,
  }));
}

/** Exact polygon union by vertical sweep; inputs are bounded rectangular corridors.
 * Deliberately independent of the browser/store and reusable by the server. */
export function cityPolygonUnionArea(polygons: readonly (readonly CityPoint[])[]): number {
  return polygonUnionSweep(polygons);
}

/** Flat-datum prism union: integrate the greatest depth at each plan point.
 * A single weighted sweep avoids repeating every intersection for every depth. */
export function cityTrenchUnionVolume(
  prisms: readonly { polygon: readonly CityPoint[]; depthM: number }[],
): number {
  return polygonUnionSweep(
    prisms.map((p) => p.polygon),
    prisms.map((p) => p.depthM),
  );
}

function polygonUnionSweep(
  polygons: readonly (readonly CityPoint[])[],
  depths?: readonly number[],
): number {
  const uniqueDepths = depths ? [...new Set(depths)].sort((a, b) => a - b) : [];
  const depthIndices = depths?.map((d) => uniqueDepths.indexOf(d));
  const activeDepthCounts = new Uint16Array(uniqueDepths.length);
  const edges = polygons.flatMap((p) => p.map((a, i) => ({ a, b: p[(i + 1) % p.length] })));
  const breaks = edges.map((e) => e.a.x);
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const { a, b } = edges[i],
        { a: c, b: d } = edges[j];
      const ux = b.x - a.x,
        uy = b.y - a.y,
        vx = d.x - c.x,
        vy = d.y - c.y,
        cross = ux * vy - uy * vx;
      if (Math.abs(cross) < EPS) continue;
      const t = ((c.x - a.x) * vy - (c.y - a.y) * vx) / cross,
        s = ((c.x - a.x) * uy - (c.y - a.y) * ux) / cross;
      if (t > 0 && t < 1 && s > 0 && s < 1) breaks.push(a.x + t * ux);
    }
  const xs = [...new Set(breaks)].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const width = xs[i] - xs[i - 1];
    if (width < EPS) continue;
    const x = (xs[i] + xs[i - 1]) / 2,
      intervals: [number, number][] = [];
    const events: [number, number, number][] = [];
    for (let pi = 0; pi < polygons.length; pi++) {
      const p = polygons[pi];
      const ys: number[] = [];
      p.forEach((a, k) => {
        const b = p[(k + 1) % p.length];
        if (x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x))
          ys.push(a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x));
      });
      ys.sort((a, b) => a - b);
      for (let k = 1; k < ys.length; k += 2) {
        if (depthIndices)
          events.push([ys[k - 1], depthIndices[pi], 1], [ys[k], depthIndices[pi], -1]);
        else intervals.push([ys[k - 1], ys[k]]);
      }
    }
    if (depthIndices) {
      events.sort((a, b) => a[0] - b[0]);
      activeDepthCounts.fill(0);
      let previousY = events[0]?.[0] ?? 0,
        maxIndex = -1,
        weightedLength = 0;
      for (const [y, index, delta] of events) {
        if (maxIndex >= 0) weightedLength += (y - previousY) * uniqueDepths[maxIndex];
        activeDepthCounts[index] += delta;
        if (delta > 0) maxIndex = Math.max(maxIndex, index);
        else while (maxIndex >= 0 && activeDepthCounts[maxIndex] === 0) maxIndex--;
        previousY = y;
      }
      area += width * weightedLength;
      continue;
    }
    let length = 0,
      end = -Infinity;
    for (const [a, b] of intervals.sort((a, b) => a[0] - b[0])) {
      length += Math.max(0, b - Math.max(a, end));
      end = Math.max(end, b);
    }
    area += width * length;
  }
  return Math.max(0, area);
}

export function estimateCityDataCentre(d: CityDataCentre) {
  const installedITKW = d.racks * d.kWPerRack,
    averageITKW = installedITKW * d.utilisation;
  const averageFacilityKW = averageITKW * d.pue,
    annualITKWh = averageITKW * d.annualHours,
    annualFacilityKWh = averageFacilityKW * d.annualHours;
  const annualSolarKWh = d.pvKWp * d.yieldKWhPerKWp;
  return {
    installedITKW,
    averageITKW,
    averageFacilityKW,
    annualITKWh,
    annualFacilityKWh,
    annualSolarKWh,
    annualBalanceKWh: annualSolarKWh - annualFacilityKWh,
    annualSolarEquivalentPct:
      annualFacilityKWh > 0 ? (annualSolarKWh / annualFacilityKWh) * 100 : null,
    batteryUsableKWh: d.batteryKWh * d.batteryUsableFraction,
    batteryAutonomyHours:
      averageFacilityKW > 0 ? (d.batteryKWh * d.batteryUsableFraction) / averageFacilityKW : null,
    annualWaterL: d.wueLPerKWh !== undefined ? annualITKWh * d.wueLPerKWh : null,
  };
}

export function estimateCity(input: CityModel) {
  const model = normaliseCity(input);
  if (!model) throw new Error('Invalid city model: quantities withheld.');
  const warnings = [
    'Planning takeoff only. Road, pavement, drainage, utility, fire and data-centre designs require project-specific professional review.',
    'Road footprints are unions of butt-ended strips. Kerbs, junction design, turning radii, crossfall, cut/fill and geological conditions are not inferred.',
    'Utility crossings are not connections. Route quantities do not establish capacity, pressure, voltage drop, earthing, resilience or utility consent.',
  ];
  const quantityIncompleteReasons: string[] = [];
  const roads = (model.enabled ? model.roads : []).map((road) => ({
    id: road.id,
    name: road.name,
    lengthM: cityPlanLengthM(road.points),
    footprintM2: cityPolygonUnionArea(cityRoadPolygons(road)),
    supplierRef: road.supplierRef ?? null,
  }));
  const activeRoads = model.enabled ? model.roads : [],
    roadPolygons = activeRoads.flatMap(cityRoadPolygons),
    roadAreaM2 = cityPolygonUnionArea(roadPolygons);
  const profiles = new Map<string, { roads: CityRoad[]; areaM2: number }>();
  for (const road of activeRoads) {
    const key = `${road.surfaceDepthM}|${road.baseDepthM}|${road.supplierRef ?? ''}`;
    if (!profiles.has(key)) profiles.set(key, { roads: [], areaM2: 0 });
    profiles.get(key)!.roads.push(road);
  }
  for (const p of profiles.values())
    p.areaM2 = cityPolygonUnionArea(p.roads.flatMap(cityRoadPolygons));
  const overlappingProfiles =
    [...profiles.values()].reduce((n, p) => n + p.areaM2, 0) - roadAreaM2 >
    Math.max(1e-5, roadAreaM2 * 1e-8);
  if (overlappingProfiles)
    quantityIncompleteReasons.push(
      'Overlapping roads have different layer depths or supplier specifications. Resolve the junction specification before road layer quantities can be combined.',
    );
  const roadSurfaceM3 = overlappingProfiles
    ? null
    : [...profiles.values()].reduce((n, p) => n + p.areaM2 * p.roads[0].surfaceDepthM, 0);
  const roadBaseM3 = overlappingProfiles
    ? null
    : [...profiles.values()].reduce((n, p) => n + p.areaM2 * p.roads[0].baseDepthM, 0);
  const activeNetworks = model.enabled ? model.networks : [];
  const networks = activeNetworks.map((n) => {
    const lengthM = cityNetworkLengthM(n.points),
      planLengthM = cityPlanLengthM(n.points);
    return {
      id: n.id,
      name: n.name,
      system: n.system,
      lengthM,
      planLengthM,
      trenchFootprintM2: cityPolygonUnionArea(cityCorridorPolygons(n.points, n.trenchWidthM)),
      stockLengths: n.stockLengthM ? Math.ceil((lengthM - 1e-9) / n.stockLengthM) : null,
      supplierRef: n.supplierRef ?? null,
    };
  });
  const trenchDepths = [...new Set(activeNetworks.map((n) => n.trenchDepthM))].sort(
    (a, b) => a - b,
  );
  let trenchUniqueVolumeM3: number | null = 0;
  if (trenchDepths.length > CITY_LIMITS.distinctTrenchDepths) {
    trenchUniqueVolumeM3 = null;
    quantityIncompleteReasons.push(
      'More than 16 distinct trench depths: split the site into coordinated packages before union excavation takeoff.',
    );
  } else
    trenchUniqueVolumeM3 = cityTrenchUnionVolume(
      activeNetworks.flatMap((n) =>
        cityCorridorPolygons(n.points, n.trenchWidthM).map((polygon) => ({
          polygon,
          depthM: n.trenchDepthM,
        })),
      ),
    );
  const uncontained = activeNetworks.filter((n) =>
    n.points.some(
      (p) => p.z + n.diameterMm / 2000 > EPS || p.z - n.diameterMm / 2000 < -n.trenchDepthM - EPS,
    ),
  );
  if (uncontained.length)
    quantityIncompleteReasons.push(
      `${uncontained.length} utility route(s) are outside their below-ground trench envelope. Adjust depth/elevation or design an above-ground support route.`,
    );
  if (
    activeNetworks.some((n) =>
      n.points.some(
        (p, i) => i > 0 && Math.hypot(p.x - n.points[i - 1].x, p.y - n.points[i - 1].y) < EPS,
      ),
    )
  )
    quantityIncompleteReasons.push(
      'Vertical risers are included in service length; access chambers and shaft excavation must be added separately.',
    );
  if (activeNetworks.length)
    warnings.push(
      'Trench volume is the union of vertical-sided plan corridors below flat ground datum. Shoring, batter, bedding, pipe displacement and disposal bulking are excluded. Shared trench space is not approval to co-locate services.',
    );
  const activeAssets = model.enabled ? model.assets : [],
    buildings = activeAssets.filter((a) => a.kind === 'building' || a.kind === 'data-centre');
  const counts = Object.fromEntries(
    CITY_ASSET_KINDS.map((k) => [k.id, activeAssets.filter((a) => a.kind === k.id).length]),
  ) as Record<CityAssetKind, number>;
  const networkLengthsM = Object.fromEntries(
    CITY_NETWORK_SYSTEMS.map((s) => [
      s.id,
      networks.filter((n) => n.system === s.id).reduce((total, n) => total + n.lengthM, 0),
    ]),
  ) as Record<CityNetworkSystem, number>;
  const extentPoints = [
    ...roadPolygons.flat(),
    ...activeNetworks.flatMap((n) => n.points),
    ...activeAssets.flatMap(cityAssetPolygon),
  ];
  const site = model.site;
  if (
    extentPoints.some(
      (p) =>
        p.x < site.originM.x - EPS ||
        p.y < site.originM.y - EPS ||
        p.x > site.originM.x + site.widthM + EPS ||
        p.y > site.originM.y + site.lengthM + EPS,
    )
  )
    warnings.push(
      'Some geometry extends beyond the site rectangle. Quantities include the complete geometry; no silent clipping is applied.',
    );
  const dataCentre =
    model.enabled && model.dataCentre ? estimateCityDataCentre(model.dataCentre) : null;
  if (dataCentre)
    warnings.push(
      'Data-centre energy is a scenario, not a meter reading or uptime certification. Annual solar balance does not prove hourly self-sufficiency. Battery autonomy excludes inverter limits, reserves and conversion losses. WUE uses IT energy.',
    );
  const unknownAssetLoadCount = activeAssets.filter(
    (a) =>
      ((a.kind === 'solar-light' || a.kind === 'ev-charger') && a.powerW === undefined) ||
      (a.powerW !== undefined && a.powerW > 0 && a.hoursPerDay === undefined),
  ).length;
  const knownAssetDailyLoadKWh = activeAssets.reduce(
    (n, a) => n + ((a.powerW ?? 0) * (a.hoursPerDay ?? 0)) / 1000,
    0,
  );
  const unknownSolarAssetCount = activeAssets.filter(
    (a) => (a.kind === 'pv-array' || a.kind === 'solar-light') && a.solarKWp === undefined,
  ).length;
  const unknownBatteryAssetCount = activeAssets.filter(
    (a) => (a.kind === 'battery' || a.kind === 'solar-light') && a.batteryKWh === undefined,
  ).length;
  const unknownTankAssetCount = activeAssets.filter(
    (a) => a.kind === 'water-tank' && a.tankCapacityL === undefined,
  ).length;
  if (
    unknownAssetLoadCount ||
    unknownSolarAssetCount ||
    unknownBatteryAssetCount ||
    unknownTankAssetCount
  )
    warnings.push(
      'Some equipment performance ratings or operating hours are unknown. Capacity subtotals include supplied ratings only; drawing size does not establish performance. Building internal loads and the separate data-centre scenario are not added to equipment subtotals.',
    );
  return {
    enabled: model.enabled,
    siteAreaM2: site.widthM * site.lengthM,
    roads,
    roadLengthM: roads.reduce((n, r) => n + r.lengthM, 0),
    roadAreaM2,
    roadSurfaceM3,
    roadBaseM3,
    networks,
    networkLengthsM,
    trenchUniqueVolumeM3,
    counts,
    assetCount: activeAssets.length,
    footprintM2: cityPolygonUnionArea(buildings.map(cityAssetPolygon)),
    solarKWp: activeAssets.reduce((n, a) => n + (a.solarKWp ?? 0), 0),
    batteryKWh: activeAssets.reduce((n, a) => n + (a.batteryKWh ?? 0), 0),
    tankCapacityL: activeAssets.reduce((n, a) => n + (a.tankCapacityL ?? 0), 0),
    assetDailyLoadKWh: unknownAssetLoadCount ? null : knownAssetDailyLoadKWh,
    knownAssetDailyLoadKWh,
    unknownAssetLoadCount,
    unknownSolarAssetCount,
    unknownBatteryAssetCount,
    unknownTankAssetCount,
    dataCentre,
    warnings,
    quantityIncompleteReasons,
    quantitiesComplete: quantityIncompleteReasons.length === 0,
  };
}

export function cityBounds(model: CityModel) {
  const points = [
    model.site.originM,
    { x: model.site.originM.x + model.site.widthM, y: model.site.originM.y + model.site.lengthM },
    ...model.roads.flatMap(cityRoadPolygons).flat(),
    ...model.networks.flatMap((n) => n.points),
    ...model.assets.flatMap(cityAssetPolygon),
  ];
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
    maxHeightM: Math.max(1, ...model.assets.map((a) => a.heightM)),
  };
}

/** Explicitly inserted sample, never an automatic migration or certified specification. */
export function sampleCity(): CityModel {
  const model = emptyCity();
  model.roads = [
    {
      id: 'city-road-east',
      name: 'Main access — edit section',
      presetId: 'local-access',
      points: [
        { x: -25, y: 70 },
        { x: 200, y: 70 },
      ],
      widthM: 6,
      surfaceDepthM: 0.05,
      baseDepthM: 0.2,
    },
    {
      id: 'city-road-north',
      name: 'District access — edit section',
      presetId: 'local-access',
      points: [
        { x: 80, y: -25 },
        { x: 80, y: 170 },
      ],
      widthM: 6,
      surfaceDepthM: 0.05,
      baseDepthM: 0.2,
    },
  ];
  model.networks = CITY_NETWORK_SYSTEMS.map((s, i) => ({
    id: `city-${s.id}`,
    name: `${s.label} — proposed corridor`,
    system: s.id,
    points: [
      { x: -20, y: 77 + i * 1.5, z: -0.7 },
      { x: 190, y: 77 + i * 1.5, z: -0.7 },
    ],
    diameterMm: s.id === 'sewer' || s.id === 'stormwater' ? 200 : 100,
    trenchWidthM: 0.6,
    trenchDepthM: 1,
  }));
  model.assets = [
    {
      id: 'city-current-building',
      name: 'Current building — open house tools',
      kind: 'building',
      x: 15,
      y: 15,
      widthM: 20,
      lengthM: 20,
      heightM: 6,
      rotation: 0,
      buildingLink: 'current',
    },
    {
      id: 'city-data-centre',
      name: 'Data centre — planning envelope',
      kind: 'data-centre',
      x: 125,
      y: 30,
      widthM: 40,
      lengthM: 30,
      heightM: 8,
      rotation: 0,
    },
    {
      id: 'city-park',
      name: 'Rain garden / green space',
      kind: 'park',
      x: 140,
      y: 125,
      widthM: 60,
      lengthM: 45,
      heightM: 0.1,
      rotation: 0,
    },
    {
      id: 'city-solar',
      name: 'PV field — planning envelope',
      kind: 'pv-array',
      x: 35,
      y: 130,
      widthM: 40,
      lengthM: 25,
      heightM: 2,
      rotation: 0,
    },
    ...[0, 1, 2, 3].map((i) => ({
      id: `city-light-${i}`,
      name: `Solar streetlight ${i + 1} — planning envelope`,
      kind: 'solar-light' as const,
      x: 10 + i * 50,
      y: 64,
      widthM: 0.4,
      lengthM: 0.4,
      heightM: 6,
      rotation: 0,
    })),
  ];
  model.dataCentre = {
    racks: 10,
    kWPerRack: 5,
    utilisation: 0.5,
    pue: 1.4,
    annualHours: 8760,
    pvKWp: 0,
    yieldKWhPerKWp: 0,
    batteryKWh: 0,
    batteryUsableFraction: 0.8,
  };
  return model;
}
