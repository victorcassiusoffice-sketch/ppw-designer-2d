/**
 * A 3D model file read as a plan: glTF binary (`.glb`) and OBJ (`.obj`).
 *
 * A model is a skin of triangles; it has no rooms. What a plan can take from it honestly is its OUTLINE SEEN
 * FROM ABOVE: each separate part of that outline becomes one room, to be given walls as high as the model. Inner
 * walls, doors and windows are not read, and the import says so.
 *
 * One kind of model says more: a glTF file this app saved itself (and one the desktop game writes the same way)
 * names each part and its storey. From such a file only the floors are taken, storey by storey, so the rooms come
 * back as they were drawn.
 *
 * Both formats are read here, with no package: a model is metres with y upward (the rule of glTF; an OBJ file is
 * read the same way, and says so). On the plan x is east and y is south.
 */
import type { PlanImportLayer, PlanImportShape, PlanImportSource } from './planImport';

export const MODEL_IMPORT_LIMITS = { bytes: 25_000_000, triangles: 2_000_000, cells: 600 } as const;

interface XY {
  x: number;
  y: number;
}
/** Triangles on the plan (x east, y south), six numbers each, with the lowest and highest point of the group. */
interface Group {
  name: string;
  flat: number[];
  low: number;
  high: number;
}

// ---- the outline of a set of triangles seen from above ----

/**
 * The outlines of what the triangles cover on the plan: one closed line for each separate part, the largest
 * first. The plan is laid over with square cells of side `cell`; a part smaller than `minAreaM2` is left out.
 * A hole inside a part is not given: an outline is the outer line of its part.
 */
