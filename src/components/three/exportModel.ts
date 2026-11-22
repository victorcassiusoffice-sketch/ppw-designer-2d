/**
 * The house as plain solids for another program: a 3D file (glTF) and a file for a 3D printer (STL).
 *
 * It is made from the same description the 3D view draws from (`SceneSolids` of `designer/roomSolids`), so a wall
 * stands where the 3D view shows it: its thickness, its side of the outline, its doors and windows. Nothing here
 * needs a screen or a graphics card: only the geometry maths of three.js.
 *
 * What it makes: every floor slab (with the hole of a stair), every wall with its openings cut out, the roof,
 * the stairs, the garden's surfaces and fences, and each placed thing as a box of its true size. A curved wall of
 * format version 2 is made curved, from the sums of `designer/arcSegment`.
 *
 * The frame of the parts: metres, x east, y NORTH, z up. That is a right-handed frame, which the two files want;
 * the plan's own y grows southward, so every plan y is turned over on the way in. Every part is a closed solid
 * whose faces are counter-clockwise seen from outside.
 */
import * as THREE from 'three';
import type {
  ItemSolid,
  SceneSolids,
  WallOpeningSolid,
  WallSolid,
} from '../../designer/roomSolids';
import { createRoofSurface, roofHeightAt, roofVerticalThickness } from '../../designer/roofSurface';
import { FLOOR_SLAB_THICKNESS_M, type RoofConfig } from '../../designer/building';
import { FENCE_MATERIALS, GARDEN_SURFACES, gardenSurfacePolygon } from '../../designer/garden';
import { cleanBulge, segmentPoints } from '../../designer/arcSegment';

interface XY {
  x: number;
  y: number;
}

export type ExportKind = 'floor' | 'wall' | 'roof' | 'stair' | 'thing' | 'garden';

export interface ExportPart {
  name: string;
  kind: ExportKind;
  /** The storey the part belongs to, when it has one. */
  levelId?: string;
  /** `#rrggbb`. */
  colourHex: string;
  /** Triangles: nine numbers each, three corners of x, y, z in metres (x east, y north, z up). */
  positions: Float32Array;
  /** What another program may want to know of the part: the product of a thing, the room of a floor. */
  extras?: Record<string, string | number>;
}

export interface ExportModel {
  parts: ExportPart[];
  /** What was left simpler than the design, in words, for the person who exports. */
  notes: string[];
}

/** The curved walls of a design, by the key the solids give a wall. */
export type WallCurves = ReadonlyMap<string, number>;

const EPS = 1e-6;
const ROOF_HEX: Record<RoofConfig['material'], string> = {
  felt: '#4b5051',
  tile: '#a55a40',
  concrete: '#a9a69f',
  metal: '#7e9498',
  'iron-sheet': '#7e9498',
};
const STAIR_HEX = '#c4c6c2';
const FENCE_THICKNESS_M = 0.06;
const GARDEN_SLAB_M = 0.05;

const hex = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;

/** A geometry's triangles as plain numbers, one corner after the other. */
function triangles(geometry: THREE.BufferGeometry): Float32Array {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry;
  const out = new Float32Array(plain.getAttribute('position').array);
  if (plain !== geometry) plain.dispose();
  geometry.dispose();
  return out;
}

const signedArea = (points: readonly XY[]): number =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;

/** Points of a plan outline in the export frame (y turned over), without a repeat and with a real area. */
function outline(points: readonly XY[]): XY[] | null {
  const out: XY[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const q = { x: p.x, y: -p.y };
    const last = out[out.length - 1];
    if (!last || Math.hypot(q.x - last.x, q.y - last.y) > EPS) out.push(q);
  }
  if (
    out.length > 1 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= EPS
  )
    out.pop();
  if (out.length < 3 || Math.abs(signedArea(out)) <= 1e-8) return null;
  // Always counter-clockwise. The extruder of three.js sets the holes right only for an outline it has to turn
  // round itself, and it turns round a counter-clockwise one: an outline given clockwise would keep its holes as
  // they came, and a hole wound the same way is not cut.
  return signedArea(out) > 0 ? out : out.reverse();
}

