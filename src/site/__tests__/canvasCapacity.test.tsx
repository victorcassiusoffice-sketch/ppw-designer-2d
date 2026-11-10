// @vitest-environment jsdom
import { act, Children, isValidElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppPreferencesProvider, PREFERENCES_KEY, UI_THEMES } from '../../i18n/AppPreferences';
import { canvasThemeFor } from '../../designer/canvasTheme';
import { useBuildSkinStore, BUILD_SKIN_PALETTES } from '../../store/buildSkinStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { getAllProducts } from '../../data/products';
import { RoomCanvas } from '../../components/RoomCanvas';
import { installCanvasSiteAdapter } from '../../components/canvasSiteBridge';
import { usePropertyStore } from '../../store/propertyStore';
import { hydrateCurrentSite } from '../hydration';
import { makeSite, toLonLat } from '../geometry';

// Only the canvas drawing host is absent in jsdom. The actual RoomCanvas DOM
// capacity readout, selectors, opaque guard and canonical area remain real.
const canvas = vi.hoisted(() => ({ children: undefined as ReactNode }));
vi.mock('react-konva', async () => {
  const { forwardRef } = await import('react');
  return {
    Stage: forwardRef(({ children }: { children?: ReactNode }, _ref) => { canvas.children = children; return null; }),
    Layer: forwardRef(() => null), Line: () => null, Group: () => null,
    Text: () => null, Circle: () => null, Rect: () => null, Shape: () => null, Image: () => null,
  };
});
const original = usePropertyStore.getState().property;
const withRoom = { ...original, activeRoomId: 'under-label', rooms: [{
  id: 'under-label', name: 'Room beneath annotation', placedItems: [],
  polygon: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }],
}] };
const legacy = { widthM: 10, depthM: 10, originM: { x: 0, y: 0 } };
type DrawingProps = { children?: ReactNode; name?: string; points?: number[]; text?: string; fill?: string; stroke?: string; listening?: boolean };
function drawingNode(children: ReactNode, accepts: (props: DrawingProps) => boolean): DrawingProps | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<DrawingProps>(child)) continue;
    if (accepts(child.props)) return child.props;
    const descendant = drawingNode(child.props.children, accepts);
    if (descendant) return descendant;
  }
}
const siteDrawing = () => drawingNode(canvas.children, props => props.name === 'site');
let host: HTMLDivElement;
let root: Root;
function capacityText() {
  return host.querySelector('[data-testid="plot-capacity"]')?.textContent;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  installCanvasSiteAdapter(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  installCanvasSiteAdapter(undefined);
  usePropertyStore.setState({ property: original });
  useBuildSkinStore.getState().setSkin('natural');
  usePlacementIntentStore.getState().setArmed(null);
  localStorage.removeItem(PREFERENCES_KEY);
  vi.unstubAllGlobals();
});
describe('actual RoomCanvas capacity readout', () => {
  it('shows the legacy rectangular quantity but no pending-world quantity, then shows canonical concave area', async () => {
    await act(async () => {
      usePropertyStore.setState({ property: { ...withRoom, site: legacy } });
      root.render(<MemoryRouter><RoomCanvas /></MemoryRouter>);
    });
    expect(capacityText()).toContain('Plot 100 m²');
    const transform = JSON.parse(host.querySelector('[data-view-transform]')!.getAttribute('data-view-transform')!);
    expect(drawingNode(siteDrawing()!.children, props => Boolean(props.points))?.points?.map(value => value / transform.pxPerMetre))
      .toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    expect(drawingNode(siteDrawing()!.children, props => Boolean(props.text))?.text).toBe('PLOT 10 × 10 m · 100 m²');
    expect(drawingNode(canvas.children, props => props.name === 'site-annotation')).toBeUndefined();
    const world = makeSite([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
    ].map(point => toLonLat(point, [57.3776792, -20.3292161])), 'Concave plot', { x: 0, y: 0 });
    await act(async () => usePropertyStore.setState({ property: { ...withRoom, site: { ...legacy, world } } }));
    expect(capacityText()).toBeUndefined();
    expect(siteDrawing()).toBeUndefined();
    expect(drawingNode(canvas.children, props => props.name === 'site-annotation')).toBeUndefined();
    await act(async () => hydrateCurrentSite());
    expect(capacityText()).toContain('Plot 64 m²');
    expect(capacityText()).not.toContain('Plot 100 m²');
    const accepted = usePropertyStore.getState().property.site!.world as ReturnType<typeof makeSite>;
    expect(drawingNode(siteDrawing()!.children, props => Boolean(props.points))?.points)
      .toEqual(accepted.polygon.flatMap(point => [point.x * transform.pxPerMetre, point.y * transform.pxPerMetre]));
    // The real RoomCanvas places the annotation after all room/item layers.
    // It cannot take room pointer events, and legacy text stays in its old layer.
    const layers = Children.toArray(canvas.children).filter(isValidElement<DrawingProps>);
    const roomLayer = layers.findIndex(layer => drawingNode(layer.props.children, props => props.name === 'room-poly'));
    const annotationLayer = layers.findIndex(layer => layer.props.name === 'site-annotation');
    expect(roomLayer).toBeGreaterThanOrEqual(0);
    expect(annotationLayer).toBe(layers.length - 1);
    expect(annotationLayer).toBeGreaterThan(roomLayer);
    expect(layers[annotationLayer].props.listening).toBe(false);
    expect(drawingNode(siteDrawing()!.children, props => Boolean(props.text))).toBeUndefined();
    expect(usePropertyStore.getState().property.rooms).toEqual(withRoom.rooms);
  });
});

