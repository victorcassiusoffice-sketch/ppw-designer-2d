import { z } from 'zod';
import { id, day, type Pilot } from './contract.js';
const name = z.string().trim().min(1).max(160),
  note = z.string().trim().max(1800),
  count = z.number().int().min(0).max(10000000);
export const eventSchema = z
  .object({
    id,
    date: day,
    kind: z.enum(['training', 'site day', 'meeting', 'other']),
    title: name,
    site: id,
    women: count,
    men: count,
    notStated: count,
    note,
    files: id.array().max(20),
  })
  .strict();
export const indicatorSchema = z
  .object({
    id,
    name,
    unit: name,
    baseline: z.number().finite(),
    target: z.number().finite(),
    source: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('reading'),
          type: id,
          field: id,
          mode: z.enum(['latest', 'sum']),
        })
        .strict(),
      z.object({ kind: z.literal('log'), stream: name }).strict(),
      z.object({ kind: z.literal('events'), event: eventSchema.shape.kind.optional() }).strict(),
      z
        .object({ kind: z.literal('attendance'), event: eventSchema.shape.kind.optional() })
        .strict(),
      z
        .object({ kind: z.literal('typed'), value: z.number().finite(), date: day, file: id })
        .strict(),
    ]),
  })
  .strict();
export const packSchema = z
  .object({
    id,
    kind: z.enum(['interim', 'final']),
    period: id,
    due: day,
    state: z.enum(['draft', 'approved', 'sent']),
    photos: id.array().max(60),
    text: z
      .object({
        indicators: note,
        steps: note,
        readings: note,
        logs: note,
        events: note,
        photos: note,
        papers: note,
      })
      .partial()
      .strict(),
    file: id.optional(),
    sentDate: day.optional(),
    approvedDate: day.optional(),
  })
  .strict();
export type Attendance = z.infer<typeof eventSchema>;
export type Indicator = z.infer<typeof indicatorSchema>;
export type ReportPack = z.infer<typeof packSchema>;
export type ReportPeriod = {
  id: string;
  number: number;
  start: string;
  end: string;
  final: boolean;
  sent?: string;
};
export type ReportsView = {
  revision: number;
  events: Attendance[];
  indicators: Indicator[];
  packs: ReportPack[];
  periods: ReportPeriod[];
};
export function indicatorValue(
  i: Indicator,
  p: Pilot,
  events: Attendance[],
  start: string,
  end: string,
) {
  const within = (d: string) => d >= start && d <= end,
    s = i.source;
  if (s.kind === 'typed') return { value: within(s.date) ? s.value : null };
  if (s.kind === 'log')
    return {
      value: p.logs
        .filter((l) => l.type === s.stream && within(l.date))
        .reduce((a, l) => a + l.quantity, 0),
    };
  if (s.kind === 'reading') {
    const values = (p.samples ?? [])
      .filter((v) => v.typeId === s.type && within(v.date) && typeof v.values[s.field] === 'number')
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .map((r) => Number(r.values[s.field]));
    return {
      value:
        s.mode === 'sum' ? values.reduce((a, b) => a + b, 0) : (values[values.length - 1] ?? null),
    };
  }
  const hits = events.filter((e) => within(e.date) && (!s.event || e.kind === s.event));
  if (s.kind === 'events') return { value: hits.length };
  const genders = hits.reduce(
    (o, e) => ({
      women: o.women + e.women,
      men: o.men + e.men,
      notStated: o.notStated + e.notStated,
    }),
    { women: 0, men: 0, notStated: 0 },
  );
  return { value: genders.women + genders.men + genders.notStated, ...genders };
}
export function periodPack(p: Pilot, view: ReportsView, pack: ReportPack) {
  const period = view.periods.find((x) => x.id === pack.period);
  if (!period) throw Error('Choose an available report period.');
  const within = (d: string) => d >= period.start && d <= period.end,
    events = view.events.filter((e) => within(e.date)),
    samples = (p.samples ?? []).filter((s) => within(s.date)),
    logs = p.logs.filter((l) => within(l.date));
  return {
    period,
    indicators: view.indicators.map((i) => ({
      name: i.name,
      unit: i.unit,
      baseline: i.baseline,
      target: i.target,
      ...indicatorValue(i, p, events, period.start, period.end),
    })),
    steps: p.steps.map((s) => ({
      name: s.title,
      status: s.state,
      tasks: s.tasks?.map((t) => ({ name: t.name, state: t.state })) ?? [],
    })),
    samples,
    readings: p.readings.filter(
      (r) => r.month >= period.start.slice(0, 7) && r.month <= period.end.slice(0, 7),
    ),
    streams: [
      ...new Set([...logs.map((l) => l.type), ...(p.baselines ?? []).map((b) => b.type)]),
    ].map((stream) => ({
      stream,
      total: logs.filter((l) => l.type === stream).reduce((a, r) => a + r.quantity, 0),
      baseline: p.baselines?.find((b) => b.type === stream)?.quantity,
    })),
    events,
    photos: p.photos.filter((ph) => pack.photos.includes(ph.id) && !ph.hidden),
    papers: p.papers.map((t) => ({ title: t.title, state: t.state })),
  };
}
