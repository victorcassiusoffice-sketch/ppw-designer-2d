// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePropertyStore } from '../../store/propertyStore';
import SiteWorkspace from '../SiteWorkspace';
import { sampleSite } from '../sample';
import type { LonLat } from '../types';

vi.mock('../SiteMap', () => ({
  default: ({
    points,
    closed,
    onChange,
  }: {
    points: LonLat[];
    closed: boolean;
    onChange: (points: LonLat[]) => void;
  }) => (
    <div data-map-closed={String(closed)} data-map-points={JSON.stringify(points)}>
      <button
        onClick={() => onChange(points.map((p, i) => (i === 0 ? [p[0] + 0.00001, p[1]] : p)))}
      >
        Move first map corner
      </button>
    </div>
  ),
}));

const original = usePropertyStore.getState().property;
let root: Root;
let app: HTMLDivElement;
const button = (text: string) => {
  const found = [...app.querySelectorAll('button')].find((node) => node.textContent === text);
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
};
const click = (text: string) => act(() => button(text).click());
const input = (label: string) => app.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
function edit(node: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function mount(demo = true) {
  await act(async () => root.render(<SiteWorkspace demo={demo} onClose={() => {}} />));
}
const savedWorld = () => JSON.stringify(usePropertyStore.getState().property.site?.world);

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  usePropertyStore.setState({ property: { ...original, site: undefined } });
  app = document.createElement('div');
  document.body.append(app);
  root = createRoot(app);
});
afterEach(async () => {
  await act(async () => root.unmount());
  app.remove();
  usePropertyStore.setState({ property: original });
  vi.unstubAllGlobals();
});

describe('local Site boundary undo', () => {
  it('undoes a coordinate edit without losing the checked terrain or source snapshot', async () => {
    await mount();
    click('Apply site to plan');
    const before = savedWorld();
    const longitude = input('Corner 1 longitude').value;
    edit(input('Corner 1 longitude'), String(Number(longitude) + 0.00001));
    expect(button('Apply site to plan').disabled).toBe(true);
    expect(input('Corner 1 longitude').value).not.toBe(longitude);
    click('Undo boundary change');
    expect(input('Corner 1 longitude').value).toBe(longitude);
    expect(button('Apply site to plan').disabled).toBe(false);
    click('Apply site to plan');
    expect(savedWorld()).toBe(before);
    expect(button('Undo boundary change').disabled).toBe(true);
  });

  it('restores a cleared boundary with all four corners, provenance and levels', async () => {
    await mount();
    click('Apply site to plan');
    const before = savedWorld();
    const rooms = JSON.stringify(usePropertyStore.getState().property.rooms);
    click('Clear boundary');
    expect(app.querySelectorAll('.site-coordinate-row')).toHaveLength(0);
    expect(button('Apply site to plan').disabled).toBe(true);
    click('Undo boundary change');
    expect(app.querySelectorAll('.site-coordinate-row')).toHaveLength(4);
    click('Apply site to plan');
    expect(savedWorld()).toBe(before);
    expect(JSON.stringify(usePropertyStore.getState().property.rooms)).toBe(rooms);
  });

  it('undoes a map drag and restores the closed state rather than deleting a corner', async () => {
    usePropertyStore.setState({
      property: {
        ...original,
        site: { widthM: 25, depthM: 20, originM: { x: -5, y: -5 }, world: sampleSite() },
      },
    });
    await mount(false);
    const before = input('Corner 1 longitude').value;
    click('Move first map corner');
    expect(input('Corner 1 longitude').value).not.toBe(before);
    click('Undo boundary change');
    expect(input('Corner 1 longitude').value).toBe(before);
    expect(app.querySelectorAll('.site-coordinate-row')).toHaveLength(4);
    expect(app.querySelector('[data-map-closed]')?.getAttribute('data-map-closed')).toBe('true');
    expect(button('Apply site to plan').disabled).toBe(false);
  });

  it('labels a manually changed traverse as drawn, then restores its survey entry on undo', async () => {
    await mount(false);
    click('From the surveyor’s plan');
    click('Close traverse & check');
    const before = app.querySelector('[data-map-points]')?.getAttribute('data-map-points');
    click('Move first map corner');
    expect(button('Drawn boundary').getAttribute('aria-pressed')).toBe('true');
    click('Undo boundary change');
    expect(button('From the surveyor’s plan').getAttribute('aria-pressed')).toBe('true');
    expect(app.querySelector('[data-map-points]')?.getAttribute('data-map-points')).toBe(before);
    expect(app.textContent).toContain('Traverse closure error');
    expect(button('Apply site to plan').disabled).toBe(false);
  });

  it('bounds history to fifty edits and never changes the saved design before Apply', async () => {
    await mount();
    const before = JSON.stringify(usePropertyStore.getState().property);
    const longitude = Number(input('Corner 1 longitude').value);
    for (let i = 1; i <= 51; i++)
      edit(input('Corner 1 longitude'), String(longitude + i * 0.000001));
    for (let i = 0; i < 50; i++) click('Undo boundary change');
    expect(Number(input('Corner 1 longitude').value)).toBeCloseTo(longitude + 0.000001, 10);
    expect(button('Undo boundary change').disabled).toBe(true);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('undoes consecutive added corners in reverse order without losing the earlier clear action', async () => {
    await mount();
    click('Clear boundary');
    const coordinate = app.querySelector<HTMLInputElement>('[placeholder="longitude, latitude"]')!;
    for (const value of ['57.3777, -20.3292', '57.3778, -20.3292', '57.3778, -20.3293']) {
      edit(coordinate, value);
      click('Add coordinate corner');
    }
    expect(app.querySelectorAll('.site-coordinate-row')).toHaveLength(3);
    for (const length of [2, 1, 0, 4]) {
      click('Undo boundary change');
      expect(app.querySelectorAll('.site-coordinate-row')).toHaveLength(length);
    }
    expect(button('Apply site to plan').disabled).toBe(false);
    expect(button('Undo boundary change').disabled).toBe(true);
  });

  it('discards another practice location’s history when the sample changes', async () => {
    await mount();
    click('Clear boundary');
    const select = app.querySelector('select')!;
    act(() => {
      select.value = '1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(button('Undo boundary change').disabled).toBe(true);
    expect(input('Corner 1 longitude').value).toBe(String(sampleSite(1).boundary[0][0]));
  });
});