/** A flat-topped solid over a plan outline, with holes, from `bottomM` up to `topM`. */
function prism(
  points: readonly XY[],
  holes: readonly (readonly XY[])[],
  bottomM: number,
  topM: number,
): Float32Array | null {
  const contour = outline(points);
  if (!contour || !(topM - bottomM > EPS)) return null;
  const shape = new THREE.Shape(contour.map((p) => new THREE.Vector2(p.x, p.y)));
  for (const hole of holes) {
    const inner = outline(hole);
    if (inner) shape.holes.push(new THREE.Path(inner.map((p) => new THREE.Vector2(p.x, p.y))));
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: topM - bottomM, bevelEnabled: false });
  geometry.translate(0, 0, bottomM);
  return triangles(geometry);
}

/** A box of a given size, turned on the plan and set down. `turnDeg` is clockwise on the plan, as the design has it. */
function box(
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  centre: XY,
  baseM: number,
  turnDeg: number,
  shift?: XY,
): Float32Array | null {
  if (![sizeX, sizeY, sizeZ, centre.x, centre.y, baseM, turnDeg].every(Number.isFinite))
    return null;
  if (!(sizeX > EPS) || !(sizeY > EPS) || !(sizeZ > EPS)) return null;
  const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
  // A shift in the box's own plan frame (x along its length, y toward the plan's south), before the turn.
  geometry.translate(shift?.x ?? 0, -(shift?.y ?? 0), sizeZ / 2);
  // Clockwise on a plan whose y grows southward is clockwise seen from above: a negative turn about z up.
  geometry.rotateZ((-turnDeg * Math.PI) / 180);
  geometry.translate(centre.x, -centre.y, baseM);
  return triangles(geometry);
}

/** The outline of a wall's face with its openings: the notches of the doors in the contour, the rest as holes. */
function wallFace(lengthM: number, heightM: number, openings: readonly WallOpeningSolid[]) {
  const margin = 0.001;
  const taken: Array<[number, number]> = [];
  const notches: XY[][] = [];
  const holes: XY[][] = [];
  let skipped = 0;
  for (const opening of [...openings].sort((p, q) => p.t0M - q.t0M)) {
    const t0 = Math.max(margin, opening.t0M);
    const t1 = Math.min(lengthM - margin, opening.t1M);
    const top = Math.min(heightM - margin, opening.topM);
    const bottom = Math.max(0, opening.bottomM);
    if (!(t1 - t0 > 0.01) || !(top - bottom > 0.01) || taken.some(([a, b]) => t0 < b && t1 > a)) {
      skipped++;
      continue;
    }
    taken.push([t0, t1]);
    const given = (opening.profile ?? []).map((p) => ({
      x: Math.min(t1, Math.max(t0, p.x)),
      y: Math.min(top, Math.max(0, p.y)),
    }));
    const rectangle = [
      { x: t0, y: bottom },
      { x: t1, y: bottom },
      { x: t1, y: top },
      { x: t0, y: top },
    ];
    const profile = given.length >= 3 && Math.abs(signedArea(given)) > 1e-6 ? given : rectangle;
    const onFloor = bottom <= margin;
    if (
      onFloor &&
      profile[0].y <= margin &&
      profile[1].y <= margin &&
      profile[0].x < profile[1].x
    ) {
      // Up the left side, over the top, down the right side: the profile taken backwards from its first corner.
      notches.push([
        { x: profile[0].x, y: 0 },
        ...profile.slice(2).reverse(),
        { x: profile[1].x, y: 0 },
      ]);
    } else {
      holes.push(profile.map((p) => ({ x: p.x, y: Math.max(margin, p.y) })));
    }
  }
  const contour: XY[] = [{ x: 0, y: 0 }];
  for (const notch of notches) contour.push(...notch);
  contour.push({ x: lengthM, y: 0 }, { x: lengthM, y: heightM }, { x: 0, y: heightM });
  return { contour, holes, skipped };
}

