/**
 * Sims-Parity DT-17 — build-mode undo/redo tests.
 *
 * Critical contract: V-GAME-1 REMOVE BOTH — Place op undo removes
 * BOTH the item and the cart line that fired with it.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  BUILD_HISTORY_RING_SIZE,
  createBuildHistory,
  type BuildHistorySinks,
  type BuildOp,
} from '../useBuildHistory';

function sinks(): BuildHistorySinks & { calls: Array<unknown> } {
  const calls: Array<unknown> = [];
  return {
    calls,
    placeItem: vi.fn((op) => { calls.push(['placeItem', op]); }),
    removeItem: vi.fn((id) => { calls.push(['removeItem', id]); }),
    moveItem: vi.fn((id, to) => { calls.push(['moveItem', id, to]); }),
    rotateItem: vi.fn((id, deg) => { calls.push(['rotateItem', id, deg]); }),
    onCartLine: vi.fn((action, op) => { calls.push(['onCartLine', action, (op as BuildOp).kind]); }),
  };
}

describe('DT-17 / useBuildHistory', () => {
  it('Place + Ctrl+Z removes item AND removes cart line (V-GAME-1)', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    const op: BuildOp = {
      kind: 'place',
      itemId: 'item-1',
      productId: 'prod-1',
      at: { xMm: 1000, yMm: 1000 },
      rotationDeg: 0,
      cartLineId: 'cart-1',
    };
    h.push(op);
    h.undo();
    expect(s.calls).toEqual([
      ['removeItem', 'item-1'],
      ['onCartLine', 'remove', 'place'],
    ]);
  });

  it('Place + Ctrl+Z + Ctrl+Y restores item AND restores cart line', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    h.push({
      kind: 'place', itemId: 'item-1', productId: 'p', at: { xMm: 0, yMm: 0 }, rotationDeg: 0, cartLineId: 'cart-1',
    });
    h.undo();
    s.calls.length = 0;
    h.redo();
    expect(s.calls[0]).toEqual(['placeItem', expect.objectContaining({ kind: 'place', itemId: 'item-1' })]);
    expect(s.calls[1]).toEqual(['onCartLine', 'restore', 'place']);
  });

  it('Delete op undo restores the item + cart line', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    h.push({
      kind: 'delete', itemId: 'item-3', productId: 'p3', at: { xMm: 0, yMm: 0 }, rotationDeg: 90, cartLineId: 'cart-3',
    });
    h.undo();
    expect(s.calls[0]).toEqual(['placeItem', expect.objectContaining({ itemId: 'item-3' })]);
    expect(s.calls[1]).toEqual(['onCartLine', 'restore', 'delete']);
  });

  it('Move op undo restores prior position', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    h.push({ kind: 'move', itemId: 'x', from: { xMm: 100, yMm: 100 }, to: { xMm: 200, yMm: 200 } });
    h.undo();
    expect(s.calls).toEqual([['moveItem', 'x', { xMm: 100, yMm: 100 }]]);
  });

  it('Rotate op undo restores prior rotation', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    h.push({ kind: 'rotate', itemId: 'x', from: 0, to: 90 });
    h.undo();
    expect(s.calls).toEqual([['rotateItem', 'x', 0]]);
  });

  it('Multi op undoes child ops in reverse order', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    h.push({
      kind: 'multi',
      ops: [
        { kind: 'place', itemId: 'a', productId: 'p', at: { xMm: 0, yMm: 0 }, rotationDeg: 0 },
        { kind: 'place', itemId: 'b', productId: 'p', at: { xMm: 1, yMm: 1 }, rotationDeg: 0 },
      ],
    });
    h.undo();
    // Reverse order — 'b' should be removed before 'a'.
    expect(s.calls[0]).toEqual(['removeItem', 'b']);
    expect(s.calls[2]).toEqual(['removeItem', 'a']);
  });

  it('canUndo / canRedo flags update correctly', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    h.push({ kind: 'move', itemId: 'x', from: { xMm: 0, yMm: 0 }, to: { xMm: 1, yMm: 1 } });
    expect(h.canUndo()).toBe(true);
    h.undo();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
    h.redo();
    expect(h.canRedo()).toBe(false);
  });

  it('push clears the redo stack', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    h.push({ kind: 'move', itemId: 'x', from: { xMm: 0, yMm: 0 }, to: { xMm: 1, yMm: 1 } });
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.push({ kind: 'rotate', itemId: 'x', from: 0, to: 90 });
    expect(h.canRedo()).toBe(false);
  });

  it('honours the 50-step ring', () => {
    const s = sinks();
    const h = createBuildHistory(s);
    for (let i = 0; i < BUILD_HISTORY_RING_SIZE + 10; i++) {
      h.push({ kind: 'rotate', itemId: `i${i}`, from: 0, to: 90 });
    }
    expect(h.inspect().undoCount).toBe(BUILD_HISTORY_RING_SIZE);
  });
});
