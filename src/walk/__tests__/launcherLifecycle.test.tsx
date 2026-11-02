/** @vitest-environment jsdom */
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThreeStageHandle } from '../../components/three/ThreeStage';
import type { SceneInput } from '../../designer/roomView3d';
import type { Property } from '../../store/propertyStore';
import WalkLauncher from '../WalkLauncher';

const mock = vi.hoisted(() => ({
  close: () => {},
  build: vi.fn(() => ({ floors: [], roofs: [] })),
}));
vi.mock('../../designer/buildingScene', () => ({ buildingSolids: mock.build }));
vi.mock('../WalkMode', async () => {
  const { useState } = await import('react');
  return {
    default: function MockWalkMode({
      onClose,
      prepareVisit,
    }: {
      onClose: () => void;
      prepareVisit: () => unknown;
    }) {
      const [started, setStarted] = useState(false);
      mock.close = onClose;
      return (
        <div data-testid="visit">
          <span>{started ? 'Visit' : 'Chooser'}</span>
          <button
            onClick={() => {
              prepareVisit();
              setStarted(true);
            }}
          >
            Start walk
          </button>
          <button onClick={onClose}>Exit walk</button>
        </div>
      );
    },
  };
});

type Stage = Pick<ThreeStageHandle, 'beginWalk' | 'debug'>;
type Snapshot = { frames: number; paused: boolean };
const property = Object.freeze({
  id: 'unchanged',
  rooms: Object.freeze([]),
}) as unknown as Property;
const sceneForLevel = vi.fn(() => ({}) as SceneInput);
const onOpen = vi.fn();
let root: Root, host: HTMLDivElement, mounted: boolean;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stage(initialFrames = 7) {
  let frames = initialFrames;
  const release = vi.fn();
  const beginWalk = vi.fn(() => ({ release }) as unknown as ReturnType<Stage['beginWalk']>);
  // Reading anything besides the frame count would violate the snapshot's narrow contract.
  const debug = vi.fn((): ReturnType<Stage['debug']> => ({
    frames,
    children: 0,
    get camera(): number[] {
      throw new Error('Background snapshot must not read the camera');
    },
    target: [],
    renderer: 'test',
    hour: null,
    sun: null,
    presentation: 'studio',
    toneMapping: null,
    exposure: null,
    fog: null,
    cameraDistance: null,
  }));
  return {
    beginWalk,
    debug,
    release,
    setFrames: (value: number) => {
      frames = value;
    },
  };
}
function launch() {
  return host.querySelector<HTMLButtonElement>('[aria-label="Open Walk mode"]')!;
}
function snapshot(button = launch()): Snapshot | undefined {
  let result: Snapshot | undefined;
  button.addEventListener(
    'world-walk-background-result',
    (event) => {
      result = (event as CustomEvent<Snapshot>).detail;
    },
    { once: true },
  );
  button.dispatchEvent(new Event('world-walk-measure-background'));
  return result;
}
function render(stageRef: { current: Stage | null }) {
  act(() =>
    root.render(
      <StrictMode>
        <WalkLauncher
          property={property}
          sceneForLevel={sceneForLevel}
          onOpen={onOpen}
          stageRef={stageRef}
        />
      </StrictMode>,
    ),
  );
}
function unmount() {
  if (mounted) {
    act(() => root.unmount());
    mounted = false;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
  localStorage.clear();
  localStorage.setItem('ppw_property_v2', '{"unchanged":true}');
});
afterEach(() => {
  unmount();
  host.remove();
});

describe('covered designer render ownership', () => {
  it('does not pause, prepare a visit or read diagnostics before the launcher is clicked', () => {
    const original = stage();
    render({ current: original });
    expect(original.beginWalk).not.toHaveBeenCalled();
    expect(original.debug).not.toHaveBeenCalled();
    expect(mock.build).not.toHaveBeenCalled();
    expect(snapshot()).toEqual({ frames: 7, paused: false });
    expect(original.debug).toHaveBeenCalledOnce();
  });

  it('holds one acquisition through chooser and Start, then releases exactly once on repeated close and unmount', () => {
    const original = stage();
    original.release.mockImplementation(() => {
      expect(host.querySelector('[data-testid="visit"]')).toBeNull();
    });
    render({ current: original });
    act(() => {
      launch().click();
      launch().click();
    });
    expect(original.beginWalk).toHaveBeenCalledOnce();
    expect(snapshot()).toEqual({ frames: 7, paused: true });
    expect(mock.build).not.toHaveBeenCalled();
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="visit"] button')!.click());
    expect(host.textContent).toContain('Visit');
    expect(mock.build).toHaveBeenCalledOnce();
    expect(original.beginWalk).toHaveBeenCalledOnce();
    expect(original.release).not.toHaveBeenCalled();
    const close = mock.close;
    act(() => {
      close();
      close();
    });
    expect(snapshot()).toEqual({ frames: 7, paused: false });
    unmount();
    expect(original.release).toHaveBeenCalledOnce();
  });

  it.each([false, true])('releases on launcher unmount with visit started=%s', (started) => {
    const original = stage();
    render({ current: original });
    act(() => launch().click());
    if (started)
      act(() => host.querySelector<HTMLButtonElement>('[data-testid="visit"] button')!.click());
    const button = launch();
    unmount();
    expect(original.release).toHaveBeenCalledOnce();
    expect(snapshot(button)).toBeUndefined();
  });

  it('acquires a fresh handle on reopen and clears ownership before a reentrant release', () => {
    const original = stage();
    original.release.mockImplementation(() => mock.close());
    render({ current: original });
    act(() => launch().click());
    act(() => mock.close());
    expect(original.release).toHaveBeenCalledOnce();
    act(() => launch().click());
    expect(original.beginWalk).toHaveBeenCalledTimes(2);
    expect(snapshot()?.paused).toBe(true);
    act(() => mock.close());
    unmount();
    expect(original.release).toHaveBeenCalledTimes(2);
  });

  it('reads and releases the acquired original stage when the parent ref changes, without touching saved data or camera', () => {
    const original = stage(11),
      replacement = stage(90),
      ref: { current: Stage | null } = { current: original };
    const saved = localStorage.getItem('ppw_property_v2'),
      before = JSON.stringify(property);
    render(ref);
    act(() => launch().click());
    ref.current = replacement;
    expect(snapshot()).toEqual({ frames: 11, paused: true });
    act(() => mock.close());
    original.setFrames(12);
    expect(snapshot()).toEqual({ frames: 12, paused: false });
    expect(original.release).toHaveBeenCalledOnce();
    expect(replacement.beginWalk).not.toHaveBeenCalled();
    expect(replacement.debug).not.toHaveBeenCalled();
    expect(replacement.release).not.toHaveBeenCalled();
    expect(localStorage.getItem('ppw_property_v2')).toBe(saved);
    expect(JSON.stringify(property)).toBe(before);
  });

  it('keeps close and unmount safe when the original stage is unavailable', () => {
    render({ current: null });
    act(() => launch().click());
    expect(host.textContent).toContain('Chooser');
    expect(snapshot()).toBeUndefined();
    act(() => mock.close());
    unmount();
  });
});
