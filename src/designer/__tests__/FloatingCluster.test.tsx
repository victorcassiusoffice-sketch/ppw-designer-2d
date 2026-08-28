/**
 * @vitest-environment jsdom
 *
 * FloatingCluster — flagship inline-manipulation surface (PARITY-MATRIX
 * M6 / F1). Verifies the cluster renders the 5 controls anchored on the
 * canvas (NOT a modal), and that rotate / duplicate / delete / confirm
 * drive the design store directly so rotation happens INLINE.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { FloatingCluster } from '../FloatingCluster';
import { useDesignStore } from '../../store/designStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  // Blank-canvas-on-open (2026-06-09): seed a room polygon so the inline
  // duplicate/rotate actions (which validate against the polygon) work.
  {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 12 },
      { x: 0, y: 12 },
    ]);
  }
  if (typeof localStorage !== 'undefined') localStorage.removeItem('ppw_designer_ui_v1');
  useDesignerUIStore.setState({ infoOpen: false, precision: 'full', lastPrecision: 'quarter', tool: 'hand' });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function placeAndSelect(): string {
  // Small 0.5 m flooring product placed with open space, so the duplicate
  // test can find a free offset slot.
  const id = useDesignStore.getState().addItem({
    productId: 'k1-floor-eva-kids',
    x: 0.5,
    y: 0.5,
    rotation: 0,
  });
  useDesignStore.getState().selectItem(id);
  return id;
}

function render() {
  act(() => {
    flushSync(() =>
      root.render(
        <FloatingCluster
          itemLeftPx={100}
          itemTopPx={100}
          itemWidthPx={80}
          containerW={400}
          containerH={600}
        />,
      ),
    );
  });
}

describe('FloatingCluster (flagship inline manipulation)', () => {
  it('renders nothing when no item is selected', () => {
    useDesignStore.getState().selectItem(null);
    render();
    expect(container.querySelector('[data-testid="floating-cluster"]')).toBeNull();
  });

  it('renders the cluster with rotate/duplicate/info/delete/confirm when selected', () => {
    placeAndSelect();
    render();
    expect(container.querySelector('[data-testid="floating-cluster"]')).not.toBeNull();
    for (const t of ['cluster-rotate', 'cluster-duplicate', 'cluster-info', 'cluster-delete', 'cluster-confirm']) {
      expect(container.querySelector(`[data-testid="${t}"]`)).not.toBeNull();
    }
  });

  it('is anchored ON the canvas (absolute), not a fullscreen modal', () => {
    placeAndSelect();
    render();
    const el = container.querySelector('[data-testid="floating-cluster"]') as HTMLElement;
    expect(el.className).toContain('absolute');
    expect(el.className).not.toContain('inset-0');
  });

  it('rotate button rotates the selected item INLINE (no navigation)', () => {
    const id = placeAndSelect();
    render();
    const btn = container.querySelector('[data-testid="cluster-rotate"]') as HTMLButtonElement;
    act(() => btn.click());
    const item = useDesignStore.getState().placedItems.find((i) => i.instanceId === id);
    expect(item?.rotation).toBe(90);
  });

  it('duplicate button adds a second item and selects the copy', () => {
    placeAndSelect();
    render();
    const before = useDesignStore.getState().placedItems.length;
    const btn = container.querySelector('[data-testid="cluster-duplicate"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(useDesignStore.getState().placedItems.length).toBe(before + 1);
  });

  it('info button opens the details sheet (does NOT auto-open on select)', () => {
    placeAndSelect();
    // Selecting alone must NOT open the sheet (the flagship fix).
    expect(useDesignerUIStore.getState().infoOpen).toBe(false);
    render();
    const btn = container.querySelector('[data-testid="cluster-info"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(useDesignerUIStore.getState().infoOpen).toBe(true);
  });

  it('delete button removes the selected item', () => {
    placeAndSelect();
    render();
    const btn = container.querySelector('[data-testid="cluster-delete"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(useDesignStore.getState().placedItems.length).toBe(0);
  });

  it('confirm button deselects (keeps the item)', () => {
    const id = placeAndSelect();
    render();
    const btn = container.querySelector('[data-testid="cluster-confirm"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(useDesignStore.getState().selectedInstanceId).toBeNull();
    expect(useDesignStore.getState().placedItems.find((i) => i.instanceId === id)).toBeDefined();
  });

  it('cluster buttons meet the ≥48px touch-target floor (M17)', () => {
    placeAndSelect();
    render();
    const btn = container.querySelector('[data-testid="cluster-rotate"]') as HTMLElement;
    expect(parseInt(btn.style.width, 10)).toBeGreaterThanOrEqual(48);
    expect(parseInt(btn.style.height, 10)).toBeGreaterThanOrEqual(48);
  });
});
