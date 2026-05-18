/**
 * Sims-Parity DT-17 — build-mode undo/redo (GL1.13).
 *
 * 50-step ring buffer. Op types: Place / Move / Rotate / Delete /
 * Duplicate / Multi-*. V-GAME-1 LOCKED: Ctrl+Z of a Place op removes
 * BOTH the visual item AND the auto-added cart line that fired with
 * it. The stack is SEPARATE from the tick 35 5-second cart-undo toast
 * — consumers wire the two via the `onCartLine` callback.
 *
 * Engine-agnostic — Konva Layer 1 + Babylon Layer 2 share.
 */

export const BUILD_HISTORY_RING_SIZE = 50;

export interface Vec2Mm {
  xMm: number;
  yMm: number;
}

export type BuildOp =
  | {
      kind: 'place';
      itemId: string;
      productId: string;
      at: Vec2Mm;
      rotationDeg: number;
      cartLineId?: string; // V-GAME-1: tracked for REMOVE BOTH
    }
  | {
      kind: 'move';
      itemId: string;
      from: Vec2Mm;
      to: Vec2Mm;
    }
  | {
      kind: 'rotate';
      itemId: string;
      from: number;
      to: number;
    }
  | {
      kind: 'delete';
      itemId: string;
      productId: string;
      at: Vec2Mm;
      rotationDeg: number;
      cartLineId?: string;
    }
  | {
      kind: 'duplicate';
      sourceItemId: string;
      newItemId: string;
      at: Vec2Mm;
      productId: string;
      rotationDeg: number;
      cartLineId?: string;
    }
  | {
      kind: 'multi';
      ops: BuildOp[];
    };

export interface BuildHistorySinks {
  /** Restore / remove an item in the design store. */
  placeItem: (op: Extract<BuildOp, { kind: 'place' }>) => void;
  removeItem: (itemId: string) => void;
  moveItem: (itemId: string, to: Vec2Mm) => void;
  rotateItem: (itemId: string, deg: number) => void;

  /**
   * V-GAME-1 cart-coupling: invoked on Place op undo + on Delete op
   * redo. Removes the cart line attached to the item.
   *
   * If the action is `remove`, the cart line is gone after the call;
   * `restore` adds it back. The optional `cartLineId` is the line id
   * the original Place op fired.
   */
  onCartLine: (action: 'remove' | 'restore', op: BuildOp) => void;
}

export interface BuildHistory {
  push(op: BuildOp): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): BuildOp | null;
  redo(): BuildOp | null;
  /** Test introspection. */
  inspect(): { undoCount: number; redoCount: number };
}

export function createBuildHistory(sinks: BuildHistorySinks): BuildHistory {
  const undoStack: BuildOp[] = [];
  const redoStack: BuildOp[] = [];

  function push(op: BuildOp): void {
    undoStack.push(op);
    while (undoStack.length > BUILD_HISTORY_RING_SIZE) undoStack.shift();
    redoStack.length = 0;
  }

  function applyInverse(op: BuildOp): void {
    switch (op.kind) {
      case 'place':
        // Undo Place: remove the item AND remove the cart line (V-GAME-1).
        sinks.removeItem(op.itemId);
        sinks.onCartLine('remove', op);
        return;
      case 'delete':
        // Undo Delete: put the item back AND restore the cart line.
        sinks.placeItem({
          kind: 'place',
          itemId: op.itemId,
          productId: op.productId,
          at: op.at,
          rotationDeg: op.rotationDeg,
          cartLineId: op.cartLineId,
        });
        sinks.onCartLine('restore', op);
        return;
      case 'move':
        sinks.moveItem(op.itemId, op.from);
        return;
      case 'rotate':
        sinks.rotateItem(op.itemId, op.from);
        return;
      case 'duplicate':
        // Undo Duplicate: remove the new item + its cart line.
        sinks.removeItem(op.newItemId);
        sinks.onCartLine('remove', op);
        return;
      case 'multi':
        // Apply inverses in reverse order.
        for (let i = op.ops.length - 1; i >= 0; i--) applyInverse(op.ops[i]);
        return;
    }
  }

  function applyForward(op: BuildOp): void {
    switch (op.kind) {
      case 'place':
        sinks.placeItem(op);
        sinks.onCartLine('restore', op);
        return;
      case 'delete':
        sinks.removeItem(op.itemId);
        sinks.onCartLine('remove', op);
        return;
      case 'move':
        sinks.moveItem(op.itemId, op.to);
        return;
      case 'rotate':
        sinks.rotateItem(op.itemId, op.to);
        return;
      case 'duplicate':
        sinks.placeItem({
          kind: 'place',
          itemId: op.newItemId,
          productId: op.productId,
          at: op.at,
          rotationDeg: op.rotationDeg,
          cartLineId: op.cartLineId,
        });
        sinks.onCartLine('restore', op);
        return;
      case 'multi':
        for (const sub of op.ops) applyForward(sub);
        return;
    }
  }

  return {
    push,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    undo: () => {
      const op = undoStack.pop();
      if (!op) return null;
      applyInverse(op);
      redoStack.push(op);
      return op;
    },
    redo: () => {
      const op = redoStack.pop();
      if (!op) return null;
      applyForward(op);
      undoStack.push(op);
      return op;
    },
    inspect: () => ({ undoCount: undoStack.length, redoCount: redoStack.length }),
  };
}
