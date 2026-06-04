/**
 * P3-2 — PaintEstimatePanel renders area + litres + price from the live
 * calculatePaint engine when walls exist, and an empty hint otherwise.
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
import { PaintEstimatePanel } from '../PaintEstimatePanel';
import { useWallStore } from '../../store/wallStore';
import type { WallSegment } from '../../store/wallStore';

// A single 5 m × 2.5 m wall = 12.5 m² → at 10 m²/L, 2 coats = 3 L.
const WALL: WallSegment = {
  id: 'w1',
  start: { x_mm: 0, y_mm: 0 },
  end: { x_mm: 5000, y_mm: 0 },
  thickness_mm: 100,
  height_mm: 2500,
  type: 'interior' as WallSegment['type'],
};

let container: HTMLDivElement;
let root: Root;

function render(): string {
  act(() => { flushSync(() => { root.render(<PaintEstimatePanel />); }); });
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

describe('PaintEstimatePanel', () => {
  it('shows the empty hint when there are no walls', () => {
    useWallStore.setState({ walls: [] });
    expect(render()).toContain('Draw walls to estimate paint');
  });

  it('shows area, litres and price for a wall set', () => {
    useWallStore.setState({ walls: [WALL] });
    const html = render();
    expect(html).toContain('12.5 m²'); // 5 m × 2.5 m
    expect(html).toContain('data-testid="paint-litres"');
    expect(html).toContain('3 L'); // 12.5 m² × 2 coats / 10 = 2.5 → ceil 3
    expect(html).toContain('data-testid="paint-price"');
    expect(html).toContain('MUR');
  });
});
