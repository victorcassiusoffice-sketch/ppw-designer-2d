import { describe, it, expect } from 'vitest';
import { resolveDragTarget, rectToPolygon } from '../geometry';

// M9 (Customer-UI fix 2026-05-31) — dragging a placed item off the lot must
// be rejected and snapped back. resolveDragTarget is the predicate the
// placed-item onDragEnd uses; these lock the bounds behaviour so a partial
// off-lot AABB can never be accepted again.
describe('M9 — off-lot drag rejection (resolveDragTarget)', () => {
  // Room spans x:0..5.5 m, y:0..4 m.
  const room = rectToPolygon({ lengthM: 5.5, widthM: 4 });

  it('rejects a 1×1 item dragged so its AABB pokes past the left wall (x = -0.5 m)', () => {
    const r = resolveDragTarget({ candidateX: -0.5, candidateY: 1, w: 1, h: 1, others: [], room });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('out-of-bounds');
  });

  it('rejects a 1×1 item dragged so its AABB pokes past the right wall', () => {
    // x 5..6 with right wall at 5.5 → out of bounds.
    const r = resolveDragTarget({ candidateX: 5, candidateY: 1, w: 1, h: 1, others: [], room });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('out-of-bounds');
  });

  it('rejects a drag past the top wall (y = -0.5 m)', () => {
    const r = resolveDragTarget({ candidateX: 1, candidateY: -0.5, w: 1, h: 1, others: [], room });
    expect(r.ok).toBe(false);
  });

  it('accepts a valid in-room move and snaps it to the grid', () => {
    const r = resolveDragTarget({ candidateX: 1.1, candidateY: 1.1, w: 1, h: 1, others: [], room });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.x).toBe(1);
      expect(r.y).toBe(1);
    }
  });
});
