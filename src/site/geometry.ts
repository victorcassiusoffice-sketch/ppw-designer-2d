import type { GeoSite, HeightPoint, LonLat, XY } from './types';
const RAD = Math.PI / 180;
const A = 6378137,
  E2 = 6.6943799901413165e-3;
function ecef([lon, lat]: LonLat) {
  const l = lon * RAD,
    p = lat * RAD,
    n = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  return [n * Math.cos(p) * Math.cos(l), n * Math.cos(p) * Math.sin(l), n * (1 - E2) * Math.sin(p)];
}
/** WGS84 local tangent metres. Plan y points south. */
export function toLocal(point: LonLat, origin: LonLat): XY {
  const xyz = ecef(point),
    o = ecef(origin),
    d = xyz.map((v, i) => v - o[i]);
  const l = origin[0] * RAD,
    p = origin[1] * RAD;
  return {
    x: -Math.sin(l) * d[0] + Math.cos(l) * d[1],
    y: Math.sin(p) * Math.cos(l) * d[0] + Math.sin(p) * Math.sin(l) * d[1] - Math.cos(p) * d[2],
  };
}
/** Invert the tangent-plane position and intersect the WGS84 surface iteratively. */
export function toLonLat(point: XY, origin: LonLat): LonLat {
  let result: LonLat = [
    origin[0] + point.x / (A * Math.cos(origin[1] * RAD) * RAD),
    origin[1] - point.y / (A * RAD),
  ];
  for (let i = 0; i < 5; i++) {
    const at = toLocal(result, origin),
      east = toLocal([result[0] + 1e-6, result[1]], origin),
      north = toLocal([result[0], result[1] + 1e-6], origin);
    const a = (east.x - at.x) / 1e-6,
      b = (north.x - at.x) / 1e-6,
      c = (east.y - at.y) / 1e-6,
      d = (north.y - at.y) / 1e-6,
      det = a * d - b * c;
    result = [
      result[0] + ((point.x - at.x) * d - (point.y - at.y) * b) / det,
      result[1] + ((point.y - at.y) * a - (point.x - at.x) * c) / det,
    ];
  }
  return result;
}
export const cross = (a: XY, b: XY, c: XY) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export const signedArea = (p: XY[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a.x * b.y - b.x * a.y;
  }, 0) / 2;
