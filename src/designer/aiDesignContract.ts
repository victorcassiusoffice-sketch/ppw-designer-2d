/** Versioned, metre-based proposal contract shared by the browser, API and MCP.
 * Proposals are data only: validation never orders products or changes a saved plan. */
import { z } from 'zod';
import { FoundationSchema, FOUNDATION_SCHEMA_DESCRIPTION } from './foundationContract.js';
import { foundationElementBounds } from './foundation.js';

const metre = z.number().finite();
const identifier = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((id) => !['__proto__', 'constructor', 'prototype'].includes(id), 'Reserved identifier.');
export const DesignBriefSchema = z
  .object({
    title: z.string().trim().min(1).max(100).default('My home concept'),
    brief: z.string().trim().max(3000).default(''),
    plotWidthM: metre.min(12).max(100).default(20),
    plotDepthM: metre.min(14).max(100).default(24),
    bedrooms: z.number().int().min(1).max(8).default(3),
    storeys: z.number().int().min(1).max(3).default(1),
    wallHeightM: metre.min(2.4).max(4).default(2.7),
  })
  .strict();
export type DesignBrief = z.infer<typeof DesignBriefSchema>;

const OpeningSchema = z
  .object({
    id: identifier,
    kind: z.enum(['door', 'doorway', 'window']),
    edgeIndex: z.number().int().min(0).max(3),
    offsetM: metre.min(0),
    widthM: metre.min(0.6).max(3),
    sillM: metre.min(0).max(2).default(0),
  })
  .strict();
const PlacementSchema = z
  .object({
    productId: identifier,
    xM: metre.min(0).max(100),
    yM: metre.min(0).max(100),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  })
  .strict();
const RoomSchema = z
  .object({
    id: identifier,
    name: z.string().min(1).max(80),
    levelId: identifier,
    xM: metre.min(0).max(100),
    yM: metre.min(0).max(100),
    widthM: metre.min(1.2).max(50),
    depthM: metre.min(1.2).max(50),
    openings: z.array(OpeningSchema).max(24).default([]),
    products: z.array(PlacementSchema).max(40).default([]),
  })
  .strict();
