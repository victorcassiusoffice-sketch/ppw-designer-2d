/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from '../TopBar';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePropertyStore } from '../../store/propertyStore';

vi.mock('../RoomView3D', () => ({ RoomView3D: ({ brushStrip }: { brushStrip?: ReactNode }) => <div>{brushStrip}</div> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {} }));
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.setState({ viewMode: 'plan', tool: 'hand' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('rooms trigger accessible name', () => {
  it.each(['Demo', 'Home · west wing'])('contains either responsive visible label verbatim for %s', name => {
    const property = usePropertyStore.getState().property;
    usePropertyStore.setState({ property: { ...property, name } });
    const open = vi.fn();
    act(() => root.render(<MemoryRouter><TopBar drawMode={false} setDrawMode={vi.fn()} roomsMenuOpen={false} setRoomsMenuOpen={open} /></MemoryRouter>));
    const trigger = host.querySelector<HTMLButtonElement>('[data-testid="rooms-trigger"]')!;
    const accessibleName = trigger.getAttribute('aria-label')!;
    const responsiveLabels = [...trigger.querySelectorAll(':scope > span')];
    expect(responsiveLabels).toHaveLength(2);
    for (const label of responsiveLabels) {
      expect(accessibleName).toContain(label.textContent);
    }
    // The phone hides both text spans; its icon button still has a named action.
    expect(accessibleName).toContain('Open rooms list');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger.click());
    expect(open).toHaveBeenCalledWith(true);
  });
});
