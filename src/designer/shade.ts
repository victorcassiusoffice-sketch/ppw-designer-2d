/**
 * Shade sails: tensioned fabric canopies between three to six fixing points.
 *
 * The model keeps the fixing points (posts or wall brackets) with their plan
 * position and fixing height. The engine works out what a sail maker and an
 * installer need before a quote: the finished corner-to-corner sizes, the
 * curved edges, how far a made sail can still be stretched to reach its
 * points, the saddle (hypar) twist, typical post sizes and footings, the
 * corner loads from the fabric prestress, the fabric quantity and where the
 * shade falls in Mauritius. Every number carries its basis. Nothing here is a
 * structural design, a wind-load certificate or a price; cyclone wind on a
 * fixed canopy is an engineer's call.
 *
 * Sources (read 31 Oct 2026; all typical values, not a maker's datasheet):
 *  S1 Sunnyside measuring guide: 250 to 300 mm per corner for hardware.
 *  S2 Shade Sails Canada: 7 % edge curve of the straight chord; 20 % slope.
 *  S3 Sunnyside wire-edge guide / BackyardCity: about 5 % working stretch in
 *     knitted HDPE cloth, 2 % in the edge wire.
 *  S4 Serge Ferrari Flexlight / Precontraint datasheets: under 1.2 %
 *     elongation at 10 daN per 5 cm for PVC-coated polyester.
 *  S5 Gale Pacific pattern compensation: cut 2.5 % less in width, 5 % less
 *     in length for knitted shade fabric.
 *  S6 LSAA (Australia) fabric structures notes: edge cable tension T = w x R
 *     (prestress times edge radius); shade-cloth prestress about 0.25 kN/m,
 *     PVC 1.5 kN/m; avoid very pointy corners; keep side ratios near; a flat
 *     four-point sail deflects 500 mm where a hypar deflects 350 mm.
 *  S7 textiles.org / Tenshon / Royal Pools: hypar height difference 20 to
 *     30 % of the span, never under about 0.9 m between high and low points.
 *  S8 Sunnyside pole and footing guide (medium to high wind, firm ground):
 *     CHS 89 x 3.2 for a 4 m sail on a 2.5 m pole to 139.7 x 4.5 for 5 m
 *     poles; footings 1.0 to 1.4 m deep, 300 to 400 mm bore.
 *  S9 Carefree / Royal Pools / Home Depot guides: 100 mm steel minimum, a
 *     third of the post buried, lean out 5 to 10 degrees.
 *  S10 Mauritius Meteorological Services: cyclone warning classes are keyed
 *     to gusts of 120 km/h; the island's record gust is 280 km/h (Gervaise,
 *     1975). Council guidance (Karratha, NT): knitted sails come down before a
 *     cyclone; stretch-tent PVC fabrics are rated 60 to 85 km/h by makers.
 *  S11 Cancer Council / Carefree: shade falls under the sail only near
 *     midsummer noon; the LSAA worked example covers about 65 % of the post
 *     footprint.
 */

export type ShadeFabricId = 'hdpe-knit' | 'pvc-coated';
export type ShadeSupport = 'post' | 'wall';

export interface ShadeFabricSpec {
  id: ShadeFabricId;
  label: string;
  /** Stretch available at working tension, fraction of the finished chord. */
  workingStretch: number;
  /** Pattern compensation the maker cuts out, fractions of width and length. */
  cutUndersize: { width: number; length: number };
  /** Membrane prestress in kN per metre. */
  prestressKNPerM: number;
  /** Share of sunlight blocked, informational. */
  shadeFactorPct: number;
  waterproof: boolean;
  /** Standard roll width; wider sails are seamed. */
  rollWidthM: number;
  cycloneRule: string;
  basis: string;
}

