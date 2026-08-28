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
 */
import { useState } from 'react';
import { useDesignsStore, DRAFT_ID } from '../store/designsStore';
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { isDrawnPolygon } from '../designer/roomLayout';
import { switchToPage, createPage } from '../lib/pages';

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
      className="flex items-center gap-1 overflow-x-auto border-b border-ppw-stone bg-ppw-sand px-2 py-1"
      data-testid="page-tabs"
    >
      <span className="mr-1 shrink-0 text-[10px] uppercase tracking-wide text-ppw-slate">
        Plans
      </span>

      {onDraft && (
        <span
          data-testid="page-tab-draft"
          className="shrink-0 rounded-t-md border border-ppw-teal bg-white px-3 py-1 text-xs font-semibold text-ppw-ink"
          title="This plan has not been named yet. Use Save as… to keep it."
        >
          {property.name || 'Untitled'} <span className="text-ppw-slate">· unsaved</span>
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
            className="w-32 shrink-0 rounded-t-md border border-ppw-teal px-2 py-1 text-xs"
          />
        ) : (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSwitch(p.id)}
            onDoubleClick={() => { setEditingId(p.id); setDraft(p.name); }}
            data-testid={`page-tab-${p.id}`}
            data-active={p.id === activeId}
            className={`shrink-0 rounded-t-md border px-3 py-1 text-xs font-medium ${
              p.id === activeId
                ? 'border-ppw-teal bg-white text-ppw-ink'
                : 'border-transparent text-ppw-slate hover:bg-white/60 hover:text-ppw-teal'
            }`}
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
        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-ppw-slate hover:text-ppw-teal"
        title="Start a separate plan — a different space or client"
      >
        +
      </button>

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
          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ppw-slate hover:text-ppw-coral"
          title="Delete this plan"
        >
          Delete plan
        </button>
      )}
    </div>
  );
}