describe('plan presentation', () => {
  const view = () => host.querySelector<HTMLElement>('[data-testid="plan-drawing-viewport"]')!;

  it('applies a live theme change to the surround, plot, dimensions and grid while preserving geometry', async () => {
    await act(async () => {
      usePropertyStore.setState({ property: { ...withRoom, site: legacy } });
      root.render(<MemoryRouter><AppPreferencesProvider><RoomCanvas /></AppPreferencesProvider></MemoryRouter>);
    });
    const initialTransform = view().dataset.viewTransform;
    const floor = () => drawingNode(drawingNode(canvas.children, p => p.name === 'room-poly')?.children, p => !!p.fill)?.fill;
    const initialFloor = floor();
    expect(initialFloor).toBeDefined();
    for (const theme of UI_THEMES) {
      const palette = canvasThemeFor(theme);
      await act(async () => window.dispatchEvent(new StorageEvent('storage', {
        key: PREFERENCES_KEY, newValue: JSON.stringify({ locale: 'en', theme }),
      })));
      expect(view().style.getPropertyValue('--build-ground')).toBe(palette.background);
      expect(drawingNode(siteDrawing()?.children, p => !!p.points)?.fill).toBe(palette.site);
      const dimensions = drawingNode(canvas.children, p => p.name === 'plan-dimensions');
      expect(drawingNode(dimensions?.children, p => !!p.text)?.fill).toBe(palette.ink);
      const grid = drawingNode(canvas.children, p => p.name === 'room-grid');
      expect(drawingNode(grid?.children, p => p.stroke === palette.majorGrid)).toBeDefined();
      expect(floor()).toBe(initialFloor);
      expect(view().dataset.viewTransform).toBe(initialTransform);
    }
    for (const skin of ['gallery', 'blueprint'] as const) {
      await act(async () => useBuildSkinStore.getState().setSkin(skin));
      expect(view().style.getPropertyValue('--build-ground')).toBe(BUILD_SKIN_PALETTES[skin].ground);
    }
  });

  it('keeps the drawing area clear on blank, empty and placement-ready plans', async () => {
    await act(async () => {
      usePropertyStore.setState({ property: original });
      root.render(<MemoryRouter><RoomCanvas /></MemoryRouter>);
    });
    expect(host.textContent).not.toContain('Draw your walls');
    await act(async () => usePropertyStore.setState({ property: withRoom }));
    expect(host.textContent).not.toContain('Your room is empty');
    const product = getAllProducts()[0];
    await act(async () => {
      usePlacementIntentStore.getState().setArmed(product.id);
      root.render(<MemoryRouter><RoomCanvas pendingProductId={product.id} /></MemoryRouter>);
    });
    const controls = host.querySelector('[data-testid="object-placement-controls"]')!;
    expect(controls.textContent).toContain(product.name);
    expect(view().contains(controls)).toBe(false);
    expect(view().textContent).not.toContain('Cancel');
    const cancel = Array.from(controls.querySelectorAll('button')).find(button => button.textContent === 'Cancel')!;
    await act(async () => cancel.click());
    expect(usePlacementIntentStore.getState().armedProductId).toBeNull();
  });
});
