/** @vitest-environment jsdom */
import { act, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceFocus } from '../../hooks/useWorkspaceFocus';
import { OpeningSelectionEditor } from '../../components/OpeningSelectionEditor';
import { usePropertyStore, type Property } from '../../store/propertyStore';
import { useOpeningSelectionStore } from '../../store/openingSelectionStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, app: HTMLDivElement, opener: HTMLButtonElement;
let previousProperty: Property, previousSelection: string | null;

function WalkDialog({ id = 'walk', onKey, onExit }: { id?: string; onKey: (event: KeyboardEvent) => void; onExit: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useWorkspaceFocus(ref, onExit, { onKeyDown: onKey });
  return createPortal(<section ref={ref} role="dialog" aria-label={id} data-world-walk={id === 'walk' ? 'true' : undefined}>
    <button>Exit {id}</button><input aria-label={`${id} input`} /><button>Controls {id}</button>
  </section>, document.body);
}

function press(key: string, code: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...options });
  act(() => (document.activeElement ?? document.body).dispatchEvent(event));
  return event;
}

beforeEach(() => {
  previousProperty = usePropertyStore.getState().property;
  previousSelection = useOpeningSelectionStore.getState().selectedId;
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 100, height: 30 }] as unknown as DOMRectList);
  app = document.createElement('div'); opener = document.createElement('button');
  opener.textContent = 'Walk mode'; document.body.append(opener, app); opener.focus(); root = createRoot(app);
});
afterEach(() => {
  act(() => root.unmount()); app.remove(); opener.remove(); vi.restoreAllMocks();
  usePropertyStore.setState({ property: previousProperty }); useOpeningSelectionStore.getState().select(previousSelection);
});

describe('walk workspace keyboard ownership', () => {
  it('forwards movement, view and door keys once, while shielding background design shortcuts', () => {
    const walk = vi.fn((event: KeyboardEvent) => { if (event.code === 'ArrowUp') event.preventDefault(); });
    const canvas = vi.fn(), documentShortcut = vi.fn();
    // The designer installs its window bubble listener before opening Walk.
    window.addEventListener('keydown', canvas);
    document.addEventListener('keydown', documentShortcut);
    try {
      act(() => root.render(<WalkDialog onKey={walk} onExit={() => {}} />));
      for (const [key, code] of [['w', 'KeyW'], ['a', 'KeyA'], ['s', 'KeyS'], ['d', 'KeyD'], ['Shift', 'ShiftLeft'], ['e', 'KeyE'], ['v', 'KeyV']]) {
        const event = press(key, code);
        expect(walk).toHaveBeenLastCalledWith(event);
      }
      expect(press('ArrowUp', 'ArrowUp').defaultPrevented).toBe(true);
      press('Delete', 'Delete'); press('z', 'KeyZ', { ctrlKey: true });
      expect(walk).toHaveBeenCalledTimes(10);
      expect(canvas).not.toHaveBeenCalled(); expect(documentShortcut).not.toHaveBeenCalled();
      expect(app.hasAttribute('inert')).toBe(true);
    } finally { window.removeEventListener('keydown', canvas); document.removeEventListener('keydown', documentShortcut); }
  });

  it('Escape closes the walk, restores the launch control and releases the background keyboard listener', () => {
    const walk = vi.fn(), exit = vi.fn(), canvas = vi.fn();
    function Visit() {
      const [open, setOpen] = useState(true);
      return open ? <WalkDialog onKey={walk} onExit={() => { exit(); setOpen(false); }} /> : null;
    }
    window.addEventListener('keydown', canvas);
    try {
      act(() => root.render(<Visit />));
      const escape = press('Escape', 'Escape');
      expect(walk).toHaveBeenCalledOnce(); expect(walk).toHaveBeenCalledWith(escape);
      expect(exit).toHaveBeenCalledOnce(); expect(escape.defaultPrevented).toBe(true);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(opener);
      expect(app.hasAttribute('inert')).toBe(false); expect(opener.hasAttribute('inert')).toBe(false);
      expect(canvas).not.toHaveBeenCalled();
      press('Delete', 'Delete'); expect(canvas).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('keydown', canvas); }
  });

  it('uses the latest walk key callback without stealing focus during status rerenders', () => {
    const oldKey = vi.fn(), latestKey = vi.fn();
    act(() => root.render(<WalkDialog onKey={oldKey} onExit={() => {}} />));
    const input = document.querySelector<HTMLInputElement>('[aria-label="walk input"]')!; input.focus();
    act(() => root.render(<WalkDialog onKey={latestKey} onExit={() => {}} />));
    expect(document.activeElement).toBe(input);
    const event = press('g', 'KeyG');
    expect(event.defaultPrevented).toBe(false);
    expect(latestKey).toHaveBeenCalledWith(event); expect(oldKey).not.toHaveBeenCalled();
  });

  it('only forwards to the top modal and resumes walk ownership when that modal closes', () => {
    const walk = vi.fn(), chooser = vi.fn();
    function Visit() {
      const [nested, setNested] = useState(true);
      return <><WalkDialog onKey={walk} onExit={() => {}} />
        {nested && <WalkDialog id="nested" onKey={chooser} onExit={() => setNested(false)} />}</>;
    }
    act(() => root.render(<Visit />));
    press('w', 'KeyW'); expect(chooser).toHaveBeenCalledOnce(); expect(walk).not.toHaveBeenCalled();
    press('Escape', 'Escape'); expect(walk).not.toHaveBeenCalled();
    expect(document.querySelector('[aria-label="walk"]')?.contains(document.activeElement)).toBe(true);
    expect(app.hasAttribute('inert')).toBe(true);
    press('w', 'KeyW'); expect(walk).toHaveBeenCalledOnce();
  });

  it('shields an already selected real opening from earlier capture listeners and keeps Escape owned by Walk', () => {
    usePropertyStore.setState({ property: { id: 'focus-property', name: 'Focus test', activeRoomId: 'room', rooms: [{
      id: 'room', name: 'Room', polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], placedItems: [],
      openings: [{ id: 'selected-door', edgeIndex: 0, offsetM: 2, widthM: 1, kind: 'door', flipFacing: false, flipHand: false }],
    }] } });
    useOpeningSelectionStore.getState().select('selected-door');
    // Mount the background editor FIRST: its capture listener already exists
    // before a user clicks Walk, unlike two components mounted in one render.
    act(() => root.render(<OpeningSelectionEditor />));
    const before = JSON.stringify(usePropertyStore.getState().property), exit = vi.fn();
    act(() => root.render(<><OpeningSelectionEditor /><WalkDialog onKey={() => {}} onExit={exit} /></>));
    press('Delete', 'Delete'); press('Backspace', 'Backspace');
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
    press('Escape', 'Escape');
    expect(exit).toHaveBeenCalledOnce();
    expect(useOpeningSelectionStore.getState().selectedId).toBe('selected-door');
  });
});
