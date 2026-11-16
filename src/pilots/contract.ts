import { z } from 'zod';

export const states = [
  'concept',
  'filed',
  'selected',
  'contracted',
  'on site',
  'measuring',
  'reported',
  'closed',
] as const;
export const kinds = ['test rack', 'demonstration wall', 'test panel', 'host building'] as const;
export const roles = [
  'lead',
  'technology supplier',
  'adviser',
  'tester',
  'host',
  'coordinator',
  'viewer',
  'checker',
] as const;
export const damageKinds = ['none', 'salt', 'biological', 'mechanical'] as const;
export const paperStates = ['needed', 'to sign', 'signed', 'filed'] as const;
export const stepStates = ['todo', 'doing', 'done', 'late'] as const;
const short = z.string().trim().min(1).max(160);
export const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export function isHls(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.hash &&
      /\.m3u8$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export const stream = z
  .string()
  .max(1000)
  .refine(
    (v) =>
      isHls(v) || /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[a-zA-Z0-9_-]{11}$/.test(v),
    'Use an HTTPS playlist or supported embed address.',
  );
export const siteSchema = z
  .object({
    id,
    name: short,
    kind: z.enum(kinds),
    place: short,
    state: z.enum(states),
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    area: z.number().finite().nonnegative().max(1e8).optional(),
    plan: id.optional(),
    photoWall: z.boolean().optional(),
  })
  .strict();
export const memberSchema = z
  .object({
    id,
    role: z.enum(roles),
    name: short,
    organisation: short,
    state: z.enum(['invited', 'active']),
  })
  .strict();
export const photoSchema = z
  .object({
    id,
    site: id,
    date: day,
    caption: z.string().trim().max(200),
    kind: z.enum(['photo', '360 panorama']),
    member: id,
    hidden: z.boolean(),
  })
  .strict();
export const readingSchema = z
  .object({
    id,
    site: id,
    month,
    cover: z.number().finite().min(0).max(100),
    condition: short,
    damage: z.enum(damageKinds),
    note: z.string().max(2000),
    photo: id.optional(),
  })
  .strict();
export const logSchema = z
  .object({
    id,
    date: day,
    type: short,
    quantity: z.number().finite().nonnegative().max(1e9),
    unit: short,
    destination: short,
    photo: id.optional(),
    ticket: id.optional(),
  })
  .strict();
export const stepSchema = z
  .object({
    id,
    title: short,
    date: day,
    state: z.enum(stepStates),
    startMonth: z.number().int().min(1).max(600).optional(),
    endMonth: z.number().int().min(1).max(600).optional(),
    ownerRole: z.enum(roles).optional(),
    order: z.number().finite().optional(),
    tasks: z
      .array(z.object({ id, name: short, role: z.enum(roles), state: z.enum(stepStates) }).strict())
      .max(40)
      .optional(),
    note: z.string().trim().max(200).optional(),
  })
  .strict();
export const paperSchema = z
  .object({
    id,
    title: short,
    state: z.enum(paperStates),
    due: day.optional(),
    ownerRole: z.enum(roles).optional(),
    ownerMember: id.optional(),
    link: z
      .string()
      .url()
      .max(1500)
      .regex(/^https:\/\//)
      .optional(),
    note: z.string().max(2000),
  })
  .strict();
export const noteSchema = z
  .object({ id, member: id, date: day, text: z.string().trim().min(1).max(2000) })
  .strict();
export const cameraSchema = z.object({ site: id, address: stream }).strict();
const interval = z.enum(['weekly', 'fortnightly', 'monthly', 'once']);
export const scheduleSchema = z
  .object({
    id: z.literal('pilot-schedule'),
    start: day,
    months: z.number().int().min(1).max(600),
    end: day,
  })
  .strict();
const field = z
  .object({
    id,
    name: short,
    unit: z.string().max(60),
    kind: z.enum(['number', 'choice', 'text', 'photo']),
    low: z.number().finite().optional(),
    high: z.number().finite().optional(),
    choices: short.array().max(30).optional(),
  })
  .strict()
  .refine(
    (f) =>
      (f.low === undefined || f.high === undefined || f.low <= f.high) &&
      (f.kind !== 'choice' || !!f.choices?.length),
  );
const target = z.object({ id, site: id, name: short, role: z.enum(roles) }).strict();
export const readingTypeSchema = z
  .object({
    id,
    name: short,
    fields: field.array().min(1).max(20),
    targets: target.array().min(1).max(30),
    rhythm: interval,
    change: z.object({ date: day, rhythm: interval }).strict().optional(),
  })
  .strict()
  .refine(
    (t) =>
      new Set(t.fields.map((f) => f.id)).size === t.fields.length &&
      new Set(t.targets.map((f) => f.id)).size === t.targets.length,
  );
export const sampleSchema = z
  .object({
    id,
    typeId: id,
    targetId: id,
    date: day,
    values: z.record(id, z.union([z.number().finite(), z.string().max(500)])),
  })
  .strict();
export const baselineSchema = z
  .object({ id, type: short, unit: short, quantity: z.number().finite().min(0).max(1e9) })
  .strict();
export const pilotSchema = z
  .object({
    slug: id,
    name: short,
    lane: short,
    state: z.enum(states),
    summary: z.string().max(500),
    schedules: scheduleSchema.array().max(1).optional(),
    readingTypes: readingTypeSchema.array().max(100).optional(),
    samples: sampleSchema.array().max(3000).optional(),
    baselines: baselineSchema.array().max(150).optional(),
    sites: siteSchema.array().max(150),
    members: memberSchema.array().max(150),
    photos: photoSchema.array().max(200),
    readings: readingSchema.array().max(3000),
    logs: logSchema.array().max(3000),
    steps: stepSchema.array().max(100),
    papers: paperSchema.array().max(200),
    notes: noteSchema.array().max(3000),
    cameras: cameraSchema.array().max(150),
  })
  .strict();
export type Pilot = z.infer<typeof pilotSchema>;
export type Site = z.infer<typeof siteSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Reading = z.infer<typeof readingSchema>;
export const exampleSlug = 'example-moss-wall';
export function series(readings: Reading[], site: string) {
  return readings.filter((r) => r.site === site).sort((a, b) => a.month.localeCompare(b.month));
}
export function totals(logs: Pilot['logs']) {
  const rows = new Map<string, { type: string; unit: string; quantity: number }>();
  for (const row of logs) {
    const key = JSON.stringify([row.type, row.unit]);
    rows.set(key, {
      type: row.type,
      unit: row.unit,
      quantity: (rows.get(key)?.quantity ?? 0) + row.quantity,
    });
  }
  return [...rows.values()];
}
export function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
export const uid = () => crypto.randomUUID();
