/**
 * Truth table for opening geometry — the door model.
 *
 * The door symbol assertions use exact expected coordinates rather than
 * "something was returned", because the whole value of the symbol is that it
 * tells a fitter which way the door opens. A leaf on the wrong side or an arc
 * sweeping the wrong way is a drawing that lies.
 */
import { describe, it, expect } from 'vitest';
import { roomEdges, type EdgeRoom } from '../wallEdges';
import {
  openingSpan,
  edgeCanHost,
  clampOpeningOffset,
  validateOpening,
  edgeNormal,
  doorSymbol,
  jambTicks,
  JAMB_MARGIN_M,
  DEFAULT_DOOR_WIDTH_M,
  type Opening,
} from '../openings';

const R1: EdgeRoom = {
  id: 'r1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
};
// Edge 0: (0,0)->(5,0) pointing +x. Edge 1: (5,0)->(5,4) pointing +y.
const TOP = roomEdges(R1)[0];
const EAST = roomEdges(R1)[1];

function door(patch: Partial<Opening> = {}): Opening {
  return {
    id: 'o1',
    edgeIndex: 0,
    offsetM: 2.5,
    widthM: 1,
    kind: 'door',
    flipFacing: false,
    flipHand: false,
    ...patch,
  };
}

describe('openingSpan', () => {
  it('centres the span on the offset', () => {
    expect(openingSpan({ offsetM: 2.5, widthM: 1 })).toEqual({ t0: 2, t1: 3 });
  });
});

describe('fit + clamping', () => {
  it('edgeCanHost accounts for a jamb at BOTH ends', () => {
    // 1 m door needs 1 + 2*0.1 = 1.2 m of wall.
    expect(edgeCanHost(1.2, 1)).toBe(true);
    expect(edgeCanHost(1.19, 1)).toBe(false);
  });

  it('clamps a drag past either end back to the jamb margin', () => {
    expect(clampOpeningOffset(5, 1, -3)).toBeCloseTo(JAMB_MARGIN_M + 0.5, 9);
    expect(clampOpeningOffset(5, 1, 99)).toBeCloseTo(5 - JAMB_MARGIN_M - 0.5, 9);
  });

  it('leaves a legal offset alone', () => {
    expect(clampOpeningOffset(5, 1, 2.5)).toBeCloseTo(2.5, 9);
  });

  it('returns null when the wall simply cannot host the opening', () => {
    expect(clampOpeningOffset(0.8, 1, 0.4)).toBeNull();
  });
});

