/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomView3D } from '../RoomView3D';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { getAllProducts } from '../../data/products';
import type { OrbitCamera } from '../../designer/roomView3d';
import type { ThreeStageHandle, ThreeStageProps } from '../three/ThreeStage';
import { ROOM_LIGHTING_STORAGE_KEY } from '../../hooks/useRoomLighting';
import { defaultFoundationRebar } from '../../designer/foundation';

const renderer = vi.hoisted(() => ({ camera: null as OrbitCamera | null, presentation: undefined as ThreeStageProps['presentation'], hour: undefined as ThreeStageProps['hour'], mounts: 0, ready: undefined as ThreeStageProps['onReady'] }));
vi.mock('../three/ThreeStage', async () => {
  const React = await import('react');
  return { default: React.forwardRef<Pick<ThreeStageHandle, 'floorPoint' | 'hitItem' | 'hitTest' | 'projectPoint'>, ThreeStageProps>(function CameraStage({ camera, presentation, hour, onReady }, ref) {
    renderer.ready = onReady;
    renderer.camera = camera;
    renderer.presentation = presentation;
    renderer.hour = hour;
    React.useEffect(() => { renderer.mounts += 1; }, []);
    React.useImperativeHandle(ref, () => ({
      floorPoint: (x, y) => ({ x: x / 100, y: y / 100 }), hitItem: () => null, hitTest: () => null,
      projectPoint: (x, y) => ({ x: x * 100, y: y * 100 }),
    }));
    return <div data-testid="camera-stage" />;
  }) };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let viewport = { width: 960, height: 640 };
beforeEach(async () => {
  viewport = { width: 960, height: 640 };
  renderer.camera = null;
  renderer.presentation = undefined;
  renderer.hour = undefined;
  renderer.mounts = 0;
  localStorage.removeItem(ROOM_LIGHTING_STORAGE_KEY);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ ...viewport, x: 0, y: 0, left: 0, top: 0, right: viewport.width, bottom: viewport.height, toJSON: () => ({}) }));
  usePropertyStore.getState().resetToDefault();
  const p = usePropertyStore.getState().property;
  usePropertyStore.setState({ property: { ...p, id: 'camera-project', activeLevelId: 'ground', activeRoomId: 'room', rooms: [{ id: 'room', name: 'Room', placedItems: [], polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }] }] } });
  useDesignerUIStore.setState({ tool: 'hand', viewMode: '3d', energyPanelOpen: false, sunHour: null, foundationView: false });
  usePlacementIntentStore.setState({ intent: null, armedProductId: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<RoomView3D variant="overlay" />); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.removeItem(ROOM_LIGHTING_STORAGE_KEY); });
function click(selector: string) { act(() => host.querySelector<HTMLButtonElement>(selector)!.click()); }
function zoomIn() { click('[aria-label="Zoom in"]'); click('[aria-label="Zoom in"]'); return structuredClone(renderer.camera!); }
function resize(width: number, height: number) { viewport = { width, height }; act(() => window.dispatchEvent(new Event('resize'))); }
function finger(type: string, id: number, x: number, y: number) {
  act(() => {
    const event = new MouseEvent(type, {clientX:x,clientY:y,bubbles:true,buttons:type === 'pointerup' ? 0 : 1});
    Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'},isPrimary:{value:id===1}});
    host.querySelector('[data-testid="wallpaint-3d-canvas"]')!.dispatchEvent(event);
  });
}
function expectSameFraming(camera: OrbitCamera, initialHeight = 640) {
  expect(renderer.camera).toMatchObject({ distanceM: camera.distanceM, target: camera.target, azimuthRad: camera.azimuthRad, elevationRad: camera.elevationRad });
  const pixelsPerMetre = (c: OrbitCamera, height: number) => height / (2 * c.distanceM * Math.tan(c.fovRad / 2));
  expect(pixelsPerMetre(renderer.camera!, viewport.height)).toBeCloseTo(pixelsPerMetre(camera, initialHeight), 10);
}

