import { describe, expect, it } from 'vitest';
import { stairPlanSymbols } from '../stairPlan';
import type { BuildingStair } from '../building';

const stair: BuildingStair = { id: 'stairs', fromLevelId: 'ground', toLevelId: 'first', x: 3, y: 4, widthM: 1, runM: 4, rotation: 0 };
const property = {
  levels: [{ id: 'ground', index: 0, name: 'Ground floor' }, { id: 'first', index: 1, name: 'First floor' }, { id: 'second', index: 2, name: 'Second floor' }],
  stairs: [stair],
};

describe('stair plan symbols', () => {
  it('shows up/down destinations on connected floors and nothing on unrelated floors', () => {
    const ground = stairPlanSymbols(property, 'ground')[0];
    const upper = stairPlanSymbols(property, 'first')[0];
    expect(ground.label).toBe('Up · First floor');
    expect(upper.label).toBe('Down · Ground floor');
    expect(ground.arrow[1].y).toBeGreaterThan(ground.arrow[0].y);
    expect(upper.arrow[1].y).toBeLessThan(upper.arrow[0].y);
    expect(stairPlanSymbols(property, 'second')).toEqual([]);
  });

  it('uses actual rise for treads and preserves the staircase orientation in plan', () => {
    const symbol = stairPlanSymbols({ ...property, stairs: [{ ...stair, rotation: 90 }] }, 'ground')[0];
    expect(symbol.treads).toHaveLength(15);
    expect(symbol.arrow[1].x).toBeLessThan(symbol.arrow[0].x);
    expect(symbol.arrow[1].y).toBeCloseTo(symbol.arrow[0].y);
    expect(Math.min(...symbol.footprint.map((point) => point.x))).toBeCloseTo(1);
    expect(Math.max(...symbol.footprint.map((point) => point.x))).toBeCloseTo(5);
    expect(Math.max(...symbol.footprint.map((point) => point.y)) - Math.min(...symbol.footprint.map((point) => point.y))).toBeCloseTo(1);
  });
});
