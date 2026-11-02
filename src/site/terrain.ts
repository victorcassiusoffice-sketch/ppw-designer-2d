import {
  area,
  cross,
  distance,
  integrateCutFill,
  intersects,
  signedArea,
  triangulate,
} from './geometry';
import type { HeightPoint, TerrainInput, XY } from './types';
type Tri = [number, number, number];
const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
function circle(p: XY, a: XY, b: XY, c: XY) {
  const ax = a.x - p.x,
    ay = a.y - p.y,
    bx = b.x - p.x,
    by = b.y - p.y,
    cx = c.x - p.x,
    cy = c.y - p.y;
  const det =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay);
  return det * Math.sign(cross(a, b, c)) > 1e-8;
}
/** Bowyer-Watson followed by constraint edge flips; unsupported degeneracies fail closed. */
export function surveyTIN(points: HeightPoint[], contours: number[][] = []): Tri[] {
  if (
    contours.length > 200 ||
    contours.some((line) => !Array.isArray(line)) ||
    contours.reduce((sum, line) => sum + line.length, 0) > 1000
  )
    throw new Error(
      'Survey contours exceed 200 lines or 1,000 point indices. Split the survey into a smaller plot extract.',
    );
  if (points.length < 3 || points.length > 1000)
    throw new Error('A survey needs 3–1000 finite points.');
  if (
    points.some(
      (p, i) =>
        !Number.isFinite(p.x + p.y + p.z) ||
        Math.abs(p.x) > 1e7 ||
        Math.abs(p.y) > 1e7 ||
        Math.abs(p.z) > 10000 ||
        points.slice(0, i).some((q) => distance(p, q) < 1e-6),
    )
  )
    throw new Error('Survey contains non-finite or duplicate XY points.');
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    minx = Math.min(...xs),
    maxx = Math.max(...xs),
    miny = Math.min(...ys),
    maxy = Math.max(...ys),
    size = Math.max(maxx - minx, maxy - miny, 1) * 20;
  const n = points.length,
    all: XY[] = [
      ...points,
      { x: minx - size, y: miny - size },
      { x: maxx + size * 2, y: miny - size },
      { x: minx - size, y: maxy + size * 2 },
    ];
  let tris: Tri[] = [[n, n + 1, n + 2]];
  for (let i = 0; i < n; i++) {
    const bad = tris.filter((t) => circle(all[i], all[t[0]], all[t[1]], all[t[2]]));
    const edges = new Map<string, { a: number; b: number; count: number }>();
    for (const t of bad)
      for (let j = 0; j < 3; j++) {
        const a = t[j],
          b = t[(j + 1) % 3],
          key = edgeKey(a, b),
          e = edges.get(key);
        edges.set(key, { a, b, count: (e?.count ?? 0) + 1 });
      }
    tris = tris.filter((t) => !bad.includes(t));
    for (const e of edges.values())
      if (e.count === 1 && Math.abs(cross(all[e.a], all[e.b], all[i])) > 1e-10)
        tris.push([e.a, e.b, i]);
  }
  tris = tris.filter((t) => t.every((i) => i < n));
  const constraints: [number, number][] = [];
  const seenConstraints = new Set<string>();
  for (const line of contours)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i];
      if (!Number.isInteger(a) || !Number.isInteger(b) || !points[a] || !points[b] || a === b)
        throw new Error('Invalid contour point indices.');
      if (Math.abs(points[a].z - points[b].z) > 0.001)
        throw new Error('Each contour must have one constant level.');
      // Include collinear survey points so a constraint never jumps an existing vertex.
      const chain = points
        .map((p, k) => ({ p, k }))
        .filter(
          ({ p }) =>
            Math.abs(cross(points[a], points[b], p)) < 1e-8 &&
            distance(points[a], p) + distance(p, points[b]) <=
              distance(points[a], points[b]) + 1e-7,
        )
        .sort((p, q) => distance(points[a], p.p) - distance(points[a], q.p));
      if (chain.some(({ p }) => Math.abs(p.z - points[a].z) > 0.001))
        throw new Error('A survey spot point conflicts with the contour level.');
      for (let j = 1; j < chain.length; j++) {
        const key = edgeKey(chain[j - 1].k, chain[j].k);
        if (!seenConstraints.has(key)) {
          seenConstraints.add(key);
          constraints.push([chain[j - 1].k, chain[j].k]);
        }
        if (constraints.length > 1000)
          throw new Error('Expanded survey contour constraints exceed 1,000 segments.');
      }
    }
  if (
    constraints.some(([a, b], i) =>
      constraints
        .slice(i + 1)
        .some(([c, d]) => intersects(points[a], points[b], points[c], points[d])),
    )
  )
    throw new Error('Survey contours cross. Correct the imported data.');
  const locked = new Set<string>();
  for (const [a, b] of constraints) {
    let complete = false;
    for (let attempt = 0; attempt < tris.length * 4 + 1; attempt++) {
      const edges = new Map<string, { a: number; b: number; tri: number[] }>();
      tris.forEach((t, i) => {
        for (let j = 0; j < 3; j++) {
          const u = t[j],
            v = t[(j + 1) % 3],
            key = edgeKey(u, v),
            e = edges.get(key);
          edges.set(key, { a: u, b: v, tri: [...(e?.tri ?? []), i] });
        }
      });
      if (edges.has(edgeKey(a, b))) {
        complete = true;
        locked.add(edgeKey(a, b));
        break;
      }
      let flipped = false;
      for (const [key, e] of edges) {
        if (
          e.tri.length !== 2 ||
          locked.has(key) ||
          !intersects(points[a], points[b], points[e.a], points[e.b])
        )
          continue;
        const u = tris[e.tri[0]].find((k) => k !== e.a && k !== e.b)!,
          v = tris[e.tri[1]].find((k) => k !== e.a && k !== e.b)!;
        if (!intersects(points[u], points[v], points[e.a], points[e.b])) continue;
        tris[e.tri[0]] = [u, v, e.a];
        tris[e.tri[1]] = [v, u, e.b];
        flipped = true;
        break;
      }
      if (!flipped) break;
    }
    if (!complete)
      throw new Error('Contour triangulation could not be completed; volumes are withheld.');
  }
  return tris;
}
function clipTriangle(subject: HeightPoint[], clip: XY[]) {
  let out = subject;
  const sign = Math.sign(signedArea(clip));
  for (let k = 0; k < clip.length; k++) {
    const a = clip[k],
      b = clip[(k + 1) % clip.length],
      input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const c = input[i],
        d = input[(i + 1) % input.length],
        vc = cross(a, b, c) * sign,
        vd = cross(a, b, d) * sign;
      if (vc >= -1e-9) out.push(c);
      if (vc >= 0 !== vd >= 0) {
        const t = vc / (vc - vd);
        out.push({ x: c.x + t * (d.x - c.x), y: c.y + t * (d.y - c.y), z: c.z + t * (d.z - c.z) });
      }
    }
  }
  return out;
}
export function terrainEstimate(boundary: XY[], input: TerrainInput) {
  if (input.source !== 'survey' && input.source !== 'typed what-if')
    throw new Error('Public terrain cannot be used for cut and fill.');
  if (!input.verticalReference.trim())
    throw new Error('Declare a vertical reference before estimating.');
  let triangles: HeightPoint[][];
  if (input.source === 'typed what-if') {
    if (
      input.points.length !== boundary.length ||
      input.points.some((p, i) => distance(p, boundary[i]) > 0.001)
    )
      throw new Error('Enter one what-if level at every current boundary corner.');
    triangles = triangulate(boundary).map((t) => t.map((i) => input.points[i]));
  } else {
    const tins = surveyTIN(input.points, input.contours),
      clip = triangulate(boundary).map((t) => t.map((i) => boundary[i]));
    triangles = tins
      .flatMap((t) =>
        clip.map((poly) =>
          clipTriangle(
            t.map((i) => input.points[i]),
            poly,
          ),
        ),
      )
      .filter((t) => t.length >= 3 && area(t) > 1e-8);
  }
  const result = integrateCutFill(triangles, input.platformM),
    plotArea = area(boundary),
    coverage = result.areaM2 / plotArea;
  if (Math.abs(coverage - 1) > 0.00001)
    throw new Error(
      `Survey covers ${(coverage * 100).toFixed(1)}% of the plot. No extrapolation; add surveyed points around the full boundary.`,
    );
  return {
    ...result,
    triangleCount: triangles.length,
    source: input.source,
    verticalReference: input.verticalReference,
  };
}
/** CSV local plan metres x,y,z OR JSON {points:[{x,y,z}],contours:[[indices]]}. */
export function parseSurvey(text: string): { points: HeightPoint[]; contours?: number[][] } {
  if (text.length > 250000) throw new Error('Survey file exceeds 250 kB.');
  if (text.trim().startsWith('{')) {
    const data = JSON.parse(text) as { points: HeightPoint[]; contours?: number[][] };
    if (
      !Array.isArray(data.points) ||
      data.points.some((p) => !p || ![p.x, p.y, p.z].every(Number.isFinite))
    )
      throw new Error('JSON needs finite points [{x,y,z}].');
    if (
      data.contours !== undefined &&
      (!Array.isArray(data.contours) || data.contours.some((line) => !Array.isArray(line)))
    )
      throw new Error('Contours must be arrays of point indices.');
    return data;
  }
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (/^\s*x\s*,/i.test(lines[0] ?? '')) lines.shift();
  const points = lines.map((line, i) => {
    const v = line.split(',').map((x) => Number(x.trim()));
    if (v.length !== 3 || line.split(',').some((s) => !s.trim()) || !v.every(Number.isFinite))
      throw new Error(`Survey line ${i + 1}: expected x,y,z in metres.`);
    return { x: v[0], y: v[1], z: v[2] };
  });
  return { points };
}
