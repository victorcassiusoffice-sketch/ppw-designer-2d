/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomView3D } from '../RoomView3D';
import { buildingSolids } from '../../designer/buildingScene';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import type { ThreeStageHandle, ThreeStageProps } from '../three/ThreeStage';

const renderer = vi.hoisted(() => ({ earlyPicks: 0, picks: 0 }));
vi.mock('../three/ThreeStage', async () => {
  const React = await import('react');
  return { default: React.forwardRef<Pick<ThreeStageHandle, 'floorPoint'>, ThreeStageProps>(function TestRoofStage({ solids }, ref) {
    const ready = React.useRef(false);
    // Match the real renderer: covering meshes are rebuilt in a child effect.
    React.useEffect(() => { ready.current = !!solids.roofs?.length; }, [solids]);
    React.useImperativeHandle(ref, () => ({ floorPoint: () => {
      if (!ready.current) { renderer.earlyPicks++; return null; }
      renderer.picks++;
      return { x: 2, y: 3 };
    } }));
    return <div data-testid="test-roof-stage" />;
  }) };
});

vi.mock('../../designer/buildingScene', async (original) => {
  const source = await original<typeof import('../../designer/buildingScene')>();
  return { ...source, buildingSolids: vi.fn(source.buildingSolids) };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  renderer.earlyPicks = 0; renderer.picks = 0;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  usePropertyStore.getState().resetToDefault();
  const p = usePropertyStore.getState().property;
  usePropertyStore.setState({ property: { ...p, rooms: [{ id: 'room', name: 'Room', placedItems: [], polygon: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 8 }, { x: 0, y: 8 }] }], activeRoomId: 'room', activeLevelId: 'ground' } });
  useDesignerUIStore.setState({ tool: 'hand', energyPanelOpen: false, viewMode: '3d' });
  usePlacementIntentStore.setState({ armedProductId: null, intent: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('3D roof working surface', () => {
  it('keeps the whole house visible when Roof is selected', () => {
    act(() => root.render(<RoomView3D variant="overlay" />));
    act(() => usePropertyStore.getState().ensureRoofLevel());
    const calls = vi.mocked(buildingSolids).mock.calls;
    expect(calls[calls.length - 1].slice(2)).toEqual(['building', true]);
    const results = vi.mocked(buildingSolids).mock.results;
    const scene = results[results.length - 1].value;
    expect(scene.floors.map((floor: { levelId: string }) => floor.levelId)).toEqual(['ground', 'roof']);
    expect(scene.roofs).toHaveLength(1);
    expect(scene.walls.length).toBeGreaterThan(0);
  });
  it('routes an armed catalog PV panel onto Roof even without the Plan component mounted', () => {
    act(() => root.render(<RoomView3D variant="overlay" />));
    act(() => usePlacementIntentStore.getState().setArmed('emcar-jinko-475'));
    expect(usePropertyStore.getState().property.activeLevelId).toBe('roof');
    expect(host.querySelector('[data-testid="wallpaint-3d-caption"]')?.textContent).toContain('Tap the roof');
    const calls = vi.mocked(buildingSolids).mock.calls;
    expect(calls[calls.length - 1].slice(2)).toEqual(['building', true]);
  });
  it('keeps the covering when returning from Roof to a regular floor — only the Roof toggle hides it', () => {
    // 2026-09-26: switching level used to force the roof off, which dropped the
    // whole roof level from the House view — a placed solar panel vanished the
    // moment the customer looked at the Ground floor.
    act(() => root.render(<RoomView3D variant="overlay" />));
    act(() => usePropertyStore.getState().ensureRoofLevel());
    act(() => usePropertyStore.getState().setActiveLevel('ground'));
    expect(usePropertyStore.getState().property.activeLevelId).toBe('ground');
    const calls = vi.mocked(buildingSolids).mock.calls;
    expect(calls[calls.length - 1].slice(2)).toEqual(['building', true]);
    const results = vi.mocked(buildingSolids).mock.results;
    expect(results[results.length - 1].value.roofs).toHaveLength(1);
    act(() => usePropertyStore.getState().ensureRoofLevel());
    const latest = vi.mocked(buildingSolids).mock.calls;
    expect(latest[latest.length - 1].slice(2)).toEqual(['building', true]);
  });
  it('keeps a panel placed on the Roof in the 3D solids after the customer switches to the Ground floor', () => {
    act(() => root.render(<RoomView3D variant="overlay" />));
    act(() => usePropertyStore.getState().ensureRoofLevel());
    const roofRoom = usePropertyStore.getState().property.rooms.find((room) => room.kind === 'roof')!;
    act(() => { usePropertyStore.getState().addItem({ productId: 'emcar-jinko-475', x: 1, y: 1, rotation: 0 }, roofRoom.id); });
    act(() => usePropertyStore.getState().setActiveLevel('ground'));
    expect(usePropertyStore.getState().property.activeLevelId).toBe('ground');
    const results = vi.mocked(buildingSolids).mock.results;
    const scene = results[results.length - 1].value;
    const panel = scene.items.find((item: { productId?: string }) => item.productId === 'emcar-jinko-475');
    expect(panel).toBeDefined();
    expect(panel.levelId).toBe('roof');
    expect(scene.roofs).toHaveLength(1);
  });
  it('keeps the first mobile screen-drop pending until Roof is visible and its covering can be picked', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 400, width: 640, height: 400, toJSON: () => ({}) });
    await act(async () => { root.render(<RoomView3D variant="overlay" />); });
    expect(host.querySelector('[data-testid="test-roof-stage"]')).not.toBeNull();
    expect(usePropertyStore.getState().property.activeLevelId).toBe('ground');
    // Long-press dragging from the phone catalog publishes a screen drop
    // directly; it does not arm the product and switch Roof ahead of time.
    await act(async () => { usePlacementIntentStore.getState().placeAt('emcar-jinko-475', 200, 160); });
    expect(usePropertyStore.getState().property.activeLevelId).toBe('roof');
    expect(renderer.earlyPicks).toBe(0);
    expect(renderer.picks).toBe(1);
    expect(usePlacementIntentStore.getState().intent).toMatchObject({ productId: 'emcar-jinko-475', target: { roomX: 2, roomY: 3 } });
  });
});
