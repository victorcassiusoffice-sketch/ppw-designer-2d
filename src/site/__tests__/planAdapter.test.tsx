// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layer, Rect, Line, Text } from 'react-konva';
import {
  installCanvasSiteAdapter,
  useCanvasSiteProjection,
  type CanvasSiteProjection,
} from '../../components/canvasSiteBridge';
import { isRectInsidePolygon, pointInPolygon, type Polygon } from '../../lib/geometry';
import { usePropertyStore, type Site } from '../../store/propertyStore';
import { hydrateCurrentSite, startSiteHydration, validateWorld } from '../hydration';
import { makeSite, toLonLat } from '../geometry';
import { sampleSite } from '../sample';

vi.mock('react-konva', () => ({
  Layer: ({ children }: { children: ReactNode }) => <g>{children}</g>,
  Rect: ({ fill }: { fill: string }) => <rect fill={fill} />,
  Line: ({ points, stroke, strokeWidth }: { points: number[]; stroke: string; strokeWidth: number }) =>
    <polyline points={points.join(' ')} stroke={stroke} strokeWidth={strokeWidth} />,
  Text: ({ text }: { text: string }) => <text>{text}</text>,
}));

const original = usePropertyStore.getState().property;
const legacy: Site = { widthM: 10, depthM: 10, originM: { x: 0, y: 0 } };
const outline = () => makeSite([
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
  { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
].map(point => toLonLat(point, [57.3776792, -20.3292161])), 'Concave plot', { x: 0, y: 0 });
let root: Root;
let host: HTMLDivElement;
let stop = () => {};
let observed: { site: Site | null; projection?: CanvasSiteProjection; polygon?: Polygon; area?: number };
let renderCount: number;
function CanvasConsumer() {
  const site = usePropertyStore(state => state.property.site ?? null);
  const projection = useCanvasSiteProjection(site);
  observed = { site, projection, polygon: projection?.polygon, area: projection?.areaM2 };
  renderCount++;
  return <><output>{projection?.label}</output><svg>{projection?.annotation({ pxPerMetre: 20,
    viewport: { x: 0, y: 0, scale: 2 }, size: { width: 800, height: 600 }, container: null,
    Layer, Rect, Line, Text, palette: { ink: '#123456', ground: '#faf9f5' } })}</svg></>;
}
async function mount(site?: Site) {
  await act(async () => {
    usePropertyStore.setState({ property: { ...original, site } });
    root.render(<CanvasConsumer />);
  });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  installCanvasSiteAdapter(undefined);
  usePropertyStore.setState({ property: { ...original, site: undefined } });
  renderCount = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  stop();
  stop = () => {};
  await act(async () => root.unmount());
  installCanvasSiteAdapter(undefined);
  usePropertyStore.setState({ property: original });
  host.remove();
  vi.unstubAllGlobals();
});