/** A straight wall slab with its openings, where the 3D view stands it. */
function straightWall(wall: WallSolid): { positions: Float32Array | null; skipped: number } {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (!(length > EPS) || !(wall.heightM > EPS) || !(wall.thicknessM > EPS))
    return { positions: null, skipped: 0 };
  const face = wallFace(length, wall.heightM, wall.openings);
  const shape = new THREE.Shape(face.contour.map((p) => new THREE.Vector2(p.x, p.y)));
  for (const hole of face.holes)
    shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, p.y))));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: wall.thicknessM,
    bevelEnabled: false,
  });
  // The face is drawn in (along the wall, up); it is pushed out along the wall's inward side. A wall of a room
  // stands outside its line, a free wall and a shared pane of glass stand on it.
  geometry.translate(0, 0, wall.centred ? -wall.thicknessM / 2 : -wall.thicknessM);
  const along = new THREE.Vector3(
    (wall.b.x - wall.a.x) / length,
    -(wall.b.y - wall.a.y) / length,
    0,
  );
  const up = new THREE.Vector3(0, 0, 1);
  const inward = new THREE.Vector3().crossVectors(along, up);
  const place = new THREE.Matrix4().makeBasis(along, up, inward);
  place.setPosition(wall.a.x, -wall.a.y, wall.elevationM ?? 0);
  geometry.applyMatrix4(place);
  return { positions: triangles(geometry), skipped: face.skipped };
}

/** A curved wall without openings: the band between two runs of points along the arc. */
function curvedWall(wall: WallSolid, bulge: number): Float32Array | null {
  const points = segmentPoints(wall.a, wall.b, bulge, 0.005);
  if (points.length < 3) return null;
  // The side of a point that looks into the room: the turn of the wall's own inward side with the arc.
  const chord = { x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y };
  const chordInward = { x: -chord.y, y: chord.x };
  const side = Math.sign(chordInward.x * wall.inward.x + chordInward.y * wall.inward.y) || 1;
  const unit = (from: XY, to: XY): XY => {
    const l = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: (to.x - from.x) / l, y: (to.y - from.y) / l };
  };
  // At a joint the band is pushed out along the middle of the two pieces' sides, and further by the mitre, so
  // that it is as wide as the wall is thick along each piece.
  const normalAt = (i: number): XY => {
    const a = unit(points[Math.max(0, i - 1)], points[Math.max(1, i)]);
    const b = unit(
      points[Math.min(points.length - 2, i)],
      points[Math.min(points.length - 1, i + 1)],
    );
    const tx = a.x + b.x;
    const ty = a.y + b.y;
    const l = Math.hypot(tx, ty) || 1;
    const mitre = 1 / Math.max(0.5, (a.x * tx + a.y * ty) / l);
    return { x: (side * -ty * mitre) / l, y: (side * tx * mitre) / l };
  };
  const inner = wall.centred ? wall.thicknessM / 2 : 0;
  const outer = wall.centred ? -wall.thicknessM / 2 : -wall.thicknessM;
  const band = [
    ...points.map((p, i) => ({ x: p.x + normalAt(i).x * inner, y: p.y + normalAt(i).y * inner })),
    ...points
      .map((p, i) => ({ x: p.x + normalAt(i).x * outer, y: p.y + normalAt(i).y * outer }))
      .reverse(),
  ];
  const base = wall.elevationM ?? 0;
  return prism(band, [], base, base + wall.heightM);
}