export const area = (p: XY[]) => Math.abs(signedArea(p));
export const distance = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);
export function metrics(p: XY[]) {
  const sides = p.map((a, i) => distance(a, p[(i + 1) % p.length]));
  const m2 = area(p);
  return {
    areaM2: m2,
    perches: m2 / 42.21,
    arpents: m2 / 4221,
    perimeterM: sides.reduce((s, a) => s + a, 0),
    minSideM: Math.min(...sides),
    maxSideM: Math.max(...sides),
    sides,
  };
}
export function intersects(a: XY, b: XY, c: XY, d: XY) {
  return cross(a, b, c) * cross(a, b, d) < -1e-10 && cross(c, d, a) * cross(c, d, b) < -1e-10;
}
export function boundaryError(p: XY[]): string | undefined {
  if (p.length < 3) return 'Add at least three corners.';
  if (p.length > 200 || p.some((a) => !Number.isFinite(a.x) || !Number.isFinite(a.y)))
    return 'Invalid or too many boundary corners.';
  if (p.some((a, i) => distance(a, p[(i + 1) % p.length]) < 0.01))
    return 'Adjacent corners must be at least 1 cm apart.';
  if (p.some((a, i) => p.some((b, j) => j > i && distance(a, b) < 0.01)))
    return 'Boundary repeats or touches a corner. Use a simple outline.';
  const onSegment = (a: XY, b: XY, q: XY) =>
    Math.abs(cross(a, b, q)) < 1e-8 &&
    q.x >= Math.min(a.x, b.x) - 1e-8 &&
    q.x <= Math.max(a.x, b.x) + 1e-8 &&
    q.y >= Math.min(a.y, b.y) - 1e-8 &&
    q.y <= Math.max(a.y, b.y) + 1e-8;
  if (
    p.some((a, i) => {
      const b = p[(i + 1) % p.length],
        c = p[(i + 2) % p.length];
      return (
        Math.abs(cross(a, b, c)) < 1e-8 && (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) < 0
      );
    })
  )
    return 'Adjacent boundary edges overlap.';
  if (area(p) < 0.1) return 'Boundary area is too small.';
  if (
    p.some((a, i) =>
      p.some(
        (c, j) =>
          j > i + 1 &&
          !(i === 0 && j === p.length - 1) &&
          (intersects(a, p[(i + 1) % p.length], c, p[(j + 1) % p.length]) ||
            onSegment(a, p[(i + 1) % p.length], c) ||
            onSegment(a, p[(i + 1) % p.length], p[(j + 1) % p.length]) ||
            onSegment(c, p[(j + 1) % p.length], a)),
      ),
    )
  )
    return 'Boundary crosses itself. Edit its corners.';
  if (
    Math.max(...p.map((a) => a.x)) - Math.min(...p.map((a) => a.x)) > 500 ||
    Math.max(...p.map((a) => a.y)) - Math.min(...p.map((a) => a.y)) > 500
  )
    return 'This planning tool supports plots up to 500 m across.';
}
export function inside(point: XY, polygon: XY[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      Math.abs(cross(a, b, point)) < 1e-8 &&
      point.x >= Math.min(a.x, b.x) - 1e-8 &&
      point.x <= Math.max(a.x, b.x) + 1e-8 &&
      point.y >= Math.min(a.y, b.y) - 1e-8 &&
      point.y <= Math.max(a.y, b.y) + 1e-8
    )
      return true;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function bearingDegrees(input: string): number {
  const s = input
    .trim()
    .toUpperCase()
    .replace(/°/g, ' ')
    .replace(/[′']/g, ' ')
    .replace(/[″"]/g, ' ')
    .replace(/\s+/g, ' ');
  const q =
    /^([NS])\s*(\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d+(?:\.\d+)?))?\s*([EW])$/.exec(s);
  if (q) {
    const degrees = Number(q[2]),
      minutes = Number(q[3] || 0),
      seconds = Number(q[4] || 0),
      angle = degrees + minutes / 60 + seconds / 3600;
    if (angle > 90 || minutes >= 60 || seconds >= 60)
      throw new Error('Quadrant bearing angle must be 0–90°, minutes/seconds below 60.');
    return (
      (q[1] === 'N'
        ? q[5] === 'E'
          ? angle
          : 360 - angle
        : q[5] === 'E'
          ? 180 - angle
          : 180 + angle) % 360
    );
  }
  const n = Number(s.trim());
  if (!s.trim() || !Number.isFinite(n) || n < 0 || n > 360)
    throw new Error('Use a clockwise bearing 0–360°, or N 35 20 E.');
  return n % 360;
}
export function traverse(legs: { lengthM: number; bearing: string }[]) {
  if (legs.length < 3) throw new Error('Enter at least three sides.');
  const points: XY[] = [{ x: 0, y: 0 }];
  for (const leg of legs) {
    if (!Number.isFinite(leg.lengthM) || leg.lengthM <= 0 || leg.lengthM > 10000)
      throw new Error('Side lengths must be positive metres.');
    const angle = bearingDegrees(leg.bearing) * RAD,
      last = points[points.length - 1];
    points.push({
      x: last.x + leg.lengthM * Math.sin(angle),
      y: last.y - leg.lengthM * Math.cos(angle),
    });
  }
  const closureErrorM = distance(points[0], points[points.length - 1]);
  // Do not distribute or conceal the residual. A closing segment is explicit.
  if (closureErrorM < 0.001) points.pop();
  return { points, closureErrorM, perimeterM: legs.reduce((s, l) => s + l.lengthM, 0) };
}
/** Reject date-line wrapping and globe-scale aliases before tangent projection. */
export function geographicBoundaryError(boundary: LonLat[]): string | undefined {
  if (
    boundary.length < 3 ||
    boundary.length > 200 ||
    boundary.some(
      (p) =>
        p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85,
    )
  )
    return 'Enter 3-200 valid WGS84 longitude/latitude corners.';
  if (
    Math.max(...boundary.map((p) => p[0])) - Math.min(...boundary.map((p) => p[0])) > 0.1 ||
    Math.max(...boundary.map((p) => p[1])) - Math.min(...boundary.map((p) => p[1])) > 0.01
  )
    return 'Date-line crossings and large geographic extents are unsupported.';
}
export function makeSite(
  boundary: LonLat[],
  name: string,
  anchor: XY,
  entry: GeoSite['entry'] = 'drawn',
): GeoSite {
  const geographicError = geographicBoundaryError(boundary);
  if (geographicError) throw new Error(geographicError);
  const origin = boundary[0];
  const polygon = boundary.map((p) => {
    const v = toLocal(p, origin);
    return { x: v.x + anchor.x, y: v.y + anchor.y };
  });
  const error = boundaryError(polygon);
  if (error) throw new Error(error);
  return { version: 1, name, origin, boundary, polygon, anchor, entry };
}
/** Ear clipping supports simple concave outlines. */
export function triangulate(p: XY[]): [number, number, number][] {
  const idx = p.map((_, i) => i),
    out: [number, number, number][] = [],
    sign = Math.sign(signedArea(p));
  while (idx.length > 3) {
    let found = false;
    for (let j = 0; j < idx.length; j++) {
      const a = idx[(j + idx.length - 1) % idx.length],
        b = idx[j],
        c = idx[(j + 1) % idx.length];
      if (cross(p[a], p[b], p[c]) * sign <= 1e-10) continue;
      if (idx.some((k) => k !== a && k !== b && k !== c && inside(p[k], [p[a], p[b], p[c]])))
        continue;
      out.push([a, b, c]);
      idx.splice(j, 1);
      found = true;
      break;
    }
    if (!found)
      throw new Error('Cannot triangulate this boundary. Remove duplicate or crossing corners.');
  }
  if (idx.length === 3) out.push(idx as [number, number, number]);
  return out;
}
function clipHeight(poly: HeightPoint[], h: number, above: boolean) {
  const out: HeightPoint[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ina = above ? a.z >= h : a.z <= h,
      inb = above ? b.z >= h : b.z <= h;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (h - a.z) / (b.z - a.z);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), z: h });
    }
  }
  return out;
}
function volume(poly: HeightPoint[], h: number) {
  let v = 0;
  for (let i = 1; i < poly.length - 1; i++)
    v +=
      area([poly[0], poly[i], poly[i + 1]]) *
      Math.abs((poly[0].z + poly[i].z + poly[i + 1].z) / 3 - h);
  return v;
}
export function integrateCutFill(triangles: HeightPoint[][], platformM: number) {
  if (!Number.isFinite(platformM)) throw new Error('Platform must be a finite level.');
  return triangles.reduce(
    (r, t) => ({
      cutM3: r.cutM3 + volume(clipHeight(t, platformM, true), platformM),
      fillM3: r.fillM3 + volume(clipHeight(t, platformM, false), platformM),
      areaM2: r.areaM2 + area(t),
    }),
    { cutM3: 0, fillM3: 0, areaM2: 0 },
  );
}
/** Least squares plane in plan x east/y south; aspect is downhill compass bearing. */
export function slope(points: HeightPoint[]) {
  const n = points.length,
    mean = (key: keyof HeightPoint) => points.reduce((s, p) => s + p[key], 0) / n;
  const mx = mean('x'),
    my = mean('y'),
    mz = mean('z');
  let xx = 0,
    yy = 0,
    xy = 0,
    xz = 0,
    yz = 0;
  for (const p of points) {
    const x = p.x - mx,
      y = p.y - my,
      z = p.z - mz;
    xx += x * x;
    yy += y * y;
    xy += x * y;
    xz += x * z;
    yz += y * z;
  }
  const det = xx * yy - xy * xy;
  if (Math.abs(det) < 1e-10) return null;
  const a = (xz * yy - yz * xy) / det,
    b = (yz * xx - xz * xy) / det;
  const grade = Math.hypot(a, b);
  return {
    percent: grade * 100,
    degrees: Math.atan(grade) / RAD,
    aspect: grade < 1e-9 ? null : (Math.atan2(-a, b) / RAD + 360) % 360,
    lowM: Math.min(...points.map((p) => p.z)),
    highM: Math.max(...points.map((p) => p.z)),
    residualM: Math.sqrt(
      points.reduce((s, p) => s + (p.z - (mz + a * (p.x - mx) + b * (p.y - my))) ** 2, 0) / n,
    ),
  };
}
/** Exact convex, uniform setback. Non-convex envelopes are withheld, not approximated. */
export function setbackEnvelope(p: XY[], setbackM: number): XY[] {
  const sign = Math.sign(signedArea(p));
  if (p.some((v, i) => cross(v, p[(i + 1) % p.length], p[(i + 2) % p.length]) * sign < -1e-8))
    throw new Error(
      'Setback envelope unavailable for a concave boundary; ask a surveyor for its inset outline.',
    );
  let out = p.map((v) => ({ ...v }));
  for (let j = 0; j < p.length; j++) {
    const a = p[j],
      b = p[(j + 1) % p.length],
      length = distance(a, b),
      threshold = setbackM * length;
    const value = (v: XY) => cross(a, b, v) * sign - threshold;
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const c = input[i],
        d = input[(i + 1) % input.length],
        vc = value(c),
        vd = value(d);
      if (vc >= -1e-8) out.push(c);
      if (vc >= 0 !== vd >= 0) {
        const t = vc / (vc - vd);
        out.push({ x: c.x + t * (d.x - c.x), y: c.y + t * (d.y - c.y) });
      }
    }
    if (!out.length) break;
  }
  return out;
}