export function footprintOutlines(flat: ArrayLike<number>, cell: number, minAreaM2 = 1): XY[][] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    minX = Math.min(minX, flat[i]);
    maxX = Math.max(maxX, flat[i]);
    minY = Math.min(minY, flat[i + 1]);
    maxY = Math.max(maxY, flat[i + 1]);
  }
  if (!(maxX > minX) || !(maxY > minY) || !(cell > 0)) return [];
  // One cell of margin all round, so that every part has free cells about it.
  const nx = Math.ceil((maxX - minX) / cell) + 2;
  const ny = Math.ceil((maxY - minY) / cell) + 2;
  const covered = new Uint8Array(nx * ny);
  const cx = (x: number) => (x - minX) / cell + 1;
  const cy = (y: number) => (y - minY) / cell + 1;
  for (let t = 0; t + 5 < flat.length; t += 6) {
    const ax = cx(flat[t]);
    const ay = cy(flat[t + 1]);
    const bx = cx(flat[t + 2]);
    const by = cy(flat[t + 3]);
    const px = cx(flat[t + 4]);
    const py = cy(flat[t + 5]);
    const area = (bx - ax) * (py - ay) - (px - ax) * (by - ay);
    // A triangle seen edge-on (a wall) covers no area of the plan.
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, px)));
    const x1 = Math.min(nx - 1, Math.floor(Math.max(ax, bx, px)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, py)));
    const y1 = Math.min(ny - 1, Math.floor(Math.max(ay, by, py)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        // The middle of the cell lies in the triangle.
        const mx = x + 0.5;
        const my = y + 0.5;
        const w0 = ((bx - mx) * (py - my) - (px - mx) * (by - my)) / area;
        const w1 = ((px - mx) * (ay - my) - (ax - mx) * (py - my)) / area;
        if (w0 >= -1e-9 && w1 >= -1e-9 && 1 - w0 - w1 >= -1e-9) covered[y * nx + x] = 1;
      }
  }
  // Each separate part: cells that touch side to side.
  const label = new Int32Array(nx * ny);
  const parts: { id: number; cells: number; first: number }[] = [];
  const queue: number[] = [];
  for (let start = 0; start < covered.length; start++) {
    if (!covered[start] || label[start]) continue;
    const id = parts.length + 1;
    let cells = 0;
    label[start] = id;
    queue.push(start);
    while (queue.length) {
      const at = queue.pop()!;
      cells++;
      const x = at % nx;
      for (const next of [at - 1, at + 1, at - nx, at + nx]) {
        if (next < 0 || next >= covered.length || !covered[next] || label[next]) continue;
        if ((next === at - 1 && x === 0) || (next === at + 1 && x === nx - 1)) continue;
        label[next] = id;
        queue.push(next);
      }
    }
    parts.push({ id, cells, first: start });
  }
  const outlines: { area: number; points: XY[] }[] = [];
  for (const part of parts) {
    if (part.cells * cell * cell < minAreaM2) continue;
    const inside = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < nx && y < ny && label[y * nx + x] === part.id;
    // The first cell found is the highest row's leftmost cell of the part: its upper left corner is on the
    // outer line. Walk that line with the part on the right hand, turning right where the way is free.
    const sx = part.first % nx;
    const sy = Math.floor(part.first / nx);
    const corners: XY[] = [];
    let x = sx;
    let y = sy;
    let dx = 1;
    let dy = 0;
    for (let guard = 0; guard < 8 * nx * ny; guard++) {
      corners.push({ x, y });
      // The cells ahead of this corner, to the right and to the left of the way.
      const right = (ddx: number, ddy: number) =>
        inside(
          x + (ddx > 0 ? 0 : ddx < 0 ? -1 : ddy > 0 ? -1 : 0),
          y + (ddy > 0 ? 0 : ddy < 0 ? -1 : ddx > 0 ? 0 : -1),
        );
      const left = (ddx: number, ddy: number) =>
        inside(
          x + (ddx > 0 ? 0 : ddx < 0 ? -1 : ddy > 0 ? 0 : -1),
          y + (ddy > 0 ? 0 : ddy < 0 ? -1 : ddx > 0 ? -1 : 0),
        );
      // Turn right, go on, or turn left: the first way that keeps a cell of the part on the right and none on
      // the left.
      const ways = [
        [-dy, dx],
        [dx, dy],
        [dy, -dx],
      ];
      let moved = false;
      for (const [wx, wy] of ways) {
        if (right(wx, wy) && !left(wx, wy)) {
          dx = wx;
          dy = wy;
          moved = true;
          break;
        }
      }
      if (!moved) break;
      x += dx;
      y += dy;
      if (x === sx && y === sy) break;
    }
    const metres = corners.map((c) => ({ x: minX + (c.x - 1) * cell, y: minY + (c.y - 1) * cell }));
    // A slanted side comes out of the cells as steps of one cell: a point within a cell and a half of the
    // straight line is taken as on it. A side along the cells has no step and is kept to the point.
    const simple = simplifyClosed(metres, cell * 1.5);
    if (simple.length >= 3) outlines.push({ area: Math.abs(areaOf(simple)), points: simple });
  }
  return outlines.sort((a, b) => b.area - a.area).map((o) => o.points);
}

const areaOf = (points: readonly XY[]): number =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;

/** A closed line with fewer points: none of the points taken out stood off the new line by more than `tolerance`. */
export function simplifyClosed(points: readonly XY[], tolerance: number): XY[] {
  if (points.length < 4) return points.map((p) => ({ ...p }));
  // Cut the closed line at its two points that are furthest apart, and thin each half.
  let a = 0;
  let b = 0;
  let far = -1;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > far) {
      far = d;
      b = i;
    }
  }
  far = -1;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[b].x, points[i].y - points[b].y);
    if (d > far) {
      far = d;
      a = i;
    }
  }
  const [from, to] = a < b ? [a, b] : [b, a];
  const thin = (line: XY[]): XY[] => {
    if (line.length < 3) return line;
    const first = line[0];
    const last = line[line.length - 1];
    const length = Math.hypot(last.x - first.x, last.y - first.y) || 1;
    let worst = 0;
    let at = 0;
    for (let i = 1; i < line.length - 1; i++) {
      const d =
        Math.abs(
          (last.x - first.x) * (first.y - line[i].y) - (first.x - line[i].x) * (last.y - first.y),
        ) / length;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst <= tolerance) return [first, last];
    return [...thin(line.slice(0, at + 1)).slice(0, -1), ...thin(line.slice(at))];
  };
  const one = thin(points.slice(from, to + 1));
  const two = thin([...points.slice(to), ...points.slice(0, from + 1)]);
  return [...one.slice(0, -1), ...two.slice(0, -1)].map((p) => ({ ...p }));
}

