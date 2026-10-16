/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityNumber } from '../CityWorkspace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const change = vi.fn();
function render(value?: number) {
  act(() => root.render(<CityNumber label="Rated load (W)" value={value} onChange={change} />));
}
function blur() {
  act(() =>
    host.querySelector('input')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
  );
}
function type(value: string) {
  const input = host.querySelector('input')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
beforeEach(() => {
  change.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
describe('optional city ratings', () => {
  it('leaves an unconfirmed rating missing when the field loses focus', () => {
    render();
    expect(host.querySelector('input')!.value).toBe('');
    blur();
    expect(change).not.toHaveBeenCalled();
  });
  it('accepts an explicitly entered zero separately from a missing rating', () => {
    render();
    type('0');
    blur();
    expect(change).toHaveBeenCalledWith(0);
  });
  it('does not commit an unchanged value or a cleared required value', () => {
    render(120);
    blur();
    type('');
    blur();
    expect(change).not.toHaveBeenCalled();
    expect(host.querySelector('input')!.value).toBe('120');
  });
  it('restores the accepted value when cross-field model validation rejects an edit', () => {
    change.mockReturnValue(false);
    render(100);
    type('1000');
    blur();
    expect(change).toHaveBeenCalledWith(1000);
    expect(host.querySelector('input')!.value).toBe('100');
  });
  it('keeps an optional rating unconfirmed when its proposed value is rejected', () => {
    change.mockReturnValue(false);
    render();
    type('5');
    blur();
    expect(host.querySelector('input')!.value).toBe('');
  });
});
