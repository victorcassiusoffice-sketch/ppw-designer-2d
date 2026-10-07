import { useLayoutEffect, useRef, type RefObject } from 'react';

interface Workspace {
  node: HTMLElement;
  escape: () => void;
  restore: HTMLElement | null;
  fallback: string;
}
const active: Workspace[] = [];
const inertBefore = new Map<HTMLElement, string | null>();
let observer: MutationObserver | null = null;
const focusSelector =
  'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])';
const visible = (element: HTMLElement): boolean =>
  !element.closest('[inert],[hidden]') && element.getClientRects().length > 0;
const focusable = (node: HTMLElement): HTMLElement[] =>
  [...node.querySelectorAll<HTMLElement>(focusSelector)].filter(visible).sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    return position & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : position & Node.DOCUMENT_POSITION_PRECEDING
        ? 1
        : 0;
  });

function focusFirst(workspace: Workspace): void {
  // The fallback is useful for a briefly empty loading view and DOM-based tests.
  (
    focusable(workspace.node)[0] ??
    workspace.node.querySelector<HTMLElement>(focusSelector) ??
    workspace.node
  ).focus({ preventScroll: true });
}
function restoreInert(node: HTMLElement, previous: string | null): void {
  if (previous === null) node.removeAttribute('inert');
  else node.setAttribute('inert', previous);
}
/** Only the top workbench is interactive, including during a React portal handover. */
function syncBackground(): void {
  const top = active[active.length - 1];
  if (!top) {
    for (const [node, previous] of inertBefore) restoreInert(node, previous);
    inertBefore.clear();
    return;
  }
  for (const child of [...document.body.children]) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === top.node || child.contains(top.node)) {
      if (inertBefore.has(child)) {
        restoreInert(child, inertBefore.get(child)!);
        inertBefore.delete(child);
      }
    } else {
      if (!inertBefore.has(child)) inertBefore.set(child, child.getAttribute('inert'));
      child.setAttribute('inert', '');
    }
  }
}
function captureKeys(event: KeyboardEvent): void {
  const workspace = active[active.length - 1];
  if (!workspace) return;
  // Prevent canvas/delete/history shortcuts from receiving workbench keystrokes.
  // Native editing, copying, typing and button activation remain browser defaults.
  event.stopImmediatePropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    workspace.escape();
  } else if (event.key === 'Tab') {
    const items = focusable(workspace.node),
      first = items[0],
      last = items[items.length - 1];
    const outside = !workspace.node.contains(document.activeElement);
    if (!items.length) {
      event.preventDefault();
      workspace.node.focus({ preventScroll: true });
    } else if (event.shiftKey && (document.activeElement === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  }
}

/** Modal-workspace focus/inert ownership shared by import, AI and services.
 * Ref-counted ownership avoids re-enabling the canvas during workspace switches.
 * Pass the actual workbench ref; it may be inside a portal backdrop. */
export function useWorkspaceFocus(
  host: RefObject<HTMLElement>,
  onEscape: () => void,
  options: { fallbackFocusSelector?: string } = {},
): void {
  const action = useRef(onEscape);
  action.current = onEscape;
  const fallback = useRef(options.fallbackFocusSelector);
  fallback.current = options.fallbackFocusSelector;
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const top = active[active.length - 1];
    const workspace: Workspace = {
      node,
      escape: () => action.current(),
      restore:
        top?.restore ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null),
      fallback: fallback.current ?? '[aria-label="Project tools"],[aria-label="Open menu"]',
    };
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    active.push(workspace);
    if (active.length === 1) {
      window.addEventListener('keydown', captureKeys, true);
      observer = new MutationObserver(syncBackground);
      observer.observe(document.body, { childList: true });
    }
    syncBackground();
    focusFirst(workspace);
    return () => {
      const index = active.indexOf(workspace);
      if (index >= 0) active.splice(index, 1);
      syncBackground();
      const next = active[active.length - 1];
      if (next) {
        if (!next.node.contains(document.activeElement)) focusFirst(next);
      } else {
        observer?.disconnect();
        observer = null;
        window.removeEventListener('keydown', captureKeys, true);
        const original = workspace.restore;
        if (original?.isConnected && !original.closest('[inert]') && original !== document.body)
          original.focus({ preventScroll: true });
        else
          [...document.querySelectorAll<HTMLElement>(workspace.fallback)]
            .find(visible)
            ?.focus({ preventScroll: true });
      }
    };
  }, [host]);
}
