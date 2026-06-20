/**
 * Per-domain render surfaces — mirror + seat-map (DESIGNER-EXPANSION P5).
 *
 * Render gate: each renderer mounts (children > 0) with ZERO console errors,
 * and exercises the GUARDED FALLBACK path (no canvas/WebGL in jsdom). We stub
 * `getContext` to return null cleanly so the probe degrades without jsdom's
 * "not implemented" noise — i.e. we deterministically test the fallback branch.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { DomainMirror3D } from '../DomainMirror3D';
import { AirplaneSeatMapCanvas } from '../AirplaneSeatMapCanvas';
import { hasCanvas2d, hasWebGL } from '../../../lib/domain/renderCaps';

let container: HTMLDivElement;
let root: Root;
let errorSpy: ReturnType<typeof vi.spyOn>;
let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  // Force the no-canvas / no-WebGL fallback path, cleanly (no jsdom noise).
  origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof origGetContext;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  errorSpy.mockRestore();
  HTMLCanvasElement.prototype.getContext = origGetContext;
});

function renderNode(node: React.ReactNode): void {
  act(() => flushSync(() => root.render(node)));
}
function expectCleanMount(): void {
  expect(container.childElementCount).toBeGreaterThan(0);
  expect(errorSpy).not.toHaveBeenCalled();
}

describe('renderCaps (guards)', () => {
  it('report false when getContext yields no context', () => {
    expect(hasCanvas2d()).toBe(false);
    expect(hasWebGL()).toBe(false);
  });
});

describe('DomainMirror3D', () => {
  it('renders the car turntable mirror as a guarded SVG projection', () => {
    renderNode(<DomainMirror3D domain="car" />);
    expectCleanMount();
    const mirror = container.querySelector('[data-testid="domain-mirror-3d"]');
    expect(mirror?.getAttribute('data-mirror')).toBe('turntable-3d');
    expect(mirror?.getAttribute('data-gl')).toBe('fallback-svg');
    expect(container.querySelector('[data-testid="domain-mirror-fallback"]')).not.toBeNull();
    // four wheels projected as nodes
    expect(container.querySelectorAll('[data-testid^="mirror-node-car-wheel-"]').length).toBe(4);
  });

  it('renders the airplane cabin mirror', () => {
    renderNode(<DomainMirror3D domain="airplane" />);
    expectCleanMount();
    const mirror = container.querySelector('[data-testid="domain-mirror-3d"]');
    expect(mirror?.getAttribute('data-mirror')).toBe('cabin-3d');
    expect(container.querySelectorAll('[data-testid^="mirror-node-seat-"]').length).toBeGreaterThan(0);
  });

  it('renders nothing for wellness-room (2D-only, unchanged)', () => {
    renderNode(<DomainMirror3D domain="wellness-room" />);
    expect(container.querySelector('[data-testid="domain-mirror-3d"]')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('AirplaneSeatMapCanvas', () => {
  it('falls back to an SVG seat-map when canvas is unavailable', () => {
    renderNode(<AirplaneSeatMapCanvas />);
    expectCleanMount();
    expect(container.querySelector('[data-testid="airplane-seatmap-svg"]')).not.toBeNull();
    // no Konva Stage mounted on the fallback path
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-testid="seatmap-cell-r0-c0"]')).not.toBeNull();
  });

  it('tints filled seat cells', () => {
    renderNode(<AirplaneSeatMapCanvas filledCellIds={new Set(['r0-c0'])} />);
    const cell = container.querySelector('[data-testid="seatmap-cell-r0-c0"]');
    expect(cell?.getAttribute('fill')).toBe('#fff7e0');
  });
});
