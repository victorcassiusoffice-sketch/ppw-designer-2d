import { distance, makeSite } from './geometry';

/** The optional, versioned Site payload. No map/runtime dependency belongs here. */
export type XY = { x: number; y: number };
export type LonLat = [number, number];
export type Source = 'drawn' | 'typed what-if' | 'public data' | 'survey' | 'unavailable';
export type HeightPoint = XY & { z: number };
export interface TerrainInput {
  source: 'typed what-if' | 'survey';
  verticalReference: string;
  points: HeightPoint[];
  /** Consecutive point indices in each line. Triangulation honours these segments. */
  contours?: number[][];
  platformM: number;
}
export interface PublicSnapshot {
  fetchedAt: string;
  solar?: {
    annualKwh: number;
    tiltDeg: number;
    sourceUrl: string;
    acquiredAt?: string;
    radiationDatabase?: string;
    periodStartYear?: number;
    periodEndYear?: number;
    version?: string;
  };
  context?: {
    roads: number;
    buildings: number;
    waterways: number;
    power: number;
    landuse: string[];
    sourceUrl: string;
    acquiredAt?: string;
  };
  terrain?: {
    heightsM: number[];
    resolutionM: number;
    sourceUrl: string;
    verticalReference: string;
    sources?: string[];
    attribution?: string;
    resolutionNote?: string;
    acquiredAt?: string;
  };
  errors?: string[];
}
export interface GeoSite {
  version: 1;
  name: string;
  origin: LonLat;
  boundary: LonLat[];
  /** East/right, north/up (negative y); first boundary corner is the plan anchor. */
  polygon: XY[];
  anchor: XY;
  entry: 'drawn' | 'traverse';
  traverse?: { lengthM: number; bearing: string }[];
  closureErrorM?: number;
  terrain?: TerrainInput;
  planning?: { setbackM: number; maxCoveragePct: number; source: string; verified: boolean };
  publicData?: PublicSnapshot;
  foundationShiftM?: number;
  sample?: true;
}
export const REPORT_BANNER =
  'Estimates from public data for planning a conversation, not a survey and not an approval.';
export const boundaryLabel = (s: Pick<GeoSite, 'entry'>) =>
  s.entry === 'traverse'
    ? 'Typed from a surveyor’s plan by you; not checked against the cadastre.'
    : 'Boundary drawn by you; not a cadastral survey.';

const finite = (x: unknown, max = 1e7): x is number =>
  typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= max;
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;
const xy = (x: unknown): x is XY => object(x) && finite(x.x) && finite(x.y);
const heightPoint = (x: unknown): x is HeightPoint => xy(x) && 'z' in x && finite(x.z, 10000);
const ll = (x: unknown): x is LonLat =>
  Array.isArray(x) && x.length === 2 && finite(x[0], 180) && finite(x[1], 85);
const timestamp = (x: unknown): x is string => text(x, 64) && Number.isFinite(Date.parse(x));
const stringList = (x: unknown, count: number, length: number): x is string[] =>
  Array.isArray(x) && x.length <= count && x.every((s) => text(s, length));
const sourceUrl = (x: unknown, prefix: string): x is string =>
  text(x, 2048) && x.startsWith(prefix);
const year = (x: unknown): x is number => finite(x, 2200) && Number.isInteger(x) && x >= 1900;