describe('3D camera stays where the customer leaves it', () => {
  it('keeps the loading animation until the renderer has drawn a frame and does not restore it on tool changes', () => {
    expect(host.querySelector('[data-testid="loading-3d"]')?.textContent).toContain('Loading 3D');
    act(() => renderer.ready?.());
    expect(host.querySelector('[data-testid="loading-3d"]')).toBeNull();
    click('[data-testid="house-mode-furnish"]');
    expect(host.querySelector('[data-testid="loading-3d"]')).toBeNull();
  });
  it('keeps camera orbit inside View settings instead of beside Undo', () => {
    expect(host.querySelector('[aria-label="Orbit camera left"]')).toBeNull();
    click('[data-testid="house-view-settings"]');
    expect(host.querySelector('[aria-label="Orbit camera left"]')).not.toBeNull();
    expect(host.querySelector('.house-camera-row [data-testid="wallpaint-3d-rotate-left"]')).toBeNull();
  });
  it('shows object rotation beside a selected floor product and hides it during wall drawing or deselection', () => {
    let id = '';
    act(() => { id = usePropertyStore.getState().addItem({ productId: 'espace-emilia-toilet-bowl', x: 3.5, y: 3.5, rotation: 0 }, 'room'); usePropertyStore.getState().selectItem(id); });
    expect(host.querySelector('[data-testid="view3d-object-turn"]')).not.toBeNull();
    expect(host.querySelector('.house-selection [data-testid="view3d-rotate"]')).toBeNull();
    click('[data-testid="house-draw-walls"]');
    expect(host.querySelector('[data-testid="view3d-object-turn"]')).toBeNull();
    act(() => usePropertyStore.getState().selectItem(null));
    expect(host.querySelector('[data-testid="view3d-object-turn"]')).toBeNull();
  });
  it('fits a foundation-only project at its real below-ground datum and preserves the camera during edits', () => {
    act(() => {
      useDesignerUIStore.getState().setFoundationView(true);
      const p = usePropertyStore.getState().property;
      usePropertyStore.setState({ property: { ...p, id: 'foundation-only', rooms: [{ ...p.rooms[0], polygon: [] }], foundation: { version: 1, enabled: true, elements: [{ id: 'pad', kind: 'pad', name: 'Pad', x: 60, y: 45, lengthM: 3, widthM: 2, depthM: 1, topElevationM: -2, rebar: defaultFoundationRebar() }] } } });
    });
    expect(renderer.camera!.target.x).toBe(60); expect(renderer.camera!.target.y).toBe(45);
    expect(renderer.camera!.target.z).toBeLessThan(-2);
    expect(host.querySelector('.house-empty')).toBeNull();
    const before = zoomIn();
    act(() => { const p = usePropertyStore.getState().property; usePropertyStore.getState().setFoundation({ ...p.foundation!, elements: p.foundation!.elements.map(e => ({ ...e, lengthM: 20, depthM: 3 })) }); });
    expect(renderer.camera).toEqual(before);
    click('[data-testid="wallpaint-3d-fit"]');
    expect(renderer.camera!.distanceM).toBeGreaterThan(before.distanceM);
    expect(renderer.camera!.target.z).toBeLessThan(-2);
  });
  it('enters foundation inspection from an upper floor without zooming out', () => {
    act(() => usePropertyStore.getState().addLevel('Upper'));
    const before = zoomIn();
    act(() => useDesignerUIStore.getState().setFoundationView(true));
    expect(usePropertyStore.getState().property.activeLevelId).toBe('ground');
    expect(renderer.camera).toEqual(before);
  });
  it('defaults to Natural light and explains the explicit neutral Colour check option', () => {
    expect(renderer.presentation).toBe('natural');
    click('[data-testid="house-view-settings"]');
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Lighting"]')!;
    expect(select.value).toBe('natural');
    expect([...select.options].map(option => option.text)).toEqual(['Natural light', 'Colour check']);
    expect(document.getElementById(select.getAttribute('aria-describedby')!)?.textContent).toContain('neutral lighting to compare finishes');
  });
  it('changes lighting without remounting the stage or moving the camera, and retains the choice through Paint and Furnish', async () => {
    const camera = zoomIn();
    const property = structuredClone(usePropertyStore.getState().property);
    const mounts = renderer.mounts;
    click('[data-testid="house-view-settings"]');
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Lighting"]')!;
    act(() => { select.value = 'architectural'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(renderer.presentation).toBe('architectural');
    expect(localStorage.getItem(ROOM_LIGHTING_STORAGE_KEY)).toBe('architectural');
    expect(renderer.camera).toEqual(camera);
    expect(renderer.mounts).toBe(mounts);
    await act(async () => root.render(<RoomView3D variant="overlay" onPaintWall={vi.fn()} brushHex="#879988" />));
    expect(renderer.presentation).toBe('architectural');
    expect(renderer.camera).toEqual(camera);
    expect(renderer.mounts).toBe(mounts);
    await act(async () => root.render(<RoomView3D variant="overlay" />));
    click('[data-testid="house-mode-furnish"]');
    expect(renderer.presentation).toBe('architectural');
    expect(renderer.camera).toEqual(camera);
    expect(renderer.mounts).toBe(mounts);
    expect(usePropertyStore.getState().property).toEqual(property);
    await act(async () => root.render(<RoomView3D key="reopened" variant="overlay" />));
    expect(renderer.presentation).toBe('architectural');
  });
  it('keeps Natural light active when opening Paint and keeps inline cards calibrated', async () => {
    const camera = zoomIn();
    const mounts = renderer.mounts;
    await act(async () => root.render(<RoomView3D variant="overlay" onPaintWall={vi.fn()} brushHex="#879988" />));
    expect(renderer.presentation).toBe('natural');
    expect(renderer.camera).toEqual(camera);
    expect(renderer.mounts).toBe(mounts);
    await act(async () => root.render(<RoomView3D key="inline" variant="card" />));
    expect(renderer.presentation).toBe('studio');
    expect(host.querySelector('[aria-label="Lighting"]')).toBeNull();
  });
  it('uses neutral light for Colour check and restores the preferred evening hour in Natural light', () => {
    const camera = zoomIn();
    const mounts = renderer.mounts;
    act(() => useDesignerUIStore.getState().setSunHour(19.5));
    expect(renderer.hour).toBe(19.5);
    click('[data-testid="house-view-settings"]');
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Lighting"]')!;
    act(() => { select.value = 'architectural'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(renderer.hour).toBeNull();
    expect(useDesignerUIStore.getState().sunHour).toBe(19.5);
    expect(host.querySelector('[data-testid="view3d-sun"]')).toBeNull();
    expect(document.getElementById(select.getAttribute('aria-describedby')!)?.textContent).toContain('Time of day is paused in Colour check');
    act(() => { select.value = 'natural'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(renderer.hour).toBe(19.5);
    expect(host.querySelector<HTMLInputElement>('[aria-label="Time of day"]')?.value).toBe('19.5');
    expect(renderer.camera).toEqual(camera);
    expect(renderer.mounts).toBe(mounts);
  });
  it('falls back to Natural light for invalid or unavailable storage and remains interactive when persistence fails', async () => {
    localStorage.setItem(ROOM_LIGHTING_STORAGE_KEY, 'unknown-profile');
    await act(async () => root.render(<RoomView3D key="invalid" variant="overlay" />));
    expect(renderer.presentation).toBe('natural');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    await act(async () => root.render(<RoomView3D key="private" variant="overlay" />));
    expect(renderer.presentation).toBe('natural');
    click('[data-testid="house-view-settings"]');
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Lighting"]')!;
    act(() => { select.value = 'architectural'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(renderer.presentation).toBe('architectural');
  });
  it('keeps the house centred through 30 phone pinch cycles delivered one finger at a time', () => {
    resize(390,640);
    const before = structuredClone(renderer.camera!);
    finger('pointerdown',1,145,320); finger('pointerdown',2,245,320);
    for (let cycle=0; cycle<30; cycle++) {
      finger('pointermove',1,95,320); finger('pointermove',2,295,320);
      expect(renderer.camera!.target).toEqual(before.target);
      expect(renderer.camera!.distanceM).toBeCloseTo(before.distanceM/2,10);
      finger('pointermove',1,145,320); finger('pointermove',2,245,320);
    }
    finger('pointerup',1,145,320); finger('pointerup',2,245,320);
    expect(renderer.camera).toEqual(before);
  });
  it('does not creep in scale when phone plus and minus are alternated', () => {
    const before = structuredClone(renderer.camera!);
    for (let cycle=0;cycle<40;cycle++) { click('[aria-label="Zoom in"]'); click('[aria-label="Zoom out"]'); }
    expect(renderer.camera!.distanceM).toBeCloseTo(before.distanceM,10);
    expect(renderer.camera!.target).toEqual(before.target);
  });
  it('rebases a second pinch after a finger lifts and a third-finger interruption without a jump', () => {
    finger('pointerdown',1,100,200); finger('pointerdown',2,200,200);
    finger('pointermove',1,50,200); finger('pointermove',2,250,200);
    finger('pointerup',2,250,200);
    const afterLift = structuredClone(renderer.camera!);
    finger('pointerdown',3,250,200); finger('pointermove',3,250,200);
    expect(renderer.camera).toEqual(afterLift);
    finger('pointerdown',4,190,400); finger('pointermove',4,210,410);
    expect(renderer.camera).toEqual(afterLift);
    finger('pointerup',4,210,410); finger('pointermove',3,250,200);
    expect(renderer.camera).toEqual(afterLift);
    finger('pointercancel',1,50,200); finger('pointerup',3,250,200);
  });
  it('keeps zoom and target through Furnish and catalog/inspector viewport resizing', () => {
    const camera = zoomIn();
    click('[data-testid="house-mode-furnish"]');
    resize(960, 400);
    expectSameFraming(camera);
    resize(640, 400);
    expectSameFraming(camera);
    resize(960, 640);
    expectSameFraming(camera);
  });
  it('keeps zoom while selecting, moving or adding a product', () => {
    const camera = zoomIn();
    const product = getAllProducts().find((p) => p.placement !== 'roof')!;
    let id = '';
    act(() => { id = usePropertyStore.getState().addItem({ productId: product.id, x: 3, y: 3, rotation: 0 }, 'room'); });
    act(() => usePropertyStore.getState().selectItem(id));
    resize(700, 520);
    act(() => usePropertyStore.getState().updateItem(id, { x: 4, y: 4 }));
    expectSameFraming(camera);
    expect(usePropertyStore.getState().property.rooms[0].placedItems[0]).toMatchObject({ x: 4, y: 4 });
  });
  it('keeps zoom through larger garden bounds, extra floors and wall-height changes until Fit is requested', () => {
    const camera = zoomIn();
    act(() => {
      const p = usePropertyStore.getState().property;
      usePropertyStore.setState({ property: { ...p, garden: { surfaces: [{ id: 'lawn', kind: 'lawn', x: -10, y: -10, widthM: 30, depthM: 30, elevationM: 0 }], fences: [] } } });
    });
    act(() => usePropertyStore.getState().addLevel('First'));
    act(() => usePropertyStore.getState().ensureRoofLevel());
    act(() => usePropertyStore.getState().setActiveLevel('ground'));
    act(() => usePropertyStore.getState().setWallHeight(3.5));
    expect(renderer.camera).toEqual(camera);
    click('[data-testid="wallpaint-3d-fit"]');
    expect(renderer.camera!.distanceM).toBeGreaterThan(camera.distanceM);
  });
  it('changes a named viewing angle without changing zoom or the viewed point', () => {
    const camera = zoomIn();
    click('[data-testid="house-view-settings"]');
    const select = host.querySelector<HTMLSelectElement>('[data-testid="view3d-camera-view"]')!;
    act(() => { select.value = 'above'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(renderer.camera!.distanceM).toBe(camera.distanceM);
    expect(renderer.camera!.target).toEqual(camera.target);
    expect(renderer.camera!.elevationRad).toBeCloseTo(78 * Math.PI / 180);
  });
  it('fits a different project rather than carrying an unrelated close-up into it', () => {
    const camera = zoomIn();
    act(() => {
      const p = usePropertyStore.getState().property;
      usePropertyStore.setState({ property: { ...p, id: 'another-project', rooms: p.rooms.map((room) => ({ ...room, polygon: room.polygon.map((point) => ({ x: point.x + 50, y: point.y })) })) } });
    });
    expect(renderer.camera!.target.x).toBeGreaterThan(camera.target.x + 40);
    expect(renderer.camera!.distanceM).toBeGreaterThan(camera.distanceM);
  });
});
