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
] as const;
export const damageKinds = ['none', 'salt', 'biological', 'mechanical'] as const;
export const paperStates = ['needed', 'to sign', 'signed', 'filed'] as const;
export const stepStates = ['todo', 'doing', 'done'] as const;
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
export const stream = z
  .string()
  .max(150)
  .regex(
    /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[a-zA-Z0-9_-]{11}$/,
    'Use a supported HTTPS video embed address.',
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
  })
  .strict();
export const stepSchema = z
  .object({ id, title: short, date: day, state: z.enum(stepStates) })
  .strict();
export const paperSchema = z
  .object({
    id,
    title: short,
    state: z.enum(paperStates),
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
export const pilotSchema = z
  .object({
    slug: id,
    name: short,
    lane: short,
    state: z.enum(states),
    summary: z.string().max(500),
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
