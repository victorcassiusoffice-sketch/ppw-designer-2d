/** One physical opening profile for wall meshes, masonry and paint takeoffs. */
import type { Opening } from './openings';
import { OPENING_DOOR_HEIGHT_M, OPENING_WINDOW_HEIGHT_M } from '../data/wallPaints.js';
import { polygonArea, type Polygon, type Vertex } from '../lib/geometry.js';

export function openingHeightM(opening: Pick<Opening, 'kind' | 'heightM' | 'shape' | 'widthM'>): number {
  if (opening.shape === 'circle') return opening.widthM;
  return typeof opening.heightM === 'number' && Number.isFinite(opening.heightM) && opening.heightM > 0 ? opening.heightM
    : opening.kind === 'window' ? OPENING_WINDOW_HEIGHT_M : opening.kind === 'hole' ? 1 : OPENING_DOOR_HEIGHT_M;
}
export function openingSillM(opening: Pick<Opening, 'kind' | 'sillM'>): number {
  return opening.kind === 'window' || opening.kind === 'hole'
    ? Math.max(0, Number.isFinite(opening.sillM) ? opening.sillM! : opening.kind === 'window' ? .9 : 0) : 0;
}
export function openingVerticalBounds(opening: Opening, wallHeightM: number) {
  const bottomM = Math.min(Math.max(0, wallHeightM), openingSillM(opening));
  const topM = Math.max(bottomM, Math.min(wallHeightM, bottomM + openingHeightM(opening)));
  return { bottomM, topM, heightM: topM - bottomM };
}
/** User changes reject invalid clearances. Legacy renders still clip profiles at
 * the wall top, rather than silently changing stored measurements. */
export function validOpeningDimensions(opening: Omit<Opening, 'id'>, wallHeightM: number): boolean {
  if (!['door', 'doorway', 'window', 'hole'].includes(opening.kind)
    || !Number.isFinite(opening.widthM) || opening.widthM < .05 || opening.widthM > 100
    || (opening.shape !== undefined && !['rectangle', 'arch', 'circle'].includes(opening.shape))
    || (opening.heightM !== undefined && (!Number.isFinite(opening.heightM) || opening.heightM < .05 || opening.heightM > 100))
    || (opening.sillM !== undefined && (!Number.isFinite(opening.sillM) || opening.sillM < 0 || opening.sillM > 100))) return false;
  if ((opening.kind === 'door' || opening.kind === 'doorway') && opening.shape === 'circle') return false;
  if (opening.shape === 'circle' && opening.heightM !== undefined && Math.abs(opening.heightM - opening.widthM) > 1e-7) return false;
  return openingSillM(opening) + openingHeightM(opening) <= wallHeightM + 1e-7;
}

