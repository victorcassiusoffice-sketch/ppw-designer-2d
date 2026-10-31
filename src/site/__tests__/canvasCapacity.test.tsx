// @vitest-environment jsdom
import { act, Children, isValidElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
type DrawingProps = { children?: ReactNode; name?: string; points?: number[]; text?: string; listening?: boolean };
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
