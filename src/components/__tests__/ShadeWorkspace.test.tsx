/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShadeWorkspace, ShadeLaunchButton } from '../ShadeWorkspace';
import { usePropertyStore, type Property } from '../../store/propertyStore';
import { useShadeEditorStore } from '../../store/shadeEditorStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, previous: Property;
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === name || b.getAttribute('aria-label') === name)!;

beforeEach(() => {
  previous = usePropertyStore.getState().property;
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 100, height: 30 }] as unknown as DOMRectList);
  usePropertyStore.setState({ property: { id: 'shade-test', name: 'Shade test', activeRoomId: 'room', rooms: [{ id: 'room', name: 'Terrace', polygon: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }], placedItems: [], openings: [] }] } as unknown as Property });
  useShadeEditorStore.getState().select(null);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); usePropertyStore.setState({ property: previous }); });

describe('shade sail workspace', () => {
  it('opens on its event, adds a hypar sail around the room, reports its sizes and keeps the saved design shape otherwise untouched', () => {
    act(() => root.render(<><ShadeLaunchButton /><ShadeWorkspace onBeforeOpen={() => {}} /></>));
    expect(document.querySelector('[data-testid="shade-panel"]')).toBeNull();
    act(() => button('Shade sails').click());
    expect(document.querySelector('[data-testid="shade-panel"]')).toBeTruthy();
    act(() => button('+ Add a sail').click());
    const shade = usePropertyStore.getState().property.shade!;
    expect(shade.enabled).toBe(true); expect(shade.sails).toHaveLength(1); expect(shade.sails[0].anchors).toHaveLength(4);
    const centreX = shade.sails[0].anchors.reduce((s, a) => s + a.x, 0) / 4, centreY = shade.sails[0].anchors.reduce((s, a) => s + a.y, 0) / 4;
    expect(centreX).toBeCloseTo(5, 6); expect(centreY).toBeCloseTo(4, 6);
    const report = document.querySelector('[data-testid="shade-report"]')!.textContent!;
    expect(report).toContain('Twisted (hypar)');
    expect(report).toContain('turnbuckles');
    expect(report).toContain('cyclone');
    expect(report).not.toMatch(/Rs|MUR|USD|€|£|\$/);
    expect(usePropertyStore.getState().property.rooms[0].polygon).toEqual([{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }]);
  });

  it('puts the first sail outside a plain house, in the garden on the north side, never inside the room', () => {
    usePropertyStore.setState({ property: { id: 'shade-test-2', name: 'Shade test', activeRoomId: 'room', rooms: [{ id: 'room', name: 'Bedroom', polygon: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }], placedItems: [], openings: [] }] } as unknown as Property });
    act(() => root.render(<ShadeWorkspace onBeforeOpen={() => {}} />));
    act(() => window.dispatchEvent(new Event('ppw:open-shade')));
    act(() => button('+ Add a sail').click());
    const anchors = usePropertyStore.getState().property.shade!.sails[0].anchors;
    expect(anchors).toHaveLength(4);
    // 1 m clear of the north wall (y = 2): every fixing point is above y = 1, so none sits inside the 2..8 × 2..6 room.
    for (const a of anchors) { expect(a.y).toBeLessThanOrEqual(1); expect(a.x).toBeGreaterThanOrEqual(2); expect(a.x).toBeLessThanOrEqual(8); }
    expect(anchors.reduce((s, a) => s + a.x, 0) / 4).toBeCloseTo(5, 6);
    expect(anchors.reduce((s, a) => s + a.y, 0) / 4).toBeCloseTo(-0.8, 6);
    expect(document.querySelector('[data-testid="shade-report"]')!.textContent).toContain('Twisted (hypar)');
  });

  it('edits a fixing point height through the table, rejects an impossible value and removes down to three points', () => {
    act(() => root.render(<ShadeWorkspace onBeforeOpen={() => {}} />));
    act(() => window.dispatchEvent(new Event('ppw:open-shade')));
    act(() => button('+ Add a sail').click());
    const height = document.querySelector<HTMLInputElement>('input[aria-label="Point 1 height"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setValue.call(height, '4.5'); height.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(usePropertyStore.getState().property.shade!.sails[0].anchors[0].heightM).toBe(4.5);
    act(() => { setValue.call(height, '40'); height.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(usePropertyStore.getState().property.shade!.sails[0].anchors[0].heightM).toBe(4.5);
    act(() => button('Remove point 4').click());
    expect(usePropertyStore.getState().property.shade!.sails[0].anchors).toHaveLength(3);
    expect(button('Remove point 1').disabled).toBe(true);
    act(() => button('+ Add a point').click());
    expect(usePropertyStore.getState().property.shade!.sails[0].anchors).toHaveLength(4);
    act(() => button('Remove this sail').click());
    expect(usePropertyStore.getState().property.shade!.sails).toHaveLength(0);
  });

  it('checks a made sail against the points and names an edge that cannot be tensioned', () => {
    act(() => root.render(<ShadeWorkspace onBeforeOpen={() => {}} />));
    act(() => window.dispatchEvent(new Event('ppw:open-shade')));
    act(() => button('+ Add a sail').click());
    const made = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    act(() => made.click());
    expect(usePropertyStore.getState().property.shade!.sails[0].made?.edgesM).toHaveLength(4);
    const edge = document.querySelector<HTMLInputElement>('input[aria-label="Edge 1 made chord"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setValue.call(edge, '2.5'); edge.dispatchEvent(new Event('input', { bubbles: true })); });
    const report = document.querySelector('[data-testid="shade-report"]')!.textContent!;
    expect(report).toContain('cannot be tensioned');
    expect(report).toContain('Edge 1');
  });
});