export const SHADE_FABRICS: readonly ShadeFabricSpec[] = [
  { id: 'hdpe-knit', label: 'Knitted shade cloth (HDPE)', workingStretch: 0.05, cutUndersize: { width: 0.025, length: 0.05 }, prestressKNPerM: 0.25, shadeFactorPct: 90, waterproof: false, rollWidthM: 3.25,
    cycloneRule: 'Take the sail down before a cyclone; knitted cloth is not a storm structure.', basis: 'S3 working stretch about 5 %; S5 cut 2.5 % / 5 % under; S6 prestress about 0.25 kN/m; S10 removal before a cyclone.' },
  { id: 'pvc-coated', label: 'PVC-coated polyester (waterproof)', workingStretch: 0.012, cutUndersize: { width: 0.005, length: 0.005 }, prestressKNPerM: 1.5, shadeFactorPct: 100, waterproof: true, rollWidthM: 2.5,
    cycloneRule: 'Fixed PVC canopies need an engineer for cyclone wind; stretch-fabric makers rate their sails for 60 to 85 km/h and expect them down before a cyclone.', basis: 'S4 under 1.2 % elongation at working load; S6 prestress about 1.5 kN/m; S10.' },
];
export const shadeFabric = (id: ShadeFabricId): ShadeFabricSpec => SHADE_FABRICS.find(f => f.id === id) ?? SHADE_FABRICS[0];

export interface ShadeAnchor {
  id: string;
  /** Plan metres, the house's world metres. */
  x: number;
  y: number;
  /** Fixing-point height above the ground datum. */
  heightM: number;
  support: ShadeSupport;
}
export interface ShadeMade {
  /** Finished corner-to-corner chords of a sail that already exists, metres, one per edge in anchor order. */
  edgesM: number[];
}
export interface ShadeSail {
  id: string;
  name: string;
  fabric: ShadeFabricId;
  anchors: ShadeAnchor[];
  /** Hardware allowance between the fixing point and the sail corner. */
  cornerGapM: number;
  /** Edge curve depth as a share of the straight chord. */
  edgeCurvePct: number;
  /** Presentation only. */
  colour: string;
  /** Present when the sail is already made to known sizes. */
  made?: ShadeMade;
}
export interface ShadeModel {
  version: 1;
  enabled: boolean;
  sails: ShadeSail[];
}

export const EMPTY_SHADE: ShadeModel = { version: 1, enabled: false, sails: [] };
export const SHADE_SAIL_LIMIT = 20;
export const SHADE_MIN_ANCHORS = 3;
export const SHADE_MAX_ANCHORS = 6;
export const SHADE_DEFAULT_CORNER_GAP_M = 0.3;
export const SHADE_DEFAULT_EDGE_CURVE_PCT = 7;
export const SHADE_COLOURS: readonly { hex: string; label: string }[] = [
  { hex: '#e9e3d4', label: 'Sand' }, { hex: '#6d7f74', label: 'Eucalyptus' }, { hex: '#2d3a3f', label: 'Charcoal' },
  { hex: '#b2473a', label: 'Terracotta' }, { hex: '#3f6c9c', label: 'Ocean' }, { hex: '#f3f2ee', label: 'White' },
];
export const hasShadeGeometry = (model?: ShadeModel): boolean => !!model?.enabled && model.sails.length > 0;

const record = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const n = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const key = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 128;
const hex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** Invalid sails are rejected, never clamped into a different physical size. */
export function normaliseShade(value: unknown): ShadeModel | undefined {
  const raw = record(value);
  if (!raw || raw.version !== 1 || typeof raw.enabled !== 'boolean' || !Array.isArray(raw.sails) || raw.sails.length > SHADE_SAIL_LIMIT) return undefined;
  const ids = new Set<string>();
  const sails: ShadeSail[] = [];
  for (const item of raw.sails) {
    const s = record(item);
    if (!s || !key(s.id) || ids.has(s.id) || !key(s.name) || !SHADE_FABRICS.some(f => f.id === s.fabric) || !Array.isArray(s.anchors)
      || s.anchors.length < SHADE_MIN_ANCHORS || s.anchors.length > SHADE_MAX_ANCHORS || !n(s.cornerGapM, 0.05, 1) || !n(s.edgeCurvePct, 0, 15) || !hex(s.colour)) return undefined;
    const anchorIds = new Set<string>();
    const anchors: ShadeAnchor[] = [];
    for (const value of s.anchors) {
      const a = record(value);
      if (!a || !key(a.id) || anchorIds.has(a.id) || !n(a.x, -10000, 10000) || !n(a.y, -10000, 10000) || !n(a.heightM, 0.5, 12) || (a.support !== 'post' && a.support !== 'wall')) return undefined;
      anchorIds.add(a.id);
      anchors.push({ id: a.id, x: a.x, y: a.y, heightM: a.heightM, support: a.support });
    }
    let made: ShadeMade | undefined;
    if (s.made !== undefined) {
      const m = record(s.made);
      if (!m || !Array.isArray(m.edgesM) || m.edgesM.length !== anchors.length || !m.edgesM.every(e => n(e, 0.3, 60))) return undefined;
      made = { edgesM: [...(m.edgesM as number[])] };
    }
    ids.add(s.id);
    sails.push({ id: s.id, name: s.name, fabric: s.fabric as ShadeFabricId, anchors, cornerGapM: s.cornerGapM, edgeCurvePct: s.edgeCurvePct, colour: s.colour, ...(made ? { made } : {}) });
  }
  return { version: 1, enabled: raw.enabled, sails };
}