export const DesignDraftSchema = z
  .object({
    version: z.literal(1),
    units: z.literal('m'),
    title: z.string().min(1).max(100),
    summary: z.string().max(1800),
    plot: z.object({ widthM: metre.min(1).max(100), depthM: metre.min(1).max(100) }).strict(),
    levels: z
      .array(
        z
          .object({
            id: identifier,
            name: z.string().min(1).max(60),
            elevationM: metre.min(0).max(20),
            heightM: metre.min(2.4).max(4),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    rooms: z.array(RoomSchema).min(1).max(40),
    stairs: z
      .array(
        z
          .object({
            id: identifier,
            fromLevelId: identifier,
            toLevelId: identifier,
            xM: metre.min(0).max(100),
            yM: metre.min(0).max(100),
            widthM: metre.min(0.9).max(3),
            runM: metre.min(2).max(8),
            rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
          })
          .strict(),
      )
      .max(6),
    roof: z
      .object({
        style: z.enum(['flat', 'gable', 'shed']),
        material: z.enum(['felt', 'tile', 'metal']),
        pitchDeg: metre.min(5).max(60),
        overhangM: metre.min(0).max(1.5),
      })
      .strict(),
    garden: z.object({ lawn: z.boolean(), entrancePath: z.boolean() }).strict(),
    foundation: FoundationSchema.optional(),
    warnings: z.array(z.string().max(500)).max(16).default([]),
  })
  .strict();
export type DesignDraft = z.infer<typeof DesignDraftSchema>;
export type DesignRoom = DesignDraft['rooms'][number];
export interface DesignCatalogProduct {
  id: string;
  name: string;
  supplier: string;
  category: string;
  widthM: number;
  depthM: number;
  heightM: number;
  /** Absent preserves legacy floor products. Version 1 proposals have no
   * roof/wall/ceiling or parent-surface product hosts. */
  placement?: 'floor' | 'wall' | 'surface' | 'ceiling' | 'roof';
}
export const DESIGN_LIMITATIONS = [
  'Concept proposal, not construction approval. Verify structure, services, access, setbacks and cyclone requirements with qualified local professionals.',
  'Room dimensions describe plan boundaries; wall thickness, finishes and opening heights need detailed coordination.',
  'Product dimensions use catalogue references. Confirm current supplier specifications, availability and prices before procurement.',
];
const close = (a: number, b: number) => Math.abs(a - b) < 0.005;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Physical opening endpoints along clockwise screen-coordinate rectangles. */
function openingCentre(room: DesignRoom, op: DesignRoom['openings'][number]): [number, number] {
  if (op.edgeIndex === 0) return [room.xM + op.offsetM, room.yM];
  if (op.edgeIndex === 1) return [room.xM + room.widthM, room.yM + op.offsetM];
  if (op.edgeIndex === 2) return [room.xM + room.widthM - op.offsetM, room.yM + room.depthM];
  return [room.xM, room.yM + room.depthM - op.offsetM];
}
function hostsPoint(room: DesignRoom, x: number, y: number, half: number): boolean {
  return (
    ((close(x, room.xM) || close(x, room.xM + room.widthM)) &&
      y - half >= room.yM - 0.005 &&
      y + half <= room.yM + room.depthM + 0.005) ||
    ((close(y, room.yM) || close(y, room.yM + room.depthM)) &&
      x - half >= room.xM - 0.005 &&
      x + half <= room.xM + room.widthM + 0.005)
  );
}

export type DraftValidation =
  | { ok: true; draft: DesignDraft; warnings: string[] }
  | { ok: false; errors: string[] };
export function validateDesignDraft(
  input: unknown,
  catalog: readonly DesignCatalogProduct[] = [],
): DraftValidation {
  const parsed = DesignDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  const d = parsed.data,
    errors: string[] = [],
    warnings = [...DESIGN_LIMITATIONS, ...d.warnings];
  const ids = new Set<string>();
  for (const entity of [
    ...d.levels,
    ...d.rooms,
    ...d.stairs,
    ...d.rooms.flatMap((r) => r.openings),
  ]) {
    if (ids.has(entity.id)) errors.push(`Duplicate identifier: ${entity.id}.`);
    ids.add(entity.id);
  }
  if (d.levels[0].id !== 'ground' || d.levels[0].elevationM !== 0)
    errors.push('The first level must be ground at elevation 0 m.');
  if (d.levels.some((l) => l.id === 'roof'))
    errors.push('The roof level is generated by the editor; do not use roof as a storey ID.');
  if (d.rooms.some((r) => r.id.startsWith('roof-')))
    errors.push('Room IDs starting roof- are reserved for generated roof slabs.');
  for (const element of d.foundation?.elements ?? []) {
    const bounds = foundationElementBounds(element);
    if (bounds.minX < 0 || bounds.minY < 0 || bounds.maxX > d.plot.widthM || bounds.maxY > d.plot.depthM)
      errors.push(`${element.name}: foundation extends beyond the plot.`);
  }
  if (d.foundation?.enabled) warnings.push(FOUNDATION_SCHEMA_DESCRIPTION.limitations);
  for (let i = 1; i < d.levels.length; i++) {
    const below = d.levels[i - 1];
    if (!close(d.levels[i].elevationM, below.elevationM + below.heightM + 0.18))
      errors.push(
        'Storeys must stack above the preceding clear height and 0.18 m conceptual slab.',
      );
    if (!d.stairs.some((s) => s.fromLevelId === below.id && s.toLevelId === d.levels[i].id))
      errors.push(`Add stairs connecting ${below.name} to ${d.levels[i].name}.`);
  }
  const connections = new Map(d.rooms.map((r) => [r.id, new Set<string>()]));
  const exterior = new Set<string>();
  let productCount = 0;
  for (const room of d.rooms) {
    if (!d.levels.some((l) => l.id === room.levelId)) errors.push(`${room.name}: unknown floor.`);
    if (
      room.xM + room.widthM > d.plot.widthM + 0.001 ||
      room.yM + room.depthM > d.plot.depthM + 0.001
    )
      errors.push(`${room.name} extends beyond the plot.`);
    for (const op of room.openings) {
      const length = op.edgeIndex % 2 === 0 ? room.widthM : room.depthM;
      if (op.offsetM - op.widthM / 2 < 0.099 || op.offsetM + op.widthM / 2 > length - 0.099)
        errors.push(`${room.name}: opening ${op.id} does not fit with a 0.1 m end margin.`);
      if (op.kind !== 'window' && op.sillM !== 0)
        errors.push(`${room.name}: a door must start at floor level.`);
      if (
        room.openings.some(
          (o) =>
            o !== op &&
            o.edgeIndex === op.edgeIndex &&
            Math.abs(o.offsetM - op.offsetM) < (o.widthM + op.widthM) / 2,
        )
      )
        errors.push(`${room.name}: openings overlap.`);
      if (op.kind !== 'window') {
        const [x, y] = openingCentre(room, op);
        const neighbours = d.rooms.filter(
          (r) =>
            r.id !== room.id && r.levelId === room.levelId && hostsPoint(r, x, y, op.widthM / 2),
        );
        if (!neighbours.length && room.levelId === 'ground') exterior.add(room.id);
        neighbours.forEach((r) => {
          connections.get(room.id)?.add(r.id);
          connections.get(r.id)?.add(room.id);
        });
      }
    }
    const placements: Array<{ x: number; y: number; w: number; h: number }> = [];
    productCount += room.products.length;
    for (const item of room.products) {
      const p = catalog.find((p) => p.id === item.productId);
      if (!p) {
        errors.push(`Unknown catalogue product: ${item.productId}. Use a verified catalogue ID.`);
        continue;
      }
      if (p.placement !== undefined && p.placement !== 'floor') {
        errors.push(
          `${p.name} needs a ${p.placement} host. Room proposals support floor products only; add this product with the editor after applying the layout.`,
        );
        continue;
      }
      const w = item.rotation % 180 ? p.depthM : p.widthM;
      const h = item.rotation % 180 ? p.widthM : p.depthM;
      if (
        item.xM - w / 2 < room.xM ||
        item.xM + w / 2 > room.xM + room.widthM ||
        item.yM - h / 2 < room.yM ||
        item.yM + h / 2 > room.yM + room.depthM
      )
        errors.push(`${p.name} does not fit inside ${room.name}.`);
      if (
        placements.some(
          (q) =>
            Math.abs(q.x - item.xM) < (q.w + w) / 2 - 0.001 &&
            Math.abs(q.y - item.yM) < (q.h + h) / 2 - 0.001,
        )
      )
        errors.push(`${room.name}: product footprints overlap.`);
      placements.push({ x: item.xM, y: item.yM, w, h });
    }
  }
  if (productCount > 200) errors.push('A proposal supports at most 200 products.');
  for (let i = 0; i < d.rooms.length; i++)
    for (let j = i + 1; j < d.rooms.length; j++) {
      const a = d.rooms[i],
        b = d.rooms[j];
      if (
        a.levelId === b.levelId &&
        Math.min(a.xM + a.widthM, b.xM + b.widthM) - Math.max(a.xM, b.xM) > 0.005 &&
        Math.min(a.yM + a.depthM, b.yM + b.depthM) - Math.max(a.yM, b.yM) > 0.005
      )
        errors.push(`${a.name} overlaps ${b.name}.`);
    }
  for (const s of d.stairs) {
    const from = d.levels.findIndex((l) => l.id === s.fromLevelId),
      to = d.levels.findIndex((l) => l.id === s.toLevelId);
    if (from < 0 || to !== from + 1) {
      errors.push(`Stair ${s.id} must connect adjacent storeys.`);
      continue;
    }
    const w = s.rotation % 180 ? s.runM : s.widthM,
      h = s.rotation % 180 ? s.widthM : s.runM;
    const contains = (r: DesignRoom) =>
      s.xM - w / 2 >= r.xM - 0.001 &&
      s.xM + w / 2 <= r.xM + r.widthM + 0.001 &&
      s.yM - h / 2 >= r.yM - 0.001 &&
      s.yM + h / 2 <= r.yM + r.depthM + 0.001;
    const a = d.rooms.find((r) => r.levelId === s.fromLevelId && contains(r)),
      b = d.rooms.find((r) => r.levelId === s.toLevelId && contains(r));
    if (!a || !b) errors.push(`Stair ${s.id} must fit inside rooms on both floors.`);
    else {
      connections.get(a.id)?.add(b.id);
      connections.get(b.id)?.add(a.id);
    }
    const risers = Math.ceil((d.levels[to].elevationM - d.levels[from].elevationM) / 0.18);
    if (s.runM / Math.max(1, risers - 1) < 0.24)
      errors.push(`Stair ${s.id} needs a longer run for the proposed rise.`);
  }
  if (!exterior.size) errors.push('Add a ground-floor entrance door onto the exterior.');
  const visited = new Set(exterior),
    pending = [...exterior];
  while (pending.length)
    for (const id of connections.get(pending.shift()!) ?? [])
      if (!visited.has(id)) {
        visited.add(id);
        pending.push(id);
      }
  for (const r of d.rooms)
    if (!visited.has(r.id))
      errors.push(`${r.name} has no connected door/stair route to a ground-floor entrance.`);
  for (const l of d.levels)
    if (!d.rooms.some((r) => r.levelId === l.id)) errors.push(`${l.name} has no rooms.`);
  if (d.stairs.length)
    warnings.push(
      'Check stair headroom, landings, guarding, clear circulation and structural openings with a professional.',
    );
  return errors.length
    ? { ok: false, errors: [...new Set(errors)].slice(0, 20) }
    : { ok: true, draft: d, warnings: [...new Set(warnings)] };
}

/** Offline rule-based layout: explicit dimensions, connected rooms and external windows. */
export function createGuidedDesign(input: unknown): DesignDraft {
  const b = DesignBriefSchema.parse(input);
  // Central stair leaves a clear strip on BOTH sides, so bedroom doors do
  // not open directly into the stair footprint. Landings remain unmodelled.
  const hall = b.storeys > 1 ? 3.2 : 2.4,
    width = Math.min(12, b.plotWidthM - 4),
    wing = (width - hall) / 2;
  const levels = Array.from({ length: b.storeys }, (_, i) => ({
    id: i ? 'floor-' + i : 'ground',
    name: i ? 'Floor ' + i : 'Ground floor',
    heightM: b.wallHeightM,
    elevationM: r3(i * (b.wallHeightM + 0.18)),
  }));
  const namesByFloor = levels.map((_, i) => {
    const bedCount = Math.floor(b.bedrooms / b.storeys) + (i < b.bedrooms % b.storeys ? 1 : 0);
    return [
      ...(i === 0 ? ['Living room', 'Kitchen / dining'] : ['Family room']),
      ...Array.from(
        { length: bedCount },
        (_, n) =>
          `Bedroom ${1 + Math.floor(b.bedrooms / b.storeys) * i + Math.min(i, b.bedrooms % b.storeys) + n}`,
      ),
      'Bathroom',
    ];
  });
  const maxRows = Math.max(...namesByFloor.map((names) => Math.ceil(names.length / 2)));
  const depth = Math.max(10, maxRows * 3.2);
  if (depth > b.plotDepthM - 4)
    throw new Error(
      `This brief needs a plot depth of at least ${r3(depth + 4)} m. Increase the plot depth or reduce bedrooms.`,
    );
  const rooms: DesignRoom[] = [],
    stairs: DesignDraft['stairs'] = [];
  for (const [i, level] of levels.entries()) {
    const names = namesByFloor[i],
      rowDepth = depth / Math.ceil(names.length / 2),
      corridorX = 2 + wing;
    const corridor: DesignRoom = {
      id: `hall-${i}`,
      name: i ? 'Landing' : 'Entrance hall',
      levelId: level.id,
      xM: corridorX,
      yM: 2,
      widthM: hall,
      depthM: depth,
      products: [],
      openings: i
        ? []
        : [
            {
              id: 'front-door',
              kind: 'door',
              edgeIndex: 0,
              offsetM: hall / 2,
              widthM: 1,
              sillM: 0,
            },
          ],
    };
    rooms.push(corridor);
    for (let n = 0; n < Math.ceil(names.length / 2) * 2; n++) {
      const side = n % 2,
        row = Math.floor(n / 2),
        y = 2 + row * rowDepth;
      rooms.push({
        id: `room-${i}-${n}`,
        name: names[n] ?? 'Study / utility',
        levelId: level.id,
        xM: side ? corridorX + hall : 2,
        yM: r3(y),
        widthM: r3(wing),
        depthM: r3(rowDepth),
        products: [],
        openings: [
          {
            id: `door-${i}-${n}`,
            kind: 'door',
            edgeIndex: side ? 3 : 1,
            offsetM: r3(rowDepth / 2),
            widthM: 0.9,
            sillM: 0,
          },
          {
            id: `window-${i}-${n}`,
            kind: 'window',
            edgeIndex: side ? 1 : 3,
            offsetM: r3(rowDepth / 2),
            widthM: 1.2,
            sillM: 0.9,
          },
        ],
      });
    }
    if (i) {
      const run = Math.max(4.2, (Math.ceil((b.wallHeightM + 0.18) / 0.18) - 1) * 0.25);
      stairs.push({
        id: `stairs-${i}`,
        fromLevelId: levels[i - 1].id,
        toLevelId: level.id,
        xM: r3(corridorX + hall / 2),
        yM: r3(3 + run / 2),
        widthM: 1,
        runM: r3(run),
        rotation: 0,
      });
    }
  }
  const draft: DesignDraft = {
    version: 1,
    units: 'm',
    title: b.title,
    summary: `${b.bedrooms}-bedroom concept over ${b.storeys} storey${b.storeys === 1 ? '' : 's'}, with connected circulation, doors, windows, roof and garden.`,
    plot: { widthM: b.plotWidthM, depthM: b.plotDepthM },
    levels,
    rooms,
    stairs,
    roof: { style: 'flat', material: 'felt', pitchDeg: 25, overhangM: 0.2 },
    garden: { lawn: true, entrancePath: true },
    warnings: [
      'Rule-based guided layout: dimensions and controls are used; free-text notes are not interpreted. Furniture is selected separately from the live catalogue.',
    ],
  };
  const checked = validateDesignDraft(draft);
  if (!checked.ok) throw new Error(checked.errors.join(' '));
  return { ...checked.draft, warnings: checked.warnings };
}

/** Machine-readable shape for external AI clients; runtime refinements are also mandatory. */
export const DESIGN_SCHEMA_DESCRIPTION = {
  version: 1,
  units: 'metres',
  coordinateSystem: 'x right, y down; room xM/yM top-left; products and stairs xM/yM are centres',
  levels:
    'ground first at 0; upper elevation = preceding elevation + clear height + 0.18 m conceptual slab; max 3 storeys',
  rooms:
    'rectangles; no interior overlap; widthM along x, depthM along y; all rooms inside plot; max 40',
  openings:
    'clockwise edges 0 top,1 right,2 bottom,3 left; offsetM from edge start to centre; 0.1 m end margin; door/doorway/window; no height field (existing renderer uses defaults)',
  products:
    'verified catalogue productId only; placement must be floor (absent means floor); roof/wall/surface/ceiling hosts are not supported in version 1 room proposals; centres in world metres; rotation 0/90/180/270; known dimensions must fit without overlapping',
  connectivity:
    'all rooms require a door/stair path to an exterior ground-floor entrance; stairs fit in rooms on both adjacent storeys',
  foundation: { optional: true, ...FOUNDATION_SCHEMA_DESCRIPTION },
  optionalArrayExamples: {
    products: [{ productId: 'verified-catalog-id', xM: 5, yM: 5, rotation: 0 }],
    stairs: [
      {
        id: 'stairs-1',
        fromLevelId: 'ground',
        toLevelId: 'floor-1',
        xM: 7.5,
        yM: 5.1,
        widthM: 1,
        runM: 4.2,
        rotation: 0,
      },
    ],
    levels: [
      { id: 'ground', name: 'Ground floor', heightM: 2.7, elevationM: 0 },
      { id: 'floor-1', name: 'Floor 1', heightM: 2.7, elevationM: 2.88 },
    ],
  },
  example: createExample(),
};
function createExample(): DesignDraft {
  return createGuidedDesign({ bedrooms: 2, storeys: 1 });
}
