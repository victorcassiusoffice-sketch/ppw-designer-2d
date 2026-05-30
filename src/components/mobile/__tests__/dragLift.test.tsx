/**
 * @vitest-environment jsdom
 *
 * useDragToPlace anti-occlusion lift (PARITY-MATRIX M2). The dragged ghost
 * is rendered above the fingertip AND the drop is reported at that lifted
 * point, so the finger never hides the object/target. We verify the
 * contract: onDrop receives clientY - DRAG_LIFT_PX.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { useDragToPlace, DRAG_LIFT_PX } from '../useDragToPlace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function Harness({ onDrop }: { onDrop: (id: string, x: number, y: number) => void }) {
  const { start, ghost } = useDragToPlace({ mode: 'immediate', onDrop });
  return (
    <div>
      <button
        data-testid="handle"
        onPointerDown={(e) => start(e, 'prod-1', '/img.png')}
      >
        grab
      </button>
      {ghost}
    </div>
  );
}

function pointer(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  const e = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(e, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: pointerId },
    button: { value: 0 },
  });
  return e;
}

describe('useDragToPlace — anti-occlusion lift (M2)', () => {
  it('exports a positive lift constant', () => {
    expect(DRAG_LIFT_PX).toBeGreaterThan(0);
  });

  it('reports the drop point lifted above the fingertip', () => {
    const onDrop = vi.fn();
    act(() => {
      flushSync(() => root.render(<Harness onDrop={onDrop} />));
    });
    const handle = container.querySelector('[data-testid="handle"]') as HTMLButtonElement;

    // Start (immediate mode arms instantly), move past threshold, release.
    act(() => {
      handle.dispatchEvent(pointer('pointerdown', 200, 300));
    });
    act(() => {
      window.dispatchEvent(pointer('pointermove', 200, 340)); // >8px → dragging
    });
    act(() => {
      window.dispatchEvent(pointer('pointerup', 200, 340));
    });

    expect(onDrop).toHaveBeenCalledTimes(1);
    const [, , droppedY] = onDrop.mock.calls[0];
    expect(droppedY).toBe(340 - DRAG_LIFT_PX);
  });
});
