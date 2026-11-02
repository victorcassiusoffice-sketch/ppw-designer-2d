// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Layer, Line, Rect, Text } from 'react-konva';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD_SKIN_PALETTES } from '../../store/buildSkinStore';
import { projectSiteForCanvas } from '../planAdapter';
import { sampleSite } from '../sample';

vi.mock('react-konva', () => ({
  Layer: ({ children, listening }: { children: ReactNode; listening: boolean }) => <g data-listening={String(listening)}>{children}</g>,
  Rect: (props: { x: number; y: number; width: number; height: number; fill: string }) => <rect {...props} />,
  Text: ({ text, fontSize, ...props }: { text: string; fontSize: number; x: number; y: number; width: number; fill: string }) =>
    <text x={props.x} y={props.y} fill={props.fill} data-width={props.width} data-font-size={fontSize}>{text}</text>,
  Line: ({ points }: { points: number[] }) => <polyline points={points.join(' ')} />,
}));

let root: Root;
let host: HTMLDivElement;
let container: HTMLDivElement;
let stripVisible: boolean;
let advance: number;
let resolveFonts: () => void;
let fonts: EventTarget & { ready: Promise<void> };
const fontDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
const context = { font: '', measureText: (text: string) => ({ width: Array.from(text).length * advance }) };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('CanvasRenderingContext2D', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  advance = 6;
  stripVisible = true;
  fonts = Object.assign(new EventTarget(), { ready: new Promise<void>(resolve => { resolveFonts = resolve; }) });
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
  container = document.createElement('div');
  container.innerHTML = '<div><button data-testid="mobile-undo">Undo</button></div>';
  document.body.append(container);
  const strip = container.firstElementChild!;
  vi.spyOn(strip, 'getClientRects').mockImplementation(() => (stripVisible ? [new DOMRect(0, 108, 180, 44)] : []) as unknown as DOMRectList);
  vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 108, 180, 44));
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 390, 268.5));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); container.remove();
  if (fontDescriptor) Object.defineProperty(document, 'fonts', fontDescriptor);
  else Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('deferred annotation overlay', () => {
  it('clears the real visible mobile strip, reflows loaded fonts, and recovers after collapse without intercepting rooms', async () => {
    const world = sampleSite();
    world.name = 'W'.repeat(160);
    const projection = projectSiteForCanvas(world);
    const view = { pxPerMetre: 30, viewport: { x: -10000, y: -10000, scale: 1 },
      size: { width: 390, height: 268.5 }, container, Layer, Rect, Line, Text,
      palette: BUILD_SKIN_PALETTES.natural };
    const render = async (height = 268.5) => act(async () => root.render(<svg>
      <rect data-room="underneath" x={0} y={0} width={390} height={height} fill="#111" />
      {projection.annotation({ ...view, size: { width: 390, height } })}
    </svg>));
    await render();
    const lineCount = () => host.querySelector('text')!.textContent!.split('\n').length;
    const initialLines = lineCount();
    expect(Number(host.querySelector('text')!.getAttribute('y'))).toBe(10060);
    expect(Number(host.querySelector('g rect')!.getAttribute('y'))).toBe(10056);
    expect(host.querySelector('g')?.getAttribute('data-listening')).toBe('false');
    expect(host.querySelector('svg')?.lastElementChild?.tagName).toBe('g');
    expect(host.querySelector('g')?.firstElementChild?.tagName).toBe('rect');
    expect(host.querySelector('g rect')?.getAttribute('fill')).toBe(view.palette.ground);
    expect(host.querySelector('text')?.getAttribute('fill')).toBe(view.palette.ink);
    await act(async () => { advance = 13; resolveFonts(); await fonts.ready; });
    expect(lineCount()).toBeGreaterThan(initialLines);
    expect(context.font).toBe('bold 11px Inter, sans-serif');
    expect(host.querySelector('text')?.textContent?.replace(/\s/g, '')).toBe(projection.label.replace(/\s/g, ''));
    stripVisible = false;
    await render();
    expect(Number(host.querySelector('text')!.getAttribute('y'))).toBe(10008);
    await render(1);
    expect(host.querySelector('text')).toBeNull();
    await render();
    expect(host.querySelector('text')?.textContent?.replace(/\s/g, '')).toBe(projection.label.replace(/\s/g, ''));
    const remove = vi.spyOn(fonts, 'removeEventListener');
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(remove).toHaveBeenCalledWith('loadingdone', expect.any(Function));
    await act(async () => { fonts.dispatchEvent(new Event('loadingdone')); });
    expect(host.textContent).toBe('');
  });

  it('uses an opaque readable ink/paper pair for all existing canvas skins', () => {
    const luminance = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    for (const palette of Object.values(BUILD_SKIN_PALETTES)) {
      const a = luminance(palette.ink), b = luminance(palette.ground);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
