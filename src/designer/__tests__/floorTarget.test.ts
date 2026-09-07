import { describe, expect, it } from 'vitest';
import { floorTargetRoom } from '../floorTarget';

const sq = (x: number) => [
  { x, y: 0 },
  { x: x + 4, y: 0 },
  { x: x + 4, y: 3 },
  { x, y: 3 },
];
const living = { id: 'living', polygon: sq(0) };
const office = { id: 'office', polygon: sq(5) };
const garden = { id: 'garden', polygon: sq(10), kind: 'outdoor' };
const blank = { id: 'blank', polygon: [] };

describe('floorTargetRoom (2026-09-07)', () => {
  it('is the active room when it is a drawn indoor room', () => {
    expect(floorTargetRoom([living, office, garden], 'office', 'living')?.id).toBe('office');
  });
  it('falls back to the last indoor room when Outdoors has focus', () => {
    expect(floorTargetRoom([living, office, garden], 'garden', 'office')?.id).toBe('office');
  });
  it('falls back to the first drawn indoor room when nothing else applies', () => {
    expect(floorTargetRoom([garden, blank, living, office], 'garden', null)?.id).toBe('living');
    expect(floorTargetRoom([garden, blank, living, office], 'garden', 'gone')?.id).toBe('living');
  });
  it('never targets Outdoors or a blank room', () => {
    expect(floorTargetRoom([garden, blank], 'garden', 'blank')).toBeNull();
    expect(floorTargetRoom([], 'x', 'y')).toBeNull();
  });
});
