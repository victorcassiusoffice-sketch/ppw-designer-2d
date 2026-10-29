// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AnimationClip, BoxGeometry, DirectionalLight, Fog, Group, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Scene, Vector3 } from 'three';
import { buildingSolids } from '../../designer/buildingScene';
import type { SceneInput } from '../../designer/roomView3d';
import type { Property } from '../../store/propertyStore';
import type { WalkCharacter } from '../characters';
import { WalkRuntime, type WalkStatus } from '../runtime';

const loader = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {
  setDRACOLoader() { return this; }
  parseAsync(...args: unknown[]) { return loader.parse(...args); }
} }));

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const character: WalkCharacter = { id: 'selected', label: 'Selected', url: '/selected.glb', thumbnailUrl: '', thumbnailDataUrl: '',
  heightM: 1.7, bytes: 1, licence: 'CC0-1.0', source: 'test', clips: { idle: 'idle', walk: 'walk', run: 'run' } };
let runtime: WalkRuntime, scene: Scene, canvas: HTMLCanvasElement, originalCanvas: HTMLCanvasElement;
let asset: Group, original: Mesh<BoxGeometry, MeshStandardMaterial>, light: DirectionalLight, property: Property, saved: string;
let now: number, frame: FrameRequestCallback | undefined, statuses: WalkStatus[];
let compile: ReturnType<typeof vi.fn<(scene: Scene, camera: PerspectiveCamera) => Promise<void>>>;
let render: ReturnType<typeof vi.fn>, release: ReturnType<typeof vi.fn>, request: ReturnType<typeof vi.fn>;
let compilation: ReturnType<typeof deferred<void>>, entered: ReturnType<typeof deferred<void>>;
let renderer: { domElement: HTMLCanvasElement; shadowMap: { enabled: boolean; type: number; needsUpdate: boolean }; toneMapping: number; toneMappingExposure: number; outputColorSpace: string; compileAsync: typeof compile; render: typeof render };
let assetGeometryDispose: MockInstance<() => void>, assetMaterialDispose: MockInstance<() => void>, originalDispose: MockInstance<() => void>;

