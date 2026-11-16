import type { Pilot } from './contract.js';
type ReadType = NonNullable<Pilot['readingTypes']>[number];
type Sample = NonNullable<Pilot['samples']>[number];
type Rhythm = ReadType['rhythm'];
const date = (value: Date) => value.toISOString().slice(0, 10);
const at = (value: string) => new Date(value + 'T00:00:00Z');
export function shiftMonth(start: string, n: number) {
  const d = at(start),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(last, day));
  return date(d);
}
export function advance(start: string, days: number) {
  const d = at(start);
  d.setUTCDate(d.getUTCDate() + days);
  return date(d);
}
export const scheduleEnd = (start: string, months: number) =>
  advance(shiftMonth(start, months), -1);
export function validateSample(sample: Sample, type: ReadType) {
  if (
    !type.targets.some((t) => t.id === sample.targetId) ||
    Object.keys(sample.values).length !== type.fields.length
  )
    return false;
  return type.fields.every((f) => {
    const v = sample.values[f.id];
    if (f.kind === 'number')
      return (
        typeof v === 'number' &&
        (f.low === undefined || v >= f.low) &&
        (f.high === undefined || v <= f.high)
      );
    if (typeof v !== 'string' || !v.trim()) return false;
    return f.kind === 'choice' ? f.choices?.includes(v) : true;
  });
}
export type Due = {
  id: string;
  label: string;
  date: string;
  role?: string;
  member?: string;
  state: 'late' | 'due today' | 'due soon';
};
export function dueList(p: Pilot, now: string): Due[] {
  const rows: Due[] = [],
    schedule = p.schedules?.[0],
    until = now.slice(0, 7) + '-31';
  const add = (row: Omit<Due, 'state'>) => {
    if (row.date <= until)
      rows.push({
        ...row,
        state: row.date < now ? 'late' : row.date === now ? 'due today' : 'due soon',
      });
  };
  for (const s of p.steps) {
    const day = s.endMonth && schedule ? scheduleEnd(schedule.start, s.endMonth) : s.date;
    if (s.state !== 'done')
      add({ id: s.id, date: day, label: s.title, role: s.ownerRole ?? 'lead' });
    for (const task of s.tasks ?? [])
      if (task.state !== 'done') add({ id: task.id, date: day, label: task.name, role: task.role });
  }
  for (const paper of p.papers)
    if (paper.due && !['filed', 'signed'].includes(paper.state))
      add({
        id: paper.id,
        label: paper.title,
        date: paper.due,
        role: paper.ownerMember ? undefined : (paper.ownerRole ?? 'lead'),
        member: paper.ownerMember,
      });
  if (schedule)
    for (const site of p.sites) {
      const last = p.readings
        .filter((r) => r.site === site.id)
        .map((r) => r.month)
        .sort()
        .pop();
      const date = last ? shiftMonth(last + '-01', 1) : schedule.start;
      if (date <= schedule.end)
        add({
          id: 'cover-' + site.id,
          label: 'Monthly cover · ' + site.name,
          role: 'tester',
          date,
        });
    }
  if (schedule)
    for (const type of p.readingTypes ?? [])
      for (const target of type.targets) {
        const recorded = (p.samples ?? [])
          .filter((s) => s.typeId === type.id && s.targetId === target.id)
          .map((s) => s.date)
          .sort()
          .pop();
        let due = schedule.start;
        if (recorded) {
          const r: Rhythm =
            type.change && recorded >= type.change.date ? type.change.rhythm : type.rhythm;
          if (r === 'once') {
            if (!type.change || recorded >= type.change.date) continue;
            due = type.change.date;
          } else {
            due =
              r === 'monthly'
                ? shiftMonth(recorded, 1)
                : advance(recorded, r === 'weekly' ? 7 : 14);
            if (type.change && recorded < type.change.date && due > type.change.date)
              due = type.change.date;
          }
        }
        if (due <= schedule.end)
          add({
            id: type.id + '-' + target.id,
            label: type.name + ' · ' + target.name,
            role: target.role,
            date: due,
          });
      }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}
export function ownWork(p: Pilot, role: string, member: string, day: string) {
  const assigned = (r: { role?: string; member?: string }) =>
    r.member ? r.member === member : r.role === role;
  return {
    due: dueList(p, day).filter(assigned),
    owned: [
      ...p.steps.flatMap((s) => [
        ...(s.ownerRole === role ? [s.title] : []),
        ...(s.tasks ?? []).filter((t) => t.role === role).map((t) => t.name),
      ]),
      ...p.papers
        .filter((s) => assigned({ member: s.ownerMember, role: s.ownerRole }))
        .map((s) => s.title),
      ...(p.readingTypes ?? []).flatMap((t) =>
        t.targets.filter((s) => s.role === role).map((s) => t.name + ' · ' + s.name),
      ),
    ],
  };
}
