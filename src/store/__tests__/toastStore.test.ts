/**
 * toastStore — V4 Driver tick 35 (Polish B).
 *
 * Tests the optional `action` extension that lets PolB.3's auto-add
 * toast carry an Undo CTA without a new toast variant.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore } from '../toastStore';

describe('toastStore — base behaviour preserved', () => {
  beforeEach(() => {
    useToastStore.getState().clear();
  });

  it('push returns an id and adds the toast', () => {
    const id = useToastStore.getState().push('Hi', 'info');
    const toasts = useToastStore.getState().toasts;
    expect(id).toBeTruthy();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hi');
    expect(toasts[0].kind).toBe('info');
    expect(toasts[0].ttlMs).toBe(2400);
    expect(toasts[0].action).toBeUndefined();
  });

  it('numeric third arg still sets ttlMs (back-compat)', () => {
    useToastStore.getState().push('Slow', 'warn', 9000);
    expect(useToastStore.getState().toasts[0].ttlMs).toBe(9000);
  });

  it('dismiss removes a toast by id', () => {
    const id = useToastStore.getState().push('Bye');
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('clear empties the queue', () => {
    useToastStore.getState().push('A');
    useToastStore.getState().push('B');
    useToastStore.getState().clear();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('toastStore — options form (PolB.3)', () => {
  beforeEach(() => {
    useToastStore.getState().clear();
  });

  it('options-object form sets both ttlMs and action', () => {
    const onClick = vi.fn();
    useToastStore.getState().push('Added X to cart', 'success', {
      ttlMs: 5000,
      action: { label: 'Undo', onClick },
    });
    const t = useToastStore.getState().toasts[0];
    expect(t.ttlMs).toBe(5000);
    expect(t.action?.label).toBe('Undo');
    expect(t.action?.onClick).toBe(onClick);
  });

  it('options-object without ttlMs falls back to 2400', () => {
    useToastStore.getState().push('Tap to undo', 'info', {
      action: { label: 'Undo', onClick: () => {} },
    });
    expect(useToastStore.getState().toasts[0].ttlMs).toBe(2400);
  });

  it('the action callback is not invoked merely by pushing', () => {
    const onClick = vi.fn();
    useToastStore.getState().push('hi', 'success', {
      ttlMs: 1,
      action: { label: 'Undo', onClick },
    });
    expect(onClick).not.toHaveBeenCalled();
  });
});
