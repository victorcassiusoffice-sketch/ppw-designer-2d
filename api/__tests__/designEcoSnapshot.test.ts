import { describe, expect, it } from 'vitest';
import { validateSnapshotMeasurements } from '../_lib/designSnapshotValidation';
const tree = {
  id: 't',
  name: 'Tree',
  x: 0,
  y: 0,
  heightM: 5,
  canopyRadiusM: 2,
  status: 'proposed',
  protectionMethod: 'unconfirmed',
};
const eco = {
  version: 1,
  trees: [tree],
  greenRoofs: [{ id: 'roof', roomId: 'roof-room', name: 'Green roof' }],
};
describe('eco snapshot validation', () => {
  it('keeps unknown engineering measurements absent and preserves legacy snapshots', () => {
    expect(validateSnapshotMeasurements({ rooms: [] })).toBeNull();
    const snapshot = { rooms: [], eco, engineering: { version: 1, structuralDesignRef: 'S1' } };
    const json = JSON.stringify(snapshot);
    expect(validateSnapshotMeasurements(snapshot)).toBeNull();
    expect(JSON.stringify(snapshot)).toBe(json);
  });
  it.each([
    null,
    { ...eco, version: 2 },
    { ...eco, trees: [tree, tree] },
    { ...eco, trees: [{ ...tree, x: NaN }] },
    { ...eco, greenRoofs: [{ ...eco.greenRoofs[0], saturatedKgM2: -1 }] },
    { ...eco, approved: true },
  ])('rejects invalid eco records rather than dropping part of a design', (bad) => {
    expect(validateSnapshotMeasurements({ eco: bad })).toContain('Invalid eco');
  });
  it('cannot save a fabricated engineering approval field', () => {
    expect(validateSnapshotMeasurements({ engineering: { version: 1, approved: true } })).toContain(
      'Invalid engineering',
    );
  });
});
