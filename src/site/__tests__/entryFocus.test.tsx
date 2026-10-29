// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceFocus } from '../../hooks/useWorkspaceFocus';
import SiteEntry from '../SiteEntry';

const checks = vi.hoisted(() => ({ verify: vi.fn(), clear: vi.fn() }));
vi.mock('../previewMode', () => ({
  previewLiveRequested: () => true,
  verifyPreviewLive: checks.verify,
  clearPreviewLive: checks.clear,
}));
vi.mock('../hydration', () => ({ hydrateCurrentSite: vi.fn(), siteHydrationWarning: vi.fn() }));
vi.mock('../SiteWorkspace', () => ({
  default: function Workspace({ onClose }: { onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useWorkspaceFocus(ref, onClose);
    return (
      <div ref={ref} data-testid="workspace">
        <button onClick={onClose}>Close workspace</button>
      </div>
    );
  },
}));

let root: Root;
let app: HTMLDivElement;
let resolve: (value: boolean) => void;
const key = (value: string) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  );
function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button aria-label="Site from the map">Site</button>
      {open && createPortal(<SiteEntry demo onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState({}, '', '/demo?site=1&live=1');
  checks.verify.mockReset().mockImplementation(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  checks.clear.mockReset();
  app = document.createElement('div');
  document.body.append(app);
  root = createRoot(app);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  app.remove();
  vi.unstubAllGlobals();
});
describe('deferred Site waiting screen', () => {
  it('blocks background Delete and restores focus/inert state when Escape cancels', async () => {
    const edit = vi.fn();
    document.addEventListener('keydown', edit);
    try {
      expect(app.hasAttribute('inert')).toBe(true);
      expect(document.activeElement?.textContent).toBe('Cancel');
      act(() => {
        key('Delete');
        key('Backspace');
      });
      expect(edit).not.toHaveBeenCalled();
      act(() => key('Escape'));
      expect(document.querySelector('[aria-label="Opening Site"]')).toBeNull();
      expect(app.hasAttribute('inert')).toBe(false);
      expect((checks.verify.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
      expect(checks.clear).toHaveBeenCalledOnce();
    } finally {
      document.removeEventListener('keydown', edit);
    }
  });
  it('hands focus ownership to the real workspace and disposes it on close', async () => {
    await act(async () => resolve(true));
    expect(document.querySelector('[aria-label="Opening Site"]')).toBeNull();
    expect(document.querySelector('[data-testid="workspace"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Close workspace');
    expect(app.hasAttribute('inert')).toBe(true);
    act(() => key('Escape'));
    expect(app.hasAttribute('inert')).toBe(false);
  });
  it('Cancel prevents a late verification result from opening the workspace', async () => {
    act(() => (document.activeElement as HTMLButtonElement).click());
    await act(async () => resolve(true));
    expect(document.querySelector('[data-testid="workspace"]')).toBeNull();
    expect(app.hasAttribute('inert')).toBe(false);
  });
});
