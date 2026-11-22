/**
 * An IFC building file read as a plan: its storeys, its spaces as room outlines, its walls as centre lines.
 *
 * IFC is the open exchange format of building programs: a text file of numbered entities (ISO 10303-21). This
 * reader takes the small part of it that a plan needs, and says what it left: nothing is guessed.
 *
 * What is read: the length unit; every storey with its name and level; a space (`IFCSPACE`) whose shape is an
 * upright extrusion of a rectangle or of a closed line of straight pieces; a wall (`IFCWALL`,
 * `IFCWALLSTANDARDCASE`) by its axis line, or by the middle line of its rectangular body. What is not: doors,
 * windows, slabs, roofs, stairs, furniture, curved or tilted elements, shapes cut from other shapes.
 *
 * The file's frame is x east, y north, z up, in its own unit. Out of here everything is in metres on the plan:
 * x east, y south (the y is turned over, as for a drawing).
 */
import type { PlanImportLayer, PlanImportShape, PlanImportSource } from './planImport';

type Ref = { ref: number };
type Typed = { type: string; args: Value[] };
type Enum = { enum: string };
type Value = number | string | null | Ref | Enum | Typed | Value[];
interface Entity {
  type: string;
  args: Value[];
}
interface XY {
  x: number;
  y: number;
}
/** A turn and a shift on the plan, and whether the element stands upright. */
interface Placement {
  ax: XY;
  ay: XY;
  at: XY;
  upright: boolean;
}