/** One half plane's share of an outline (the points where `value` is at most `limit`, or at least it). */
function clip(
  points: readonly XY[],
  value: (p: XY) => number,
  limit: number,
  below: boolean,
): XY[] {
  const inside = (p: XY) => (below ? value(p) <= limit + 1e-9 : value(p) >= limit - 1e-9);
  const out: XY[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (limit - value(a)) / (value(b) - value(a));
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** A solid between two heights that change over the plan: the roof's covering. Plan points in, export frame out. */
function slopedSolid(
  planOutline: readonly XY[],
  topAt: (planPoint: XY) => number,
  thicknessM: number,
  seam?: (planPoint: XY) => boolean,
): number[] {
  const out: number[] = [];
  let ring = planOutline.filter(
    (p, i) =>
      Math.hypot(
        p.x - planOutline[(i + 1) % planOutline.length].x,
        p.y - planOutline[(i + 1) % planOutline.length].y,
      ) > EPS,
  );
  if (ring.length < 3) return out;
  // In the export frame (y turned over) the ring is taken counter-clockwise: the inside is then on the left.
  const flat = (p: XY) => ({ x: p.x, y: -p.y });
  if (signedArea(ring.map(flat)) < 0) ring = [...ring].reverse();
  const corner = (p: XY, top: boolean) => {
    const z = topAt(p) - (top ? 0 : thicknessM);
    return [p.x, -p.y, z];
  };
  const push = (a: number[], b: number[], c: number[]) => out.push(...a, ...b, ...c);
  const faces = THREE.ShapeUtils.triangulateShape(
    ring.map((p) => new THREE.Vector2(p.x, -p.y)),
    [],
  );
  for (const [i, j, k] of faces) {
    const tri = [ring[i], ring[j], ring[k]];
    const ccw = signedArea(tri.map(flat)) > 0;
    const [a, b, c] = ccw ? tri : [tri[0], tri[2], tri[1]];
    push(corner(a, true), corner(b, true), corner(c, true));
    push(corner(a, false), corner(c, false), corner(b, false));
  }
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    // The cut between the two faces of a gable is inside the roof: it gets no wall.
    if (seam && seam(p) && seam(q)) continue;
    push(corner(p, false), corner(q, false), corner(q, true));
    push(corner(p, false), corner(q, true), corner(p, true));
  }
  return out;
}

function roofSolid(
  polygon: readonly XY[],
  elevationM: number,
  config: RoofConfig,
): Float32Array | null {
  const surface = createRoofSurface(polygon as XY[], elevationM, config);
  if (!surface) return null;
  const thickness = roofVerticalThickness(surface);
  const topAt = (p: XY) => roofHeightAt(surface, p);
  if (surface.config.style !== 'gable')
    return new Float32Array(slopedSolid(surface.polygon, topAt, thickness));
  // A gable has two faces: the outline is cut along the ridge, and each half is made by itself.
  const across = (p: XY) => p[surface.axis];
  const onRidge = (p: XY) => Math.abs(across(p) - surface.ridge) < 1e-7;
  const numbers = [
    ...slopedSolid(clip(surface.polygon, across, surface.ridge, true), topAt, thickness, onRidge),
    ...slopedSolid(clip(surface.polygon, across, surface.ridge, false), topAt, thickness, onRidge),
  ];
  return numbers.length > 0 ? new Float32Array(numbers) : null;
}

function join(pieces: Array<Float32Array | null>): Float32Array | null {
  const kept = pieces.filter((p): p is Float32Array => p !== null && p.length > 0);
  if (kept.length === 0) return null;
  const out = new Float32Array(kept.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const piece of kept) {
    out.set(piece, at);
    at += piece.length;
  }
  return out;
}

/** The outline of a room's floor with its curved edges as short straight pieces. */
function curvedOutline(polygon: readonly XY[], roomId: string, curves: WallCurves): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const bulge = cleanBulge(curves.get(`wall-${roomId}-${i}`));
    const points = bulge === undefined ? [a] : segmentPoints(a, b, bulge, 0.005).slice(0, -1);
    out.push(...points);
  }
  return out;
}

/**
 * The house as parts. `curves` names the curved walls of the design (format version 2) by the key the solids
 * give a wall: `wall-<room id>-<edge>` for an edge of a room, `fw-<id>` for a free wall.
 */