describe('deferred geographic plan projection', () => {
  it('does not project no-site or legacy data without activation', async () => {
    await mount();
    expect(observed.polygon).toBeUndefined();
    expect(observed.area).toBeUndefined();
    await act(async () => usePropertyStore.getState().setSite({ ...legacy, originM: { x: -3, y: 7 } }));
    expect(observed.projection).toBeUndefined();
    expect(observed.polygon).toBeUndefined();
    expect(observed.area).toBeUndefined();
    expect(host.textContent).toBe('');
    expect(host.querySelector('polyline')).toBeNull();
  });

  it('withholds pending world shape, label and capacity instead of fabricating a bounding rectangle', async () => {
    const world = outline();
    await mount({ ...legacy, world });
    expect(observed.projection).toBeUndefined();
    expect(observed.polygon).toBeUndefined();
    expect(observed.area).toBeUndefined();
    expect(Object.isFrozen(world)).toBe(false);
    expect(host.textContent).toBe('');
    expect(host.querySelector('polyline')).toBeNull();
  });

  it('does not activate even accepted data until deferred hydration registers the bridge', async () => {
    const world = validateWorld(outline())!;
    await mount({ ...legacy, world });
    expect(Object.isFrozen(world)).toBe(true);
    expect(observed.polygon).toBeUndefined();
    await act(async () => hydrateCurrentSite());
    expect(observed.polygon).toBe(world.polygon);
    expect(observed.projection).toBeDefined();
  });

  it('uses the exact immutable concave polygon for constraints and true area, with a scaled north arrow', async () => {
    await mount({ ...legacy, world: outline() });
    const rooms = usePropertyStore.getState().property.rooms;
    await act(async () => { stop = startSiteHydration(); });
    const world = usePropertyStore.getState().property.site!.world as ReturnType<typeof outline>;
    expect(observed.polygon).toBe(world.polygon);
    expect(Object.isFrozen(observed.polygon)).toBe(true);
    expect(observed.area).toBeCloseTo(64, 5);
    expect(observed.area).not.toBe(legacy.widthM * legacy.depthM);
    expect(pointInPolygon({ x: 8, y: 8 }, observed.polygon!)).toBe(false);
    expect(isRectInsidePolygon({ x: 7, y: 7, w: 1, h: 1 }, observed.polygon!)).toBe(false);
    expect(isRectInsidePolygon({ x: 1, y: 1, w: 1, h: 1 }, observed.polygon!)).toBe(true);
    expect(host.querySelector('output')?.textContent).toBe('Concave plot · N ↑ · boundary drawn / typed by you');
    const arrow = host.querySelector('polyline')!;
    const points = arrow.getAttribute('points')!.split(' ').map(Number);
    expect(points.every(coordinate => coordinate >= 4)).toBe(true);
    expect(points[3]).toBeLessThan(points[1]); // North stays up, inside the drawable area.
    expect(host.querySelector('text')?.textContent?.replace(/\s+/g, ' ')).toBe(observed.projection?.label);
    expect(arrow.getAttribute('stroke')).toBe('#123456');
    expect(arrow.getAttribute('stroke-width')).toBe('0.75');
    expect(host.querySelector('rect')?.getAttribute('fill')).toBe('#faf9f5');
    expect(usePropertyStore.getState().property.rooms).toBe(rooms);
    const projection = observed.projection;
    const before = renderCount;
    await act(async () => { hydrateCurrentSite(); usePropertyStore.getState().toggleGrid(); });
    expect(observed.projection).toBe(projection);
    expect(renderCount).toBe(before);
  });

  it('rejects a merely frozen unvalidated object and preserves the legacy plot after failed validation', async () => {
    await mount();
    await act(async () => hydrateCurrentSite());
    const invalid = outline();
    invalid.polygon[0].x += 1000;
    Object.freeze(invalid);
    await act(async () => usePropertyStore.getState().setSite({ ...legacy, world: invalid }));
    expect(observed.projection).toBeUndefined();
    expect(observed.polygon).toBeUndefined();
    expect(observed.area).toBeUndefined();
    await act(async () => hydrateCurrentSite());
    expect(observed.site).toEqual(legacy);
    expect(observed.polygon).toBeUndefined();
    expect(observed.area).toBeUndefined();
    expect(host.querySelector('polyline')).toBeNull();
  });

  it('updates on later imported sites and removal, then withholds new opaque data after subscription disposal', async () => {
    await mount({ ...legacy, world: outline() });
    await act(async () => { stop = startSiteHydration(); });
    const previous = observed.projection;
    await act(async () => usePropertyStore.getState().loadProperty({ ...original, site: { ...legacy, world: sampleSite(1) } }));
    expect(observed.projection).not.toBe(previous);
    expect(observed.projection?.label).toContain('Curepipe');
    expect(observed.area).toBeCloseTo(500, 5);
    await act(async () => usePropertyStore.getState().setSite(null));
    expect(observed.polygon).toBeUndefined();
    expect(observed.area).toBeUndefined();
    expect(host.querySelector('polyline')).toBeNull();
    stop();
    stop();
    await act(async () => usePropertyStore.getState().setSite({ ...legacy, world: sampleSite(2) }));
    expect(Object.isFrozen(observed.site?.world)).toBe(false);
    expect(observed.polygon).toBeUndefined();
    expect(observed.area).toBeUndefined();
    await act(async () => root.unmount());
    root = createRoot(host);
    const before = renderCount;
    installCanvasSiteAdapter(undefined);
    expect(renderCount).toBe(before);
  });
});
