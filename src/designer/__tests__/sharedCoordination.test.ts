import { describe, expect, it } from 'vitest';
import {
  coordinationSnapshot,
  coordinationDate,
  coordinationStages,
  deliveryGroups,
  stationActions,
} from '../sharedCoordination';
import { SharedSpecComponentSchema, type SharedSpecProject } from '../sharedSpecsContract';
const component = (id: string, extra = {}) =>
  SharedSpecComponentSchema.parse({
    id,
    category: 'wall',
    name: id,
    material: 'Concrete',
    quantity: 20,
    unit: 'm2',
    sources: ['https://example.com/spec'],
    ...extra,
  });
const project = (extra: Partial<SharedSpecProject> = {}): SharedSpecProject => ({
  id: 'da59ef84-c91e-4731-8efa-79e20d5f89cb',
  name: 'District',
  sourceBuildId: 'build',
  specRevision: 4,
  members: [
    { userId: 'user_owner', role: 'owner', active: true },
    { userId: 'user_supplier', role: 'supplier', active: true },
    { userId: 'user_engineer', role: 'engineer', active: true },
  ],
  pilotReviews: [],
  components: [],
  ...extra,
});
describe('coordination derives one action per source component', () => {
  it('uses the Mauritius civil day across the UTC midnight boundary', () => {
    expect(coordinationDate(new Date('2026-10-18T19:59:59Z'))).toBe('2026-10-18');
    expect(coordinationDate(new Date('2026-10-18T20:00:00Z'))).toBe('2026-10-19');
    expect(coordinationDate(new Date('2026-10-18T21:00:00Z'))).toBe('2026-10-19');
    expect(coordinationDate(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
  });
  it('does not display an imported release acknowledgement as clear when checks are blocked', () => {
    const p = project({
      pilotReviews: [
        {
          stageId: 'release',
          actorUserId: 'user_owner',
          reviewedAt: '2026-10-19T08:00:00Z',
          basisRevision: 4,
          decision: 'accepted',
          note: 'Imported decision',
        },
      ],
    });
    expect(coordinationStages(p).find((stage) => stage.id === 'release')?.state).toBe('blocked');
  });
  it('gives suppliers only their assigned packages, including removed commitments', () => {
    const p = project({
      components: [
        component('assigned', { assigneeUserId: 'user_supplier' }),
        component('other'),
        component('removed', { assigneeUserId: 'user_supplier', sourceRemoved: true }),
      ],
    });
    const actions = stationActions(p, 'supplier', 'user_supplier', '2026-10-19');
    expect(actions.map((a) => a.component.id)).toEqual(['removed', 'assigned']);
    expect(actions[0].reasons[0]).toContain('Geometry removed');
    expect(actions[1].reasons).toContain('Agree delivery date');
  });
  it('prioritises late deliveries without calling delivered packages late', () => {
    const p = project({
      components: [
        component('date-needed'),
        component('late', { deliveryDate: '2026-10-18', status: 'ordered' }),
        component('done', {
          deliveryDate: '2026-10-17',
          status: 'delivered',
          responsibleParty: 'Site team',
        }),
      ],
    });
    const actions = stationActions(p, 'contractor', 'user_owner', '2026-10-19');
    expect(actions.map((a) => a.component.id)).toEqual(['late', 'date-needed']);
    expect(actions[0].reasons).toContain('Delivery date passed — confirm status');
  });
  it('separates dates and units without duplicating or mutating component data in export', () => {
    const p = project({
      components: [
        component('area', { deliveryDate: '2026-10-25' }),
        component('volume', { unit: 'm3', deliveryDate: '2026-10-20' }),
        component('removed', { sourceRemoved: true }),
        component('delivered', { status: 'delivered' }),
      ],
    });
    const before = structuredClone(p),
      snapshot = coordinationSnapshot(p, 'local', '2026-10-19');
    expect(deliveryGroups(p).map((g) => g.date)).toEqual(['2026-10-20', '2026-10-25']);
    expect(snapshot.deliveries).toEqual([
      { date: '2026-10-20', componentIds: ['volume'] },
      { date: '2026-10-25', componentIds: ['area'] },
    ]);
    expect(snapshot.components).toHaveLength(4);
    expect(snapshot.components.map((c) => c.unit)).toEqual(['m2', 'm3', 'm2', 'm2']);
    expect(snapshot.scope).toBe('local');
    expect(snapshot.limitation).toContain('not a purchase order');
    expect(p).toEqual(before);
  });
  it('never treats stale or revoked engineering acknowledgements as current', () => {
    const p = project({
      pilotReviews: [
        {
          stageId: 'engineering',
          actorUserId: 'user_engineer',
          reviewedAt: '2026-10-19T08:00:00Z',
          basisRevision: 3,
          decision: 'accepted',
          note: 'Prior design',
        },
      ],
    });
    expect(coordinationStages(p).find((s) => s.id === 'engineering')?.state).toBe('stale');
    p.pilotReviews[0].basisRevision = 4;
    expect(coordinationStages(p).find((s) => s.id === 'engineering')?.state).toBe('accepted');
    p.members[2].active = false;
    expect(coordinationStages(p).find((s) => s.id === 'engineering')?.state).toBe('stale');
    expect(
      coordinationStages(p)
        .find((s) => s.id === 'release')
        ?.blockers.join(' '),
    ).toContain('7 review stage(s)');
  });
});
