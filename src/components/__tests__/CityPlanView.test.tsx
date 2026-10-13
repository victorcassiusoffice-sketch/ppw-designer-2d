/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityPlanView } from '../CityPlanView';
import {
  cityAssetPolygon,
  cityBounds,
  cityRoadPolygons,
  sampleCity,
  type CityModel,
} from '../../designer/city';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
let width = 1280,
  height = 720;
const onPoint = vi.fn(),
  onSelect = vi.fn();
const svg = () => host.querySelector('svg')!;
const view = () => svg().getAttribute('viewBox')!.split(' ').map(Number);
function matrix() {
  const [x, y, w, h] = view();
  const scale = Math.min(width / w, height / h);
  const e = (width - w * scale) / 2 - x * scale,
    f = (height - h * scale) / 2 - y * scale;
  return {
    a: scale,
    d: scale,
    e,
    f,
    inverse: () => ({ a: 1 / scale, d: 1 / scale, e: -e / scale, f: -f / scale }),
  };
}
function worldAt(x: number, y: number) {
  const m = matrix().inverse();
  return { x: x * m.a + m.e, y: y * m.d + m.f };
}
function render(model: CityModel = sampleCity(), selectedId: string | null = null, fitNonce = 0) {
  act(() =>
    root.render(
      <CityPlanView
        model={model}
        tool="select"
        selectedId={selectedId}
        draft={[]}
        onPoint={onPoint}
        onSelect={onSelect}
        fitNonce={fitNonce}
        showUtilities
      />,
    ),
  );
}
function pointer(type: string, id: number, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: id });
  act(() => svg().dispatchEvent(event));
}
beforeEach(() => {
  width = 1280;
  height = 720;
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: matrix,
  });
  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(SVGElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width, height, top: 0, left: 0, bottom: height, right: width }),
  });
  vi.stubGlobal(
    'DOMPoint',
    class {
      constructor(
        public x: number,
        public y: number,
      ) {}
      matrixTransform(m: { a: number; d: number; e: number; f: number }) {
        return { x: this.x * m.a + m.e, y: this.y * m.d + m.f };
      }
    },
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  render();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('City plan measured display and camera persistence', () => {
  it('uses the exact metre footprints used by the takeoff engine', () => {
    const m = sampleCity();
    const roadPoints = host
      .querySelector(`[data-city-id="${m.roads[0].id}"] polygon`)!
      .getAttribute('points');
    expect(roadPoints).toBe(
      cityRoadPolygons(m.roads[0])[0]
        .map((p) => `${p.x},${p.y}`)
        .join(' '),
    );
    const asset = { ...m.assets[1], rotation: 35 };
    render({ ...m, assets: [asset] });
    expect(host.querySelector(`[data-city-id="${asset.id}"] polygon`)!.getAttribute('points')).toBe(
      cityAssetPolygon(asset)
        .map((p) => `${p.x},${p.y}`)
        .join(' '),
    );
  });
  it.each([
    [1280, 720],
    [390, 510],
  ])('keeps the wheel focal point fixed at %s × %s', (w, h) => {
    width = w;
    height = h;
    const x = width * 0.67,
      y = height * 0.32,
      anchor = worldAt(x, y),
      before = view()[2];
    act(() =>
      svg().dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          deltaY: -80,
        }),
      ),
    );
    expect(view()[2]).toBeLessThan(before);
    expect(worldAt(x, y).x).toBeCloseTo(anchor.x, 8);
    expect(worldAt(x, y).y).toBeCloseTo(anchor.y, 8);
    for (let i = 0; i < 10; i++) {
      act(() =>
        svg().dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            deltaY: i % 2 ? -60 : 60,
          }),
        ),
      );
    }
    expect(worldAt(x, y).x).toBeCloseTo(anchor.x, 8);
    expect(worldAt(x, y).y).toBeCloseTo(anchor.y, 8);
  });
  it('preserves the phone pinch focal point while allowing two-finger panning', () => {
    width = 390;
    height = 510;
    const anchor = worldAt(195, 230),
      before = view()[2];
    pointer('pointerdown', 1, 145, 230);
    pointer('pointerdown', 2, 245, 230);
    pointer('pointermove', 1, 125, 250);
    pointer('pointermove', 2, 285, 250);
    expect(view()[2]).toBeLessThan(before);
    expect(worldAt(205, 250).x).toBeCloseTo(anchor.x, 8);
    expect(worldAt(205, 250).y).toBeCloseTo(anchor.y, 8);
    pointer('pointerup', 1, 125, 250);
    pointer('pointerup', 2, 285, 250);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onPoint).not.toHaveBeenCalled();
  });
  it('preserves the viewport on selection and dimension edits until explicit Fit', () => {
    pointer('pointerdown', 1, 600, 300);
    pointer('pointermove', 1, 680, 360);
    pointer('pointerup', 1, 680, 360);
    const panned = svg().getAttribute('viewBox');
    const m = sampleCity();
    m.assets[0].widthM = 25;
    render(m, m.assets[0].id);
    expect(svg().getAttribute('viewBox')).toBe(panned);
    render(m, null);
    expect(svg().getAttribute('viewBox')).toBe(panned);
    render(m, null, 1);
    expect(svg().getAttribute('viewBox')).not.toBe(panned);
  });
  it('Fit includes offsite route geometry rather than hiding it beyond the site rectangle', () => {
    const m = sampleCity();
    m.roads[0].points[1].x = 500;
    render(m, null, 1);
    const bounds = cityBounds(m),
      [x, y, w, h] = view();
    expect(x).toBeLessThanOrEqual(bounds.minX);
    expect(y).toBeLessThanOrEqual(bounds.minY);
    expect(x + w).toBeGreaterThanOrEqual(bounds.maxX);
    expect(y + h).toBeGreaterThanOrEqual(bounds.maxY);
  });
  it('does not display disabled city geometry while quantities are disabled', () => {
    render({ ...sampleCity(), enabled: false });
    expect(host.querySelectorAll('[data-city-id]')).toHaveLength(0);
  });
});
