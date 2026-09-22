import { describe, expect, it } from 'vitest';
import { anchorWallStroke, completeWallStroke } from '../touchWallStroke';

describe('phone wall strokes', () => {
  it('builds and closes a room through four continuous finger drags', () => {
    let vertices = completeWallStroke([], { x: 0, y: 0 }, { x: 4, y: 0 }, 0.3).vertices;
    vertices = completeWallStroke(vertices, { x: 4, y: 0 }, { x: 4, y: 3 }, 0.3).vertices;
    vertices = completeWallStroke(vertices, { x: 4, y: 3 }, { x: 0, y: 3 }, 0.3).vertices;
    const result = completeWallStroke(vertices, { x: 0, y: 3 }, { x: 0.1, y: 0.1 }, 0.3);
    expect(result.closed).toBe(true);
    expect(result.vertices).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }]);
  });

  it('does not persist a zero-length wall when both ends snap to one grid point', () => {
    expect(completeWallStroke([], { x: 1, y: 1 }, { x: 1, y: 1 }, 0.3)).toEqual({
      vertices: [{ x: 1, y: 1 }], closed: false,
    });
  });

  it('leaves the original run intact so a pinch can cancel its temporary anchor', () => {
    const original = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
    const preview = anchorWallStroke(original, { x: 4, y: 3 });
    expect(preview).toHaveLength(3);
    expect(original).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
  });
});
