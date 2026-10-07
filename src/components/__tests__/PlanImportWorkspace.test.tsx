/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PlanImportWorkspace } from '../PlanImportWorkspace';
import { normaliseLoadedProperty, usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore } from '../../store/designsStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useHistoryStore } from '../../store/historyStore';
import { switchToPage } from '../../lib/pages';
import { createGuidedDesign } from '../../designer/aiDesignContract';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const beforeOpen = vi.fn();
const click = (text: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button, text).toBeDefined();
  act(() => button!.click());
};
const open = () => act(() => window.dispatchEvent(new Event('ppw:open-plan-import')));
const ack = () =>
  act(() => document.querySelector<HTMLInputElement>('.plan-import-ack input')!.click());
async function file(value: { name: string; size: number; text: () => Promise<string> }) {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [value], configurable: true });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}
beforeEach(() => {
  localStorage.clear();
  usePropertyStore.getState().resetToDefault();
  useDesignsStore.setState({ designs: {}, currentId: null });
  useHistoryStore.getState().reset();
  usePropertyStore.getState().renameProperty('Existing measured house');
  usePropertyStore.getState().setRoomPolygon(usePropertyStore.getState().property.activeRoomId, [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 5 },
    { x: 0, y: 5 },
  ]);
  useDesignerUIStore.getState().setViewMode('3d');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<PlanImportWorkspace onBeforeOpen={beforeOpen} />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

describe('review-and-apply plan import', () => {
  it('opens a fullscreen local review and Escape returns without changing the canvas', () => {
    const previous = usePropertyStore.getState().property;
    open();
    expect(host.hasAttribute('inert')).toBe(true);
    click('Try an example');
    expect(beforeOpen).toHaveBeenCalled();
    expect(document.querySelector('[aria-label="Imported geometry preview"]')).not.toBeNull();
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes('Add as a new plan'),
      )?.disabled,
    ).toBe(true);
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(host.hasAttribute('inert')).toBe(false);
    expect(usePropertyStore.getState().property).toBe(previous);
  });
  it('adds two floors as an editable new page and preserves the previous unsaved drawing', () => {
    const previous = structuredClone(usePropertyStore.getState().property);
    open();
    click('Try an example');
    ack();
    click('Add as a new plan →');
    const property = usePropertyStore.getState().property;
    expect(property.name).toBe('Two-storey example');
    expect(property.rooms.filter((r) => r.polygon.length >= 3)).toHaveLength(3);
    expect(property.levels?.filter((l) => l.kind !== 'roof')).toHaveLength(2);
    expect(property.rooms[0].polygon[1].x).toBe(5);
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
    expect(useHistoryStore.getState().past).toEqual([]);
    const saved = useDesignsStore
      .getState()
      .list()
      .find((p) => p.property.id === previous.id);
    expect(saved).toBeDefined();
    act(() => {
      switchToPage(saved!.id);
    });
    expect(usePropertyStore.getState().property.rooms).toEqual(
      normaliseLoadedProperty(previous).rooms,
    );
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('requires renewed acknowledgement after the scale or layer choice changes', () => {
    open();
    click('Try an example');
    ack();
    const select = document.querySelector<HTMLSelectElement>('.plan-import-settings-card select')!;
    act(() => {
      select.value = 'cm';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.querySelector<HTMLInputElement>('.plan-import-ack input')?.checked).toBe(false);
    expect(document.querySelector('.plan-import-facts')?.textContent).toContain('5200.0 m²');
  });
  it('invalidates an existing review when an unsupported or oversized file is chosen', async () => {
    open();
    click('Try an example');
    ack();
    await file({ name: 'house.rvt', size: 12, text: vi.fn() });
    expect(document.querySelector('[role=alert]')?.textContent).toContain('not supported');
    expect(document.querySelector('.plan-import-ack')).toBeNull();
    await file({ name: 'huge.dxf', size: 2_000_001, text: vi.fn() });
    expect(document.querySelector('[role=alert]')?.textContent).toContain('2 MB');
    expect(usePropertyStore.getState().property.name).toBe('Existing measured house');
  });
  it('accepts validated Designer draft JSON and rejects arbitrary property JSON', async () => {
    open();
    await file({
      name: 'proposal.json',
      size: 100,
      text: async () => JSON.stringify(createGuidedDesign({ bedrooms: 1 })),
    });
    expect(document.querySelector('[role=alert]')).toBeNull();
    expect(document.querySelector('.plan-import-ack')).not.toBeNull();
    await file({
      name: 'random.json',
      size: 100,
      text: async () => JSON.stringify({ rooms: [], id: 'unvalidated' }),
    });
    expect(document.querySelector('[role=alert]')?.textContent).toContain('Designer draft JSON');
    expect(document.querySelector('.plan-import-ack')).toBeNull();
  });
  it('does not let an older asynchronous upload replace the newer example', async () => {
    open();
    let resolve!: (text: string) => void;
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', {
      value: [
        {
          name: 'old.svg',
          size: 20,
          text: () =>
            new Promise<string>((done) => {
              resolve = done;
            }),
        },
      ],
      configurable: true,
    });
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    click('Try an example');
    await act(async () =>
      resolve('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>'),
    );
    expect(document.querySelector('.plan-import-review-heading h2')?.textContent).toBe(
      'Two-storey example',
    );
  });
  it('captures canvas shortcuts and closes when another workspace opens', () => {
    open();
    const behind = vi.fn();
    window.addEventListener('keydown', behind);
    try {
      act(() =>
        document
          .querySelector<HTMLButtonElement>('[aria-label="Back to designer"]')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })),
      );
      expect(behind).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', behind);
    }
    act(() => window.dispatchEvent(new Event('ppw:open-services')));
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