// ---------------------------------------------------------------- geometry

export interface Point3 { x: number; y: number; z: number; }
const sub = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: Point3) => Math.hypot(v.x, v.y, v.z);
const planLen = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const round = (v: number, places = 3) => Math.round(v * 10 ** places) / 10 ** places;

/** Shoelace area of the plan polygon, always positive. */
export function shadePlanArea(points: readonly { x: number; y: number }[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; twice += a.x * b.y - b.x * a.y; }
  return Math.abs(twice) / 2;
}
/** Interior angle at corner i of the plan polygon, degrees. */
export function shadeCornerAngleDeg(points: readonly { x: number; y: number }[], i: number): number {
  const p = points[i], a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
  const ux = a.x - p.x, uy = a.y - p.y, vx = b.x - p.x, vy = b.y - p.y;
  const dot = ux * vx + uy * vy, cross = ux * vy - uy * vx;
  return Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI;
}
function segmentsCross(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }): boolean {
  const orient = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b) && orient(a, b, c) !== 0 && orient(a, b, d) !== 0 && orient(c, d, a) !== 0 && orient(c, d, b) !== 0;
}
/** Non-adjacent edges of a sail outline must not cross. */
export function shadeOutlineSimple(points: readonly { x: number; y: number }[]): boolean {
  const m = points.length;
  for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) {
    if (i === 0 && j === m - 1) continue;
    if (segmentsCross(points[i], points[(i + 1) % m], points[j], points[(j + 1) % m])) return false;
  }
  return true;
}
/** Corner points of the finished sail: each fixing point moved inward along its bisector by the hardware gap. */
export function shadeSailCorners(sail: ShadeSail): Point3[] {
  const pts = sail.anchors;
  const m = pts.length;
  const area2 = pts.reduce((s, a, i) => { const b = pts[(i + 1) % m]; return s + a.x * b.y - b.x * a.y; }, 0);
  const cx = pts.reduce((s, p) => s + p.x, 0) / m, cy = pts.reduce((s, p) => s + p.y, 0) / m;
  return pts.map((p, i) => {
    const a = pts[(i + m - 1) % m], b = pts[(i + 1) % m];
    const ua = { x: a.x - p.x, y: a.y - p.y }, ub = { x: b.x - p.x, y: b.y - p.y };
    const la = Math.hypot(ua.x, ua.y) || 1, lb = Math.hypot(ub.x, ub.y) || 1;
    let bx = ua.x / la + ub.x / lb, by = ua.y / la + ub.y / lb;
    let bl = Math.hypot(bx, by);
    if (bl < 1e-6) { bx = cx - p.x; by = cy - p.y; bl = Math.hypot(bx, by) || 1; }
    bx /= bl; by /= bl;
    // The bisector points inward for either winding when it also points toward the centroid.
    const toCentre = (cx - p.x) * bx + (cy - p.y) * by;
    const sign = toCentre >= 0 ? 1 : -1;
    void area2;
    return { x: p.x + bx * sign * sail.cornerGapM, y: p.y + by * sign * sail.cornerGapM, z: p.heightM };
  });
}
/** Inward unit normal of edge i (from corner i to i+1) in plan. */
function inwardNormal(corners: readonly Point3[], i: number): { x: number; y: number } {
  const m = corners.length, a = corners[i], b = corners[(i + 1) % m];
  const cx = corners.reduce((s, p) => s + p.x, 0) / m, cy = corners.reduce((s, p) => s + p.y, 0) / m;
  const ex = b.x - a.x, ey = b.y - a.y, l = Math.hypot(ex, ey) || 1;
  let nx = -ey / l, ny = ex / l;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
  return { x: nx, y: ny };
}

