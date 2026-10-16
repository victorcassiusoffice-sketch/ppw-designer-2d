/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseBuildTutorial } from '../HouseBuildTutorial';
import { usePropertyStore } from '../../store/propertyStore';
import { AppPreferencesProvider, PREFERENCES_KEY } from '../../i18n/AppPreferences';
import {
  HOUSE_TUTORIAL_STEPS,
  houseTutorialStorageKey,
  readHouseTutorialProgress,
} from '../../designer/houseBuildTutorial';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const open = () => act(() => window.dispatchEvent(new Event('olb:open-house-tutorial')));
const button = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
  )!;
const click = (label: string) => act(() => button(label).click());
beforeEach(() => {
  localStorage.clear();
  usePropertyStore.getState().resetToDefault();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
const render = () =>
  act(() =>
    root.render(
      <AppPreferencesProvider>
        <HouseBuildTutorial />
      </AppPreferencesProvider>,
    ),
  );
describe('project-specific non-modal house guide', () => {
  it('saves explicit review progress, opens an existing action, and collapses without trapping the canvas', () => {
    render();
    open();
    expect(host.querySelector('[aria-modal="false"]')).not.toBeNull();
    expect(document.body.getAttribute('inert')).toBeNull();
    const id = usePropertyStore.getState().property.id;
    act(() => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
    expect(readHouseTutorialProgress(id).reviewed).toEqual(['brief']);
    const action = vi.fn();
    window.addEventListener('olb:tutorial-action', action);
    click('Open this tool ↗');
    expect((action.mock.calls[0][0] as CustomEvent).detail).toEqual({ action: 'project' });
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(host.querySelector('.house-tutorial-resume')).not.toBeNull();
    window.removeEventListener('olb:tutorial-action', action);
    open();
    click('Close guide');
    expect(host.textContent).toBe('');
    open();
    expect(host.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
  });
  it('never marks a step reviewed by launching it and keeps projects separate', () => {
    render();
    open();
    const originalId = usePropertyStore.getState().property.id;
    click('Next →');
    expect(readHouseTutorialProgress(originalId)).toEqual({ step: 1, reviewed: [] });
    act(() =>
      usePropertyStore.setState((state) => ({
        property: { ...state.property, id: 'another-project' },
      })),
    );
    expect(host.querySelector('[role=dialog]')).toBeNull();
    open();
    expect(host.querySelector('h3')!.textContent).toBe('Project brief');
    expect(readHouseTutorialProgress(originalId).step).toBe(1);
  });
  it('dismisses on Escape and outside interaction with no blocking backdrop', () => {
    render();
    open();
    act(() =>
      host
        .querySelector('h2')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(host.querySelector('[role=dialog]')).toBeNull();
    open();
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('[role=dialog]')).toBeNull();
  });
  it.each(['fr', 'es', 'zh-CN'] as const)('provides complete guided copy for %s', (locale) => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ locale, theme: 'ocean' }));
    render();
    open();
    expect(host.querySelector('h3')!.textContent).toBe(HOUSE_TUTORIAL_STEPS[0].copy[locale][0]);
    expect(
      HOUSE_TUTORIAL_STEPS.every((step) =>
        step.copy[locale].every((part) => part.trim().length > 0),
      ),
    ).toBe(true);
  });
  it('bounds corrupt progress and exposes storage failures without losing current session state', () => {
    const id = usePropertyStore.getState().property.id;
    localStorage.setItem(
      houseTutorialStorageKey(id),
      JSON.stringify({ step: 999, reviewed: ['brief', 'brief', 'unknown'] }),
    );
    expect(readHouseTutorialProgress(id)).toEqual({ step: 0, reviewed: ['brief'] });
    render();
    open();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    click('Next →');
    expect(host.querySelector('h3')!.textContent).toBe('Plan and scale');
    expect(host.textContent).toContain('Progress is temporary');
  });
});
