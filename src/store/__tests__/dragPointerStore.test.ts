import { describe, it, expect, beforeEach } from 'vitest';
import { useDragPointerStore } from '../dragPointerStore';

beforeEach(() => {
  useDragPointerStore.setState({ drag: null, drop: null, overCanvas: false });
});

describe('dragPointerStore', () => {
  it('promotes a drag to a drop on release', () => {
    const s = () => useDragPointerStore.getState();
    s().begin('p1', 10, 20);
    expect(s().drag).toEqual({ productId: 'p1', clientX: 10, clientY: 20 });

    s().move('p1', 30, 40);
    expect(s().drag).toEqual({ productId: 'p1', clientX: 30, clientY: 40 });
    expect(s().drop).toBeNull();

    s().release(false);
    expect(s().drag).toBeNull();
    expect(s().drop).toMatchObject({ productId: 'p1', clientX: 30, clientY: 40, shiftKey: false });
  });

  it('gives every drop a strictly increasing nonce', () => {
    const s = () => useDragPointerStore.getState();
    s().begin('p1', 5, 5);
    s().release(false);
    const first = s().drop!.nonce;
    s().consumeDrop();

    // Same coordinates deliberately: without a nonce a consumer effect keyed
    // on the drop object would not re-fire for an identical second drop.
    s().begin('p1', 5, 5);
    s().release(true);
    const second = s().drop!.nonce;
    expect(second).toBeGreaterThan(first);
    expect(s().drop!.shiftKey).toBe(true);
  });

  it('release without a drag in flight is a no-op', () => {
    const s = () => useDragPointerStore.getState();
    s().release(false);
    expect(s().drop).toBeNull();
  });

  it('cancel nulls both drag and drop', () => {
    const s = () => useDragPointerStore.getState();
    s().begin('p1', 1, 2);
    s().release(false);
    s().cancel();
    expect(s().drag).toBeNull();
    expect(s().drop).toBeNull();
  });

  it('consumeDrop clears only the drop', () => {
    const s = () => useDragPointerStore.getState();
    s().begin('p1', 1, 2);
    s().release(false);
    expect(s().drop).not.toBeNull();
    s().consumeDrop();
    expect(s().drop).toBeNull();
  });

  it('setOverCanvas only writes on a real change', () => {
    const s = () => useDragPointerStore.getState();
    let writes = 0;
    const unsub = useDragPointerStore.subscribe(() => { writes += 1; });
    s().setOverCanvas(false); // already false
    expect(writes).toBe(0);
    s().setOverCanvas(true);
    expect(writes).toBe(1);
    s().setOverCanvas(true); // unchanged
    expect(writes).toBe(1);
    unsub();
  });
});