export function exportParts(solids: SceneSolids, curves: WallCurves = new Map()): ExportModel {
  const parts: ExportPart[] = [];
  const notes: string[] = [];
  const add = (part: Omit<ExportPart, 'positions'>, positions: Float32Array | null) => {
    if (positions && positions.length >= 9) parts.push({ ...part, positions });
  };

  for (const floor of solids.floors) {
    const top = floor.elevationM ?? 0;
    const hasCurve = floor.polygon.some(
      (_, i) => cleanBulge(curves.get(`wall-${floor.roomId}-${i}`)) !== undefined,
    );
    add(
      {
        name: `floor ${floor.roomId}`,
        kind: 'floor',
        levelId: floor.levelId,
        colourHex: hex(floor.hex, '#a9aba6'),
        extras: { roomId: floor.roomId },
      },
      prism(
        hasCurve ? curvedOutline(floor.polygon, floor.roomId, curves) : floor.polygon,
        floor.holes ?? [],
        top - FLOOR_SLAB_THICKNESS_M,
        top,
      ),
    );
  }

  let openingsLeftOut = 0;
  let curvedWithOpenings = 0;
  for (const wall of solids.walls) {
    if (wall.renderDuplicateOf) continue;
    const bulge = cleanBulge(curves.get(wall.key));
    let positions: Float32Array | null;
    if (bulge !== undefined && wall.openings.length === 0) positions = curvedWall(wall, bulge);
    else {
      if (bulge !== undefined) curvedWithOpenings++;
      const made = straightWall(wall);
      positions = made.positions;
      openingsLeftOut += made.skipped;
    }
    add(
      { name: wall.key, kind: 'wall', levelId: wall.levelId, colourHex: hex(wall.hex, '#e8e4dc') },
      positions,
    );
  }
  if (curvedWithOpenings > 0)
    notes.push(
      `${curvedWithOpenings} curved ${curvedWithOpenings === 1 ? 'wall has' : 'walls have'} a door or a window and ${curvedWithOpenings === 1 ? 'is' : 'are'} exported straight.`,
    );
  if (openingsLeftOut > 0)
    notes.push(
      `${openingsLeftOut} ${openingsLeftOut === 1 ? 'opening lies' : 'openings lie'} over another or off the wall and ${openingsLeftOut === 1 ? 'is' : 'are'} not cut out.`,
    );

  for (const roof of solids.roofs ?? [])
    add(
      {
        name: `roof ${roof.roomId ?? ''}`.trim(),
        kind: 'roof',
        levelId: roof.levelId,
        colourHex: roof.coolCoating ? '#e7e6d6' : (ROOF_HEX[roof.config.material] ?? '#7e9498'),
      },
      roofSolid(roof.polygon, roof.elevationM, roof.config),
    );

  for (const { stair, baseM, riseM } of solids.stairs ?? []) {
    if (
      ![stair.x, stair.y, stair.rotation, stair.widthM, stair.runM, baseM, riseM].every(
        Number.isFinite,
      )
    )
      continue;
    if (!(stair.widthM > 0) || !(stair.runM > 0) || !(riseM > 0)) continue;
    // The 3D view's own count: a riser of at most 0.18 m.
    const count = Math.min(512, Math.max(1, Math.ceil((riseM - 1e-9) / 0.18)));
    const going = stair.runM / count;
    const steps: Array<Float32Array | null> = [];
    for (let i = 0; i < count; i++)
      steps.push(
        box(stair.widthM, going, ((i + 1) * riseM) / count, stair, baseM, stair.rotation, {
          x: 0,
          y: -stair.runM / 2 + (i + 0.5) * going,
        }),
      );
    add({ name: `stair ${stair.id}`, kind: 'stair', colourHex: STAIR_HEX }, join(steps));
  }

  for (const item of solids.items) add(thingPart(item), thingBox(item));

  if (solids.garden && solids.gardenVisible !== false) {
    for (const surface of solids.garden.surfaces) {
      const top = Math.max(0, surface.elevationM);
      add(
        {
          name: `garden ${surface.kind} ${surface.id}`,
          kind: 'garden',
          colourHex: GARDEN_SURFACES[surface.kind]?.hex ?? '#70934f',
        },
        prism(gardenSurfacePolygon(surface), [], top - (surface.thicknessM ?? GARDEN_SLAB_M), top),
      );
    }
    for (const fence of solids.garden.fences) {
      const length = Math.hypot(fence.b.x - fence.a.x, fence.b.y - fence.a.y);
      const turn = (Math.atan2(fence.b.y - fence.a.y, fence.b.x - fence.a.x) * 180) / Math.PI;
      add(
        {
          name: `fence ${fence.id}`,
          kind: 'garden',
          colourHex: FENCE_MATERIALS[fence.material]?.hex ?? '#a37b50',
        },
        box(
          length,
          FENCE_THICKNESS_M,
          fence.heightM,
          { x: (fence.a.x + fence.b.x) / 2, y: (fence.a.y + fence.b.y) / 2 },
          0,
          turn,
        ),
      );
    }
  }
  return { parts, notes };
}

function thingPart(item: ItemSolid): Omit<ExportPart, 'positions'> {
  return {
    name: `thing ${item.instanceId}`,
    kind: 'thing',
    levelId: item.levelId,
    colourHex: hex(item.hex, '#b9b3a8'),
    extras: {
      instanceId: item.instanceId,
      ...(item.productId ? { productId: item.productId } : {}),
    },
  };
}