// ----------------------------------------------------------------- the report

export type ShadeFitStatus = 'made-to-points' | 'fits' | 'slack' | 'over-stretch';
export interface ShadeEdgeReport {
  index: number;
  from: string;
  to: string;
  /** Fixing point to fixing point, three dimensions. */
  spanM: number;
  planSpanM: number;
  /** Finished sail corner to corner after the hardware gaps. */
  chordM: number;
  curveDepthM: number;
  curvedEdgeM: number;
  /** Fabric length the maker cuts so that working stretch brings it to the chord. */
  relaxedChordM: number;
  /** How much farther apart the points may move before the fabric cannot be tensioned. */
  stretchHeadroomM: number;
  /** For a made sail: the stretch the given edge needs to reach its points. */
  requiredStretchPct: number | null;
  fit: ShadeFitStatus;
  edgeRadiusM: number;
  cableTensionKN: number;
}
export interface ShadeCornerReport {
  anchorId: string;
  angleDeg: number;
  heightM: number;
  support: ShadeSupport;
  /** Resultant of the two edge cable tensions, kN. */
  loadKN: number;
  /** Post advice when the fixing point is a post. */
  post?: { exposedHeightM: number; leanDeg: number; footingDepthM: number; footingDiameterM: number; steel: string; engineer: boolean };
}
export interface ShadeWarning { id: string; level: 'info' | 'check' | 'stop'; text: string; basis: string; }
export interface ShadeSailReport {
  sailId: string;
  fabric: ShadeFabricSpec;
  anchors: number;
  edges: ShadeEdgeReport[];
  corners: ShadeCornerReport[];
  /** Plan area inside the fixing points. */
  footprintAreaM2: number;
  /** Plan area of the finished scalloped sail. */
  finishedAreaM2: number;
  /** Cut area after the maker's pattern compensation. */
  relaxedCutAreaM2: number;
  coverageSharePct: number;
  meanSpanM: number;
  longestSpanM: number;
  minCornerAngleDeg: number;
  sideRatio: number;
  /** Height difference between the high and low groups of corners. */
  twistM: number;
  twistTargetM: number;
  heightRangeM: number;
  form: 'hypar' | 'sloped' | 'flat';
  /** Noon shadow offset from the sail's plan footprint, metres, for Mauritius. */
  shadow: { juneNoonOffsetM: number; juneDirection: 'south'; decemberNoonOffsetM: number; decemberDirection: 'north' };
  hardware: { turnbuckles: number; snapHooks: number; dRings: number; posts: number; wallBrackets: number; wireEdgeM: number };
  fit: ShadeFitStatus;
  warnings: ShadeWarning[];
  basis: string;
}

const MAURITIUS_LATITUDE_DEG = -20.3;
const SOLAR_DECLINATION_DEG = 23.44;
const noonZenithDeg = (declination: number) => Math.abs(MAURITIUS_LATITUDE_DEG - declination);

function postAdvice(exposedHeightM: number, longestSpanM: number): NonNullable<ShadeCornerReport['post']> {
  // S8 table by sail size and pole height; S9 minimums; above 3.7 m exposed an engineer sizes the post.
  const tall = exposedHeightM > 2.6;
  let steel: string;
  if (longestSpanM <= 4) steel = tall ? 'CHS 139.7 x 4.5' : 'CHS 89.0 x 3.2';
  else if (longestSpanM <= 5) steel = tall ? 'CHS 139.7 x 4.5' : 'CHS 101.6 x 3.2';
  else if (longestSpanM <= 6) steel = tall ? 'CHS 139.7 x 4.5' : 'CHS 114.3 x 3.6';
  else steel = 'engineer to size';
  const engineer = exposedHeightM > 3.7 || longestSpanM > 6;
  return {
    exposedHeightM: round(exposedHeightM, 2), leanDeg: 7,
    footingDepthM: round(Math.max(0.8, Math.ceil((exposedHeightM / 3) * 10) / 10), 2),
    footingDiameterM: longestSpanM <= 4 ? 0.3 : longestSpanM <= 5 ? 0.35 : 0.4,
    steel, engineer,
  };
}

