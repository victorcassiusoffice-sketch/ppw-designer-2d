// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WallSurfaceOptions } from '../WallSurfaceOptions';
import { WallDimensionsControl } from '../WallDimensionsControl';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
let container: HTMLDivElement; let root: Root;
beforeEach(() => { usePropertyStore.getState().resetToDefault(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const clickText = (label: string) => act(() => [...container.querySelectorAll('button')].find(b => b.textContent === label)!.click());
describe('wall surface controls keep application and quantities connected', () => {
  it('arms the shared brush and dismisses masonry choice, but leaves glass specification editable', () => {
    const dismiss = vi.fn();
    act(() => root.render(<WallSurfaceOptions materialsOnly onChooseMaterial={dismiss} />));
    clickText('Exposed brick');
    expect(useDesignerUIStore.getState().tool).toBe('wallpaint');
    expect(useDesignerUIStore.getState().wallPaintDraft.construction).toBe('brick');
    expect(dismiss).toHaveBeenCalledTimes(1);
    clickText('Glass');
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Glass thickness (mm)');
  });
  it('writes accepted thickness to Materials and rejects invalid input without losing the old value', () => {
    act(() => root.render(<WallDimensionsControl />)); clickText('Height & thickness');
    let input = container.querySelector('input[aria-label="Masonry wall thickness in millimetres"]') as HTMLInputElement;
    act(() => { input.value = '250'; input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(usePropertyStore.getState().property.materials?.wall.thicknessM).toBe(.25);
    input = container.querySelector('input[aria-label="Masonry wall thickness in millimetres"]') as HTMLInputElement;
    act(() => { input.value = '0'; input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(input.value).toBe('250');
    expect(container.textContent).toContain('previous thickness was kept');
    act(() => (container.querySelector('[data-testid="paint-wall-height-up"]') as HTMLButtonElement).click());
    expect(usePropertyStore.getState().property.wallHeightM).toBe(2.8);
  });
});
