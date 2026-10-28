import { expect, test, type Page } from '@playwright/test';

// A real WebGL regression: intercept the browser's canvas allocations, rather
// than asserting which helper name appears in ThreeStage's source.
type Allocation = { axis: 'width' | 'height'; value: number; cssWidth: number; cssHeight: number; at: number };
type BufferWindow = Window & { __bufferAllocations: Allocation[] };
test.use({ launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP *.vercel.app 216.198.79.3'] } });
const read = (page: Page) => page.getByTestId('wallpaint-3d-gl').evaluate(canvas => {
  const surface = canvas as HTMLCanvasElement;
  const rect = surface.getBoundingClientRect();
  const gl = surface.getContext('webgl2')!;
  return {
    width: surface.width, height: surface.height,
    cssWidth: Math.round(rect.width), cssHeight: Math.round(rect.height),
    css: surface.getAttribute('style'), viewport: Array.from(gl.getParameter(gl.VIEWPORT) as Int32Array),
    error: gl.getError(), quality: surface.dataset.quality, shading: surface.dataset.shading,
    writes: (window as BufferWindow).__bufferAllocations,
  };
});
async function assertBuffer(page: Page, ratio: number) {
  await expect.poll(async () => {
    const r = await read(page);
    return r.width === Math.floor(r.cssWidth * ratio) && r.height === Math.floor(r.cssHeight * ratio);
  }).toBe(true);
  const r = await read(page);
  expect(r.viewport).toEqual([0, 0, r.width, r.height]);
  expect(r.error).toBe(0);
  return r;
}

for (const device of [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, scale: 2 },
  { name: 'phone', viewport: { width: 390, height: 844 }, scale: 3 },
]) test.describe(device.name, () => {
  test.use({ viewport: device.viewport, deviceScaleFactor: device.scale, hasTouch: device.name === 'phone' });
  test('allocates at final density once, preserves CSS, and resizes only for actual layout/density changes', async ({ page }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [], writes: string[] = [];
    // Browser navigation uses the same pinned host as the application. The
    // separate Node API request client does not inherit Chromium's resolver.
    const health = await page.goto('/api/healthcheck');
    expect(health?.ok()).toBe(true);
    await info.attach('health.json', { body: await page.locator('body').innerText(), contentType: 'application/json' });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        writes.push(route.request().url()); return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('olb-render-quality-v1', JSON.stringify({ state: { choice: 'medium' }, version: 0 }));
      const records: Allocation[] = (window as BufferWindow).__bufferAllocations = [];
      for (const axis of ['width', 'height'] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, axis)!;
        Object.defineProperty(HTMLCanvasElement.prototype, axis, {
          ...descriptor,
          set(this: HTMLCanvasElement, value: number) {
            if (this.dataset.testid === 'wallpaint-3d-gl') {
              const rect = this.getBoundingClientRect();
              records.push({ axis, value, cssWidth: Math.round(rect.width), cssHeight: Math.round(rect.height), at: performance.now() });
            }
            descriptor.set!.call(this, value);
          },
        });
      }
    });
    await page.goto('/demo?view=3d&pitch=1');
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="wallpaint-3d-gl"]')?.getAttribute('data-first-picture-ms')) > 0);
    const initial = await assertBuffer(page, 1.5);
    await info.attach('initial-buffer.json', { body: JSON.stringify(initial, null, 2), contentType: 'application/json' });
    expect(initial.writes.length).toBeGreaterThanOrEqual(2);
    expect(initial.writes.length % 2).toBe(0);
    for (let i = 0; i < initial.writes.length; i += 2) {
      const [width, height] = initial.writes.slice(i, i + 2);
      expect([width.axis, height.axis]).toEqual(['width', 'height']);
      expect(width.value).toBe(Math.floor(width.cssWidth * 1.5));
      expect(height.value).toBe(Math.floor(height.cssHeight * 1.5));
      if (i > 0) expect([width.value, height.value]).not.toEqual([initial.writes[i - 2].value, initial.writes[i - 1].value]);
    }
    await page.getByTestId('house-view-settings').click();
    const beforeOrbit = (await read(page)).writes.length;
    await page.getByTestId('wallpaint-3d-rotate-left').click();
    await page.waitForTimeout(150);
    expect((await read(page)).writes).toHaveLength(beforeOrbit);
    for (const [choice, ratio] of [['low', 1], ['high', 2], ['medium', 1.5]] as const) {
      const before = (await read(page)).writes.length;
      await page.getByRole('combobox', { name: '3D rendering quality' }).selectOption(choice);
      const after = await assertBuffer(page, ratio);
      expect(after.writes).toHaveLength(before + 2);
      expect(after.css).toBe(initial.css);
    }
    const beforeResize = (await read(page)).writes.length;
    await page.setViewportSize({ width: device.viewport.width - 20, height: device.viewport.height - 30 });
    await expect.poll(async () => (await read(page)).writes.length).toBeGreaterThan(beforeResize);
    const resized = await assertBuffer(page, 1.5);
    expect(resized.writes.length).toBeGreaterThan(beforeResize);
    expect(resized.css).toBe(initial.css);
    await info.attach('final-buffer.json', { body: JSON.stringify(resized, null, 2), contentType: 'application/json' });
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
});
