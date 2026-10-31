// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { SiteLaunchButton } from '../SiteLaunchButton';

const module = vi.hoisted(() => ({ start: vi.fn<() => () => void>(), dispose: vi.fn() }));
vi.mock('../hydration', () => ({ startSiteHydration: module.start }));
const original = usePropertyStore.getState().property;
let root: Root;
let host: HTMLDivElement;
let frames: FrameRequestCallback[];
async function paint() {
  await act(async () => {
    const batch = frames.splice(0);
    for (const callback of batch) callback(10);
    await Promise.resolve();
  });
}
async function mount(world: boolean) {
  const property = { ...original };
  if (world)
    property.site = { widthM: 25, depthM: 20, originM: { x: 0, y: 0 }, world: { version: 1 } };
  else delete property.site;
  usePropertyStore.setState({ property });
  await act(async () => root.render(<SiteLaunchButton />));
}
beforeEach(() => {
  module.start.mockReset().mockReturnValue(module.dispose);
  module.dispose.mockReset();
  frames = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  window.history.replaceState({}, '', '/demo?view=3d&pitch=1');
  useDesignerUIStore.getState().setViewMode('plan');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.querySelector('[data-first-picture-ms]')?.remove();
  usePropertyStore.setState({ property: original });
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
});
describe('Site first-picture boundary', () => {
  it('does not load hydration for a design with no Site extension', async () => {
    await mount(false);
    await paint();
    await paint();
    expect(module.start).not.toHaveBeenCalled();
  });
  it('honours route-requested 3D while the store still says plan', async () => {
    await mount(true);
    await paint();
    await paint();
    expect(module.start).not.toHaveBeenCalled();
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    await act(async () => {
      canvas.dataset.firstPictureMs = '123';
      await Promise.resolve();
    });
    await paint();
    expect(module.start).not.toHaveBeenCalled();
    await paint();
    await vi.waitFor(() => expect(module.start).toHaveBeenCalledTimes(1));
  });
  it('does not start a pending import after disposal', async () => {
    window.history.replaceState({}, '', '/designer?view=2d');
    await mount(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    await paint();
    await paint();
    expect(module.start).not.toHaveBeenCalled();
  });
  it('disposes the installed subscription when the launcher unmounts', async () => {
    window.history.replaceState({}, '', '/designer?view=2d');
    await mount(true);
    await paint();
    await paint();
    await vi.waitFor(() => expect(module.start).toHaveBeenCalledTimes(1));
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(module.dispose).toHaveBeenCalledTimes(1);
  });
});
