/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WalkMode from '../WalkMode';
import type { WalkStatus } from '../runtime';
import type { SceneSolids } from '../../designer/roomSolids';
import type { Property } from '../../store/propertyStore';

// Round-4 phone door regression: the browser delivered trusted pointer events to
// the door button and withheld the click after a look flick (docs/world/ROUNDS.md).
const mock = vi.hoisted(() => ({
  load: vi.fn(), interact: vi.fn(), dispose: vi.fn(), keyDown: vi.fn(), clearInput: vi.fn(), dragLook: vi.fn(), setStick: vi.fn(),
  onStatus: (_value: unknown) => {},
}));
vi.mock('../runtime', () => ({
  WalkRuntime: class {
    constructor(_host: unknown, _solids: unknown, _property: unknown, onStatus: (value: unknown) => void) { mock.onStatus = onStatus; }
    load() { return mock.load(); }
    interact() { return mock.interact(); }
    dispose() { mock.dispose(); }
    clearInput() { mock.clearInput(); }
    keyDown(event: KeyboardEvent) { mock.keyDown(event); }
    dragLook(dx: number, dy: number) { mock.dragLook(dx, dy); }
    setStick(x: number, y: number) { mock.setStick(x, y); }
    escape() { return false; }
  },
}));
vi.mock('../../components/three/ThreeStage', async () => {
  const React = await import('react');
  return { ThreeStage: React.forwardRef(({ onReady }: { onReady: () => void }, ref) => {
    React.useImperativeHandle(ref, () => ({ beginWalk: () => ({ release() {} }) }), []);
    React.useEffect(onReady, [onReady]);
    return <div data-testid="door-touch-scene" />;
  }) };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, frameId: number;
const frames = new Map<number, FrameRequestCallback>();
const prepareVisit = () => ({ property: { id: 'door-touch', rooms: [] } as unknown as Property, solids: {} as SceneSolids });
const status: WalkStatus = {
  mode: 'third', door: 'Open door', blocked: false, locked: false, animation: 'idle',
  position: [1, 0, 1], camera: [1, 2, 3], fps: 60, low1: 60, frames: 1, entryMs: 500,
};
const door = () => document.querySelector<HTMLButtonElement>('.world-walk-door button')!;
function pointer(type: string, init: PointerEventInit & { clientX: number; clientY: number }): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerType: 'touch', isPrimary: true, ...init });
}
function tapAt(element: Element, pointerId: number, x: number, y: number, liftX = x, liftY = y): void {
  act(() => {
    element.dispatchEvent(pointer('pointerdown', { pointerId, clientX: x, clientY: y }));
    element.dispatchEvent(pointer('pointerup', { pointerId, clientX: liftX, clientY: liftY }));
  });
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); frames.clear(); frameId = 0;
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 100, height: 30 }] as unknown as DOMRectList);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)', addEventListener() {}, removeEventListener() {},
  }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++frameId; frames.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  mock.load.mockImplementation(async () => { mock.onStatus(status); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function start(): Promise<void> {
  act(() => root.render(<WalkMode prepareVisit={prepareVisit} onClose={() => {}} />));
  act(() => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Start walk')!.click());
  for (let count = 0; count < 2; count++) {
    await act(async () => { for (const [id, frame] of [...frames]) { frames.delete(id); frame(performance.now()); } });
  }
  await act(async () => { await vi.waitFor(() => expect(mock.load).toHaveBeenCalledOnce()); });
  expect(door()).toBeTruthy();
}

describe('phone door tap without a synthesized click', () => {
  it('toggles the door once on a completed trusted touch tap and ignores the browser click that follows', async () => {
    await start();
    tapAt(door(), 29, 195, 607);
    expect(mock.interact).toHaveBeenCalledOnce();
    act(() => door().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(mock.interact).toHaveBeenCalledOnce();
  });

  it('still toggles the door on a mouse click and on keyboard activation, and not on a touch that slides off', async () => {
    await start();
    act(() => door().click());
    expect(mock.interact).toHaveBeenCalledOnce();
    tapAt(door(), 30, 195, 607, 195, 650);
    expect(mock.interact).toHaveBeenCalledOnce();
    act(() => door().dispatchEvent(pointer('pointerdown', { pointerId: 31, clientX: 195, clientY: 607, pointerType: 'mouse' })));
    act(() => door().dispatchEvent(pointer('pointerup', { pointerId: 31, clientX: 195, clientY: 607, pointerType: 'mouse' })));
    expect(mock.interact).toHaveBeenCalledOnce();
  });

  it('owns look and pad touch contacts so the browser derives no scroll or fling gesture from them', async () => {
    await start();
    for (const selector of ['.world-walk-look', '.world-walk-stick']) {
      const surface = document.querySelector(selector)!;
      for (const type of ['touchstart', 'touchmove']) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        surface.dispatchEvent(event);
        expect(event.defaultPrevented, `${selector} ${type}`).toBe(true);
      }
    }
    const doorTouch = new Event('touchstart', { bubbles: true, cancelable: true });
    door().dispatchEvent(doorTouch);
    expect(doorTouch.defaultPrevented).toBe(false);
  });
});
