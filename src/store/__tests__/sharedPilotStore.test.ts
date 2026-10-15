/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  newPilot,
  applyPilotOperation,
  pilotActor,
  useSharedPilotStore,
  type PilotRecord,
} from '../sharedPilotStore';
import {
  PILOT_STAGES,
  SharedSpecComponentSchema,
  type SharedSpecOperation,
  type SharedSpecRole,
} from '../../designer/sharedSpecsContract';

const component = () =>
  SharedSpecComponentSchema.parse({
    id: 'wall:ground',
    sourceKey: 'wall:ground',
    sourceFingerprint: 'abc',
    name: 'Wall',
    category: 'wall',
    material: 'Documented wall assembly',
    quantity: 12,
    unit: 'm2',
    sources: ['https://example.org/material-test'],
    assigneeUserId: pilotActor('supplier'),
    responsibleParty: 'Test contractor',
    deliveryDate: '2026-12-01',
  });
const seeded = () =>
  applyPilotOperation(
    newPilot('build', 'Local pilot'),
    { type: 'sync-components', components: [component()] },
    1,
  );
const apply = (p: PilotRecord, operation: SharedSpecOperation, role: SharedSpecRole = 'owner') =>
  applyPilotOperation(p, operation, p.record.revision, role);
const accepted = (p = seeded()) => {
  const roles = {
    brief: 'architect',
    geometry: 'architect',
    materials: 'architect',
    engineering: 'engineer',
    supplier: 'supplier',
    logistics: 'contractor',
    client: 'client',
  } as const;
  for (const stageId of PILOT_STAGES.filter((s) => s !== 'release'))
    p = apply(
      p,
      {
        type: 'review-stage',
        stageId,
        decision: 'accepted',
        note: 'Reviewed current specification and evidence',
      },
      roles[stageId],
    );
  return p;
};
beforeEach(() => {
  localStorage.clear();
  useSharedPilotStore.setState({ pilots: {} });
});

