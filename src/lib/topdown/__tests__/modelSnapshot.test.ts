import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../data/products.schema';
import * as THREE from 'three';

const gpu = vi.hoisted(() => ({ created: 0, disposed: 0, rendered: 0, fail: false, camera: null as unknown, drawImage: vi.fn() }));
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return { ...actual,
    WebGLRenderer: class {
      domElement = {};
      shadowMap = { enabled: false, type: 0 };
      capabilities = { getMaxAnisotropy: () => 4 };
      constructor() { gpu.created++; }
      setPixelRatio() {}
      setClearColor() {}
      setSize() {}
      render(_scene: unknown, camera: unknown) { gpu.rendered++; gpu.camera = camera; if (gpu.fail) throw new Error('Context unavailable'); }
      dispose() { gpu.disposed++; }
      forceContextLoss() {}
    },
    PMREMGenerator: class { fromScene() { return new actual.WebGLRenderTarget(1, 1); } dispose() {} },
  };
});
vi.mock('../../../components/three/furniturePreview', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    furniturePreview: () => new actual.Group(),
    disposeFurnitureTextures: vi.fn(),
  };
});
vi.mock('../../../components/three/solarPanelPreview', () => ({ solarPanelPreview: () => null }));
vi.mock('../../../components/three/waterTankPreview', () => ({ waterTankPreview: () => null }));

const product = { id: 'courts-marco-sofa-corner', sku: 'SOFA', dimensions_cm: { length: 260, width: 102, height: 110 }, front_edge: 'bottom' } as Product;

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers();
  gpu.created = gpu.disposed = gpu.rendered = 0; gpu.fail = false; gpu.camera = null; gpu.drawImage.mockClear();
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: gpu.drawImage }) }) });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('shared plan model photographs', () => {
  it('caches a separate directional shadow canvas with metre offsets and a north-up projection', async () => {
    const { planModelShadowSnapshot } = await import('../modelSnapshot');
    const direction = { x: -0.45, y: 0.55 };
    const first = planModelShadowSnapshot(product, 90, direction);
    expect(planModelShadowSnapshot(product, 90, direction)).toBe(first);
    await vi.advanceTimersByTimeAsync(1);
    const result = (await first)!;
    expect(result.itemWidthM).toBeCloseTo(1.02);
    expect(result.itemDepthM).toBeCloseTo(2.6);
    expect(result.xM).toBeLessThan(0);
    expect(result.widthM).toBeGreaterThan(result.itemWidthM);
    expect(gpu.rendered).toBe(1);
    const camera = gpu.camera as THREE.OrthographicCamera;
    camera.updateMatrixWorld(true);
    const nw = new THREE.Vector3(result.xM, 0, result.yM).project(camera);
    const se = new THREE.Vector3(result.xM + result.widthM, 0, result.yM + result.depthM).project(camera);
    expect(nw.x).toBeCloseTo(-1); expect(nw.y).toBeCloseTo(1);
    expect(se.x).toBeCloseTo(1); expect(se.y).toBeCloseTo(-1);
    const movedLight = planModelShadowSnapshot(product, 90, { x: 0.45, y: 0.55 });
    await vi.advanceTimersByTimeAsync(1);
    expect((await movedLight)!.xM).toBeCloseTo(-0.08);
    expect(gpu.rendered).toBe(2);
  });
  it('renders a shared bitmap once and projects north-up at exact catalog bounds', async () => {
    const { planModelSnapshot } = await import('../modelSnapshot');
    const first = planModelSnapshot(product);
    expect(planModelSnapshot(product)).toBe(first);
    await vi.advanceTimersByTimeAsync(1);
    expect(await first).toMatchObject({ width: 512, height: 201 });
    expect(gpu.rendered).toBe(1);
    const camera = gpu.camera as THREE.OrthographicCamera;
    camera.updateMatrixWorld(true);
    const nw = new THREE.Vector3(0, 0, 0).project(camera);
    const se = new THREE.Vector3(2.6, 0, 1.02).project(camera);
    expect(nw.x).toBeCloseTo(-1); expect(nw.y).toBeCloseTo(1);
    expect(se.x).toBeCloseTo(1); expect(se.y).toBeCloseTo(-1);
  });
  it('releases idle GPU resources, keeps bitmaps, and can render a newly sized product later', async () => {
    const { planModelSnapshot } = await import('../modelSnapshot');
    const first = planModelSnapshot(product);
    await vi.advanceTimersByTimeAsync(1); const firstImage = await first;
    await vi.advanceTimersByTimeAsync(5001);
    expect(gpu.disposed).toBe(1);
    expect(await planModelSnapshot(product)).toBe(firstImage);
    expect(gpu.created).toBe(1);
    const changed = planModelSnapshot({ ...product, dimensions_cm: { ...product.dimensions_cm, width: 110 } });
    await vi.advanceTimersByTimeAsync(1);
    expect(await changed).not.toBeNull(); expect(gpu.created).toBe(2);
  });
  it('lets existing artwork handle rendering failure and never starts WebGL for unsupported products', async () => {
    const { planModelSnapshot } = await import('../modelSnapshot');
    expect(await planModelSnapshot({ ...product, id: 'unsupported' })).toBeNull();
    expect(gpu.created).toBe(0);
    gpu.fail = true;
    const failed = planModelSnapshot(product);
    await vi.advanceTimersByTimeAsync(1);
    expect(await failed).toBeNull();
    await vi.advanceTimersByTimeAsync(5001);
    expect(gpu.disposed).toBe(1);
  });
});
