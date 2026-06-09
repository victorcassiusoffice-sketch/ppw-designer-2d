/**
 * @vitest-environment jsdom
 *
 * useKeyboardShortcuts — Sims feature-finish key additions (PARITY-MATRIX
 * F2 `<`/`>` rotate detents, D18 Ctrl+Y redo, D15 Ctrl+F precision toggle,
 * D14/D11/D12 tool keys H/E/J). Existing R/D/Del/Esc/Ctrl+Z behaviour is
 * covered by placementActions + historyStore tests; this guards the new keys.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useDesignStore } from '../../store/designStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { __test, installHistorySubscriptions } from '../../store/historyStore';
import { getAllProducts } from '../../data/products';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let teardown: (() => void) | null = null;

function Harness() {
  useKeyboardShortcuts();
  return null;
}

beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  // Blank-canvas-on-open (2026-06-09): seed a room polygon so rotate/
  // duplicate (which validate against the polygon) operate on a real room.
  {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 12 },
      { x: 0, y: 12 },
    ]);
  }
  useDesignerUIStore.setState({ infoOpen: false, precision: 'full', tool: 'hand' });
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  teardown = installHistorySubscriptions({ coalesceMs: 0 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => flushSync(() => root.render(<Harness />)));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  if (teardown) { teardown(); teardown = null; }
  vi.restoreAllMocks();
});

function key(k: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }));
  });
}

function placeAndSelect(): string {
  const product = getAllProducts()[0];
  const id = useDesignStore.getState().addItem({ productId: product.id, x: 1, y: 1, rotation: 0 });
  useDesignStore.getState().selectItem(id);
  return id;
}

describe('useKeyboardShortcuts — new keys', () => {
  it('`>` rotates +90°, `<` rotates -90°', () => {
    const id = placeAndSelect();
    key('>');
    expect(useDesignStore.getState().placedItems.find((i) => i.instanceId === id)?.rotation).toBe(90);
    key('<');
    expect(useDesignStore.getState().placedItems.find((i) => i.instanceId === id)?.rotation).toBe(0);
  });

  it('Ctrl+F toggles snap precision', () => {
    expect(useDesignerUIStore.getState().precision).toBe('full');
    key('f', { ctrlKey: true });
    expect(useDesignerUIStore.getState().precision).toBe('quarter');
    key('f', { ctrlKey: true });
    expect(useDesignerUIStore.getState().precision).toBe('full');
  });

  it('E arms eyedropper, J arms sledgehammer, H/Esc return to hand', () => {
    key('e');
    expect(useDesignerUIStore.getState().tool).toBe('eyedropper');
    key('j');
    expect(useDesignerUIStore.getState().tool).toBe('sledgehammer');
    key('h');
    expect(useDesignerUIStore.getState().tool).toBe('hand');
    key('j');
    key('Escape');
    expect(useDesignerUIStore.getState().tool).toBe('hand');
  });

  it('Ctrl+Y redoes a previously undone rotation', () => {
    const id = placeAndSelect();
    key('>'); // rotate to 90
    expect(useDesignStore.getState().placedItems.find((i) => i.instanceId === id)?.rotation).toBe(90);
    key('z', { ctrlKey: true }); // undo → 0
    expect(useDesignStore.getState().placedItems.find((i) => i.instanceId === id)?.rotation).toBe(0);
    key('y', { ctrlKey: true }); // redo → 90
    expect(useDesignStore.getState().placedItems.find((i) => i.instanceId === id)?.rotation).toBe(90);
  });
});
