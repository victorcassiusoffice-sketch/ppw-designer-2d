/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlumbingPitchPage from './PlumbingPitchPage';
import EmployeeStarterPage from './EmployeeStarterPage';
import { EXERCISES, handbook, PACK_LINKS } from './salesPack';

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
    expect(host.textContent).toContain('linked endpoints follow it');
    expect(host.textContent).toContain('surveyed elevations');
    expect(host.textContent).toContain('2D plan or 3D edit');
    expect(host.textContent).toContain('Crossing lines alone do not create a junction');
    expect(host.textContent).toContain('not a hydraulic simulation');
  });
  it('links the supported services, foundation and guide entry points with their review limits', () => {
    act(() => root.render(<PlumbingPitchPage />));
    click(button('Your website'));
    expect(host.textContent).toContain('3D route editing');
    expect(host.textContent).toContain('without deleting objects');
    expect([...host.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toContain(
      '/demo?view=3d&panel=services&pitch=1',
    );
    expect(host.textContent).not.toContain('dedicated 2D workspace');
    click(button('Work together'));
    expect(host.textContent).toContain('diameter and depth');
    expect(host.textContent).toContain('totals are withheld for review');
    expect(host.textContent).toContain('not a pile design or excavation method');
    expect([...host.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toContain(
      '/demo?view=2d&panel=foundation&pitch=1',
    );
    expect(
      [...host.querySelectorAll('a')].find(
        (a) => a.getAttribute('href') === '/demo?view=2d&pitch=1',
      )?.textContent,
    ).toContain('House guide');
    expect(host.textContent).toContain('does not automatically share edits');
    expect(host.querySelector('a[href="/checkout"]')).toBeNull();
  });
  it('distinguishes supplier references and dimensional illustrations from available stock and CAD', () => {
    act(() => root.render(<PlumbingPitchPage />));
    click(button('Your catalogue'));
    expect(host.textContent).toContain('not manufacturer CAD');
    expect(host.textContent).toContain('do not confirm Mauritius availability');
    expect(host.textContent).toContain('not automatically build a plumbing');
    expect(host.textContent).toContain('do not indicate a supplier partnership');
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
    expect(host.textContent).toContain(`1 / ${EXERCISES.length} self-checked`);
    click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!);
    expect(host.textContent).toContain(`0 / ${EXERCISES.length} self-checked`);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the deployment origin in the handbook and labels automation limitations', () => {
    const text = handbook('https://preview.example');
    for (const entry of PACK_LINKS) expect(text).toContain(`https://preview.example${entry.path}`);
    expect(text).toContain('John Lewis is a prospect example');
    expect(text).toContain('Do not claim live co-editing');
    expect(text).not.toContain('localhost');
    expect(text).not.toContain('[meeting link]');
    expect(text).toContain('quantity planning, not foundation approval');
    expect(text).toContain('Two coats double raw demand, not necessarily the number of tins');
    expect(text).toContain('one published dimensional envelope in 2D and 3D');
    expect(text).toContain('links follow fixture moves and rotation');
    expect(text).toContain('9 October 2026');
    expect(text).toContain('Add concrete');
    expect(text).toContain('UBP / Premix');
    expect(text).toContain('shared edges need no redraw');
    expect(text).toContain('quote-required items are not free');
    for (const exercise of EXERCISES.filter(({ path }) => path.startsWith('/demo'))) {
      expect(new URL(exercise.path, 'https://preview.example').searchParams.get('pitch')).toBe('1');
    }
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
