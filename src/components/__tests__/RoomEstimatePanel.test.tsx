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
import { usePropertyStore } from '../../store/propertyStore';
import { WALL_PAINTS } from '../../data/wallPaints';
import { deriveWallPaintOrders } from '../../designer/wallPaintCalc';

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
  usePropertyStore.setState({ property: { id: 'p', name: 'Paint quote', activeRoomId: 'r', wallHeightM: 2.5,
    rooms: [{ id: 'r', name: 'Room', polygon: POLY_20M2, placedItems: [], wallPaint: [{ edgeIndex: 0, paintId: WALL_PAINTS[0].id }] }] } });
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
    const quote = deriveWallPaintOrders(usePropertyStore.getState().property)[0];
    expect(container.querySelector('[data-testid="paint-litres"]')?.textContent).toBe(`${quote.litres.toFixed(1)} L`);
    expect(html).toContain(WALL_PAINTS[0].name);
    expect(html).not.toContain('Cream Shell');
  });

  it('coats control updates the persisted property and the same cart demand', () => {
    render();
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Paint coats"]')!;
    act(() => { select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(usePropertyStore.getState().property.wallPaintCoats).toBe(1);
    const quote = deriveWallPaintOrders(usePropertyStore.getState().property)[0];
    expect(container.querySelector('[data-testid="paint-litres"]')?.textContent).toBe(`${quote.litres.toFixed(1)} L`);
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
