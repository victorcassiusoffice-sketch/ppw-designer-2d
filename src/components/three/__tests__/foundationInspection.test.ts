import { describe, expect, it } from 'vitest';
import { setFoundationInspection } from '../foundationInspection';
describe('below-ground visibility restores the existing scene state', () => {
  it('does not turn previously hidden floors or gardens back on', () => {
    const floor = { visible: true },
      garden = { visible: false };
    setFoundationInspection([floor, garden, null], true);
    setFoundationInspection([floor, garden], true);
    expect(floor.visible).toBe(false);
    expect(garden.visible).toBe(false);
    setFoundationInspection([floor, garden], false);
    expect(floor.visible).toBe(true);
    expect(garden.visible).toBe(false);
  });
  it('handles replacement geometry while inspecting without reviving disposed nodes', () => {
    const previousFloor = { visible: true },
      replacement = { visible: true };
    setFoundationInspection([previousFloor], true);
    setFoundationInspection([replacement], true);
    setFoundationInspection([replacement], false);
    expect(replacement.visible).toBe(true);
    expect(previousFloor.visible).toBe(false);
    setFoundationInspection([replacement], true);
    setFoundationInspection([replacement], false);
    expect(replacement.visible).toBe(true);
  });
});