/** Copy only bounded, recognised public response fields. Cached acquisition dates stay intact. */
function normalisePublicSnapshot(value: unknown, cornerCount: number): PublicSnapshot | undefined {
  if (!object(value) || !timestamp(value.fetchedAt)) return;
  const out: PublicSnapshot = { fetchedAt: value.fetchedAt };
  if (value.errors !== undefined) {
    if (!stringList(value.errors, 20, 2000)) return;
    out.errors = [...value.errors];
  }
  if (value.solar !== undefined) {
    const s = value.solar;
    if (
      !object(s) ||
      !finite(s.annualKwh) ||
      s.annualKwh < 0 ||
      !finite(s.tiltDeg, 90) ||
      s.tiltDeg < 0 ||
      !sourceUrl(s.sourceUrl, 'https://re.jrc.ec.europa.eu/') ||
      (s.acquiredAt !== undefined && !timestamp(s.acquiredAt)) ||
      (s.radiationDatabase !== undefined && !text(s.radiationDatabase, 100)) ||
      (s.version !== undefined && !text(s.version, 80)) ||
      (s.periodStartYear !== undefined && !year(s.periodStartYear)) ||
      (s.periodEndYear !== undefined && !year(s.periodEndYear)) ||
      (year(s.periodStartYear) && year(s.periodEndYear) && s.periodStartYear > s.periodEndYear)
    )
      return;
    out.solar = { annualKwh: s.annualKwh, tiltDeg: s.tiltDeg, sourceUrl: s.sourceUrl };
    if (timestamp(s.acquiredAt)) out.solar.acquiredAt = s.acquiredAt;
    if (text(s.radiationDatabase, 100)) out.solar.radiationDatabase = s.radiationDatabase;
    if (text(s.version, 80)) out.solar.version = s.version;
    if (year(s.periodStartYear)) out.solar.periodStartYear = s.periodStartYear;
    if (year(s.periodEndYear)) out.solar.periodEndYear = s.periodEndYear;
  }
  if (value.context !== undefined) {
    const c = value.context;
    if (
      !object(c) ||
      !['roads', 'buildings', 'waterways', 'power'].every(
        (key) => finite(c[key]) && Number.isInteger(c[key]) && Number(c[key]) >= 0,
      ) ||
      !stringList(c.landuse, 200, 160) ||
      !sourceUrl(c.sourceUrl, 'https://www.openstreetmap.org/') ||
      (c.acquiredAt !== undefined && !timestamp(c.acquiredAt))
    )
      return;
    out.context = {
      roads: c.roads as number,
      buildings: c.buildings as number,
      waterways: c.waterways as number,
      power: c.power as number,
      landuse: [...c.landuse],
      sourceUrl: c.sourceUrl,
    };
    if (timestamp(c.acquiredAt)) out.context.acquiredAt = c.acquiredAt;
  }
  if (value.terrain !== undefined) {
    const t = value.terrain;
    if (
      !object(t) ||
      !Array.isArray(t.heightsM) ||
      t.heightsM.length !== cornerCount ||
      !t.heightsM.every((h) => finite(h, 10000)) ||
      !finite(t.resolutionM) ||
      t.resolutionM <= 0 ||
      !text(t.verticalReference, 300) ||
      !t.verticalReference.trim() ||
      !sourceUrl(t.sourceUrl, 'https://github.com/tilezen/joerd/') ||
      (t.sources !== undefined && !stringList(t.sources, 200, 2000)) ||
      (t.attribution !== undefined && !text(t.attribution, 2000)) ||
      (t.resolutionNote !== undefined && !text(t.resolutionNote, 1000)) ||
      (t.acquiredAt !== undefined && !timestamp(t.acquiredAt))
    )
      return;
    out.terrain = {
      heightsM: [...t.heightsM],
      resolutionM: t.resolutionM,
      sourceUrl: t.sourceUrl,
      verticalReference: t.verticalReference,
    };
    if (Array.isArray(t.sources)) out.terrain.sources = [...t.sources];
    if (text(t.attribution, 2000)) out.terrain.attribution = t.attribution;
    if (text(t.resolutionNote, 1000)) out.terrain.resolutionNote = t.resolutionNote;
    if (timestamp(t.acquiredAt)) out.terrain.acquiredAt = t.acquiredAt;
  }
  // Whitelisting first also avoids following circular or oversized unknown fields.
  return JSON.stringify(out).length <= 30000 ? out : undefined;
}

