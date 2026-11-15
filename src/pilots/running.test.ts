import { expect, it } from 'vitest';
import { dueList, ownWork, scheduleEnd, validateSample } from './running';
import { blankPilot } from './example';
import { type Pilot } from './contract';
it('keeps the works plan calendar, changing reading rhythm and assigned dues on their dates', () => {
  const p = blankPilot('trial', 'Trial', 'Test');
  p.schedules = [{ id: 'pilot-schedule', start: '2026-01-01', months: 10, end: '2026-10-31' }];
  expect(scheduleEnd('2026-01-01', 10)).toBe('2026-10-31');
  p.steps = [
    {
      id: 's',
      title: 'Review',
      date: '2026-01-10',
      state: 'doing',
      endMonth: 3,
      ownerRole: 'lead',
      tasks: [{ id: 'sub', name: 'Inspect', role: 'host', state: 'doing' }],
    },
  ];
  p.papers = [
    {
      id: 'permit',
      title: 'Permit',
      note: '',
      state: 'needed',
      due: '2026-03-12',
      ownerMember: 'member',
    },
  ];
  const type: NonNullable<Pilot['readingTypes']>[number] = {
    id: 'depth',
    name: 'Depth',
    fields: [{ id: 'n', kind: 'number', name: 'Thickness', unit: 'mm', low: 1, high: 9 }],
    targets: [{ id: 'one', site: 'site', name: 'Panel A', role: 'tester' }],
    rhythm: 'weekly',
    change: { date: '2026-03-01', rhythm: 'monthly' },
  };
  p.readingTypes = [type];
  const sample = {
    id: 'one',
    date: '2026-03-01',
    typeId: type.id,
    targetId: 'one',
    values: { n: 2 },
  };
  p.samples = [sample];
  expect(validateSample(sample, type)).toBe(true);
  expect(validateSample({ ...sample, values: { n: 10 } }, type)).toBe(false);
  const dates = dueList(p, '2026-03-12');
  expect(dates.map((d) => [d.id, d.date, d.state])).toEqual([
    ['permit', '2026-03-12', 'due today'],
    ['sub', '2026-03-31', 'due soon'],
    ['s', '2026-03-31', 'due soon'],
  ]);
  expect(ownWork(p, 'host', 'member', '2026-03-12').due.map((d) => d.id)).toEqual([
    'permit',
    'sub',
  ]);
  expect(ownWork(p, 'tester', 'tester-seat', '2026-04-02').due).toMatchObject([
    { label: 'Depth · Panel A', date: '2026-04-01', state: 'late' },
  ]);
});
