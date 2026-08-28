/**
 * designerUIStore — Sims feature-finish UI state (PARITY-MATRIX D15/M13,
 * tools D11/D12/D14, flagship info-sheet gating).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDesignerUIStore,
  PRECISION_STEP_M,
  SNAP_UNIT_ORDER,
  SNAP_UNIT_LABEL,
  currentSnapStepM,
  currentSnapStepMm,
} from '../designerUIStore';

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.removeItem('ppw_designer_ui_v1');
  useDesignerUIStore.setState({ infoOpen: false, precision: 'full', lastPrecision: 'quarter', tool: 'hand' });
});

describe('designerUIStore', () => {
  it('defaults: info closed, full precision, hand tool', () => {
    const s = useDesignerUIStore.getState();
    expect(s.infoOpen).toBe(false);
    expect(s.precision).toBe('full');
    expect(s.tool).toBe('hand');
  });

  it('togglePrecision flips full ↔ quarter', () => {
    useDesignerUIStore.getState().togglePrecision();
    expect(useDesignerUIStore.getState().precision).toBe('quarter');
    useDesignerUIStore.getState().togglePrecision();
    expect(useDesignerUIStore.getState().precision).toBe('full');
  });

  it('precision steps are 0.5 m (full) and 0.25 m (quarter)', () => {
    expect(PRECISION_STEP_M.full).toBe(0.5);
    expect(PRECISION_STEP_M.quarter).toBe(0.25);
  });

  it('currentSnapStepM reflects the active precision', () => {
    expect(currentSnapStepM()).toBe(0.5);
    useDesignerUIStore.getState().setPrecision('quarter');
    expect(currentSnapStepM()).toBe(0.25);
  });

  it('setTool switches build tool', () => {
    useDesignerUIStore.getState().setTool('eyedropper');
    expect(useDesignerUIStore.getState().tool).toBe('eyedropper');
    useDesignerUIStore.getState().setTool('sledgehammer');
    expect(useDesignerUIStore.getState().tool).toBe('sledgehammer');
  });

  it('resetTransient clears info + returns to hand tool', () => {
    useDesignerUIStore.setState({ infoOpen: true, tool: 'sledgehammer' });
    useDesignerUIStore.getState().resetTransient();
    const s = useDesignerUIStore.getState();
    expect(s.infoOpen).toBe(false);
    expect(s.tool).toBe('hand');
  });
// ---- units brief 2026-08-28 (D1/D2) ----

  it('the ladder is six units, coarse-to-fine order, default unchanged', () => {
    expect(SNAP_UNIT_ORDER).toEqual(['cm1', 'cm10', 'quarter', 'full', 'm1', 'm10']);
    expect(PRECISION_STEP_M.cm1).toBe(0.01);
    expect(PRECISION_STEP_M.cm10).toBe(0.1);
    expect(PRECISION_STEP_M.m1).toBe(1);
    expect(PRECISION_STEP_M.m10).toBe(10);
    // V-GAME-3: 0.5 m stays the default for anyone who never picks a unit.
    expect(useDesignerUIStore.getState().precision).toBe('full');
  });

  it('every step is a whole number of millimetres', () => {
    // Load-bearing: wallStore.detectClosedRoomVertices matches endpoints by
    // exact `${x_mm},${y_mm}` string equality, so a fractional-mm step would
    // silently stop closing rooms rather than throwing.
    for (const u of SNAP_UNIT_ORDER) {
      const mm = PRECISION_STEP_M[u] * 1000;
      expect(Math.abs(mm - Math.round(mm))).toBeLessThan(1e-9);
    }
  });

  it('every unit has an explicit label', () => {
    for (const u of SNAP_UNIT_ORDER) {
      expect(SNAP_UNIT_LABEL[u]).toBeTruthy();
    }
    // Explicit, never derived - 0.25 must not render as "25 cm" anywhere.
    expect(SNAP_UNIT_LABEL.quarter).toBe('0.25 m');
    expect(SNAP_UNIT_LABEL.cm1).toBe('1 cm');
  });

  it('togglePrecision is an A/B swap against lastPrecision, not a cycle', () => {
    useDesignerUIStore.getState().setPrecision('cm1');
    expect(useDesignerUIStore.getState().lastPrecision).toBe('full');
    useDesignerUIStore.getState().togglePrecision();
    expect(useDesignerUIStore.getState().precision).toBe('full');
    useDesignerUIStore.getState().togglePrecision();
    expect(useDesignerUIStore.getState().precision).toBe('cm1');
  });

  it('setPrecision to the current unit is a no-op and does not poison the pair', () => {
    useDesignerUIStore.getState().setPrecision('full');
    expect(useDesignerUIStore.getState().lastPrecision).toBe('quarter');
    useDesignerUIStore.getState().togglePrecision();
    expect(useDesignerUIStore.getState().precision).toBe('quarter');
  });

  it('currentSnapStepMm mirrors the metre step in whole mm', () => {
    useDesignerUIStore.getState().setPrecision('cm1');
    expect(currentSnapStepMm()).toBe(10);
    useDesignerUIStore.getState().setPrecision('m10');
    expect(currentSnapStepMm()).toBe(10000);
  });
});
