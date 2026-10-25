import { describe, it, expect } from 'vitest';
import { requiresInteriorWall } from '../indoorWallPlacement';

describe('indoor blind placement restriction', () => {
  it('protects untagged supplier blinds and curtains, but respects outdoor declarations', () => {
    const blind = { id: 'merchant-roller-blind', name: 'Roller blind', placement: 'wall' };
    expect(requiresInteriorWall(blind)).toBe(true);
    expect(requiresInteriorWall({ ...blind, outdoor: true })).toBe(false);
    expect(requiresInteriorWall({ id: 'shelf', name: 'Wall shelf', placement: 'wall' })).toBe(false);
    expect(requiresInteriorWall({ ...blind, placement: 'floor' })).toBe(false);
  });
});