// ---- the two formats ----

function readObj(text: string): Group[] {
  const vertices: number[] = [];
  const flat: number[] = [];
  let low = Infinity;
  let high = -Infinity;
  let faces = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number);
      if (![x, y, z].every(Number.isFinite))
        throw new Error('The OBJ file has a point that is no number.');
      vertices.push(x, y, z);
    } else if (line.startsWith('f ')) {
      const corners = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((part) => {
          const n = Number(part.split('/')[0]);
          const index = n < 0 ? vertices.length / 3 + n : n - 1;
          if (!Number.isInteger(index) || index < 0 || index >= vertices.length / 3)
            throw new Error('The OBJ file has a face that names a point it does not have.');
          return index;
        });
      for (let i = 1; i + 1 < corners.length; i++) {
        if (++faces > MODEL_IMPORT_LIMITS.triangles)
          throw new Error('This model has too many faces. Use a simpler one.');
        for (const c of [corners[0], corners[i], corners[i + 1]]) {
          // y is up: the plan takes x, and z as its y.
          flat.push(vertices[c * 3], vertices[c * 3 + 2]);
          low = Math.min(low, vertices[c * 3 + 1]);
          high = Math.max(high, vertices[c * 3 + 1]);
        }
      }
    }
  }
  return flat.length ? [{ name: 'Model', flat, low, high }] : [];
}

type Json = Record<string, unknown>;
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

