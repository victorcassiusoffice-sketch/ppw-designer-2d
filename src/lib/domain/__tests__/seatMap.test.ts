/**
 * Airplane seat-map model (DESIGNER-EXPANSION P5). Pure geometry — node env.
 */
import { describe, it, expect } from 'vitest';
import { getDefaultSpace } from '../templates';
import type { FuselageSectionSpace } from '../templates';
import { buildSeatMap } from '../seatMap';

const space = getDefaultSpace('airplane') as FuselageSectionSpace;

describe('buildSeatMap', () => {
  it('produces rows × cols cells matching the fuselage floor grid', () => {
    const map = buildSeatMap(space);
    expect(map.rows).toBe(space.floorGrid.rows);
    expect(map.cols).toBe(space.floorGrid.cols);
    expect(map.cells).toHaveLength(space.floorGrid.rows * space.floorGrid.cols);
  });

  it('ids each cell r{row}-c{col} and lays them on a non-overlapping grid', () => {
    const map = buildSeatMap(space);
    expect(map.cells[0].id).toBe('r0-c0');
    // first row cells share y, increase in x
    const row0 = map.cells.filter((c) => c.row === 0);
    expect(row0.every((c) => c.yPx === row0[0].yPx)).toBe(true);
    expect(row0[1].xPx).toBeGreaterThan(row0[0].xPx);
    // every cell is square + positive
    expect(map.cells.every((c) => c.sizePx > 0)).toBe(true);
  });

  it('is deterministic (same input → identical output)', () => {
    expect(buildSeatMap(space)).toEqual(buildSeatMap(space));
  });

  it('reports a positive overall extent', () => {
    const map = buildSeatMap(space);
    expect(map.widthPx).toBeGreaterThan(0);
    expect(map.heightPx).toBeGreaterThan(0);
  });
});
