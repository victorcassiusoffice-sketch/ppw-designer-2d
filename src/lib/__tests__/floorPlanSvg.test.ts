/**
 * floorPlanSvg tests - Week 4b Hotfix 4.
 *
 * The bug we were guarding against: the previous implementation
 * conflated `pxPerMetre` (the input ceiling) with the actual draw
 * scale. For a 5x4 m room, the polygon collapsed to ~7 px wide. The
 * tests here lock in the correct scale: a 5x4 m room should fill most
 * of the 1100x780 canvas (less margins), and the SVG should carry
 * grid, ticks, scale bar, North arrow + product labels.
 */
import { describe, it, expect } from 'vitest';
import { renderRoomSvg } from '../floorPlanSvg';
import { rectToPolygon } from '../geometry';

describe('renderRoomSvg - Hotfix 4 scale + labels', () => {
  const room5x4 = {
    name: 'Main Room',
    polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
    placedItems: [
      {
        productId: 'massage-table-01',
        productName: 'Pro Massage Table',
        x: 1.5,
        y: 1.0,
        length_cm: 220,
        width_cm: 100,
        rotation: 0,
      },
    ],
  };

  const svg = renderRoomSvg(room5x4);

  it('returns a non-empty SVG string', () => {
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg.length).toBeGreaterThan(800);
  });

  it('emits a polygon with vertices spread across the canvas (not collapsed to a blob)', () => {
    // Extract first <polygon points="..."/>. The actual canvas is
    // 1100x780 with 70 px margins, so a 5x4 m room should map to a
    // polygon at least 800 px wide.
    const match = svg.match(/<polygon points="([^"]+)" fill="#FAF7F1"/);
    expect(match).not.toBeNull();
    const points = match![1].split(/\s+/).map((p) => p.split(',').map(Number));
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const widthPx = Math.max(...xs) - Math.min(...xs);
    const heightPx = Math.max(...ys) - Math.min(...ys);
    expect(widthPx).toBeGreaterThan(700);
    expect(heightPx).toBeGreaterThan(550);
  });

  it('renders a product rectangle with name + cm dimensions', () => {
    expect(svg).toContain('Pro Massage Table');
    expect(svg).toContain('220 x 100 cm');
  });

  it('renders wall length labels (m)', () => {
    expect(svg).toContain('5.00 m');
    expect(svg).toContain('4.00 m');
  });

  it('renders the scale bar caption', () => {
    expect(svg).toContain('1.00 m');
    expect(svg).toContain('Scale:');
  });

  it('renders a north arrow', () => {
    expect(svg).toMatch(/<text[^>]*>N<\/text>/);
  });

  it('escapes XML special characters in the room name', () => {
    const tricky = renderRoomSvg({
      name: 'A & B <Sauna>',
      polygon: rectToPolygon({ lengthM: 3, widthM: 3 }),
      placedItems: [],
    });
    expect(tricky).toContain('A &amp; B &lt;Sauna&gt;');
    expect(tricky).not.toContain('<Sauna>');
  });

  it('handles a polygon room (triangle) without throwing', () => {
    const tri = renderRoomSvg({
      name: 'Triangle',
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 3 },
      ],
      placedItems: [],
    });
    expect(tri).toContain('<svg');
    expect(tri).toContain('Triangle');
  });

  it('honours custom widthPx/heightPx', () => {
    const custom = renderRoomSvg(room5x4, { widthPx: 600, heightPx: 400 });
    expect(custom).toContain('viewBox="0 0 600 400"');
  });
});
