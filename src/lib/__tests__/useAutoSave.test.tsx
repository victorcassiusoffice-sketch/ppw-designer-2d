/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from '../useAutoSave';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore } from '../../store/designsStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let savedId: string;
function Harness() { useAutoSave(); return null; }
beforeEach(() => {
  vi.useFakeTimers();
  usePropertyStore.getState().resetToDefault();
  useDesignsStore.setState({ designs: {}, currentId: null });
  savedId = useDesignsStore.getState().savePropertyAs('My plan', usePropertyStore.getState().property);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('pending local saves before leaving an embedded designer', () => {
  it.each(['pagehide', 'beforeunload'])('flushes the final edit synchronously on %s before its debounce', eventName => {
    act(() => usePropertyStore.getState().renameProperty('Latest edit'));
    expect(useDesignsStore.getState().designs[savedId].property.name).not.toBe('Latest edit');
    act(() => window.dispatchEvent(new Event(eventName)));
    expect(useDesignsStore.getState().designs[savedId].property.name).toBe('Latest edit');
    const flushed = useDesignsStore.getState().designs[savedId];
    act(() => vi.advanceTimersByTime(300));
    expect(useDesignsStore.getState().designs[savedId]).toBe(flushed);
  });

  it('flushes pending edits on component exit and removes unload listeners', () => {
    act(() => usePropertyStore.getState().renameProperty('Last embedded edit'));
    act(() => root.render(null));
    expect(useDesignsStore.getState().designs[savedId].property.name).toBe('Last embedded edit');
    act(() => usePropertyStore.getState().renameProperty('Later work in another view'));
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(useDesignsStore.getState().designs[savedId].property.name).toBe('Last embedded edit');
  });
});