function clip(polygon: Polygon, axis: 'x' | 'y', limit: number, keepAbove: boolean): Polygon {
  const out: Polygon = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const insideA = keepAbove ? a[axis] >= limit : a[axis] <= limit;
    const insideB = keepAbove ? b[axis] >= limit : b[axis] <= limit;
    if (insideA) out.push(a);
    if (insideA !== insideB) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** x = distance along the host wall; y = height above the floor, in metres.
 * Curved profiles use the SAME sampled perimeter in every renderer/calculator. */
export function openingProfile(opening: Opening, wallHeightM: number): Polygon {
  if (![opening.widthM, opening.offsetM, wallHeightM].every(Number.isFinite) || opening.widthM <= 0 || wallHeightM <= 0) return [];
  const left = opening.offsetM - opening.widthM / 2, right = opening.offsetM + opening.widthM / 2;
  const bottom = openingSillM(opening), height = openingHeightM(opening), top = bottom + height;
  let profile: Polygon;
  if (opening.shape === 'circle') {
    const radius = opening.widthM / 2;
    const count = Math.max(96, Math.ceil(Math.PI / Math.acos(1 - Math.min(.003 / radius, 1)) / 4) * 4);
    profile = Array.from({ length: count }, (_, i) => {
      const angle = Math.PI * 2 * i / count;
      return { x: opening.offsetM + Math.cos(angle) * radius, y: bottom + radius + Math.sin(angle) * radius };
    });
  } else if (opening.shape === 'arch') {
    const rise = Math.min(height, opening.widthM / 2), spring = top - rise;
    const count = Math.max(48, Math.ceil(Math.PI / Math.acos(1 - Math.min(.003 / Math.max(opening.widthM / 2, rise), 1)) / 2));
    profile = [{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: spring },
      ...Array.from({ length: count + 1 }, (_, i) => ({ x: opening.offsetM + Math.cos(Math.PI * i / count) * opening.widthM / 2, y: spring + Math.sin(Math.PI * i / count) * rise }))];
  } else profile = [{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }];
  return clip(clip(profile, 'y', 0, true), 'y', wallHeightM, false);
}

export function openingProfileAreaM2(opening: Opening, wallHeightM: number): number {
  const polygon = openingProfile(opening, wallHeightM);
  return polygon.length >= 3 ? polygonArea(polygon) : 0;
}

/** Union of convex opening profiles clipped to physical face spans. Includes
 * profile crossings as sweep events, so overlapping legacy holes aren't added
 * twice and curved shapes never get rectangular deductions. */
export function openingProfileUnionAreaM2(openings: Opening[], wallHeightM: number, spans: Array<{ t0: number; t1: number }>, minimumAreaM2 = 0): number {
  const seen = new Set<string>();
  const profiles = openings.map(o => openingProfile(o, wallHeightM)).filter(p => p.length >= 3 && polygonArea(p) >= minimumAreaM2 - 1e-9)
    .flatMap(p => spans.map(span => clip(clip(p, 'x', span.t0, true), 'x', span.t1, false))).filter(p => p.length >= 3).filter(p => { const key = JSON.stringify(p); if (seen.has(key)) return false; seen.add(key); return true; });
  const events = profiles.flatMap(p => p.map(v => v.x));
  const segments = profiles.flatMap((p, profile) => p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    return { a, b, profile, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
  })).sort((a, b) => a.minX - b.minX);
  let active: typeof segments = [];
  for (const a of segments) {
    active = active.filter(b => b.maxX >= a.minX);
    for (const b of active) {
      if (a.profile === b.profile || a.minY > b.maxY || b.minY > a.maxY) continue;
      const ux = a.b.x - a.a.x, uy = a.b.y - a.a.y, vx = b.b.x - b.a.x, vy = b.b.y - b.a.y;
      const d = ux * vy - uy * vx;
      if (Math.abs(d) < 1e-12) continue;
      const dx = b.a.x - a.a.x, dy = b.a.y - a.a.y, t = (dx * vy - dy * vx) / d, u = (dx * uy - dy * ux) / d;
      if (t > 0 && t < 1 && u > 0 && u < 1) events.push(a.a.x + t * ux);
    }
    active.push(a);
  }
  const xs = [...new Set(events)].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const x = (xs[i - 1] + xs[i]) / 2;
    const intervals = profiles.flatMap(p => {
      const ys = p.flatMap((a, j) => {
        const b = p[(j + 1) % p.length];
        return (a.x <= x && b.x > x) || (b.x <= x && a.x > x) ? [a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)] : [];
      });
      return ys.length >= 2 ? [{ lo: Math.min(...ys), hi: Math.max(...ys) }] : [];
    }).sort((a, b) => a.lo - b.lo);
    let end = -Infinity, height = 0;
    for (const interval of intervals) { height += Math.max(0, interval.hi - Math.max(end, interval.lo)); end = Math.max(end, interval.hi); }
    area += (xs[i] - xs[i - 1]) * height;
  }
  return area;
}

export function openingProfileWorldPoint(point: Vertex, a: Vertex, b: Vertex): { x: number; y: number; z: number } {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x + (b.x - a.x) * point.x / length, y: a.y + (b.y - a.y) * point.x / length, z: point.y };
}
