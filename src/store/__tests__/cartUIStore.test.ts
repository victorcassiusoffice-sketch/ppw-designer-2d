/**
 * cartUIStore — Polish B drawer-open state (V4 Driver tick 35).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCartUIStore } from '../cartUIStore';

describe('cartUIStore', () => {
  beforeEach(() => {
    useCartUIStore.getState().close();
  });

  it('starts closed', () => {
    expect(useCartUIStore.getState().isDrawerOpen).toBe(false);
  });

  it('open() opens', () => {
    useCartUIStore.getState().open();
    expect(useCartUIStore.getState().isDrawerOpen).toBe(true);
  });

  it('close() closes', () => {
    useCartUIStore.getState().open();
    useCartUIStore.getState().close();
    expect(useCartUIStore.getState().isDrawerOpen).toBe(false);
  });

  it('toggle() flips the state', () => {
    expect(useCartUIStore.getState().isDrawerOpen).toBe(false);
    useCartUIStore.getState().toggle();
    expect(useCartUIStore.getState().isDrawerOpen).toBe(true);
    useCartUIStore.getState().toggle();
    expect(useCartUIStore.getState().isDrawerOpen).toBe(false);
  });
});
