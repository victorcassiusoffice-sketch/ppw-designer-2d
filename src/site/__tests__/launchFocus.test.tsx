// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceFocus } from '../../hooks/useWorkspaceFocus';
import { usePropertyStore } from '../../store/propertyStore';
import { SiteLaunchButton } from '../SiteLaunchButton';

const gate = vi.hoisted(() => ({ pending: true, promise: Promise.resolve() as Promise<void> }));
vi.mock('../SiteEntry', () => ({
  default: function SuspendedEntry({ onClose }: { onClose: () => void }) {
    if (gate.pending) throw gate.promise;
    return <LoadedWorkspace onClose={onClose} />;
  },
}));
function LoadedWorkspace({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useWorkspaceFocus(ref, onClose);
  return (
    <div ref={ref} data-testid="loaded-site">
      <button onClick={onClose}>Close workspace</button>
    </div>
  );
}

const original = usePropertyStore.getState().property;
let root: Root;
let app: HTMLDivElement;
let resolve: () => void;
const key = (value: string) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  );
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  gate.pending = true;
  gate.promise = new Promise<void>((done) => {
    resolve = done;
  });
  window.history.replaceState({}, '', '/demo?view=2d&site=1');
  const property = { ...original };
  delete property.site;
  usePropertyStore.setState({ property });
  app = document.createElement('div');
  document.body.append(app);
  root = createRoot(app);
  await act(async () => root.render(<SiteLaunchButton />));
  const opener = app.querySelector('button')!;
  opener.focus();
  await act(async () => opener.click());
});
afterEach(async () => {
  gate.pending = false;
  await act(async () => {
    resolve();
    root.unmount();
  });
  app.remove();
  usePropertyStore.setState({ property: original });
  vi.unstubAllGlobals();
});
describe('Site initial Suspense fallback', () => {
  it('owns focus and background inertness, blocks Delete, and Escape cancels a pending entry', async () => {
    const backgroundEdit = vi.fn();
    document.addEventListener('keydown', backgroundEdit);
    try {
      expect(document.querySelector('[aria-label="Opening Site"]')?.textContent).toContain(
        'Opening Site…',
      );
      expect(app.hasAttribute('inert')).toBe(true);
      expect(document.activeElement?.textContent).toBe('Cancel');
      expect(
        (document.querySelector('[aria-label="Opening Site"]') as HTMLElement).style.position,
      ).toBe('fixed');
      expect((document.activeElement as HTMLElement).style.minHeight).toBe('44px');
      act(() => {
        key('Delete');
        key('Backspace');
      });
      expect(backgroundEdit).not.toHaveBeenCalled();
      act(() => key('Escape'));
      expect(app.hasAttribute('inert')).toBe(false);
      expect(document.activeElement).toBe(app.querySelector('button'));
      expect(document.querySelector('[aria-label="Opening Site"]')).toBeNull();
      gate.pending = false;
      await act(async () => resolve());
      expect(document.querySelector('[data-testid="loaded-site"]')).toBeNull();
    } finally {
      document.removeEventListener('keydown', backgroundEdit);
    }
  });
  it('hands modal ownership to the loaded entry without leaving the canvas interactive', async () => {
    gate.pending = false;
    await act(async () => resolve());
    expect(document.querySelector('[aria-label="Opening Site"]')).toBeNull();
    expect(document.querySelector('[data-testid="loaded-site"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Close workspace');
    expect(app.hasAttribute('inert')).toBe(true);
    act(() => key('Escape'));
    expect(app.hasAttribute('inert')).toBe(false);
  });
});
