// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_KEY } from '../../i18n/AppPreferences';

const captured = vi.hoisted(() => ({ root: undefined as Root | undefined, diagnostics: vi.fn() }));
vi.mock('react-dom/client', async importOriginal => {
  const original = await importOriginal<typeof import('react-dom/client')>();
  const wrapped = (...args: Parameters<typeof createRoot>) => {
    captured.root = original.createRoot(...args);
    return captured.root;
  };
  return { ...original, createRoot: wrapped, default: { ...original, createRoot: wrapped } };
});
vi.mock('./plumbingStartup', () => ({ startPlumbingDiagnostics: captured.diagnostics }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => captured.root?.unmount()); captured.root = undefined;
  document.body.replaceChildren(); localStorage.clear();
  history.replaceState(null, '', '/'); vi.restoreAllMocks();
});

describe('isolated plumbing application', () => {
  it('renders the real chapters/preferences/form without starting FX or submitting a request', async () => {
    history.replaceState(null, '', '/pitch/plumbing?brand=ppw');
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ locale: 'en', theme: 'ocean' }));
    document.body.innerHTML = '<div id="root"></div>';
    const fetch = vi.spyOn(globalThis, 'fetch');
    await act(async () => { await import('./plumbingMain'); });
    expect(captured.diagnostics).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.uiTheme).toBe('ocean');
    expect(document.querySelector('h1')?.textContent).toContain('A clearer picture.');
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('.sales-shot img')?.getAttribute('srcset')).toContain('plumbing-workspace-384.webp');
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    act(() => tabs[1].click());
    expect(location.search).toBe('?brand=ppw');
    expect(decodeURIComponent(location.hash)).toBe('#Try the tools');
    act(() => document.querySelector<HTMLButtonElement>('.sales-start-demo')!.click());
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe('/embed/designer?scene=home&view=2d&panel=services&pitch=1');
    act(() => tabs[5].click());
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(document.querySelector('form.pitch-enquiry')).not.toBeNull();
    expect(document.querySelector('input[name="email"]')).not.toBeNull();
    expect(document.querySelector('input[name="consent"]')).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
