/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import { GardenDrawLayer } from '../GardenDrawLayer';
import { usePropertyStore } from '../../store/propertyStore';
import { useGardenEditorStore } from '../../store/gardenEditorStore';
import { installHistorySubscriptions, useHistoryStore, __test as historyTest } from '../../store/historyStore';

type Handler = (event: Konva.KonvaEventObject<PointerEvent>) => void;
const capture = vi.hoisted(() => ({ handlers: {} as Record<string, Handler> }));
vi.mock('react-konva', () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Rect: (props: Record<string, unknown>) => {
    if (props.onPointerDown) capture.handlers = props as Record<string, Handler>;
    return <div />;
  },
  Text: ({ text }: { text: string }) => <span>{text}</span>,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let stopHistory: (() => void) | undefined;
let surfaceId: string;
const target = { getStage: () => ({ getRelativePointerPosition: () => cursor }), setPointerCapture: vi.fn(), releaseCapture: vi.fn() };
let cursor = { x: 0, y: 0 };
beforeEach(() => {
  historyTest.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  useGardenEditorStore.getState().close();
  surfaceId = usePropertyStore.getState().addGardenSurface({ kind: 'lawn', x: 6, y: 0, widthM: 2, depthM: 3, elevationM: 0 })!;
  useGardenEditorStore.getState().place({ kind: 'surface', id: surfaceId, mode: 'resize' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<GardenDrawLayer pxPerMetre={10} scale={1} />));
});
afterEach(() => { stopHistory?.(); stopHistory = undefined; act(() => root.unmount()); host.remove(); });
function pointer(name: string, x: number, y: number, isPrimary = true) {
  cursor = { x, y };
  const event = { target, evt: { pointerId: isPrimary ? 1 : 2, pointerType: 'touch', isPrimary, button: 0 }, cancelBubble: false } as unknown as Konva.KonvaEventObject<PointerEvent>;
  act(() => capture.handlers[name](event));
}

describe('plan garden drawing', () => {
  it('previews a rectangle without changing the plan, then records one undoable resize', () => {
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    stopHistory = installHistorySubscriptions({ coalesceMs: 0 });
    pointer('onPointerDown', 60, 80); pointer('onPointerMove', 10, 20);
    expect(host.textContent).toContain('5.0 × 6.0 m');
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    pointer('onPointerUp', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toMatchObject({ x: 1, y: 2, widthM: 5, depthM: 6 });
    expect(useGardenEditorStore.getState().placement).toBeNull();
    expect(useHistoryStore.getState().past).toHaveLength(1);
    act(() => useHistoryStore.getState().undo());
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
  });
  it('does not commit after pointer cancellation or a second touch', () => {
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    pointer('onPointerDown', 60, 80); pointer('onPointerMove', 10, 20);
    pointer('onPointerCancel', 10, 20); pointer('onPointerUp', 10, 20);
    expect(host.textContent).toBe('');
    pointer('onPointerDown', 60, 80); pointer('onPointerMove', 10, 20);
    pointer('onPointerDown', 50, 50, false); pointer('onPointerUp', 10, 20);
    expect(host.textContent).toBe('');
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
  });
  it('clears the anchor when a placement is replaced, so an old release cannot move another surface', () => {
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    pointer('onPointerDown', 60, 80); pointer('onPointerMove', 10, 20);
    act(() => useGardenEditorStore.getState().place({ kind: 'surface', id: surfaceId }));
    pointer('onPointerUp', 10, 20);
    expect(host.textContent).toBe('');
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
  });
});