const MAX_ENTITIES = 400000;
const isRef = (v: Value | undefined): v is Ref => typeof v === 'object' && v !== null && 'ref' in v;
const isList = (v: Value | undefined): v is Value[] => Array.isArray(v);
const isTyped = (v: Value | undefined): v is Typed =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'type' in v;
const enumOf = (v: Value | undefined): string | undefined =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'enum' in v ? v.enum : undefined;
const text = (v: Value | undefined): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined;
const num = (v: Value | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : isTyped(v) && typeof v.args[0] === 'number' && Number.isFinite(v.args[0])
      ? v.args[0]
      : undefined;

/** The arguments of one entity: numbers, texts, references, lists, typed values, and what is left empty. */
function parseArgs(source: string): Value[] {
  let i = 0;
  const skipSpace = () => {
    while (i < source.length && /\s/.test(source[i])) i++;
  };
  const list = (): Value[] => {
    const out: Value[] = [];
    i++; // the opening bracket
    skipSpace();
    if (source[i] === ')') {
      i++;
      return out;
    }
    for (;;) {
      out.push(value());
      skipSpace();
      if (source[i] === ',') {
        i++;
        continue;
      }
      if (source[i] === ')') {
        i++;
        return out;
      }
      throw new Error('Incomplete IFC entity.');
    }
  };
  const value = (): Value => {
    skipSpace();
    const c = source[i];
    if (c === undefined) throw new Error('Incomplete IFC entity.');
    if (c === '(') return list();
    if (c === '$' || c === '*') {
      i++;
      return null;
    }
    if (c === '#') {
      const m = /^#(\d+)/.exec(source.slice(i, i + 16));
      if (!m) throw new Error('Invalid IFC reference.');
      i += m[0].length;
      return { ref: Number(m[1]) };
    }
    if (c === "'") {
      let out = '';
      i++;
      for (;;) {
        if (i >= source.length) throw new Error('Incomplete IFC text.');
        if (source[i] === "'") {
          if (source[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          i++;
          return out;
        }
        out += source[i++];
      }
    }
    if (c === '.') {
      const m = /^\.([A-Z0-9_]+)\./.exec(source.slice(i, i + 80));
      if (m) {
        i += m[0].length;
        return { enum: m[1] };
      }
    }
    const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?/.exec(source.slice(i, i + 40));
    if (number) {
      i += number[0].length;
      return Number(number[0]);
    }
    const typed = /^([A-Z][A-Z0-9_]*)\s*\(/.exec(source.slice(i, i + 80));
    if (typed) {
      i += typed[1].length;
      skipSpace();
      return { type: typed[1], args: list() };
    }
    throw new Error('Unreadable IFC value.');
  };
  i = source.indexOf('(');
  if (i < 0) return [];
  return list();
}

/** The file without its comments. A comment stands between two marks; one inside a text is text. */
function withoutComments(file: string): string {
  if (!file.includes('/*')) return file;
  let out = '';
  let inText = false;
  for (let i = 0; i < file.length; i++) {
    const c = file[i];
    if (c === "'") inText = !inText;
    if (!inText && c === '/' && file[i + 1] === '*') {
      const end = file.indexOf('*/', i + 2);
      if (end < 0) break;
      i = end + 1;
      out += ' ';
      continue;
    }
    out += c;
  }
  return out;
}

/** The numbered entities of the file's data section. */
function readEntities(source: string): Map<number, Entity> {
  const file = withoutComments(source);
  const start = file.search(/\bDATA\s*;/);
  if (!/^\s*ISO-10303-21\s*;/.test(file) || start < 0)
    throw new Error('This is not an IFC file (ISO 10303-21). Export IFC 2x3 or IFC 4 as text.');
  const entities = new Map<number, Entity>();
  // One entity ends at a semicolon that is not inside a text.
  let from = file.indexOf(';', start) + 1;
  let inText = false;
  for (let i = from; i < file.length; i++) {
    const c = file[i];
    if (c === "'") inText = !inText;
    else if (c === ';' && !inText) {
      const statement = file.slice(from, i).trim();
      from = i + 1;
      if (/^ENDSEC$/i.test(statement)) break;
      const m = /^#(\d+)\s*=\s*([A-Z][A-Z0-9_]*)\s*(\([\s\S]*\))$/.exec(statement);
      if (!m) continue;
      if (entities.size >= MAX_ENTITIES)
        throw new Error('This IFC file is too large. Export one building, without furniture.');
      // Only what a plan needs is taken apart; the rest is counted by its name alone.
      entities.set(Number(m[1]), { type: m[2], args: NEEDED.has(m[2]) ? parseArgs(m[3]) : [] });
    }
  }
  return entities;
}

const NEEDED = new Set([
  'IFCSIUNIT',
  'IFCCONVERSIONBASEDUNIT',
  'IFCMEASUREWITHUNIT',
  'IFCUNITASSIGNMENT',
  'IFCBUILDINGSTOREY',
  'IFCSPACE',
  'IFCWALL',
  'IFCWALLSTANDARDCASE',
  'IFCRELAGGREGATES',
  'IFCRELCONTAINEDINSPATIALSTRUCTURE',
  'IFCLOCALPLACEMENT',
  'IFCAXIS2PLACEMENT3D',
  'IFCAXIS2PLACEMENT2D',
  'IFCCARTESIANPOINT',
  'IFCDIRECTION',
  'IFCPRODUCTDEFINITIONSHAPE',
  'IFCSHAPEREPRESENTATION',
  'IFCEXTRUDEDAREASOLID',
  'IFCRECTANGLEPROFILEDEF',
  'IFCARBITRARYCLOSEDPROFILEDEF',
  'IFCARBITRARYPROFILEDEFWITHVOIDS',
  'IFCPOLYLINE',
]);

const PREFIX: Record<string, number> = { MILLI: 0.001, CENTI: 0.01, DECI: 0.1, KILO: 1000 };

export function parsePlanIfc(file: string): PlanImportSource {
  const entities = readEntities(file);
  const get = (v: Value | undefined, ...types: string[]): Entity | undefined => {
    if (!isRef(v)) return undefined;
    const entity = entities.get(v.ref);
    return entity && (types.length === 0 || types.includes(entity.type)) ? entity : undefined;
  };
  const warnings: string[] = [];
  const skipped = new Map<string, number>();
  const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1);

  // ---- the length unit ----
  const siScale = (unit: Entity | undefined): number | undefined =>
    unit &&
    unit.type === 'IFCSIUNIT' &&
    enumOf(unit.args[1]) === 'LENGTHUNIT' &&
    enumOf(unit.args[3]) === 'METRE'
      ? (PREFIX[enumOf(unit.args[2]) ?? ''] ?? 1)
      : undefined;
  let metres: number | undefined;
  for (const entity of entities.values()) {
    if (entity.type !== 'IFCUNITASSIGNMENT' || !isList(entity.args[0])) continue;
    for (const item of entity.args[0]) {
      const unit = get(item);
      const plain = siScale(unit);
      if (plain !== undefined) metres = plain;
      else if (unit?.type === 'IFCCONVERSIONBASEDUNIT' && enumOf(unit.args[1]) === 'LENGTHUNIT') {
        const measure = get(unit.args[3], 'IFCMEASUREWITHUNIT');
        const factor = num(measure?.args[0]);
        const base = siScale(get(measure?.args[1]));
        if (factor !== undefined && factor > 0 && base !== undefined) metres = factor * base;
      }
    }
  }
  if (metres === undefined) {
    metres = 1;
    warnings.push('The IFC file names no length unit: metres are assumed. Check one known length.');
  }
  const k = metres;

  // ---- points, directions, placements ----
  const point = (v: Value | undefined): XY | undefined => {
    const coords = get(v, 'IFCCARTESIANPOINT')?.args[0];
    if (!isList(coords)) return undefined;
    const x = num(coords[0]);
    const y = num(coords[1]);
    return x === undefined || y === undefined ? undefined : { x, y };
  };
  const direction = (v: Value | undefined): number[] | undefined => {
    const ratios = get(v, 'IFCDIRECTION')?.args[0];
    if (!isList(ratios)) return undefined;
    const out = ratios.map((r) => num(r) ?? 0);
    return out.length >= 2 ? out : undefined;
  };
  const IDENTITY: Placement = {
    ax: { x: 1, y: 0 },
    ay: { x: 0, y: 1 },
    at: { x: 0, y: 0 },
    upright: true,
  };
  const axis = (v: Value | undefined): Placement => {
    const entity = get(v, 'IFCAXIS2PLACEMENT3D', 'IFCAXIS2PLACEMENT2D');
    if (!entity) return IDENTITY;
    const at = point(entity.args[0]) ?? { x: 0, y: 0 };
    const three = entity.type === 'IFCAXIS2PLACEMENT3D';
    const up = three ? (direction(entity.args[1]) ?? [0, 0, 1]) : [0, 0, 1];
    const ref = direction(entity.args[three ? 2 : 1]) ?? [1, 0, 0];
    const upLength = Math.hypot(up[0] ?? 0, up[1] ?? 0, up[2] ?? 0) || 1;
    const z = (up[2] ?? 0) / upLength;
    const length = Math.hypot(ref[0], ref[1]) || 1;
    const ax = { x: ref[0] / length, y: ref[1] / length };
    // The second axis is the upright one turned onto the first: to the left of it when the element stands
    // upright, to the right when it is upside down.
    const ay = z >= 0 ? { x: -ax.y, y: ax.x } : { x: ax.y, y: -ax.x };
    return {
      ax,
      ay,
      at,
      upright: Math.abs(z) > 0.999 && Math.hypot(ref[0], ref[1]) > 0.999 * Math.hypot(...ref),
    };
  };
  const apply = (p: Placement, q: XY): XY => ({
    x: p.at.x + p.ax.x * q.x + p.ay.x * q.y,
    y: p.at.y + p.ax.y * q.x + p.ay.y * q.y,
  });
  const then = (outer: Placement, inner: Placement): Placement => ({
    ax: { x: apply(outer, inner.ax).x - outer.at.x, y: apply(outer, inner.ax).y - outer.at.y },
    ay: { x: apply(outer, inner.ay).x - outer.at.x, y: apply(outer, inner.ay).y - outer.at.y },
    at: apply(outer, inner.at),
    upright: outer.upright && inner.upright,
  });
  const placed = new Map<number, Placement>();
  const placement = (v: Value | undefined, depth = 0): Placement => {
    if (!isRef(v) || depth > 64) return IDENTITY;
    const known = placed.get(v.ref);
    if (known) return known;
    const entity = get(v, 'IFCLOCALPLACEMENT');
    const made = entity
      ? then(placement(entity.args[0], depth + 1), axis(entity.args[1]))
      : IDENTITY;
    placed.set(v.ref, made);
    return made;
  };

  // ---- storeys, and what stands on each ----
  const storeys = [...entities]
    .filter(([, e]) => e.type === 'IFCBUILDINGSTOREY')
    .map(([id, e]) => ({
      id,
      name: text(e.args[2]) ?? text(e.args[7]),
      level: (num(e.args[9]) ?? 0) * k,
    }))
    .sort((a, b) => a.level - b.level || a.id - b.id);
  if (storeys.length > 12) throw new Error('This IFC file has more than 12 storeys.');
  const storeyOf = new Map<number, number>();
  for (const entity of entities.values()) {
    const [home, members] =
      entity.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE'
        ? [entity.args[5], entity.args[4]]
        : entity.type === 'IFCRELAGGREGATES'
          ? [entity.args[4], entity.args[5]]
          : [undefined, undefined];
    if (!isRef(home) || !isList(members)) continue;
    const floor = storeys.findIndex((s) => s.id === home.ref);
    if (floor < 0) continue;
    for (const member of members) if (isRef(member)) storeyOf.set(member.ref, floor);
  }
  const floorName = (floor: number) =>
    storeys[floor]?.name ?? (floor === 0 ? 'Ground floor' : `Floor ${floor}`);

  // ---- shapes ----
  const polyline = (v: Value | undefined): XY[] | undefined => {
    const points = get(v, 'IFCPOLYLINE')?.args[0];
    if (!isList(points)) return undefined;
    const out = points.map((p) => point(p));
    return out.every((p): p is XY => p !== undefined) ? out : undefined;
  };
  /** The solids of an element's shape, and its axis line when it has one. */
  const shapeOf = (product: Entity) => {
    const shape = get(product.args[6], 'IFCPRODUCTDEFINITIONSHAPE');
    const list = shape && isList(shape.args[2]) ? shape.args[2] : [];
    const solids: Entity[] = [];
    let axisLine: XY[] | undefined;
    for (const item of list) {
      const representation = get(item, 'IFCSHAPEREPRESENTATION');
      if (!representation || !isList(representation.args[3])) continue;
      for (const part of representation.args[3]) {
        const solid = get(part, 'IFCEXTRUDEDAREASOLID');
        if (solid) solids.push(solid);
        else if (text(representation.args[1]) === 'Axis') axisLine = axisLine ?? polyline(part);
      }
    }
    return { solids, axisLine };
  };
  /** The outline of an upright extrusion, on the plan of the file, before the element's own placement. */
  const footprint = (solid: Entity): { points: XY[]; length?: number } | undefined => {
    const position = axis(solid.args[1]);
    const up = direction(solid.args[2]) ?? [0, 0, 1];
    if (!position.upright || Math.abs(up[2] ?? 0) < 0.999 * Math.hypot(up[0], up[1], up[2] ?? 0))
      return undefined;
    const profile = get(solid.args[0]);
    if (profile?.type === 'IFCRECTANGLEPROFILEDEF') {
      const at = axis(profile.args[2]);
      const x = num(profile.args[3]);
      const y = num(profile.args[4]);
      if (!(x && x > 0) || !(y && y > 0)) return undefined;
      const corners = [
        { x: -x / 2, y: -y / 2 },
        { x: x / 2, y: -y / 2 },
        { x: x / 2, y: y / 2 },
        { x: -x / 2, y: y / 2 },
      ];
      return { points: corners.map((c) => apply(position, apply(at, c))), length: x };
    }
    if (
      profile?.type === 'IFCARBITRARYCLOSEDPROFILEDEF' ||
      profile?.type === 'IFCARBITRARYPROFILEDEFWITHVOIDS'
    ) {
      const line = polyline(profile.args[2]);
      return line && line.length >= 3 ? { points: line.map((p) => apply(position, p)) } : undefined;
    }
    return undefined;
  };
  const onPlan = (p: XY): XY => ({ x: p.x * k, y: -p.y * k });

  const shapes: PlanImportShape[] = [];
  const rooms = new Set<number>();
  const walls = new Set<number>();
  for (const [id, entity] of entities) {
    const isSpace = entity.type === 'IFCSPACE';
    const isWall = entity.type === 'IFCWALL' || entity.type === 'IFCWALLSTANDARDCASE';
    if (!isSpace && !isWall) continue;
    const floor = storeyOf.get(id) ?? 0;
    const where = placement(entity.args[5]);
    const { solids, axisLine } = shapeOf(entity);
    if (!where.upright) {
      skip(isSpace ? 'tilted spaces' : 'tilted walls');
      continue;
    }
    if (isSpace) {
      const made = solids.map(footprint).find((f) => f !== undefined);
      if (!made) {
        skip('spaces whose shape is not an upright extrusion of straight lines');
        continue;
      }
      shapes.push({
        id: `ifc-${id}`,
        layer: `${floorName(floor)}: rooms`,
        closed: true,
        points: made.points.map((p) => onPlan(apply(where, p))),
      });
      rooms.add(floor);
      continue;
    }
    let line = axisLine && axisLine.length >= 2 ? axisLine : undefined;
    if (!line) {
      // No axis: the middle line of a rectangular body, along its longer side.
      const made = solids.map(footprint).find((f) => f?.length !== undefined);
      if (made) {
        const [a, b, c, d] = made.points;
        const mid = (p: XY, q: XY) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
        line = [mid(a, d), mid(b, c)];
      }
    }
    if (!line) {
      skip('walls with no straight axis line and no rectangular body');
      continue;
    }
    shapes.push({
      id: `ifc-${id}`,
      layer: `${floorName(floor)}: walls`,
      closed: false,
      points: line.map((p) => onPlan(apply(where, p))),
    });
    walls.add(floor);
  }

  const others = new Map<string, number>();
  for (const entity of entities.values())
    if (
      /^IFC(DOOR|WINDOW|SLAB|ROOF|STAIR|STAIRFLIGHT|FURNISHINGELEMENT|COLUMN|BEAM)$/.test(
        entity.type,
      )
    )
      others.set(entity.type, (others.get(entity.type) ?? 0) + 1);
  if (others.size)
    warnings.push(
      `Not read from the IFC file: ${[...others].map(([type, n]) => `${n} ${type.slice(3).toLowerCase()}`).join(', ')}. Only storeys, spaces and wall lines are read.`,
    );
  for (const [why, count] of skipped) warnings.push(`${count} ${why} skipped.`);
  if (storeys.length > 1)
    warnings.push(
      'The storeys keep their order. Their heights in the file are not used: one wall height applies to every floor.',
    );

  // A storey with spaces takes its rooms; its wall lines are offered and left off, or each wall would stand twice
  // (once on the edge of a room, once on its own line). A storey with no space takes its wall lines.
  const suggestedLayers: PlanImportLayer[] = [];
  const count = Math.max(1, storeys.length);
  for (let floor = 0; floor < count; floor++) {
    if (rooms.has(floor))
      suggestedLayers.push({ name: `${floorName(floor)}: rooms`, role: 'rooms', floor });
    if (walls.has(floor))
      suggestedLayers.push({
        name: `${floorName(floor)}: walls`,
        role: rooms.has(floor) ? 'skip' : 'walls',
        floor,
      });
  }
  if ([...walls].some((floor) => rooms.has(floor)))
    warnings.push(
      'Wall lines of a storey that has spaces are left off: its rooms already bring their walls. Switch a wall layer on to add them as free walls.',
    );
  return {
    format: 'ifc',
    name: 'IFC building',
    shapes,
    warnings,
    suggestedUnit: 'm',
    suggestedLayers,
  };
}