/** Bounded, JSON-only persistence; absent payload emits no new legacy keys. */
export function normaliseGeoSite(value: unknown): GeoSite | undefined {
  if (
    !object(value) ||
    value.version !== 1 ||
    !ll(value.origin) ||
    !xy(value.anchor) ||
    !Array.isArray(value.boundary) ||
    value.boundary.length < 3 ||
    value.boundary.length > 200 ||
    !value.boundary.every(ll) ||
    !Array.isArray(value.polygon) ||
    value.polygon.length !== value.boundary.length ||
    !value.polygon.every(xy) ||
    (value.entry !== 'drawn' && value.entry !== 'traverse') ||
    !text(value.name, 160)
  )
    return;
  let canonical: GeoSite;
  try {
    canonical = makeSite(value.boundary, value.name, value.anchor, value.entry);
  } catch {
    return;
  }
  if (
    value.origin.some((coordinate, i) => Math.abs(coordinate - canonical.origin[i]) > 1e-12) ||
    value.polygon.some((point, i) => distance(point, canonical.polygon[i]) > 0.001)
  )
    return;
  const out: GeoSite = {
    version: 1,
    name: value.name,
    origin: [...value.origin],
    boundary: value.boundary.map((p) => [...p] as LonLat),
    polygon: value.polygon.map((p) => ({ x: p.x, y: p.y })),
    anchor: { x: value.anchor.x, y: value.anchor.y },
    entry: value.entry,
  };
  if (value.terrain !== undefined) {
    const t = value.terrain;
    if (
      !object(t) ||
      (t.source !== 'survey' && t.source !== 'typed what-if') ||
      !text(t.verticalReference, 300) ||
      !t.verticalReference.trim() ||
      !finite(t.platformM, 10000) ||
      !Array.isArray(t.points) ||
      t.points.length < 3 ||
      t.points.length > 1000 ||
      !t.points.every(heightPoint)
    )
      return;
    const points = t.points;
    if (
      t.source === 'typed what-if' &&
      (points.length !== out.polygon.length ||
        points.some((point, i) => distance(point, out.polygon[i]) > 0.001))
    )
      return;
    if (
      t.contours !== undefined &&
      (!Array.isArray(t.contours) ||
        t.contours.length > 200 ||
        !t.contours.every(
          (line) =>
            Array.isArray(line) &&
            line.length >= 2 &&
            line.length <= 1000 &&
            line.every((i) => Number.isInteger(i) && i >= 0 && i < points.length),
        ) ||
        t.contours.reduce((sum, line) => sum + line.length, 0) > 1000)
    )
      return;
    out.terrain = {
      source: t.source,
      verticalReference: t.verticalReference,
      points: points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      platformM: t.platformM,
    };
    if (Array.isArray(t.contours)) out.terrain.contours = t.contours.map((line) => [...line]);
  }
  if (value.planning !== undefined) {
    const p = value.planning;
    if (
      !object(p) ||
      !finite(p.setbackM, 1000) ||
      p.setbackM < 0 ||
      !finite(p.maxCoveragePct, 100) ||
      p.maxCoveragePct <= 0 ||
      !text(p.source, 1000) ||
      !p.source.trim() ||
      typeof p.verified !== 'boolean'
    )
      return;
    out.planning = {
      setbackM: p.setbackM,
      maxCoveragePct: p.maxCoveragePct,
      source: p.source,
      verified: p.verified,
    };
  }
  if (value.closureErrorM !== undefined) {
    if (!finite(value.closureErrorM) || value.closureErrorM < 0) return;
    out.closureErrorM = value.closureErrorM;
  }
  if (value.foundationShiftM !== undefined) {
    if (!finite(value.foundationShiftM, 100)) return;
    out.foundationShiftM = value.foundationShiftM;
  }
  if (value.traverse !== undefined) {
    if (
      !Array.isArray(value.traverse) ||
      value.traverse.length > 200 ||
      !value.traverse.every(
        (l) => object(l) && finite(l.lengthM, 10000) && l.lengthM > 0 && text(l.bearing, 79),
      )
    )
      return;
    out.traverse = value.traverse.map((l) => ({ lengthM: l.lengthM, bearing: l.bearing }));
  }
  if (value.publicData !== undefined) {
    const publicData = normalisePublicSnapshot(value.publicData, out.boundary.length);
    if (!publicData) return;
    out.publicData = publicData;
  }
  if (value.sample !== undefined) {
    if (value.sample !== true) return;
    out.sample = true;
  }
  return out;
}