beforeEach(() => {
  vi.useFakeTimers(); now = 1000; frame = undefined; statuses = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  request = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('requestAnimationFrame', request); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: null, arrayBuffer: async () => new ArrayBuffer(1) })));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  document.exitPointerLock = vi.fn();
  canvas = document.createElement('canvas'); originalCanvas = document.createElement('canvas'); document.body.append(originalCanvas, canvas);
  originalCanvas.dataset.camera = '{"azimuthRad":0.75,"distanceM":12}';
  originalCanvas.dataset.renderCamera = '{"position":[3,4,5]}';
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 1280 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 800 });
  canvas.requestPointerLock = vi.fn(async () => {});
  scene = new Scene(); scene.fog = new Fog('#d8e1d9', 30, 100);
  light = new DirectionalLight(0xffffff, 2); light.castShadow = true; light.shadow.mapSize.set(2048, 2048); scene.add(light);
  original = new Mesh(new BoxGeometry(1, 2, .1), new MeshStandardMaterial({ color: '#ab9988' }));
  const originalJoinery = new Group(); originalJoinery.userData.joinery = 'door';
  originalJoinery.add(...Array.from({ length: 6 }, () => new Object3D()), original); scene.add(originalJoinery);
  originalDispose = vi.spyOn(original.material, 'dispose');
  asset = new Group(); asset.name = 'selected-avatar';
  const mesh = new Mesh(new BoxGeometry(.4, 1.7, .3), new MeshStandardMaterial({ color: '#456789', roughness: .72 }));
  mesh.position.y = .85; asset.add(mesh);
  assetGeometryDispose = vi.spyOn(mesh.geometry, 'dispose'); assetMaterialDispose = vi.spyOn(mesh.material, 'dispose');
  loader.parse.mockResolvedValue({ scene: asset, animations: ['idle', 'walk', 'run'].map(name => new AnimationClip(name, 1, [])) });
  property = { id: 'preparation', name: 'Preparation', activeRoomId: 'room', rooms: [{ id: 'room', name: 'Room', placedItems: [],
    polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }],
    openings: [{ id: 'entry', edgeIndex: 0, offsetM: 4, widthM: 1.1, kind: 'door', flipFacing: false, flipHand: false }] }] };
  const source = (value: Property): SceneInput => ({ wallHeightM: 2.7, cameraPos: { x: 8, y: 8, z: 8 }, cameraTarget: { x: 4, y: 4, z: 0 },
    rooms: value.rooms.map(room => ({ ...room, items: [] })) });
  saved = JSON.stringify(property); localStorage.setItem('preparation-design', saved);
  // jsdom schedules a storage-event task for the fixture write. Drain it
  // before load so the timer assertions concern runtime preparation only.
  vi.advanceTimersByTime(0);
  compilation = deferred<void>(); entered = deferred<void>();
  compile = vi.fn(() => { entered.resolve(); return compilation.promise; });
  render = vi.fn(); release = vi.fn();
  renderer = { domElement: canvas, shadowMap: { enabled: true, type: 1, needsUpdate: false }, toneMapping: 0, toneMappingExposure: 1, outputColorSpace: 'srgb', compileAsync: compile, render };
  runtime = new WalkRuntime({ scene, renderer, fill: { current: null }, sky: { current: null }, bounds: { current: { centre: new Vector3(), radius: 4 } }, fogClearance: 3, release } as unknown as ConstructorParameters<typeof WalkRuntime>[0],
    buildingSolids(property, source, 'building', true), property, value => statuses.push(value), vi.fn());
});
afterEach(() => {
  runtime?.dispose(); original.geometry.dispose(); original.material.dispose(); document.body.innerHTML = ''; localStorage.clear();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
async function start() {
  const loading = runtime.load(character, now);
  const settlement = loading.then(() => ({ fulfilled: true, reason: undefined as unknown }), reason => ({ fulfilled: false, reason }));
  await entered.promise;
  return { loading, settlement };
}
const pose = (camera: PerspectiveCamera) => ({ position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far });
const quality = () => ({ enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type, mapSize: light.shadow.mapSize.toArray(), toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, colorSpace: renderer.outputColorSpace, fog: scene.fog?.toJSON() });

describe('selected Walk scene preparation', () => {
  it.each([[1280, 800, 65], [390, 844, 95]])('prepares the actual scene/camera at %sx%s before readiness without changing quality', async (width, height, expectedFov) => {
    Object.defineProperty(canvas, 'clientWidth', { value: width }); Object.defineProperty(canvas, 'clientHeight', { value: height });
    const beforeQuality = quality(), originalCamera = { ...originalCanvas.dataset };
    const { loading } = await start();
    expect(compile).toHaveBeenCalledOnce();
    const [preparedScene, camera] = compile.mock.calls[0];
    expect(preparedScene).toBe(scene); expect(camera).toBeInstanceOf(PerspectiveCamera);
    expect(scene.getObjectByName('selected-avatar')).toBe(asset);
    expect(asset.parent?.position.length()).toBeGreaterThan(1);
    const door = scene.children.find(child => child instanceof Group && child !== asset.parent && child !== original.parent)!;
    expect(door.position.length()).toBeGreaterThan(1);
    expect(camera.position.length()).toBeGreaterThan(1); expect(camera.fov).toBe(expectedFov); expect(camera.aspect).toBe(width / height);
    expect(quality()).toEqual(beforeQuality); expect(original.visible).toBe(false);
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledWith('/selected.glb', expect.any(Object));
    expect(request).not.toHaveBeenCalled(); expect(render).not.toHaveBeenCalled(); expect(statuses).toEqual([]);
    const preparedPose = pose(camera), actorPosition = asset.parent!.position.toArray(), doorPosition = door.position.toArray();
    now = 1450; compilation.resolve(); await loading;
    expect(request).toHaveBeenCalledOnce(); expect(statuses).toEqual([]);
    frame!(now);
    expect(render).toHaveBeenCalledWith(scene, camera); expect(pose(camera)).toEqual(preparedPose);
    expect(asset.parent!.position.toArray()).toEqual(actorPosition); expect(door.position.toArray()).toEqual(doorPosition);
    expect(statuses[0]).toMatchObject({ entryMs: 450, mode: 'third', animation: 'idle', frames: 1 });
    expect((scene.fog as Fog).near).toBeCloseTo(camera.position.length() + 7);
    expect((scene.fog as Fog).far - (scene.fog as Fog).near).toBeCloseTo(60);
    expect(quality()).toEqual({ ...beforeQuality, fog: scene.fog?.toJSON() });
    expect(assetGeometryDispose).not.toHaveBeenCalled(); expect(assetMaterialDispose).not.toHaveBeenCalled();
    runtime.dispose();
    expect(release).toHaveBeenCalledOnce(); expect(original.visible).toBe(true); expect(originalDispose).not.toHaveBeenCalled();
    expect(JSON.stringify(property)).toBe(saved); expect(localStorage.getItem('preparation-design')).toBe(saved);
    expect({ ...originalCanvas.dataset }).toEqual(originalCamera); expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores movement, view, look and interaction while preparation is pending, keeping Escape available', async () => {
    const { loading } = await start(), camera = compile.mock.calls[0][1], before = pose(camera);
    runtime.keyDown(new KeyboardEvent('keydown', { code: 'KeyW' })); runtime.keyDown(new KeyboardEvent('keydown', { code: 'KeyV' }));
    runtime.setStick(1, -1); runtime.setRunning(true); runtime.toggleView(); runtime.dragLook(200, 50); runtime.lock();
    expect(runtime.interact()).toBe(false); expect(runtime.escape()).toBe(false);
    expect(canvas.requestPointerLock).not.toHaveBeenCalled(); expect(pose(camera)).toEqual(before);
    compilation.resolve(); await loading; frame!(now);
    expect(statuses[0]).toMatchObject({ mode: 'third', animation: 'idle' }); expect(pose(camera)).toEqual(before);
    const position = statuses[0].position;
    runtime.keyDown(new KeyboardEvent('keydown', { code: 'KeyW' })); now += 300; frame!(now);
    expect(statuses[statuses.length - 1].animation).toBe('walk');
    expect(statuses[statuses.length - 1].position).not.toEqual(position);
  });

  it.each(['resolve', 'reject'] as const)('disposes once while pending and ignores late compilation %s', async completion => {
    const { settlement } = await start();
    runtime.dispose(); runtime.dispose();
    const result = await settlement;
    expect(result.fulfilled).toBe(false); expect(String(result.reason)).toContain('cancelled');
    if (completion === 'resolve') compilation.resolve(); else compilation.reject(new Error('late compilation failure'));
    await Promise.resolve(); await Promise.resolve();
    expect(request).not.toHaveBeenCalled(); expect(statuses).toEqual([]); expect(render).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce(); expect(assetGeometryDispose).toHaveBeenCalledOnce(); expect(assetMaterialDispose).toHaveBeenCalledOnce();
    expect(original.visible).toBe(true); expect(originalDispose).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the existing load deadline to reject a compile that never settles', async () => {
    const { settlement } = await start();
    await vi.advanceTimersByTimeAsync(20000);
    const result = await settlement;
    expect(result.fulfilled).toBe(false); expect(String(result.reason)).toContain('took too long');
    expect(request).not.toHaveBeenCalled(); expect(statuses).toEqual([]); expect(vi.getTimerCount()).toBe(0);
    // The modal's existing error path owns release, just as for fetch/decode failures.
    runtime.dispose(); runtime.dispose(); compilation.resolve(); await Promise.resolve();
    expect(release).toHaveBeenCalledOnce(); expect(assetMaterialDispose).toHaveBeenCalledOnce();
  });

  it.each(['throw', 'reject'] as const)('propagates a synchronous/asynchronous compile %s without publishing readiness', async failure => {
    const error = new Error('preparation failed');
    if (failure === 'throw') compile.mockImplementation(() => { entered.resolve(); throw error; });
    const { settlement } = await start();
    if (failure === 'reject') compilation.reject(error);
    expect(await settlement).toEqual({ fulfilled: false, reason: error });
    expect(request).not.toHaveBeenCalled(); expect(render).not.toHaveBeenCalled(); expect(statuses).toEqual([]);
    expect(vi.getTimerCount()).toBe(0); runtime.dispose(); runtime.dispose();
    expect(release).toHaveBeenCalledOnce(); expect(assetMaterialDispose).toHaveBeenCalledOnce(); expect(originalDispose).not.toHaveBeenCalled();
  });
});
