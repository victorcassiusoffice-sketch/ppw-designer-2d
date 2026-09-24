/** @vitest-environment jsdom */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomDrawHUD, type RoomDrawHUDProps } from '../RoomDrawMode';
import type { Polygon, Vertex } from '../../lib/geometry';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useDrawProgressStore } from '../../store/drawProgressStore';

vi.mock('react-konva', () => ({ Layer: () => null, Line: () => null, Circle: () => null, Group: () => null, Text: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let props: RoomDrawHUDProps;
const corners: Polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }];

function Harness() {
  const [vertices, setVertices] = useState(props.vertices);
  const [hover, setHover] = useState<Vertex | null>(props.hover);
  return <RoomDrawHUD {...props} vertices={vertices} setVertices={setVertices} hover={hover} setHover={setHover} />;
}
beforeEach(() => {
  useDesignerUIStore.setState({ precision: 'full' });
  useDrawProgressStore.getState().setContinueAfterCommit(false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  props = {
    enabled: true, vertices: corners, hover: { x: 1, y: 3 }, name: 'Studio',
    setVertices: vi.fn(), setHover: vi.fn(), setName: vi.fn(),
    onCommit: vi.fn(), onCommitWalls: vi.fn(), onCancel: vi.fn(),
  };
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
function render() { act(() => root.render(<Harness />)); }
function button(id: string) { return host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!; }
function click(id: string) { act(() => button(id).click()); }
function length(value: string) {
  const input = host.querySelector<HTMLInputElement>('[data-testid="draw-segment-length"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('reserved wall drawing dock', () => {
  it('makes a room and clears the in-progress run without keeping loose walls', () => {
    render();
    click('room-draw-close');
    expect(props.onCommit).toHaveBeenCalledWith(corners, 'Studio');
    expect(props.onCommitWalls).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="room-draw-vertices-count"]')?.textContent).toContain('0');
    expect(button('room-draw-close').disabled).toBe(true);
  });

  it('keeps an open wall run after Undo and preserves a separate Discard action', () => {
    render();
    click('room-draw-undo');
    expect(button('room-draw-close').disabled).toBe(true);
    click('room-draw-finish-walls');
    expect(props.onCommitWalls).toHaveBeenCalledWith(corners.slice(0, 2));
    expect(props.onCommit).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
    click('room-draw-cancel');
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('keeps Room + next available and requests continuation only when selected', () => {
    render();
    click('room-draw-close-continue');
    expect(props.onCommit).toHaveBeenCalledWith(corners, 'Studio');
    expect(useDrawProgressStore.getState().continueAfterCommit).toBe(true);
  });

  it('exposes phone snap and exact last-wall length without adding another vertex', () => {
    props.phone = true;
    props.vertices = corners.slice(0, 2);
    props.hover = null;
    render();
    const settings = host.querySelector<HTMLElement>('#phone-wall-draw-settings')!;
    expect(settings.hidden).toBe(true);
    expect(button('room-draw-settings').getAttribute('aria-expanded')).toBe('false');
    click('room-draw-settings');
    expect(settings.hidden).toBe(false);
    expect(button('room-draw-settings').getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelectorAll('[data-testid="snap-unit-stepper"]')).toHaveLength(1);
    click('snap-unit-finer');
    expect(useDesignerUIStore.getState().precision).toBe('quarter');
    length('2.75');
    click('draw-segment-apply');
    click('room-draw-finish-walls');
    expect(props.onCommitWalls).toHaveBeenCalledWith([{ x: 0, y: 0 }, { x: 2.75, y: 0 }]);
  });

  it('uses the last pointer direction for an exact new desktop segment', () => {
    props.vertices = corners.slice(0, 1);
    props.hover = { x: 3, y: 0 };
    render();
    length('2.5');
    click('draw-segment-apply');
    click('room-draw-finish-walls');
    expect(props.onCommitWalls).toHaveBeenCalledWith([{ x: 0, y: 0 }, { x: 2.5, y: 0 }]);
  });

  it('keeps the quick room shortcut available on an empty phone plan', () => {
    props.phone = true;
    props.vertices = [];
    props.onQuickRectangle = vi.fn();
    render();
    click('start-quick-rectangle');
    expect(props.onQuickRectangle).toHaveBeenCalledOnce();
    expect(button('room-draw-close').disabled).toBe(true);
  });
});