export function estimateShadeSail(sail: ShadeSail): ShadeSailReport {
  const fabric = shadeFabric(sail.fabric);
  const anchors = sail.anchors;
  const m = anchors.length;
  const corners = shadeSailCorners(sail);
  const warnings: ShadeWarning[] = [];
  const plan = anchors.map(a => ({ x: a.x, y: a.y }));
  if (!shadeOutlineSimple(plan)) warnings.push({ id: 'crossing', level: 'stop', text: 'The fixing points cross each other in plan. Reorder the corners so the outline does not self-intersect.', basis: 'Geometry' });
  const edges: ShadeEdgeReport[] = [];
  let longestSpanM = 0, shortestSpanM = Infinity, spanSum = 0;
  for (let i = 0; i < m; i++) {
    const a = anchors[i], b = anchors[(i + 1) % m];
    const spanM = len(sub({ x: a.x, y: a.y, z: a.heightM }, { x: b.x, y: b.y, z: b.heightM }));
    const planSpanM = planLen(a, b);
    const chordM = Math.max(0, spanM - 2 * sail.cornerGapM);
    const curveDepthM = chordM * sail.edgeCurvePct / 100;
    const curvedEdgeM = chordM > 0 ? chordM * (1 + (8 / 3) * (curveDepthM / chordM) ** 2) : 0;
    const relaxedChordM = chordM / (1 + fabric.workingStretch);
    const stretchHeadroomM = chordM * fabric.workingStretch;
    const edgeRadiusM = curveDepthM > 0 ? chordM ** 2 / (8 * curveDepthM) + curveDepthM / 2 : Infinity;
    const cableTensionKN = Number.isFinite(edgeRadiusM) ? fabric.prestressKNPerM * edgeRadiusM : 0;
    let requiredStretchPct: number | null = null, fit: ShadeFitStatus = 'made-to-points';
    if (sail.made) {
      const madeChord = sail.made.edgesM[i];
      const required = madeChord > 0 ? (chordM - madeChord) / madeChord : 0;
      requiredStretchPct = round(required * 100, 2);
      fit = required < 0 ? 'slack' : required <= fabric.workingStretch ? 'fits' : 'over-stretch';
    }
    longestSpanM = Math.max(longestSpanM, spanM); shortestSpanM = Math.min(shortestSpanM, spanM); spanSum += spanM;
    edges.push({ index: i, from: a.id, to: b.id, spanM: round(spanM), planSpanM: round(planSpanM), chordM: round(chordM), curveDepthM: round(curveDepthM), curvedEdgeM: round(curvedEdgeM), relaxedChordM: round(relaxedChordM), stretchHeadroomM: round(stretchHeadroomM), requiredStretchPct, fit, edgeRadiusM: Number.isFinite(edgeRadiusM) ? round(edgeRadiusM, 2) : -1, cableTensionKN: round(cableTensionKN, 2) });
  }
  const meanSpanM = spanSum / m;
  // Corner loads: the two adjacent edge tensions along the chord directions.
  const cornersOut: ShadeCornerReport[] = anchors.map((a, i) => {
    const prev = edges[(i + m - 1) % m], next = edges[i];
    const toPrev = sub(corners[(i + m - 1) % m], corners[i]), toNext = sub(corners[(i + 1) % m], corners[i]);
    const lp = len(toPrev) || 1, ln = len(toNext) || 1;
    const fx = prev.cableTensionKN * toPrev.x / lp + next.cableTensionKN * toNext.x / ln;
    const fy = prev.cableTensionKN * toPrev.y / lp + next.cableTensionKN * toNext.y / ln;
    const fz = prev.cableTensionKN * toPrev.z / lp + next.cableTensionKN * toNext.z / ln;
    const angleDeg = shadeCornerAngleDeg(plan, i);
    const out: ShadeCornerReport = { anchorId: a.id, angleDeg: round(angleDeg, 1), heightM: a.heightM, support: a.support, loadKN: round(Math.hypot(fx, fy, fz), 2) };
    if (a.support === 'post') out.post = postAdvice(a.heightM, longestSpanM);
    return out;
  });
  const footprintAreaM2 = shadePlanArea(plan);
  const cornerPlan = corners.map(c => ({ x: c.x, y: c.y }));
  const scallops = edges.reduce((s, e) => s + (2 / 3) * e.chordM * e.curveDepthM, 0);
  const finishedAreaM2 = Math.max(0, shadePlanArea(cornerPlan) - scallops);
  const relaxedCutAreaM2 = finishedAreaM2 * (1 - fabric.cutUndersize.width) * (1 - fabric.cutUndersize.length);
  const heights = anchors.map(a => a.heightM);
  const heightRangeM = Math.max(...heights) - Math.min(...heights);
  let twistM: number;
  if (m === 4) twistM = Math.abs((heights[0] + heights[2]) / 2 - (heights[1] + heights[3]) / 2);
  else twistM = heights.reduce((s, h, i) => s + Math.abs(h - heights[(i + 1) % m]), 0) / m;
  const twistTargetM = Math.max(0.9, 0.2 * meanSpanM);
  const form: ShadeSailReport['form'] = m >= 4 && twistM >= twistTargetM ? 'hypar' : heightRangeM >= 0.2 * meanSpanM ? 'sloped' : 'flat';
  const minCornerAngleDeg = Math.min(...plan.map((_, i) => shadeCornerAngleDeg(plan, i)));
  const sideRatio = shortestSpanM > 0 ? longestSpanM / shortestSpanM : Infinity;
  const meanHeight = heights.reduce((s, h) => s + h, 0) / m;
  const shadow = {
    juneNoonOffsetM: round(meanHeight * Math.tan(noonZenithDeg(SOLAR_DECLINATION_DEG) * Math.PI / 180), 2), juneDirection: 'south' as const,
    decemberNoonOffsetM: round(meanHeight * Math.tan(noonZenithDeg(-SOLAR_DECLINATION_DEG) * Math.PI / 180), 2), decemberDirection: 'north' as const,
  };
  const posts = anchors.filter(a => a.support === 'post').length;
  const hardware = { turnbuckles: Math.max(2, Math.ceil(m / 2)), snapHooks: m - Math.max(2, Math.ceil(m / 2)), dRings: m, posts, wallBrackets: m - posts, wireEdgeM: round(edges.reduce((s, e) => s + e.curvedEdgeM, 0) + 0.5 * m, 2) };
  if (m === 3 && form === 'flat') warnings.push({ id: 'triangle-flat', level: 'check', text: 'A triangle cannot twist. Drop one corner by at least a fifth of the span so rain runs off and the sail stays quiet.', basis: 'S2 slope 20 % or more; S6 flat sails flap and pool water.' });
  if (m >= 4 && form !== 'hypar') warnings.push({ id: 'no-hypar', level: 'check', text: `Alternate high and low corners by at least ${twistTargetM.toFixed(1)} m (a fifth of the span, never under 0.9 m). A flat sail flaps, pools water and stretches early.`, basis: 'S6, S7.' });
  if (minCornerAngleDeg < 35) warnings.push({ id: 'pointy', level: 'check', text: `A corner of ${minCornerAngleDeg.toFixed(0)} degrees becomes a strap: little shade and hard to tension. Open the angle or move the point.`, basis: 'S6 avoid very pointy corners.' });
  if (sideRatio > 2) warnings.push({ id: 'side-ratio', level: 'check', text: 'The longest side is more than twice the shortest. Keep sides nearer each other or split into two sails.', basis: 'S6 keep side lengths within reach of each other.' });
  if (longestSpanM > 8) warnings.push({ id: 'big-span', level: 'check', text: 'Spans over 8 m carry large corner loads: an engineer sizes the posts, footings and fixings.', basis: 'S6 reaction loads are underestimated without calculation.' });
  if (cornersOut.some(c => c.loadKN > 4)) warnings.push({ id: 'corner-load', level: 'check', text: 'A corner load above 4 kN: the fixing and its post or wall need an engineer\'s check.', basis: 'S6 T = w x R; S9.' });
  for (const edge of edges) {
    if (edge.fit === 'over-stretch') warnings.push({ id: `over-${edge.index}`, level: 'stop', text: `Edge ${edge.index + 1}: the made sail would need ${edge.requiredStretchPct} % stretch; ${fabric.label} gives about ${(fabric.workingStretch * 100).toFixed(1)} %. Bring the points closer by ${(edge.chordM - (sail.made?.edgesM[edge.index] ?? 0) * (1 + fabric.workingStretch)).toFixed(2)} m or use longer hardware.`, basis: 'S3 / S4 working stretch.' });
    if (edge.fit === 'slack') warnings.push({ id: `slack-${edge.index}`, level: 'check', text: `Edge ${edge.index + 1}: the made sail is ${Math.abs(edge.chordM - (sail.made?.edgesM[edge.index] ?? 0)).toFixed(2)} m longer than its points allow and will hang loose. Move the points apart or shorten the sail.`, basis: 'S1, S3.' });
    if (edge.chordM < 0.5) warnings.push({ id: `short-${edge.index}`, level: 'stop', text: `Edge ${edge.index + 1} leaves under half a metre of fabric after the hardware gaps.`, basis: 'S1.' });
  }
  if (cornersOut.some(c => c.post?.engineer)) warnings.push({ id: 'post-engineer', level: 'check', text: 'A post over 3.7 m exposed, or a sail over 6 m, is outside the supplier guide: an engineer sizes it.', basis: 'S8, S9.' });
  warnings.push({ id: 'cyclone', level: 'info', text: `${fabric.cycloneRule} Mauritius cyclone warnings start at gusts of 120 km/h; the island record is 280 km/h.`, basis: 'S10.' });
  warnings.push({ id: 'shade-moves', level: 'info', text: `Shade sits under the sail only near midsummer noon. At noon in June it falls about ${shadow.juneNoonOffsetM} m to the south of the sail; make the sail larger than the area you want shaded.`, basis: 'S11.' });
  const fit: ShadeFitStatus = edges.some(e => e.fit === 'over-stretch') ? 'over-stretch' : edges.some(e => e.fit === 'slack') ? 'slack' : sail.made ? 'fits' : 'made-to-points';
  return {
    sailId: sail.id, fabric, anchors: m, edges, corners: cornersOut,
    footprintAreaM2: round(footprintAreaM2, 2), finishedAreaM2: round(finishedAreaM2, 2), relaxedCutAreaM2: round(relaxedCutAreaM2, 2),
    coverageSharePct: footprintAreaM2 > 0 ? round(finishedAreaM2 / footprintAreaM2 * 100, 1) : 0,
    meanSpanM: round(meanSpanM), longestSpanM: round(longestSpanM), minCornerAngleDeg: round(minCornerAngleDeg, 1), sideRatio: round(sideRatio, 2),
    twistM: round(twistM, 2), twistTargetM: round(twistTargetM, 2), heightRangeM: round(heightRangeM, 2), form, shadow, hardware, fit, warnings,
    basis: 'Typical values from published installation guides and fabric datasheets (S1 to S11 in src/designer/shade.ts). A maker confirms sizes from the real fixing points; an engineer certifies posts, footings and cyclone wind. No price.',
  };
}

