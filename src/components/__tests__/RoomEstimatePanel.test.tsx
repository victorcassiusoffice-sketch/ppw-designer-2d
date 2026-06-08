/**
 * P3-2 — RoomEstimatePanel renders BOTH the paint (walls) and flooring (floor
 * polygon) sections from the live calculator engines.
 *
 * Uses the repo's raw react-dom/client render pattern (no @testing-library).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { RoomEstimatePanel } from '../RoomEstimatePanel';
import { useWallStore } from '../../store/wallStore';
import type { WallSegment } from '../../store/wallStore';
import { useDesignStore } from '../../store/designStore';

const WALL: WallSegment = {
  id: 'w1', start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 5000, y_mm: 0 },
  thickness_mm: 100, height_mm: 2500, type: 'interior' as WallSegment['type'],
};
// 5 m × 4 m rectangle = 20 m² floor (Vertex = { x, y } in metres).
const POLY_20M2 = [
  { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
];

let container: HTMLDivElement;
let root: Root;
function render(): string {
  act(() => { flushSync(() => { root.render(<RoomEstimatePanel />); }); });
  return container.innerHTML;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  useWallStore.setState({ walls: [] });
});

describe('RoomEstimatePanel', () => {
  it('renders both a paint section and a flooring section', () => {
    useWallStore.setState({ walls: [WALL] });
    useDesignStore.setState({ polygon: POLY_20M2 });
    const html = render();
    expect(html).toContain('Room estimate');
    expect(html).toContain('data-testid="paint-section"');
    expect(html).toContain('data-testid="floor-section"');
  });

  it('paint section shows area + litres + price for walls', () => {
    useWallStore.setState({ walls: [WALL] });
    const html = render();
    expect(html).toContain('12.5 m²');
    expect(html).toContain('data-testid="paint-litres"');
    expect(html).toContain('data-testid="paint-price"');
  });

  it('flooring section shows floor area + units + price from the room polygon', () => {
    useDesignStore.setState({ polygon: POLY_20M2 });
    const html = render();
    expect(html).toContain('20.0 m²'); // floor area
    expect(html).toContain('data-testid="floor-units"');
    expect(html).toContain('data-testid="floor-price"');
    expect(html).toContain('MUR');
  });
});
