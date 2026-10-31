// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearPreviewLive,
  isOfflineDemo,
  previewLiveRequested,
  verifyPreviewLive,
} from '../previewMode';

afterEach(() => {
  clearPreviewLive();
  window.history.replaceState({}, '', '/');
});
const reply = (env: unknown) =>
  vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ env }), { headers: { 'Content-Type': 'application/json' } }),
  );
describe('preview-only live Site entry', () => {
  it('requires the explicit demo, site and live flags', () => {
    expect(previewLiveRequested('/demo', '?site=1&live=1')).toBe(true);
    expect(previewLiveRequested('/demo', '?site=1')).toBe(false);
    expect(previewLiveRequested('/demo', '?live=1')).toBe(false);
    expect(previewLiveRequested('/designer', '?site=1&live=1')).toBe(false);
  });
  it('makes no environment request for the normal offline sample', async () => {
    window.history.replaceState({}, '', '/demo?site=1');
    const request = reply('preview');
    expect(await verifyPreviewLive(undefined, request)).toBe(false);
    expect(request).not.toHaveBeenCalled();
    expect(isOfflineDemo()).toBe(true);
  });
  it.each(['production', 'development', 'unknown', undefined])(
    'stays offline for %s',
    async (env) => {
      window.history.replaceState({}, '', '/demo?site=1&live=1');
      expect(await verifyPreviewLive(undefined, reply(env))).toBe(false);
      expect(isOfflineDemo()).toBe(true);
    },
  );
  it('enables providers only after the same-origin server confirms preview', async () => {
    window.history.replaceState({}, '', '/demo?site=1&live=1');
    expect(isOfflineDemo()).toBe(true);
    const request = reply('preview');
    expect(await verifyPreviewLive(undefined, request)).toBe(true);
    expect(isOfflineDemo()).toBe(false);
    expect(request).toHaveBeenCalledWith(
      '/api/healthcheck',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store', redirect: 'error' }),
    );
    window.history.replaceState({}, '', '/demo?site=1');
    expect(isOfflineDemo()).toBe(true);
    clearPreviewLive();
    window.history.replaceState({}, '', '/demo?site=1&live=1');
    expect(isOfflineDemo()).toBe(true);
  });
  it('fails closed on network failure or aborted verification', async () => {
    window.history.replaceState({}, '', '/demo?site=1&live=1');
    const request = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    expect(await verifyPreviewLive(undefined, request)).toBe(false);
    const abort = new AbortController();
    abort.abort();
    expect(await verifyPreviewLive(abort.signal, reply('preview'))).toBe(false);
    expect(isOfflineDemo()).toBe(true);
  });
});
