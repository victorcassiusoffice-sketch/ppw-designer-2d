/**
 * designerUIStore — Sims feature-finish UI state (PARITY-MATRIX D15/M13,
 * tools D11/D12/D14, flagship info-sheet gating).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDesignerUIStore,
  PRECISION_STEP_M,
  currentSnapStepM,
} from '../designerUIStore';

beforeEach(() => {
  useDesignerUIStore.setState({ infoOpen: false, precision: 'full', tool: 'hand' });
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
});
