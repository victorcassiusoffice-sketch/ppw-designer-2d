/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WalkMode from '../WalkMode';
import { WALK_CHARACTERS } from '../characters';
import type { SceneSolids } from '../../designer/roomSolids';
import type { Property } from '../../store/propertyStore';
import type { WalkStatus } from '../runtime';

const mock = vi.hoisted(() => ({
  create: vi.fn(),
  load: vi.fn(),
  escape: vi.fn(),
  dispose: vi.fn(),
  keyDown: vi.fn(),
  release: vi.fn(),
  onStatus: (_status: unknown) => {},
  finish: () => {},
}));
vi.mock('../runtime', () => ({
  WalkRuntime: class {
    constructor(
      _host: unknown,
      _solids: unknown,
      _property: unknown,
      onStatus: (status: unknown) => void,
    ) {
      mock.create();
      mock.onStatus = onStatus;
    }
    load(...args: unknown[]) {
      return mock.load(...args);
    }
    escape() {
      return mock.escape();
    }
    dispose() {
      mock.dispose();
    }
    keyDown(event: KeyboardEvent) {
      mock.keyDown(event);
    }
    clearInput() {}
  },
}));
vi.mock('../../components/three/ThreeStage', async () => {
  const React = await import('react');
  return {
    ThreeStage: React.forwardRef(({ onReady }: { onReady: () => void }, ref) => {
      React.useImperativeHandle(ref, () => ({ beginWalk: () => ({ release: mock.release }) }), []);
      React.useEffect(onReady, [onReady]);
      return <div data-testid="walk-scene-test" />;
    }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, frameId: number;
const frames = new Map<number, FrameRequestCallback>();
const property = { id: 'walk-choice', name: 'Choice test', rooms: [] } as unknown as Property;
const solids = {
  floors: [],
  walls: [],
  roofs: [],
  items: [],
  stairs: [],
  wallHeightM: 2.7,
} as SceneSolids;
const status: WalkStatus = {
  mode: 'third',
  door: null,
  blocked: false,
  locked: true,
  animation: 'idle',
  position: [0, 0, 0],
  camera: [0, 2, 2],
  fps: 60,
  low1: 60,
  frames: 1,
  entryMs: 500,
};
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent === name,
  )!;

beforeEach(() => {
  vi.clearAllMocks();
  frames.clear();
  frameId = 0;
  localStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    { width: 100, height: 30 },
  ] as unknown as DOMRectList);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  mock.load.mockImplementation((_character, _startedAt, progress: (message: string) => void) => {
    progress('Loading Maya… 45%');
    return new Promise<void>((resolve) => {
      mock.finish = () => {
        mock.onStatus(status);
        resolve();
      };
    });
  });
  mock.escape.mockReturnValue(false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function advanceFrame() {
  const pending = [...frames.entries()];
  await act(async () => {
    for (const [id, callback] of pending) {
      frames.delete(id);
      callback(performance.now());
    }
  });
}
async function start(
  prepareVisit: () => { property: Property; solids: SceneSolids },
  close = vi.fn(),
) {
  act(() => root.render(<WalkMode prepareVisit={prepareVisit} onClose={close} />));
  act(() => button('Start walk').click());
  await advanceFrame();
  await advanceFrame();
  await act(async () => {
    await vi.waitFor(() => expect(mock.load).toHaveBeenCalledOnce());
  });
}

describe('deferred character chooser', () => {
  it('draws four embedded PNGs without preparing a scene or starting the character loader', () => {
    const prepare = vi.fn(() => ({ property, solids }));
    act(() => root.render(<WalkMode prepareVisit={prepare} onClose={() => {}} />));
    expect(document.querySelector('[data-testid="walk-chooser"]')).not.toBeNull();
    const images = [
      ...document.querySelectorAll<HTMLImageElement>('[data-testid="walk-chooser"] img'),
    ];
    expect(images).toHaveLength(4);
    for (const [index, image] of images.entries()) {
      expect(image.getAttribute('src')).toBe(WALK_CHARACTERS[index].thumbnailDataUrl);
      expect(image.dataset.thumbnailSource).toBe(WALK_CHARACTERS[index].thumbnailUrl);
      const source = readFileSync(
        path.resolve('public', WALK_CHARACTERS[index].thumbnailUrl.slice(1)),
      );
      expect(source.byteLength).toBeLessThanOrEqual(20000);
      // Vite serves source URLs in tests; production inlining is checked in the browser audit.
      const copy = readFileSync(
        path.resolve('src/walk/thumbnails', path.basename(WALK_CHARACTERS[index].thumbnailUrl)),
      );
      expect(copy).toEqual(source);
      expect(WALK_CHARACTERS[index].thumbnailDataUrl).toMatch(
        /(?:^data:image\/png;base64,|\.png\?inline$)/,
      );
      expect(source.readUInt32BE(16)).toBe(64);
      expect(source.readUInt32BE(20)).toBe(64);
    }
    expect(prepare).not.toHaveBeenCalled();
    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.load).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="walk-scene-test"]')).toBeNull();
    expect(document.body.textContent).toContain('Esc frees the mouse');
  });

  it('paints preparation first, then loads only the chosen character with progress', async () => {
    const prepare = vi.fn(() => ({ property, solids }));
    act(() => root.render(<WalkMode prepareVisit={prepare} onClose={() => {}} />));
    act(() => button('Alex').click());
    expect(mock.load).not.toHaveBeenCalled();
    act(() => button('Start walk').click());
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Preparing your walk…');
    expect(prepare).not.toHaveBeenCalled();
    await advanceFrame();
    expect(prepare).not.toHaveBeenCalled();
    await advanceFrame();
    await act(async () => {
      await vi.waitFor(() => expect(mock.load).toHaveBeenCalledOnce());
    });
    expect(prepare).toHaveBeenCalledOnce();
    expect(mock.load.mock.calls[0][0].id).toBe('male-a');
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Loading Maya… 45%');
    expect(localStorage.getItem('olb-world-character-v1')).toBe('male-a');
  });

  it('keeps Walk open when Escape frees the mouse, then exits on the next Escape', async () => {
    const close = vi.fn();
    await start(() => ({ property, solids }), close);
    await act(async () => mock.finish());
    expect(document.querySelector('.world-walk-hint')?.textContent).toContain(
      'Esc frees the mouse',
    );
    mock.escape.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const pressEscape = () =>
      act(() =>
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
        ),
      );
    pressEscape();
    expect(close).not.toHaveBeenCalled();
    pressEscape();
    expect(close).toHaveBeenCalledOnce();
  });

  it('cancels preparation if the user leaves before Start work begins', async () => {
    const prepare = vi.fn(() => ({ property, solids }));
    act(() => root.render(<WalkMode prepareVisit={prepare} onClose={() => {}} />));
    act(() => button('Start walk').click());
    act(() => root.render(null));
    await advanceFrame();
    await advanceFrame();
    expect(prepare).not.toHaveBeenCalled();
    expect(mock.load).not.toHaveBeenCalled();
  });
});