// ------------------------------------------------------------- the 3D surface

/** Mean value coordinates of a plan point inside a simple polygon (Floater). */
export function meanValueWeights(point: { x: number; y: number }, polygon: readonly { x: number; y: number }[]): number[] {
  const m = polygon.length;
  const weights = new Array<number>(m).fill(0);
  const d = polygon.map(p => Math.hypot(p.x - point.x, p.y - point.y));
  for (let i = 0; i < m; i++) if (d[i] < 1e-9) { weights[i] = 1; return weights; }
  const tan = new Array<number>(m).fill(0);
  for (let i = 0; i < m; i++) {
    const a = polygon[i], b = polygon[(i + 1) % m];
    const ax = a.x - point.x, ay = a.y - point.y, bx = b.x - point.x, by = b.y - point.y;
    const cross = ax * by - ay * bx, dot = ax * bx + ay * by;
    const angle = Math.atan2(Math.abs(cross), dot);
    if (Math.abs(cross) < 1e-9 && dot < 0) {
      // On an edge: linear interpolation between its ends.
      const t = d[i] / (d[i] + d[(i + 1) % m]);
      weights.fill(0); weights[i] = 1 - t; weights[(i + 1) % m] = t; return weights;
    }
    tan[i] = Math.tan(angle / 2);
  }
  let total = 0;
  for (let i = 0; i < m; i++) { const w = (tan[(i + m - 1) % m] + tan[i]) / d[i]; weights[i] = w; total += w; }
  return total > 0 ? weights.map(w => w / total) : weights.map(() => 1 / m);
}