/** A placed thing as a box of its true size, where the plan has it. */
function thingBox(item: ItemSolid): Float32Array | null {
  return box(
    item.lengthM,
    item.widthM,
    Math.max(0.005, item.z1 - item.z0),
    { x: (item.x0 + item.x1) / 2, y: (item.y0 + item.y1) / 2 },
    item.z0,
    item.rotationDeg,
  );
}

// ---- what a model is, in numbers ----

export interface ModelNumbers {
  parts: number;
  triangles: number;
  /** The size of the box round the whole model, in metres: east to west, north to south, bottom to top. */
  sizeM: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export function modelNumbers(parts: readonly ExportPart[]): ModelNumbers {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let count = 0;
  for (const part of parts) {
    count += part.positions.length / 9;
    for (let i = 0; i < part.positions.length; i += 3) {
      min.x = Math.min(min.x, part.positions[i]);
      min.y = Math.min(min.y, part.positions[i + 1]);
      min.z = Math.min(min.z, part.positions[i + 2]);
      max.x = Math.max(max.x, part.positions[i]);
      max.y = Math.max(max.y, part.positions[i + 1]);
      max.z = Math.max(max.z, part.positions[i + 2]);
    }
  }
  if (count === 0) {
    const zero = { x: 0, y: 0, z: 0 };
    return { parts: 0, triangles: 0, sizeM: zero, min: zero, max: zero };
  }
  return {
    parts: parts.length,
    triangles: count,
    sizeM: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    min,
    max,
  };
}

/** The volume a part encloses, in cubic metres: positive when its faces look outward. */
export function partVolumeM3(positions: Float32Array): number {
  let six = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.subarray(i, i + 9);
    six += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return six / 6;
}

// ---- the two files ----

/**
 * A binary glTF 2.0 file (`.glb`): metres, y up, right-handed, as the format asks. One node for each part, with
 * its name, a plain colour, and its extras. Faces are flat: each has its own normal.
 */
export function glbBytes(parts: readonly ExportPart[], title: string): Uint8Array {
  const kept = parts.filter((part) => part.positions.length >= 9);
  const materials: string[] = [];
  const materialOf = (colour: string) => {
    const at = materials.indexOf(colour);
    return at >= 0 ? at : materials.push(colour) - 1;
  };
  const views: Array<{ byteOffset: number; byteLength: number }> = [];
  const accessors: Record<string, unknown>[] = [];
  const meshes: Record<string, unknown>[] = [];
  const nodes: Record<string, unknown>[] = [];
  const chunks: Float32Array[] = [];
  let offset = 0;
  const put = (data: Float32Array, minMax: boolean) => {
    chunks.push(data);
    views.push({ byteOffset: offset, byteLength: data.byteLength });
    offset += data.byteLength;
    const accessor: Record<string, unknown> = {
      bufferView: views.length - 1,
      componentType: 5126,
      count: data.length / 3,
      type: 'VEC3',
    };
    if (minMax) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < data.length; i++) {
        min[i % 3] = Math.min(min[i % 3], data[i]);
        max[i % 3] = Math.max(max[i % 3], data[i]);
      }
      accessor.min = min;
      accessor.max = max;
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };
  for (const part of kept) {
    // From x east, y north, z up to the file's x east, y up, z south: a turn, so the faces keep their side.
    const position = new Float32Array(part.positions.length);
    const normal = new Float32Array(part.positions.length);
    for (let i = 0; i < part.positions.length; i += 3) {
      position[i] = part.positions[i];
      position[i + 1] = part.positions[i + 2];
      position[i + 2] = -part.positions[i + 1];
    }
    for (let i = 0; i < position.length; i += 9) {
      const ux = position[i + 3] - position[i];
      const uy = position[i + 4] - position[i + 1];
      const uz = position[i + 5] - position[i + 2];
      const vx = position[i + 6] - position[i];
      const vy = position[i + 7] - position[i + 1];
      const vz = position[i + 8] - position[i + 2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      // A face with no area has no side: it is given one, so that the file stays well formed.
      if (l > 0) {
        nx /= l;
        ny /= l;
        nz /= l;
      } else {
        nx = 0;
        ny = 1;
        nz = 0;
      }
      for (let k = 0; k < 9; k += 3) {
        normal[i + k] = nx;
        normal[i + k + 1] = ny;
        normal[i + k + 2] = nz;
      }
    }
    const positionAt = put(position, true);
    const normalAt = put(normal, false);
    meshes.push({
      name: part.name,
      primitives: [
        {
          attributes: { POSITION: positionAt, NORMAL: normalAt },
          material: materialOf(part.colourHex),
          mode: 4,
        },
      ],
    });
    nodes.push({
      name: part.name,
      mesh: meshes.length - 1,
      extras: {
        kind: part.kind,
        ...(part.levelId ? { levelId: part.levelId } : {}),
        ...part.extras,
      },
    });
  }
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const json = {
    asset: { version: '2.0', generator: 'design export' },
    scene: 0,
    scenes: [{ name: title, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials: materials.map((colour) => ({
      name: colour,
      pbrMetallicRoughness: {
        baseColorFactor: [
          linear(parseInt(colour.slice(1, 3), 16)),
          linear(parseInt(colour.slice(3, 5), 16)),
          linear(parseInt(colour.slice(5, 7), 16)),
          1,
        ],
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    })),
    accessors,
    bufferViews: views.map((view) => ({ buffer: 0, ...view, target: 34962 })),
    buffers: [{ byteLength: offset }],
  };
  // A model with nothing in it is still a file another program can open: a scene with no node.
  if (kept.length === 0) {
    for (const key of [
      'nodes',
      'meshes',
      'materials',
      'accessors',
      'bufferViews',
      'buffers',
    ] as const)
      delete (json as Record<string, unknown>)[key];
    json.scenes = [{ name: title, nodes: [] }];
  }
  const text = new TextEncoder().encode(JSON.stringify(json));
  const textLength = Math.ceil(text.length / 4) * 4;
  const binLength = Math.ceil(offset / 4) * 4;
  const total = 12 + 8 + textLength + (offset > 0 ? 8 + binLength : 0);
  const file = new Uint8Array(total);
  const view = new DataView(file.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, textLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  file.fill(0x20, 20, 20 + textLength);
  file.set(text, 20);
  if (offset > 0) {
    const at = 20 + textLength;
    view.setUint32(at, binLength, true);
    view.setUint32(at + 4, 0x004e4942, true);
    let cursor = at + 8;
    for (const chunk of chunks) {
      file.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), cursor);
      cursor += chunk.byteLength;
    }
  }
  return file;
}

/**
 * A binary STL file for a 3D printer: one solid, millimetres, z up, at the true size of the house (a slicer
 * scales it). `scale` makes a smaller model: 0.01 is 1 to 100.
 */
export function stlBytes(parts: readonly ExportPart[], title: string, scale = 1): Uint8Array {
  const count = parts.reduce((n, part) => n + Math.floor(part.positions.length / 9), 0);
  const file = new Uint8Array(84 + count * 50);
  const view = new DataView(file.buffer);
  // The first 80 bytes are a free text. It must not begin with the word that starts a text STL.
  const head = new TextEncoder().encode(
    `binary stl, millimetres, z up: ${title}`.replace(/[^\x20-\x7e]/g, '?'),
  );
  file.set(head.subarray(0, 80), 0);
  view.setUint32(80, count, true);
  const k = 1000 * scale;
  let at = 84;
  for (const part of parts) {
    const p = part.positions;
    for (let i = 0; i + 9 <= p.length; i += 9) {
      const ux = p[i + 3] - p[i];
      const uy = p[i + 4] - p[i + 1];
      const uz = p[i + 5] - p[i + 2];
      const vx = p[i + 6] - p[i];
      const vy = p[i + 7] - p[i + 1];
      const vz = p[i + 8] - p[i + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      view.setFloat32(at, nx / l, true);
      view.setFloat32(at + 4, ny / l, true);
      view.setFloat32(at + 8, nz / l, true);
      for (let c = 0; c < 9; c++) view.setFloat32(at + 12 + c * 4, p[i + c] * k, true);
      view.setUint16(at + 48, 0, true);
      at += 50;
    }
  }
  return file;
}
