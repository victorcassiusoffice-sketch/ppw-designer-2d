import { describe, expect, it } from 'vitest';
import { interiorSide, wallFinishHighlight, wallPaintBand } from '../wallFinishPlan';

describe('plan paint finish', () => {
  it('uses a stronger, narrower reflection for gloss and no white wash for matt', () => {
    const matt = wallFinishHighlight('matt');
    const satin = wallFinishHighlight('satin');
    const gloss = wallFinishHighlight('gloss');
    expect(matt[5]).toBe('rgba(255,255,255,0.000)');
    expect(satin[5]).toBe('rgba(255,255,255,0.308)');
    expect(gloss[5]).toBe('rgba(255,255,255,0.515)');
    expect(Number(gloss[2])).toBeGreaterThan(Number(satin[2]));
    expect(wallFinishHighlight(undefined)).toEqual(matt);
  });

  it('keeps paint inside the room when an imported polygon has reversed winding', () => {
    const room = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
    expect(interiorSide(room)).toBe(1);
    expect(interiorSide([...room].reverse())).toBe(-1);
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    const forward = wallPaintBand(a, b, 3, 6);
    const reversed = wallPaintBand(b, a, 3, -6);
    expect(forward.filter((_, i) => i % 2)).toEqual([4.5, 4.5, 7.5, 7.5]);
    expect(reversed.filter((_, i) => i % 2).sort()).toEqual([4.5, 4.5, 7.5, 7.5]);
    expect(wallPaintBand(a, a, 3)).toEqual([]);
  });
});