describe('validateOpening', () => {
  it('accepts a door centred on a long enough wall', () => {
    expect(validateOpening(5, { offsetM: 2.5, widthM: 1 })).toEqual({ ok: true });
  });

  it('rejects a wall that is too short, with a reason', () => {
    const v = validateOpening(0.9, { offsetM: 0.45, widthM: 1 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('wall-too-short');
    expect(v.message).toBeTruthy();
  });

  it('rejects an opening that eats the jamb margin', () => {
    const v = validateOpening(5, { offsetM: 0.5, widthM: 1 }); // t0 = 0 < 0.1
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('past-jamb-margin');
  });

  it('accepts an opening sitting exactly on the jamb margin', () => {
    expect(validateOpening(5, { offsetM: JAMB_MARGIN_M + 0.5, widthM: 1 }).ok).toBe(true);
  });

  it('rejects two openings that share wall length', () => {
    const v = validateOpening(6, { offsetM: 2.5, widthM: 1 }, [{ offsetM: 3.2, widthM: 1 }]);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('overlaps-another-opening');
  });

  it('ALLOWS two openings that merely touch end-to-end', () => {
    // spans [2,3] and [3,4]
    expect(validateOpening(6, { offsetM: 2.5, widthM: 1 }, [{ offsetM: 3.5, widthM: 1 }]).ok)
      .toBe(true);
  });

  it('ignores openings on other walls (caller passes only same-edge ones)', () => {
    expect(validateOpening(6, { offsetM: 2.5, widthM: 1 }, []).ok).toBe(true);
  });
});

describe('edgeNormal', () => {
  it('gives opposite sides for the two facings', () => {
    const a = edgeNormal(TOP, false);
    const b = edgeNormal(TOP, true);
    expect(a.nx).toBeCloseTo(-b.nx, 9);
    expect(a.ny).toBeCloseTo(-b.ny, 9);
  });

  it('is perpendicular to the wall', () => {
    const n = edgeNormal(EAST, false);
    expect(n.nx * EAST.dx + n.ny * EAST.dy).toBeCloseTo(0, 9);
  });
});

describe('doorSymbol', () => {
  it('hinges at the near jamb and swings perpendicular into the room', () => {
    // TOP runs (0,0)->(5,0). Door centred at 2.5, width 1 => span [2,3].
    const s = doorSymbol(TOP, door({ offsetM: 2.5, widthM: 1 }));
    expect(s.hinge).toEqual({ x: 2, y: 0 });
    expect(s.farJamb).toEqual({ x: 3, y: 0 });
    // flipFacing=false => normal is (-dy, dx) = (0, 1), i.e. +y, into the room.
    expect(s.leafEnd.x).toBeCloseTo(2, 9);
    expect(s.leafEnd.y).toBeCloseTo(1, 9);
  });

  it('flipHand moves the hinge to the other jamb', () => {
    const s = doorSymbol(TOP, door({ offsetM: 2.5, widthM: 1, flipHand: true }));
    expect(s.hinge).toEqual({ x: 3, y: 0 });
    expect(s.farJamb).toEqual({ x: 2, y: 0 });
    // Still swings into the room, but from the other side.
    expect(s.leafEnd.y).toBeCloseTo(1, 9);
  });

  it('flipFacing swings the leaf to the other side of the wall', () => {
    const s = doorSymbol(TOP, door({ offsetM: 2.5, widthM: 1, flipFacing: true }));
    expect(s.leafEnd.y).toBeCloseTo(-1, 9);
  });

  it('the two flips give four distinct leaf tips', () => {
    const tips = [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ].map(([flipFacing, flipHand]) => {
      const s = doorSymbol(TOP, door({ flipFacing, flipHand }));
      return `${s.leafEnd.x.toFixed(3)},${s.leafEnd.y.toFixed(3)}`;
    });
    expect(new Set(tips).size).toBe(4);
  });

  it('sweeps a quarter circle of radius = width, from wall to leaf', () => {
    const o = door({ offsetM: 2.5, widthM: 1 });
    const s = doorSymbol(TOP, o, 12);
    expect(s.arc).toHaveLength((12 + 1) * 2);

    // Every arc point is exactly `width` from the hinge.
    for (let i = 0; i < s.arc.length; i += 2) {
      const d = Math.hypot(s.arc[i] - s.hinge.x, s.arc[i + 1] - s.hinge.y);
      expect(d).toBeCloseTo(o.widthM, 9);
    }
    // Starts at the far jamb, ends at the leaf tip.
    expect(s.arc[0]).toBeCloseTo(s.farJamb.x, 9);
    expect(s.arc[1]).toBeCloseTo(s.farJamb.y, 9);
    expect(s.arc[s.arc.length - 2]).toBeCloseTo(s.leafEnd.x, 9);
    expect(s.arc[s.arc.length - 1]).toBeCloseTo(s.leafEnd.y, 9);
  });

  it('works on a wall running the other way (the shared-wall case)', () => {
    // EAST runs (5,0)->(5,4), pointing +y. Door at 2, width 1 => span [1.5,2.5].
    const s = doorSymbol(EAST, door({ edgeIndex: 1, offsetM: 2, widthM: 1 }));
    expect(s.hinge.x).toBeCloseTo(5, 9);
    expect(s.hinge.y).toBeCloseTo(1.5, 9);
    // normal (-dy, dx) = (-1, 0) => swings toward -x, into room 1.
    expect(s.leafEnd.x).toBeCloseTo(4, 9);
    expect(s.leafEnd.y).toBeCloseTo(1.5, 9);
  });

  it('uses the default trade width sensibly', () => {
    const s = doorSymbol(TOP, door({ widthM: DEFAULT_DOOR_WIDTH_M }));
    expect(Math.hypot(s.leafEnd.x - s.hinge.x, s.leafEnd.y - s.hinge.y))
      .toBeCloseTo(DEFAULT_DOOR_WIDTH_M, 9);
  });
});

describe('jambTicks', () => {
  it('returns one tick per jamb, across the wall', () => {
    const ticks = jambTicks(TOP, door({ offsetM: 2.5, widthM: 1 }), 0.05);
    expect(ticks).toHaveLength(2);
    const [[a0, a1]] = ticks;
    expect(a0.x).toBeCloseTo(2, 9);
    expect(a1.x).toBeCloseTo(2, 9);
    expect(a1.y - a0.y).toBeCloseTo(0.1, 9);
  });
});
