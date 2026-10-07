/** @vitest-environment jsdom */
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceFocus } from '../useWorkspaceFocus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, app: HTMLDivElement, opener: HTMLButtonElement;
function Workbench({ id, escape }: { id: string; escape: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useWorkspaceFocus(ref, escape);
  return createPortal(
    <section ref={ref} data-workbench={id}>
      <button>First {id}</button>
      <input aria-label={`Input ${id}`} />
      <button>Last {id}</button>
    </section>,
    document.body,
  );
}
const key = (node: Element, key: string, shiftKey = false) =>
  act(() =>
    node.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
    ),
  );
const first = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-workbench="${id}"] button`)!;
const last = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-workbench="${id}"] button:last-child`)!;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    { width: 50, height: 30 },
  ] as unknown as DOMRectList);
  app = document.createElement('div');
  opener = document.createElement('button');
  opener.textContent = 'Launch';
  document.body.append(opener, app);
  opener.focus();
  root = createRoot(app);
});
afterEach(() => {
  act(() => root.unmount());
  app.remove();
  opener.remove();
  vi.restoreAllMocks();
});

describe('workspace focus and background ownership', () => {
  it('inerts the canvas, wraps Tab, isolates shortcuts, and returns focus after close', () => {
    const escape = vi.fn(),
      behind = vi.fn();
    window.addEventListener('keydown', behind);
    try {
      act(() => root.render(<Workbench id="one" escape={escape} />));
      expect(app.hasAttribute('inert')).toBe(true);
      expect(opener.hasAttribute('inert')).toBe(true);
      expect(document.activeElement).toBe(first('one'));
      key(first('one'), 'Tab', true);
      expect(document.activeElement).toBe(last('one'));
      key(last('one'), 'Tab');
      expect(document.activeElement).toBe(first('one'));
      key(first('one'), 'Delete');
      expect(behind).not.toHaveBeenCalled();
      key(first('one'), 'Escape');
      expect(escape).toHaveBeenCalledOnce();
      act(() => root.render(null));
      expect(app.hasAttribute('inert')).toBe(false);
      expect(opener.hasAttribute('inert')).toBe(false);
      expect(document.activeElement).toBe(opener);
    } finally {
      window.removeEventListener('keydown', behind);
    }
  });
  it('preserves pre-existing inert attributes and includes late-added background portals', async () => {
    const preexisting = document.createElement('aside');
    preexisting.setAttribute('inert', 'kept');
    document.body.append(preexisting);
    const late = document.createElement('aside');
    try {
      act(() => root.render(<Workbench id="one" escape={() => {}} />));
      await act(async () => {
        document.body.append(late);
        await Promise.resolve();
      });
      expect(late.hasAttribute('inert')).toBe(true);
      act(() => root.render(null));
      expect(late.hasAttribute('inert')).toBe(false);
      expect(preexisting.getAttribute('inert')).toBe('kept');
    } finally {
      preexisting.remove();
      late.remove();
    }
  });
  it('does not re-enable the house when another workspace remains active', () => {
    const render = (a: boolean, b: boolean) =>
      act(() =>
        root.render(
          <>
            {a && <Workbench key="a" id="a" escape={() => {}} />}
            {b && <Workbench key="b" id="b" escape={() => {}} />}
          </>,
        ),
      );
    render(true, false);
    render(true, true);
    expect(document.querySelector('[data-workbench="a"]')?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(first('b'));
    render(false, true);
    expect(app.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(first('b'));
    render(false, false);
    expect(app.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
  it('keeps focused input during rerenders and uses the latest Escape action', () => {
    const oldAction = vi.fn(),
      newAction = vi.fn();
    act(() => root.render(<Workbench id="a" escape={oldAction} />));
    const input = document.querySelector<HTMLInputElement>('[aria-label="Input a"]')!;
    input.focus();
    act(() => root.render(<Workbench id="a" escape={newAction} />));
    expect(document.activeElement).toBe(input);
    key(input, 'Escape');
    expect(newAction).toHaveBeenCalledOnce();
    expect(oldAction).not.toHaveBeenCalled();
  });
  it('falls back to a persistent project control if the launching menu was removed', () => {
    const fallback = document.createElement('button');
    fallback.setAttribute('aria-label', 'Project tools');
    document.body.append(fallback);
    try {
      act(() => root.render(<Workbench id="a" escape={() => {}} />));
      opener.remove();
      act(() => root.render(null));
      expect(document.activeElement).toBe(fallback);
    } finally {
      fallback.remove();
    }
  });
});
