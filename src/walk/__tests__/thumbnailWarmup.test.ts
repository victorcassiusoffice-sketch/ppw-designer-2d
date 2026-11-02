import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../data/products.schema';

const gpu = vi.hoisted(() => ({ compile: vi.fn(), render: vi.fn(), dispose: vi.fn() }));
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return { ...actual, WebGLRenderer: class {
    domElement = {}; shadowMap = {}; capabilities = { getMaxAnisotropy: () => 4 };
    setPixelRatio() {} setClearColor() {} setSize() {} forceContextLoss() {}
    compileAsync = gpu.compile; render = gpu.render; dispose = gpu.dispose;
  }, PMREMGenerator: class { fromScene() { return new actual.WebGLRenderTarget(1, 1); } dispose() {} } };
});
vi.mock('../../components/three/furniturePreview', async () => {
  const { Group } = await vi.importActual<typeof import('three')>('three');
  return { furniturePreview: () => new Group(), disposeFurnitureTextures: vi.fn() };
});
vi.mock('../../components/three/solarPanelPreview', () => ({ solarPanelPreview: () => null }));
vi.mock('../../components/three/waterTankPreview', () => ({ waterTankPreview: () => null }));
const product = { id: 'courts-marco-sofa-corner', sku: 'SOFA', dimensions_cm: { length: 260, width: 102, height: 110 }, front_edge: 'bottom' } as Product;

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); gpu.compile.mockReset(); gpu.render.mockReset(); gpu.dispose.mockReset();
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) }) });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('deferred plan thumbnail shader preparation', () => {
  it('keeps the queue and GPU resources alive while beauty compilation yields, then prepares the shadow before drawing', async () => {
    const { planModelSnapshot, planModelShadowSnapshot } = await import('../../lib/topdown/modelSnapshot');
    let finish!: () => void, finishShadow!: () => void;
    gpu.compile.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishShadow = resolve; }));
    const first = planModelSnapshot(product), second = planModelShadowSnapshot(product, 0, { x: .45, y: .55 });
    await vi.advanceTimersByTimeAsync(1);
    expect(gpu.compile).toHaveBeenCalledOnce(); expect(gpu.render).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6000); expect(gpu.dispose).not.toHaveBeenCalled();
    finish(); await first; await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(6000); expect(gpu.dispose).not.toHaveBeenCalled();
    finishShadow(); await second;
    expect(gpu.compile).toHaveBeenCalledTimes(2); expect(gpu.render).toHaveBeenCalledTimes(2);
    expect(gpu.compile.mock.invocationCallOrder[0]).toBeLessThan(gpu.render.mock.invocationCallOrder[0]);
    expect(gpu.compile.mock.invocationCallOrder[1]).toBeLessThan(gpu.render.mock.invocationCallOrder[1]);
    await vi.advanceTimersByTimeAsync(5001); expect(gpu.dispose).toHaveBeenCalledOnce();
  });

  it('catches asynchronous shader failure and allows the next thumbnail to complete', async () => {
    const { planModelSnapshot } = await import('../../lib/topdown/modelSnapshot');
    gpu.compile.mockRejectedValueOnce(new Error('context lost')).mockResolvedValue(undefined);
    const failed = planModelSnapshot(product);
    const next = planModelSnapshot({ ...product, dimensions_cm: { ...product.dimensions_cm, width: 120 } });
    await vi.advanceTimersByTimeAsync(1); expect(await failed).toBeNull();
    await vi.advanceTimersByTimeAsync(1); expect(await next).not.toBeNull();
    expect(gpu.render).toHaveBeenCalledOnce();
  });
});