export interface ShadeSurface {
  /** Plan x, height z, plan y triplets in world metres (three.js x, y-up, z). */
  positions: number[];
  indices: number[];
  /** The scalloped outline, one closed ring, for cables and the plan. */
  outline: Point3[];
  corners: Point3[];
}
/**
 * The sail surface: a smooth saddle through the corner heights (mean value
 * interpolation, exactly bilinear for a parallelogram) over the scalloped
 * finished outline. It is an interpolated shape for the picture and the plan,
 * not a form-finding result; the engine's numbers do not depend on it.
 */
export function shadeSailSurface(sail: ShadeSail, options: { edgeSegments?: number; rings?: number } = {}): ShadeSurface {
  const corners = shadeSailCorners(sail);
  const m = corners.length;
  const edgeSegments = Math.max(2, options.edgeSegments ?? 8), rings = Math.max(1, options.rings ?? 6);
  const cornerPlan = corners.map(c => ({ x: c.x, y: c.y }));
  const heightAt = (p: { x: number; y: number }) => meanValueWeights(p, cornerPlan).reduce((s, w, i) => s + w * corners[i].z, 0);
  const outline: Point3[] = [];
  for (let i = 0; i < m; i++) {
    const a = corners[i], b = corners[(i + 1) % m];
    const chord = Math.hypot(b.x - a.x, b.y - a.y);
    const dip = chord * sail.edgeCurvePct / 100;
    const nrm = inwardNormal(corners, i);
    for (let s = 0; s < edgeSegments; s++) {
      const t = s / edgeSegments, bulge = dip * 4 * t * (1 - t);
      const x = a.x + (b.x - a.x) * t + nrm.x * bulge, y = a.y + (b.y - a.y) * t + nrm.y * bulge;
      outline.push({ x, y, z: a.z + (b.z - a.z) * t });
    }
  }
  const cx = corners.reduce((s, c) => s + c.x, 0) / m, cy = corners.reduce((s, c) => s + c.y, 0) / m;
  const centre: Point3 = { x: cx, y: cy, z: heightAt({ x: cx, y: cy }) };
  const ringPoints: Point3[][] = [outline];
  for (let k = 1; k < rings; k++) {
    const f = 1 - k / rings;
    ringPoints.push(outline.map(p => { const x = cx + (p.x - cx) * f, y = cy + (p.y - cy) * f; return { x, y, z: heightAt({ x, y }) }; }));
  }
  const positions: number[] = [], indices: number[] = [];
  const push = (p: Point3) => { positions.push(p.x, p.z, p.y); return positions.length / 3 - 1; };
  const ringIndex: number[][] = ringPoints.map(ring => ring.map(push));
  const centreIndex = push(centre);
  const count = outline.length;
  for (let k = 0; k + 1 < ringIndex.length; k++) for (let i = 0; i < count; i++) {
    const a = ringIndex[k][i], b = ringIndex[k][(i + 1) % count], c = ringIndex[k + 1][(i + 1) % count], d = ringIndex[k + 1][i];
    indices.push(a, b, c, a, c, d);
  }
  const last = ringIndex[ringIndex.length - 1];
  for (let i = 0; i < count; i++) indices.push(last[i], last[(i + 1) % count], centreIndex);
  return { positions, indices, outline, corners };
}

/** A sensible first sail: a 3.6 m four-point hypar around a plan point, posts at alternating heights. */
export function defaultShadeSail(id: string, centre: { x: number; y: number }, makeId: () => string): ShadeSail {
  const half = 1.8;
  const corners = [[-half, -half, 3.2], [half, -half, 2.2], [half, half, 3.2], [-half, half, 2.2]] as const;
  return {
    id, name: 'Shade sail', fabric: 'hdpe-knit', cornerGapM: SHADE_DEFAULT_CORNER_GAP_M, edgeCurvePct: SHADE_DEFAULT_EDGE_CURVE_PCT, colour: SHADE_COLOURS[0].hex,
    anchors: corners.map(([dx, dy, h]) => ({ id: makeId(), x: round(centre.x + dx, 3), y: round(centre.y + dy, 3), heightM: h, support: 'post' as const })),
  };
}