describe('local stakeholder pilot reducer', () => {
  it('starts with all rehearsal roles, one owner and no claim of cloud sharing', () => {
    const pilot = newPilot('build', 'Local project');
    expect(pilot.record.project.sourceBuildId).toBe('build');
    expect(pilot.record.project.members).toHaveLength(6);
    expect(pilot.record.project.members.filter((m) => m.role === 'owner')).toHaveLength(1);
    expect(pilot.record.project.components).toEqual([]);
    expect(pilot.history).toEqual([]);
  });
  it('rejects a stale revision without changing the project or losing the draft', () => {
    const current = seeded(),
      before = structuredClone(current);
    expect(() =>
      applyPilotOperation(
        current,
        { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'Draft retained' } },
        1,
      ),
    ).toThrow('This pilot changed');
    expect(current).toEqual(before);
  });
  it('checks actual active rehearsal membership even when a caller chooses a role', () => {
    const current = apply(seeded(), {
      type: 'set-member',
      userId: pilotActor('supplier'),
      role: 'supplier',
      active: false,
    });
    expect(() =>
      apply(
        current,
        { type: 'review-stage', stageId: 'supplier', decision: 'accepted', note: 'Attempt' },
        'supplier',
      ),
    ).toThrow('Active project membership');
  });
  it('restricts clients to comments and suppliers to their assigned components', () => {
    let current = apply(seeded(), {
      type: 'patch-component',
      componentId: 'wall:ground',
      patch: { assigneeUserId: null },
    });
    expect(() =>
      apply(
        current,
        { type: 'patch-component', componentId: 'wall:ground', patch: { quantity: 20 } },
        'client',
      ),
    ).toThrow('cannot edit');
    expect(() =>
      apply(
        current,
        {
          type: 'patch-component',
          componentId: 'wall:ground',
          patch: { material: 'Supplier product' },
        },
        'supplier',
      ),
    ).toThrow('cannot edit');
    current = apply(current, {
      type: 'patch-component',
      componentId: 'wall:ground',
      patch: { assigneeUserId: pilotActor('supplier') },
    });
    current = apply(
      current,
      {
        type: 'patch-component',
        componentId: 'wall:ground',
        patch: { material: 'Supplier product', deliveryDate: '2026-12-01' },
      },
      'supplier',
    );
    expect(current.record.project.components[0].material).toBe('Supplier product');
    expect(() =>
      apply(
        current,
        { type: 'patch-component', componentId: 'wall:ground', patch: { quantity: 20 } },
        'supplier',
      ),
    ).toThrow('cannot edit');
    current = apply(
      current,
      { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'Client reviewed' } },
      'client',
    );
    expect(current.record.project.components[0].notes).toBe('Client reviewed');
  });
  it('does not let architect role write engineering analysis', () => {
    expect(() =>
      apply(
        seeded(),
        {
          type: 'patch-component',
          componentId: 'wall:ground',
          patch: { analysis: { airTempC: 30 } },
        },
        'architect',
      ),
    ).toThrow('cannot edit');
    expect(
      apply(
        seeded(),
        {
          type: 'patch-component',
          componentId: 'wall:ground',
          patch: { analysis: { airTempC: 30 } },
        },
        'engineer',
      ).record.project.components[0].analysis?.airTempC,
    ).toBe(30);
  });
  it('requires actual material, supplier and logistics inputs for their respective stages', () => {
    const incomplete = apply(seeded(), {
      type: 'patch-component',
      componentId: 'wall:ground',
      patch: {
        material: '',
        sources: [],
        assigneeUserId: null,
        deliveryDate: null,
        responsibleParty: null,
      },
    });
    expect(() =>
      apply(
        incomplete,
        { type: 'review-stage', stageId: 'materials', decision: 'accepted', note: 'Missing' },
        'architect',
      ),
    ).toThrow('material and a source');
    expect(() =>
      apply(
        incomplete,
        { type: 'review-stage', stageId: 'supplier', decision: 'accepted', note: 'Missing' },
        'supplier',
      ),
    ).toThrow('active supplier assignment');
    expect(() =>
      apply(
        incomplete,
        { type: 'review-stage', stageId: 'logistics', decision: 'accepted', note: 'Missing' },
        'contractor',
      ),
    ).toThrow('responsible party and delivery date');
    expect(() =>
      apply(incomplete, {
        type: 'review-stage',
        stageId: 'release',
        decision: 'accepted',
        note: 'Missing',
      }),
    ).toThrow('material and a source');
  });
  it('does not grow revisions or history for an unchanged measured sync', () => {
    const current = seeded();
    const next = apply(current, { type: 'sync-components', components: [component()] });
    expect(next).toBe(current);
    expect(next.record.project.specRevision).toBe(1);
  });
  it('records the actor and component of a changed spec', () => {
    const current = apply(
      seeded(),
      {
        type: 'patch-component',
        componentId: 'wall:ground',
        patch: { notes: 'Question for engineer' },
      },
      'client',
    );
    expect(current.history[0]).toMatchObject({
      revision: 3,
      operation: 'patch-component',
      actorUserId: pilotActor('client'),
      componentId: 'wall:ground',
    });
    expect(current.record.project.specRevision).toBe(2);
  });
  it('requires each role and all current acknowledgements before release', () => {
    const first = seeded();
    expect(() =>
      apply(first, {
        type: 'review-stage',
        stageId: 'release',
        decision: 'accepted',
        note: 'Release',
      }),
    ).toThrow('Every pilot stage');
    expect(() =>
      apply(
        first,
        { type: 'review-stage', stageId: 'engineering', decision: 'accepted', note: 'Wrong role' },
        'architect',
      ),
    ).toThrow('cannot acknowledge');
    const reviewed = accepted(first);
    const released = apply(reviewed, {
      type: 'review-stage',
      stageId: 'release',
      decision: 'accepted',
      note: 'Coordinated review complete',
    });
    expect(released.record.project.pilotReviews).toHaveLength(8);
    expect(released.record.project.specRevision).toBe(first.record.project.specRevision);
  });
  it('makes prior review decisions stale after a component change', () => {
    const reviewed = accepted();
    const changed = apply(
      reviewed,
      {
        type: 'patch-component',
        componentId: 'wall:ground',
        patch: { material: 'Changed assembly' },
      },
      'architect',
    );
    expect(
      changed.record.project.pilotReviews.every(
        (r) => r.basisRevision < changed.record.project.specRevision,
      ),
    ).toBe(true);
    expect(() =>
      apply(changed, {
        type: 'review-stage',
        stageId: 'release',
        decision: 'accepted',
        note: 'Must re-review',
      }),
    ).toThrow('Every pilot stage');
  });
  it('blocks release for needs-work and revoked responsible reviewers', () => {
    const current = accepted();
    const needsWork = apply(
      current,
      {
        type: 'review-stage',
        stageId: 'engineering',
        decision: 'needs-work',
        note: 'Missing material test',
      },
      'engineer',
    );
    expect(() =>
      apply(needsWork, {
        type: 'review-stage',
        stageId: 'release',
        decision: 'accepted',
        note: 'Release',
      }),
    ).toThrow('Every pilot stage');
    const revoked = apply(current, {
      type: 'set-member',
      userId: pilotActor('engineer'),
      role: 'engineer',
      active: false,
    });
    expect(() =>
      apply(revoked, {
        type: 'review-stage',
        stageId: 'release',
        decision: 'accepted',
        note: 'Release',
      }),
    ).toThrow('Every pilot stage');
  });
  it('retains only the latest 150 history entries without truncating components', () => {
    let current = seeded();
    for (let i = 0; i < 155; i++)
      current = apply(current, {
        type: 'patch-component',
        componentId: 'wall:ground',
        patch: { notes: `Revision ${i}` },
      });
    expect(current.history).toHaveLength(150);
    expect(current.history[0].revision).toBe(current.record.revision);
    expect(current.record.project.components[0].notes).toBe('Revision 154');
  });
});

