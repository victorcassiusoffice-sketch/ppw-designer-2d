// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createPage, currentPageId } from '../lib/pages';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignsStore } from '../store/designsStore';
import { sharedProperty } from './contract';
import { leave, resume, snapshot } from './client';

afterEach(async () => { await leave(true); sessionStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('reopens the invited tab after another tab saved a different active page, without uploading that page', async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ left: true }) });
  vi.stubGlobal('fetch', send);
  const sharedId = createPage('Shared fixture');
  const base = sharedProperty(usePropertyStore.getState().property);
  const other = createPage('Separate local design');
  const otherId = usePropertyStore.getState().property.id;
  sessionStorage.setItem('olb-live-build-v1', JSON.stringify({
    session: { page: sharedId, actorId: 'fixture', session: 'fixture', roomId: 'example' },
    revision: 1, base,
  }));
  resume();
  expect(snapshot().joined).toBe(true);
  expect(currentPageId()).toBe(sharedId);
  expect(usePropertyStore.getState().property.id).toBe(base.id);
  expect(useDesignsStore.getState().designs[other].property?.id).toBe(otherId);
  expect(send).not.toHaveBeenCalled();
  createPage('Leave intentionally');
  expect(snapshot().joined).toBe(false);
  expect(sessionStorage.getItem('olb-live-build-v1')).toBeNull();
});
