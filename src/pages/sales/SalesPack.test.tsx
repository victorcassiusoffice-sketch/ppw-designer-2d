/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlumbingPitchPage from './PlumbingPitchPage';
import EmployeeStarterPage from './EmployeeStarterPage';
import { handbook, PACK_LINKS } from './salesPack';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
const click = (node: HTMLElement) => act(() => node.click());
function button(label: string) {
  const node = [...host.querySelectorAll<HTMLButtonElement>('button')].find((el) =>
    el.textContent?.includes(label),
  );
  if (!node) throw new Error(label);
  return node;
}
describe('sales enablement journeys', () => {
  it('loads the real services embed only on request and keeps practice on a read-only route', () => {
    act(() => root.render(<PlumbingPitchPage />));
    expect(host.querySelector('iframe')).toBeNull();
    click(button('Try the tools'));
    click(button('Launch interactive'));
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe(
      '/embed/designer?scene=home&view=2d&panel=services&pitch=1',
    );
    expect(host.textContent).toContain('No orders or payments');
  });
  it('supports keyboard chapter navigation and restores a chapter with spaces after reload', () => {
    window.history.replaceState(null, '', '/pitch/plumbing#Work%20together');
    act(() => root.render(<PlumbingPitchPage />));
    expect(host.textContent).toContain('A shared project brief');
    const selected = host.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')!;
    act(() => selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(host.textContent).toContain('Your first');
    expect(document.activeElement).toBe(host.querySelector('#sales-tab-5'));
  });
  it('allows exercises to be checked and unchecked without changing the practice plan', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    act(() => root.render(<EmployeeStarterPage />));
    click(button('Demo lab'));
    click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!);
    expect(host.textContent).toContain('1 / 6 self-checked');
    click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!);
    expect(host.textContent).toContain('0 / 6 self-checked');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the deployment origin in the handbook and labels automation limitations', () => {
    const text = handbook('https://preview.example');
    for (const entry of PACK_LINKS) expect(text).toContain(`https://preview.example${entry.path}`);
    expect(text).toContain('John Lewis is a prospect example');
    expect(text).toContain('Do not claim live co-editing');
    expect(text).not.toContain('localhost');
    expect(text).not.toContain('[meeting link]');
  });
  it('keeps all employee practice links on demonstration routes', () => {
    act(() => root.render(<EmployeeStarterPage />));
    click(button('All links'));
    expect(host.querySelector('a[href="/checkout"]')).toBeNull();
    expect(host.querySelector('a[href="/designer"]')).toBeNull();
    expect([...host.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toContain(
      '/demo?view=2d&panel=services&pitch=1',
    );
  });
});