function readGlb(bytes: Uint8Array): { groups: Group[]; own: boolean } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67)
    throw new Error('This is not a glTF binary file. Save the model as a single .glb file.');
  if (view.getUint32(4, true) !== 2) throw new Error('Only glTF version 2 is read.');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength)
    throw new Error('The glTF file is incomplete.');
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as Json;
  const packed = [...list(json.extensionsRequired), ...list(json.extensionsUsed)].map(String);
  if (packed.some((name) => /draco|meshopt/i.test(name)))
    throw new Error('This glTF file is packed (Draco or meshopt). Save it again without packing.');
  let bin: Uint8Array | undefined;
  const binAt = 20 + jsonLength;
  if (binAt + 8 <= bytes.byteLength && view.getUint32(binAt + 4, true) === 0x004e4942)
    bin = bytes.subarray(binAt + 8, binAt + 8 + view.getUint32(binAt, true));
  const buffers = list(json.buffers);
  if (buffers.some((b) => typeof b.uri === 'string'))
    throw new Error(
      'This glTF file keeps its points in another file. Save the model as a single .glb file.',
    );
  const accessors = list(json.accessors);
  const views = list(json.bufferViews);
  const meshes = list(json.meshes);
  const nodes = list(json.nodes);
  const read = (
    index: unknown,
    size: number,
  ): { get: (i: number, k: number) => number; count: number } | undefined => {
    const accessor = accessors[index as number];
    const bufferView = accessor ? views[accessor.bufferView as number] : undefined;
    if (!accessor || !bufferView || !bin || accessor.sparse) return undefined;
    const type = accessor.componentType as number;
    const width = type === 5126 || type === 5125 ? 4 : type === 5123 ? 2 : type === 5121 ? 1 : 0;
    if (!width) return undefined;
    const start = ((bufferView.byteOffset as number) ?? 0) + ((accessor.byteOffset as number) ?? 0);
    const stride = (bufferView.byteStride as number) || width * size;
    const count = accessor.count as number;
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      start + (count - 1) * stride + width * size > bin.byteLength
    )
      return undefined;
    const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    return {
      count,
      get: (i, k) => {
        const at = start + i * stride + k * width;
        return type === 5126
          ? data.getFloat32(at, true)
          : type === 5125
            ? data.getUint32(at, true)
            : type === 5123
              ? data.getUint16(at, true)
              : data.getUint8(at);
      },
    };
  };
  // A node's place: its own matrix, or its turn, its size and its shift, under the node that holds it.
  const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const times = (a: number[], b: number[]) => {
    const out = new Array<number>(16).fill(0);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return out;
  };
  const local = (node: Json): number[] => {
    if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix as number[];
    const [tx, ty, tz] = (node.translation as number[] | undefined) ?? [0, 0, 0];
    const [qx, qy, qz, qw] = (node.rotation as number[] | undefined) ?? [0, 0, 0, 1];
    const [sx, sy, sz] = (node.scale as number[] | undefined) ?? [1, 1, 1];
    return [
      (1 - 2 * (qy * qy + qz * qz)) * sx,
      2 * (qx * qy + qz * qw) * sx,
      2 * (qx * qz - qy * qw) * sx,
      0,
      2 * (qx * qy - qz * qw) * sy,
      (1 - 2 * (qx * qx + qz * qz)) * sy,
      2 * (qy * qz + qx * qw) * sy,
      0,
      2 * (qx * qz + qy * qw) * sz,
      2 * (qy * qz - qx * qw) * sz,
      (1 - 2 * (qx * qx + qy * qy)) * sz,
      0,
      tx,
      ty,
      tz,
      1,
    ];
  };
  const byName = new Map<string, Group>();
  let own = false;
  let triangles = 0;
  const visit = (index: number, parent: number[], depth: number) => {
    const node = nodes[index];
    if (!node || depth > 64) return;
    const world = times(parent, local(node));
    const extras = (node.extras ?? {}) as Json;
    const kind = typeof extras.kind === 'string' ? extras.kind : undefined;
    const level = typeof extras.levelId === 'string' ? extras.levelId : undefined;
    if (kind) own = true;
    const mesh = meshes[node.mesh as number];
    for (const primitive of list(mesh?.primitives)) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      const position = read((primitive.attributes as Json | undefined)?.POSITION, 3);
      if (!position) continue;
      const indices = primitive.indices === undefined ? undefined : read(primitive.indices, 1);
      const count = indices ? indices.count : position.count;
      triangles += Math.floor(count / 3);
      if (triangles > MODEL_IMPORT_LIMITS.triangles)
        throw new Error('This model has too many faces. Use a simpler one.');
      const key = kind ? `${kind}|${level ?? ''}` : 'model';
      const group = byName.get(key) ?? { name: key, flat: [], low: Infinity, high: -Infinity };
      byName.set(key, group);
      for (let i = 0; i + 2 < count; i += 3)
        for (let c = 0; c < 3; c++) {
          const at = indices ? indices.get(i + c, 0) : i + c;
          const x = position.get(at, 0);
          const y = position.get(at, 1);
          const z = position.get(at, 2);
          const wx = world[0] * x + world[4] * y + world[8] * z + world[12];
          const wy = world[1] * x + world[5] * y + world[9] * z + world[13];
          const wz = world[2] * x + world[6] * y + world[10] * z + world[14];
          // y is up, z is south: the plan takes x, and z as its y.
          group.flat.push(wx, wz);
          group.low = Math.min(group.low, wy);
          group.high = Math.max(group.high, wy);
        }
    }
    for (const child of (node.children as number[] | undefined) ?? [])
      visit(child, world, depth + 1);
  };
  const scenes = list(json.scenes);
  const roots =
    (scenes[(json.scene as number) ?? 0]?.nodes as number[] | undefined) ?? nodes.map((_, i) => i);
  for (const root of roots) visit(root, IDENTITY, 0);
  return { groups: [...byName.values()], own };
}

