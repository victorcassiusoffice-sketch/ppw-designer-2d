import { describe, expect, it } from 'vitest';
import { defaultShadeSail } from '../shade';
import { placeShadeSail } from '../shadePlacement';

const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
// The demo show flat: living 5.5 × 4 on top, bedroom and kitchen below; footprint x 0..5.5, y 0..7.5; no plot.
const flat = [
  { id: 'living', name: 'Living room', polygon: rect(0, 0, 5.5, 4) },
  { id: 'bedroom', name: 'Bedroom', polygon: rect(0, 4, 3.5, 7.5) },
  { id: 'kitchen', name: 'Kitchen', polygon: rect(3.5, 4, 5.5, 7.5) },
];
const inside = (p: { x: number; y: number }, poly: { x: number; y: number }[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};
const anchorsOf = (centre: { x: number; y: number }) => defaultShadeSail('s', centre, (() => { let n = 0; return () => `p${n++}`; })()).anchors;

describe('placeShadeSail: a new sail lands outside the house', () => {
  it('puts the first sail in the garden on the sunny north side of a plain house, clear of the walls', () => {
    const p = placeShadeSail({ rooms: flat });
    expect(p.where).toBe('beside-house');
    expect(p.side).toBe('north');
    expect(p.x).toBe(2.75);
    expect(p.y).toBe(-2.8); // 1 m clearance + half a 3.6 m sail above y = 0
    for (const a of anchorsOf(p)) {
      expect(a.y).toBeLessThanOrEqual(-1); // every fixing point stays at least the clearance away from the wall
      for (const room of flat) expect(inside(a, room.polygon)).toBe(false);
    }
  });

  it('prefers a drawn terrace or veranda: the sail centres on that room', () => {
    const p = placeShadeSail({ rooms: [...flat, { id: 't', name: 'Terrace', polygon: rect(5.5, 0, 9.5, 4) }] });
    expect(p).toEqual({ x: 7.5, y: 2, where: 'outdoor-room' });
    expect(placeShadeSail({ rooms: [...flat, { id: 'v', name: 'Varangue', polygon: rect(0, 7.5, 5.5, 10.5) }] })).toEqual({ x: 2.75, y: 9, where: 'outdoor-room' });
  });

  it('prefers a hard garden surface that takes the whole sail over a lawn or a small path', () => {
    const garden = { surfaces: [
      { id: 'lawn', kind: 'lawn', x: -20, y: -20, widthM: 40, depthM: 40 },
      { id: 'path', kind: 'path', x: 6, y: 0, widthM: 1.2, depthM: 8 },
      { id: 'patio', kind: 'concrete', x: 6, y: 1, widthM: 4, depthM: 4 },
    ] };
    expect(placeShadeSail({ rooms: flat, garden })).toEqual({ x: 8, y: 3, where: 'garden-surface' });
  });

  it('keeps the sail inside the plot and picks the side where it fits', () => {
    // House against the north boundary: the north side has no room, east has 10 m.
    const site = { widthM: 20, depthM: 12, originM: { x: -4, y: 0 } };
    const p = placeShadeSail({ rooms: flat, site });
    expect(p.where).toBe('beside-house');
    expect(p.side).toBe('east');
    expect(p.x).toBe(8.3);
    expect(p.y).toBe(3.75);
    for (const a of anchorsOf(p)) {
      expect(a.x).toBeGreaterThanOrEqual(-4); expect(a.x).toBeLessThanOrEqual(16);
      expect(a.y).toBeGreaterThanOrEqual(0); expect(a.y).toBeLessThanOrEqual(12);
      for (const room of flat) expect(inside(a, room.polygon)).toBe(false);
    }
  });

  it('on a plot too tight for the sail it still stays outside the house and inside the plot along the wall', () => {
    const site = { widthM: 9.5, depthM: 11.5, originM: { x: -2, y: -2 } }; // 2 m on every side: nothing fits whole
    const p = placeShadeSail({ rooms: flat, site });
    expect(p).toEqual({ x: 2.75, y: -2.8, where: 'beside-house', side: 'north' }); // clear of the wall, overhangs the north boundary
    for (const a of anchorsOf(p)) {
      expect(a.x).toBeGreaterThanOrEqual(-2 - 1e-9); expect(a.x).toBeLessThanOrEqual(7.5 + 1e-9); // kept inside the plot along the wall
      for (const room of flat) expect(inside(a, room.polygon)).toBe(false); // never inside the house
    }
    // Only the south side has room: the sail goes there, clamped inside along x.
    const south = placeShadeSail({ rooms: flat, site: { widthM: 7.5, depthM: 15, originM: { x: -1, y: -1 } } });
    expect(south.side).toBe('south');
    expect(south.y).toBe(10.3);
    expect(south.x).toBe(2.75);
  });

  it('ignores the outdoor container room, roofs and other storeys', () => {
    const rooms = [
      ...flat,
      { id: 'out', name: 'Outside', kind: 'outdoor', polygon: [] },
      { id: 'roof', name: 'Roof', kind: 'roof', polygon: rect(-1, -1, 6.5, 8.5) },
      { id: 'up', name: 'Terrace', levelId: 'level-1', polygon: rect(0, 0, 5.5, 4) },
    ];
    expect(placeShadeSail({ rooms })).toEqual({ x: 2.75, y: -2.8, where: 'beside-house', side: 'north' });
  });

  it('with no rooms uses the plot centre, else the plan origin area', () => {
    expect(placeShadeSail({ rooms: [], site: { widthM: 20, depthM: 10, originM: { x: 0, y: 0 } } })).toEqual({ x: 10, y: 5, where: 'plot' });
    expect(placeShadeSail({ rooms: [] })).toEqual({ x: 5, y: 5, where: 'open' });
  });
});
