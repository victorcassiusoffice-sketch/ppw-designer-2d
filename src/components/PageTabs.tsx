/**
 * PageTabs — the always-visible strip of separate PLANS.
 *
 * Vic 2026-08-28: rooms are attached areas on one canvas with real names; a
 * PAGE is a separate plan (a different client, a different premises).
 *
 * The plans themselves already existed in `designsStore` — named properties
 * with a `currentId` — but the only way to reach them was a Save-as / Load
 * dropdown that replaced the canvas destructively. Surfacing them as tabs is
 * what turns "saved files" into a thing you can actually work across, and the
 * switch now flushes the outgoing plan first so nothing is lost.
 *
 * 2026-08-29 toolbar contract: same chrome recipe as the bar (40 px controls,
 * radius 8, ink = active, terracotta rim only on the destructive action).
 */
import { useState } from 'react';
import { useDesignsStore, DRAFT_ID } from '../store/designsStore';
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { isDrawnPolygon } from '../designer/roomLayout';
import { switchToPage, createPage } from '../lib/pages';
import { StudioIcon } from './StudioIcon';

const TAB_BASE =
  'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-[12px] font-medium leading-none ' +
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] ' +
  'active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)]';
const TAB_REST = `${TAB_BASE} border-ppw-rim bg-ppw-chrome text-ppw-charcoal hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]`;
const TAB_ON = `${TAB_BASE} border-ppw-inkDeep bg-ppw-inkDeep text-ppw-paper`;
const TAB_DANGER = `${TAB_BASE} border-ppw-clay bg-ppw-chrome text-ppw-charcoal hover:bg-ppw-clay hover:text-white`;

export function PageTabs(): JSX.Element | null {
  const designs = useDesignsStore((s) => s.designs);
  const currentId = useDesignsStore((s) => s.currentId);
  const renamePage = useDesignsStore((s) => s.rename);
  const removePage = useDesignsStore((s) => s.remove);
  const property = usePropertyStore((s) => s.property);
  const pushToast = useToastStore((s) => s.push);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const pages = Object.values(designs)
    .filter((d) => d.id !== DRAFT_ID)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  // Read from the SUBSCRIBED value, not currentPageId()'s getState(), so the
  // strip re-renders when the active page changes.
  const activeId = currentId ?? DRAFT_ID;
  const onDraft = activeId === DRAFT_ID;

  // Nothing named yet and nothing drawn: the strip would be pure chrome.
  const anythingDrawn = property.rooms.some((r) => isDrawnPolygon(r.polygon));
  if (pages.length === 0 && !anythingDrawn) return null;

  function handleSwitch(id: string) {
    if (id === activeId) return;
    if (switchToPage(id)) {
      pushToast(`Switched to "${designs[id]?.name ?? 'plan'}"`, 'info');
    }
  }

  function handleNew() {
    // createPage promotes an unsaved draft to a real tab first, so pressing +
    // can never strand the work that is currently on screen.
    const id = createPage(`Plan ${pages.length + 2}`);
    pushToast('New plan started', 'success');
    setEditingId(id);
    setDraft(`Plan ${pages.length + 1}`);
  }

  function commitRename() {
    if (editingId) renamePage(editingId, draft.trim() || 'Untitled plan');
    setEditingId(null);
    setDraft('');
  }

  return (
    <div
      className="flex shrink-0 items-center gap-2 overflow-hidden border-b border-ppw-rim bg-ppw-rail px-3 py-1.5"
      data-testid="page-tabs"
    >
      <div className="page-tabs-scroll" role="tablist" aria-label="Plans">
      <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ppw-charcoal">
        Plans
      </span>

      {onDraft && (
        <span
          data-testid="page-tab-draft"
          className={TAB_ON}
          title="This plan has not been named yet. Use Save as… to keep it."
        >
          {property.name || 'Untitled'}
          <span className="text-[11px] font-medium opacity-80">· unsaved</span>
        </span>
      )}

      {pages.map((p) =>
        editingId === p.id ? (
          <input
            key={p.id}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditingId(null); setDraft(''); }
            }}
            data-testid={`page-tab-input-${p.id}`}
            aria-label="Plan name"
            className="h-10 w-36 shrink-0 rounded-lg border border-ppw-inkDeep bg-ppw-chrome px-3 text-[12px] font-medium text-ppw-inkDeep focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]"
          />
        ) : (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === activeId}
            onClick={() => handleSwitch(p.id)}
            onDoubleClick={() => { setEditingId(p.id); setDraft(p.name); }}
            data-testid={`page-tab-${p.id}`}
            data-active={p.id === activeId}
            className={p.id === activeId ? TAB_ON : TAB_REST}
            title="Click to open this plan · double-click to rename"
          >
            {p.name}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={handleNew}
        data-testid="page-tab-new"
        aria-label="New plan"
        className={`${TAB_REST} w-10 justify-center px-0`}
        title="Start a separate plan — a different space or client"
      >
        <StudioIcon name="plus" size={16} />
      </button>

      </div>

      {pages.length > 1 && activeId !== DRAFT_ID && (
        <button
          type="button"
          onClick={() => {
            const name = designs[activeId]?.name ?? 'plan';
            removePage(activeId);
            const next = pages.find((p) => p.id !== activeId);
            if (next) switchToPage(next.id);
            pushToast(`Deleted "${name}"`, 'info');
          }}
          data-testid="page-tab-delete"
          aria-label="Delete plan"
          className={`${TAB_DANGER} ml-auto`}
          title="Delete this plan"
        >
          <StudioIcon name="trash" size={16} />
          <span className="page-delete-label">Delete plan</span>
        </button>
      )}
    </div>
  );
}
