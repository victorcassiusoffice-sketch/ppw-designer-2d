/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedDesigner } from '../EmbeddedDesigner';
import DemoDesignerPage from '../../pages/DemoDesignerPage';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useHistoryStore, takeSnapshot } from '../../store/historyStore';

const app = vi.hoisted(() => ({ rendered: vi.fn() }));
vi.mock('../../App', () => ({ default: () => { app.rendered(); return <div>Designer</div>; } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let parentFrame: HTMLIFrameElement | undefined;
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useDesignerUIStore.getState().setViewMode('3d'); app.rendered.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); parentFrame?.remove(); parentFrame = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function message(source: Window | null, data: unknown, origin = window.location.origin) {
  act(() => window.dispatchEvent(new MessageEvent('message', { source, data, origin })));
}

describe('persistent embedded designer', () => {
  it('keeps the same iframe and initial URL across view switches', () => {
    act(() => root.render(<EmbeddedDesigner scene="home" view="2d" />));
    const frame = host.querySelector('iframe')!;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    act(() => root.render(<EmbeddedDesigner scene="home" view="3d" />));
    expect(host.querySelector('iframe')).toBe(frame);
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=2d');
    expect(posted).toHaveBeenLastCalledWith({ type: 'ppw:designer-view', view: '3d' }, window.location.origin);
    act(() => root.render(<EmbeddedDesigner scene="home" view="2d" />));
    expect(host.querySelector('iframe')).toBe(frame);
    expect(posted).toHaveBeenLastCalledWith({ type: 'ppw:designer-view', view: '2d' }, window.location.origin);
  });

  it('sends the latest requested view when its child becomes ready, ignoring unrelated senders', () => {
    act(() => root.render(<EmbeddedDesigner scene="home" view="2d" />));
    const frame = host.querySelector('iframe')!;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    act(() => root.render(<EmbeddedDesigner scene="home" view="3d" />));
    posted.mockClear();
    message(frame.contentWindow, { type: 'ppw:designer-ready' }, 'https://untrusted.example');
    message(window, { type: 'ppw:designer-ready' });
    message(frame.contentWindow, { type: 'another-message' });
    expect(posted).not.toHaveBeenCalled();
    message(frame.contentWindow, { type: 'ppw:designer-ready' });
    expect(posted).toHaveBeenCalledTimes(1);
    expect(posted).toHaveBeenLastCalledWith({ type: 'ppw:designer-view', view: '3d' }, window.location.origin);
  });

  it('accepts only typed same-origin requests from its actual parent without changing design or history', () => {
    parentFrame = document.createElement('iframe'); document.body.append(parentFrame);
    const parent = parentFrame.contentWindow!;
    vi.stubGlobal('parent', parent);
    const ready = vi.spyOn(parent, 'postMessage');
    const snapshot = takeSnapshot();
    useHistoryStore.setState({ past: [snapshot], future: [snapshot] });
    const property = usePropertyStore.getState().property;
    const history = useHistoryStore.getState();
    act(() => root.render(<MemoryRouter initialEntries={['/embed/designer?view=3d']}><DemoDesignerPage /></MemoryRouter>));
    expect(ready).toHaveBeenCalledWith({ type: 'ppw:designer-ready' }, window.location.origin);
    for (const data of [null, '2d', { type: 'ppw:designer-view', view: 'invalid' }, { type: 'other', view: '2d' }]) message(parent, data);
    message(window, { type: 'ppw:designer-view', view: '2d' });
    message(parent, { type: 'ppw:designer-view', view: '2d' }, 'https://untrusted.example');
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
    message(parent, { type: 'ppw:designer-view', view: '2d' });
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
    expect(ready).toHaveBeenLastCalledWith({ type: 'ppw:designer-view-state', view: '2d' }, window.location.origin);
    message(parent, { type: 'ppw:designer-view', view: '3d' });
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
    expect(usePropertyStore.getState().property).toBe(property);
    expect(useHistoryStore.getState().past).toBe(history.past);
    expect(useHistoryStore.getState().future).toBe(history.future);
    expect(app.rendered).toHaveBeenCalledTimes(1);
    act(() => useDesignerUIStore.getState().setViewMode('plan'));
    expect(ready).toHaveBeenLastCalledWith({ type: 'ppw:designer-view-state', view: '2d' }, window.location.origin);
  });

  it('synchronizes parent controls only from valid view-state replies by its own child', () => {
    const onViewChange = vi.fn();
    act(() => root.render(<EmbeddedDesigner scene="home" view="3d" onViewChange={onViewChange} />));
    const child = host.querySelector('iframe')!.contentWindow;
    message(child, { type: 'ppw:designer-view-state', view: '2d' }, 'https://untrusted.example');
    message(window, { type: 'ppw:designer-view-state', view: '2d' });
    message(child, { type: 'ppw:designer-view-state', view: 'invalid' });
    message(child, { type: 'ppw:designer-view-state', view: '3d' });
    expect(onViewChange).not.toHaveBeenCalled();
    message(child, { type: 'ppw:designer-view-state', view: '2d' });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenLastCalledWith('2d');
  });
});