describe('browser pilot persistence', () => {
  it('keeps one pilot per source build and does not reset it when opening again', () => {
    const store = useSharedPilotStore.getState();
    store.ensure('build', 'Original');
    const original = useSharedPilotStore.getState().pilots.build;
    store.ensure('build', 'Renamed');
    expect(useSharedPilotStore.getState().pilots.build).toBe(original);
    store.ensure('another', 'Second');
    expect(Object.keys(useSharedPilotStore.getState().pilots)).toHaveLength(2);
  });
  it('rehydrates a valid saved pilot without treating it as a cloud project', async () => {
    const current = seeded();
    localStorage.setItem(
      'olb-shared-pilot-v1',
      JSON.stringify({ version: 0, state: { pilots: { build: current } } }),
    );
    await useSharedPilotStore.persist.rehydrate();
    expect(useSharedPilotStore.getState().pilots.build.record).toEqual(current.record);
  });
  it('rejects records whose source build differs from the persisted key', async () => {
    localStorage.setItem(
      'olb-shared-pilot-v1',
      JSON.stringify({ version: 0, state: { pilots: { other: seeded() } } }),
    );
    await useSharedPilotStore.persist.rehydrate();
    expect(useSharedPilotStore.getState().pilots.other).toBeUndefined();
  });
  it('drops malformed history entries instead of handing object children to React', async () => {
    const current = seeded();
    const corrupt = {
      ...current,
      history: [
        { revision: {}, operation: { bad: true }, actorUserId: [], changedAt: null },
        ...current.history,
      ],
    };
    localStorage.setItem(
      'olb-shared-pilot-v1',
      JSON.stringify({ version: 0, state: { pilots: { build: corrupt } } }),
    );
    await useSharedPilotStore.persist.rehydrate();
    expect(useSharedPilotStore.getState().pilots.build.history).toEqual(current.history);
  });
});
