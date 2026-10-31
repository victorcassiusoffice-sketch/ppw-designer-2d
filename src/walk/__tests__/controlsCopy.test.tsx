/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WalkMode from '../WalkMode';
import type { WalkStatus } from '../runtime';
import type { SceneSolids } from '../../designer/roomSolids';
import type { Property } from '../../store/propertyStore';

const mock = vi.hoisted(() => ({
  load: vi.fn(), interact: vi.fn(), dispose: vi.fn(), keyDown: vi.fn(), clearInput: vi.fn(),
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
    escape() { return false; }
  },
}));
vi.mock('../../components/three/ThreeStage', async () => {
  const React = await import('react');
  return { ThreeStage: React.forwardRef(({ onReady }: { onReady: () => void }, ref) => {
    React.useImperativeHandle(ref, () => ({ beginWalk: () => ({ release() {} }) }), []);
    React.useEffect(onReady, [onReady]);
    return <div data-testid="copy-test-scene" />;
  }) };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, frameId: number, coarse: boolean;
const frames = new Map<number, FrameRequestCallback>();
const pointerListeners = new Set<() => void>();
const prepareVisit = () => ({ property: { id: 'controls-copy', rooms: [] } as unknown as Property, solids: {} as SceneSolids });
const status: WalkStatus = {
  mode: 'third', door: 'Open door', blocked: false, locked: false, animation: 'idle',
  position: [1, 0, 1], camera: [1, 2, 3], fps: 60, low1: 60, frames: 1, entryMs: 500,
};
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
  .find((element) => element.getAttribute('aria-label') === name || element.textContent === name)!;

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); frames.clear(); pointerListeners.clear(); frameId = 0; coarse = false;
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 100, height: 30 }] as unknown as DOMRectList);
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query === '(pointer: coarse)' ? coarse : !coarse; },
    addEventListener(_event: string, listener: () => void) { pointerListeners.add(listener); },
    removeEventListener(_event: string, listener: () => void) { pointerListeners.delete(listener); },
  }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId; frames.set(id, callback); return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  mock.load.mockImplementation(async () => { mock.onStatus(status); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function changePointer(touch: boolean) {
  act(() => { coarse = touch; for (const listener of pointerListeners) listener(); });
}
async function start(onClose = vi.fn()) {
  act(() => root.render(<WalkMode prepareVisit={prepareVisit} onClose={onClose} />));
  act(() => button('Start walk').click());
  for (let count = 0; count < 2; count++) {
    await act(async () => {
      for (const [id, frame] of [...frames]) { frames.delete(id); frame(performance.now()); }
    });
  }
  await act(async () => { await vi.waitFor(() => expect(mock.load).toHaveBeenCalledOnce()); });
}

describe('Walk controls copy follows the primary input while keeping hybrid help', () => {
  it('leads the touch chooser with actual pad/drag/tap/Exit guidance and makes no timed promise', () => {
    coarse = true;
    act(() => root.render(<WalkMode prepareVisit={prepareVisit} onClose={() => {}} />));
    const card = document.querySelector('.world-walk-controls-card')!;
    expect(card.querySelector('strong')?.textContent).toBe('How to walk');
    expect(card.querySelector('p')?.textContent).toMatch(/^Touch:.*pad.*Drag.*Tap a door.*Tap Exit walk/);
    expect(card.textContent).toContain('Keyboard and mouse:');
    expect(card.textContent).toContain('Esc frees the mouse');
    expect(document.body.textContent).not.toMatch(/ten seconds|10 seconds/i);
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('keeps touch door and Exit actions intact, without a keyboard badge or keyboard-only persistent hint', async () => {
    coarse = true;
    const close = vi.fn();
    await start(close);
    const door = button('Open door');
    expect(door.getAttribute('aria-label')).toBe('Open door');
    expect(door.querySelector('kbd')).toBeNull();
    act(() => door.click());
    expect(mock.interact).toHaveBeenCalledOnce();
    const hint = document.querySelector('.world-walk-hint')!.textContent!;
    expect(hint).toContain('Pad: move + turn');
    expect(hint).toContain('Drag: look'); expect(hint).toContain('Tap doors'); expect(hint).toContain('Exit walk');
    expect(hint).not.toMatch(/Esc|E doors|V view|Click/);
    act(() => button('Controls').click());
    const help = document.querySelector('.world-walk-help')!;
    expect(help.querySelector('p')?.textContent).toMatch(/^Touch:/);
    expect(help.textContent).toContain('Keyboard and mouse:');
    expect(help.textContent).toContain('V to switch view'); expect(help.textContent).toContain('E for doors');
    act(() => button('Got it').click());
    const shortcut = new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true });
    act(() => window.dispatchEvent(shortcut));
    expect(mock.keyDown).toHaveBeenCalledWith(shortcut);
    act(() => document.querySelector<HTMLButtonElement>('.world-walk-exit')!.click());
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps desktop shortcuts visible and updates help order and badges when a hybrid device changes its primary pointer', async () => {
    await start();
    const desktopHint = document.querySelector('.world-walk-hint')!.textContent!;
    expect(desktopHint).toContain('Click or drag'); expect(desktopHint).toContain('E doors');
    expect(desktopHint).toContain('V view'); expect(desktopHint).toContain('Esc exits');
    expect(button('Open door').querySelector('kbd')?.textContent).toBe('E');
    expect(button('Open door').querySelector('kbd')?.getAttribute('aria-hidden')).toBe('true');
    act(() => button('Controls').click());
    expect(document.querySelector('.world-walk-help p')?.textContent).toMatch(/^Keyboard and mouse:/);
    changePointer(true);
    expect(document.querySelector('.world-walk-help p')?.textContent).toMatch(/^Touch:/);
    expect(button('Open door').querySelector('kbd')).toBeNull();
    changePointer(false);
    expect(document.querySelector('.world-walk-help p')?.textContent).toMatch(/^Keyboard and mouse:/);
    expect(button('Open door').querySelector('kbd')?.textContent).toBe('E');
    act(() => root.render(null));
    expect(pointerListeners.size).toBe(0);
  });
});
