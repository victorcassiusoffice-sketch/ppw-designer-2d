// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { buildingSolids } from '../../designer/buildingScene';
import type { Property } from '../../store/propertyStore';
import type { SceneInput } from '../../designer/roomView3d';
import type { WalkCharacter } from '../characters';
import { WalkRuntime, type WalkStatus } from '../runtime';

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

const character: WalkCharacter = { id: 'test', label: 'Test', url: '/character.glb', thumbnailUrl: '', thumbnailDataUrl: '',
  heightM: 1.7, bytes: 1, licence: 'CC0-1.0', source: 'test', clips: { idle: 'idle', walk: 'walk', run: 'sprint' } };
let runtime: WalkRuntime;
let canvas: HTMLCanvasElement;
let now: number;
let frame: FrameRequestCallback;
let locked: Element | null;
let render: ReturnType<typeof vi.fn>;
let onExit: ReturnType<typeof vi.fn>;
let statuses: WalkStatus[];

beforeEach(async () => {
  now = 1000; locked = null; statuses = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0]))));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => locked });
  document.exitPointerLock = () => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); };
  canvas = document.createElement('canvas'); document.body.append(canvas);
  Object.defineProperty(canvas, 'clientWidth', { value: 1280 }); Object.defineProperty(canvas, 'clientHeight', { value: 800 });
  canvas.requestPointerLock = async () => { locked = canvas; document.dispatchEvent(new Event('pointerlockchange')); };
  const property: Property = { id: 'runtime-test', name: 'Test', activeRoomId: 'room', rooms: [{ id: 'room', name: 'Room', placedItems: [],
    polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }] }] };
  const source = (p: Property): SceneInput => ({ wallHeightM: 2.7, cameraPos: { x: 8, y: 8, z: 8 }, cameraTarget: { x: 4, y: 4, z: 0 },
    rooms: p.rooms.map(room => ({ ...room, items: [] })) });
  render = vi.fn(); onExit = vi.fn();
  const host = { scene: new Scene(), renderer: { domElement: canvas, shadowMap: { needsUpdate: false }, compileAsync: vi.fn(async () => {}) }, render, release: vi.fn() };
  runtime = new WalkRuntime(host as unknown as ConstructorParameters<typeof WalkRuntime>[0], buildingSolids(property, source, 'building', true), property,
    status => statuses.push(status), onExit);
  await runtime.load(character, now);
});
afterEach(() => { runtime?.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const tick = () => { now += 20; frame(now); };
const releaseEscape = () => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape' }));

describe('walk runtime event lifecycle', () => {
  it('unlocks on the first Escape, suppresses repeats, then delegates the next Escape to the modal', () => {
    runtime.lock(); expect(document.pointerLockElement).toBe(canvas);
    expect(runtime.escape()).toBe(true); expect(document.pointerLockElement).toBeNull();
    expect(runtime.escape()).toBe(true); expect(onExit).not.toHaveBeenCalled();
    releaseEscape(); expect(runtime.escape()).toBe(false);
    tick(); expect(statuses[statuses.length - 1]?.locked).toBe(false);
  });

  it('handles native pointer unlock before Escape keydown and keeps blur from exiting the visit', () => {
    runtime.lock(); document.exitPointerLock();
    expect(runtime.escape()).toBe(true); releaseEscape(); expect(runtime.escape()).toBe(false);
    runtime.lock(); window.dispatchEvent(new Event('blur')); expect(document.pointerLockElement).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('lets an immediate second Escape exit when native pointerlockchange arrives after both keypresses', () => {
    runtime.lock();
    // Chromium clears pointerLockElement synchronously but may dispatch its
    // pointerlockchange after the next press, leaving Controls.isLocked stale.
    document.exitPointerLock = () => { locked = null; };
    expect(runtime.escape()).toBe(true); releaseEscape();
    expect(document.pointerLockElement).toBeNull();
    expect(runtime.escape()).toBe(false);
    expect(onExit).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('pointerlockchange'));
  });

  it('does not mistake its own delayed unlock event after keyup for a new native Escape', () => {
    runtime.lock(); document.exitPointerLock = () => { locked = null; };
    expect(runtime.escape()).toBe(true); releaseEscape();
    document.dispatchEvent(new Event('pointerlockchange'));
    expect(runtime.escape()).toBe(false);
  });

  it('ignores duplicate unlocked notifications when both queued lock and unlock events observe an unlocked DOM', () => {
    // Reopening can lock and unlock before either native change event fires.
    canvas.requestPointerLock = async () => { locked = canvas; };
    document.exitPointerLock = () => { locked = null; };
    runtime.lock(); expect(runtime.escape()).toBe(true); releaseEscape();
    document.dispatchEvent(new Event('pointerlockchange'));
    document.dispatchEvent(new Event('pointerlockchange'));
    expect(runtime.escape()).toBe(false);
  });

  it.each(['third', 'first'] as const)('reports only the first rendered moved frame after an armed keydown in %s person', mode => {
    if (mode === 'first') runtime.toggleView();
    tick(); expect(canvas.hasAttribute('data-walk-input-result')).toBe(false);
    const result = vi.fn(() => expect(render).toHaveBeenCalled());
    canvas.addEventListener('world-walk-input-result', result);
    canvas.dispatchEvent(new CustomEvent('world-walk-measure-input'));
    const key = new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' });
    Object.defineProperty(key, 'timeStamp', { value: now - 2 });
    runtime.keyDown(key); tick();
    const sample = JSON.parse(canvas.getAttribute('data-walk-input-result')!);
    expect(sample).toMatchObject({ inputAt: now - 22, handlerAt: now - 20, firstMovedRenderedAt: now, source: 'keyboard', key: 'KeyW', mode });
    expect(Math.hypot(sample.position[0] - sample.startPosition[0], sample.position[2] - sample.startPosition[1])).toBeGreaterThan(.01);
    tick(); expect(result).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending input sample on blur so later movement cannot be attributed to an old key', () => {
    canvas.dispatchEvent(new CustomEvent('world-walk-measure-input'));
    runtime.keyDown(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus'));
    runtime.keyDown(new KeyboardEvent('keydown', { code: 'KeyW' })); tick();
    expect(canvas.hasAttribute('data-walk-input-result')).toBe(false);
  });

  it('rejects invalid development poses and confirms a supported pose only after rendering its settled camera', () => {
    canvas.dispatchEvent(new CustomEvent('world-walk-test-pose', { detail: { position: [0, 0, 0], yaw: 0 } }));
    expect(JSON.parse(canvas.getAttribute('data-walk-test-pose')!).accepted).toBe(false);
    canvas.dispatchEvent(new CustomEvent('world-walk-test-pose', { detail: { position: [4, .001, 4], yaw: 0, baselineCamera: true } }));
    expect(canvas.hasAttribute('data-walk-test-pose')).toBe(false);
    for (let i = 0; i < 60; i++) tick();
    const proof = JSON.parse(canvas.getAttribute('data-walk-test-pose')!);
    expect(proof).toMatchObject({ accepted: true, baselineCamera: true, source: '52dfa87:src/walk/runtime.ts', fixture: { frames: 60 }, actorVisible: true, fov: 65 });
    expect(proof.camera[2]).toBeCloseTo(7.1, 3);
    expect(proof.camera[1]).toBeCloseTo(proof.position[1] + 2, 3);
  });
});
