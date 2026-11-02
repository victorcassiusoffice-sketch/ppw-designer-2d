/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import PlumbingPitchPage from './PlumbingPitchPage';

const deferred = vi.hoisted(() => {
  let release!: () => void;
  let complete!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const finished = new Promise<void>(resolve => { complete = resolve; });
  return { ready, release, finished, complete, loads: 0 };
});
vi.mock('./PlumbingEnquiryForm', async importOriginal => {
  deferred.loads += 1;
  await deferred.ready;
  const module = await importOriginal();
  deferred.complete();
  return module;
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('plumbing form boundary', () => {
  it('loads the unchanged form only for its chapter and never submits while loading', async () => {
    history.replaceState(null, '', '/pitch/plumbing');
    const fetch = vi.spyOn(globalThis, 'fetch');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<PlumbingPitchPage />));
      expect(deferred.loads).toBe(0);
      expect(host.querySelector('form')).toBeNull();
      const nextStep = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(node => node.textContent?.includes('Next step'))!;
      act(() => nextStep.click());
      expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading form…');
      expect(host.querySelector('form')).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
      await act(async () => { deferred.release(); await deferred.finished; });
      expect(deferred.loads).toBe(1);
      expect(host.querySelector('[role="status"]')).toBeNull();
      expect(host.querySelector('form.pitch-enquiry')).not.toBeNull();
      expect(host.querySelector('input[name="email"]')).not.toBeNull();
      expect(host.querySelector('input[name="consent"]')).not.toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); history.replaceState(null, '', '/');
    }
  });
});