export function parsePlanModel(name: string, bytes: Uint8Array): PlanImportSource {
  if (bytes.byteLength > MODEL_IMPORT_LIMITS.bytes)
    throw new Error('Use a model file smaller than 25 MB.');
  const extension = name.split('.').pop()?.toLowerCase();
  const warnings: string[] = [];
  let groups: Group[];
  let own = false;
  if (extension === 'obj') {
    groups = readObj(new TextDecoder().decode(bytes));
    warnings.push(
      'An OBJ file names no unit and no upward axis: it is read in metres with y upward, as glTF is.',
    );
  } else if (extension === 'glb') {
    ({ groups, own } = readGlb(bytes));
  } else throw new Error('A 3D model is read from a .glb or an .obj file.');
  if (!groups.length) throw new Error('No face could be read from this model.');
  const low = Math.min(...groups.map((g) => g.low));
  const high = Math.max(...groups.map((g) => g.high));

  // A file this app saved names its floors and their storeys: only those are taken, storey by storey.
  // The slab under the roof is a floor in the file too, on the storey named `roof`: it is no storey to live on.
  const floors = groups
    .filter((g) => g.name.startsWith('floor|') && g.name !== 'floor|roof')
    .sort((a, b) => a.high - b.high);
  const taken =
    own && floors.length
      ? floors
      : [
          {
            ...groups.reduce((all, g) => ({ ...all, flat: all.flat.concat(g.flat) }), {
              name: 'Model',
              flat: [] as number[],
              low,
              high,
            }),
          },
        ];
  const shapes: PlanImportShape[] = [];
  const suggestedLayers: PlanImportLayer[] = [];
  let small = 0;
  taken.forEach((group, floor) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < group.flat.length; i += 2) {
      minX = Math.min(minX, group.flat[i]);
      maxX = Math.max(maxX, group.flat[i]);
      minY = Math.min(minY, group.flat[i + 1]);
      maxY = Math.max(maxY, group.flat[i + 1]);
    }
    const cell = Math.max(0.05, Math.max(maxX - minX, maxY - minY) / MODEL_IMPORT_LIMITS.cells);
    const outlines = footprintOutlines(group.flat, cell);
    const all = footprintOutlines(group.flat, cell, 0);
    small += all.length - outlines.length;
    const layer =
      own && floors.length
        ? `${floor === 0 ? 'Ground floor' : `Floor ${floor}`}: rooms`
        : 'Model outline';
    outlines
      .slice(0, 150)
      .forEach((points, i) =>
        shapes.push({ id: `model-${floor}-${i}`, layer, closed: true, points }),
      );
    if (outlines.length)
      suggestedLayers.push({ name: layer, role: 'rooms', floor: Math.min(11, floor) });
  });
  if (small)
    warnings.push(
      `${small} small ${small === 1 ? 'part' : 'parts'} of the outline (under 1 m2) left out.`,
    );
  warnings.push(
    own && floors.length
      ? 'A 3D file saved by this app: its floors come back as rooms, storey by storey. Doors, windows, the roof, stairs and placed things are not read back from it; open the design file to get the whole design.'
      : `A 3D model has no rooms. Its outline seen from above becomes ${shapes.length === 1 ? 'one room' : `${shapes.length} rooms`}; its inner walls, doors and windows are not read. The model is ${(high - low).toFixed(2)} m high: set the wall height to match.`,
  );
  return {
    format: 'model',
    name: name.replace(/\.[^.]+$/, '').slice(0, 100) || '3D model',
    shapes,
    warnings,
    suggestedUnit: 'm',
    suggestedLayers,
  };
}
