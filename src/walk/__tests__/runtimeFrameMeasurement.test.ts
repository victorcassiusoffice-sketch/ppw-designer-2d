// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { buildingSolids } from '../../designer/buildingScene';
import type { Property } from '../../store/propertyStore';
import type { SceneInput } from '../../designer/roomView3d';
import type { WalkCharacter } from '../characters';
import { WalkRuntime } from '../runtime';
import type { FrameMeasurementResult } from '../frameMeasurement';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', async () => {
  const { AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial } = await import('three');
  return { GLTFLoader: class {
    setDRACOLoader() { return this; }
    async parseAsync() {
      const scene = new Group(), mesh = new Mesh(new BoxGeometry(.4, 1.7, .3), new MeshStandardMaterial());
      mesh.position.y = .85; scene.add(mesh);
      return { scene, animations: ['idle', 'walk', 'sprint'].map(name => new AnimationClip(name, 1, [])) };
    }
  } };
});

let runtime: WalkRuntime, canvas: HTMLCanvasElement, now: number, frame: FrameRequestCallback;
let render: ReturnType<typeof vi.fn>, results: FrameMeasurementResult[];
const character: WalkCharacter = { id: 'test', label: 'Test', url: '/test.glb', thumbnailUrl: '', thumbnailDataUrl: '',
  heightM: 1.7, bytes: 1, licence: 'CC0-1.0', source: 'test', clips: { idle: 'idle', walk: 'walk', run: 'sprint' } };
beforeEach(async () => {
  vi.useFakeTimers(); now = 1000; results = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0]))));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.exitPointerLock = vi.fn();
  canvas = document.createElement('canvas'); document.body.append(canvas);
  Object.defineProperty(canvas, 'clientWidth', { value: 1280 }); Object.defineProperty(canvas, 'clientHeight', { value: 800 });
  const property: Property = { id: 'frame-measurement', name: 'Test', activeRoomId: 'room', rooms: [{ id: 'room', name: 'Room', placedItems: [],
    polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }] }] };
  const source = (p: Property): SceneInput => ({ wallHeightM: 2.7, cameraPos: { x: 8, y: 8, z: 8 }, cameraTarget: { x: 4, y: 4, z: 0 }, rooms: p.rooms.map(room => ({ ...room, items: [] })) });
  render = vi.fn();
  const host = { scene: new Scene(), renderer: { domElement: canvas, shadowMap: { needsUpdate: false }, compileAsync: vi.fn(async () => {}) }, render, release: vi.fn() };
  runtime = new WalkRuntime(host as unknown as ConstructorParameters<typeof WalkRuntime>[0], buildingSolids(property, source, 'building', true), property, vi.fn(), vi.fn());
  canvas.addEventListener('world-walk-frame-result', event => results.push((event as CustomEvent<FrameMeasurementResult>).detail));
  await runtime.load(character, now);
});
afterEach(() => { runtime?.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const arm = (durationMs: number) => canvas.dispatchEvent(new CustomEvent('world-walk-measure-frames', { detail: { durationMs } }));
const tick = (elapsed = 20) => { now += elapsed; frame(now); };

describe('runtime frame-measurement lifecycle', () => {
  it('is opt-in, emits once after completed renders, and retains a 500ms active stall', () => {
    tick(); expect(canvas.hasAttribute('data-walk-frame-result')).toBe(false);
    arm(1000); tick(); tick(500); expect(results).toHaveLength(0);
    tick(480);
    expect(render).toHaveBeenCalledTimes(4);
    expect(results).toHaveLength(1);
    expect(results[0].intervals.map(i => i.durationMs)).toEqual([20, 500, 480]);
    expect(results[0]).toMatchObject({ reason: 'deadline', completedFrames: 3, activeMs: 1000 });
    expect(JSON.parse(canvas.dataset.walkFrameResult!)).toEqual(results[0]);
    tick(); expect(results).toHaveLength(1);
  });

  it('finishes from its deadline timer even when focus and visibility stop rendering', () => {
    arm(1000); tick(); now += 30; window.dispatchEvent(new Event('blur'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    now = 2000; vi.advanceTimersByTime(1000);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ reason: 'deadline', activeMs: 50, pausedMs: 950, completedFrames: 1 });
    expect(results[0].transitions.map(t => t.reason)).toEqual(['armed', 'blur', 'hidden']);
  });

  it('resumes without charging the focus gap to an active render interval', () => {
    arm(1000); tick(); now = 1050; window.dispatchEvent(new Event('blur'));
    now = 1450; window.dispatchEvent(new Event('focus')); tick();
    now = 2000; vi.advanceTimersByTime(1000);
    expect(results[0]).toMatchObject({ activeMs: 600, pausedMs: 400, completedFrames: 2 });
    expect(results[0].intervals.map(i => i.durationMs)).toEqual([20, 20]);
  });

  it('publishes a partial disposal result, clears its timer and removes the arming listener', () => {
    arm(1000); tick(); runtime.dispose();
    expect(results).toHaveLength(1); expect(results[0]).toMatchObject({ reason: 'disposed', observedMs: 20, completedFrames: 1 });
    now = 3000; vi.advanceTimersByTime(2000); arm(1000); vi.advanceTimersByTime(2000);
    expect(results).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
  });

  it('cannot re-arm from a disposal-result listener while disposal is in progress', () => {
    canvas.addEventListener('world-walk-frame-result', () => arm(1000));
    arm(1000); tick(); runtime.dispose();
    expect(results).toHaveLength(1); expect(results[0].reason).toBe('disposed');
    expect(vi.getTimerCount()).toBe(0);
    now = 3000; vi.advanceTimersByTime(2000);
    expect(results).toHaveLength(1);
  });

  it('rejects unbounded durations and ignores re-arming instead of silently replacing an active window', () => {
    for (const duration of [0, -100, 50, Infinity, NaN, 120001]) arm(duration);
    expect(vi.getTimerCount()).toBe(0);
    arm(100); now = 1020; arm(1000); now = 1100; vi.advanceTimersByTime(100);
    expect(results).toHaveLength(1); expect(results[0]).toMatchObject({ requestedMs: 100, startedAt: 1000, deadlineAt: 1100, reason: 'deadline' });
  });
});
