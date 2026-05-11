/**
 * RoomList — Week 2.5 multi-room sidebar (Model A — separate
 * canvases per room, RoomSketcher-style).
 *
 * Each row shows: room name (inline-rename), area (m²), placed-item
 * count, active indicator, delete button (with confirm).
 *
 * Desktop (≥ 768 px): vertical column to the left of ProductPalette.
 * Mobile (< 768 px):    collapses to a dropdown above the canvas.
 */

import { useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { polygonArea } from '../lib/geometry';
import { useToastStore } from '../store/toastStore';

export interface RoomListProps {
  /** Called when the user clicks "+ Add room" — parent opens the chooser. */
  onRequestAddRoom: () => void;
}

export function RoomList({ onRequestAddRoom }: RoomListProps) {
  const property = usePropertyStore((s) => s.property);
  const setActiveRoom = usePropertyStore((s) => s.setActiveRoom);
  const removeRoom = usePropertyStore((s) => s.removeRoom);
  const renameRoom = usePropertyStore((s) => s.renameRoom);
  const renameProperty = usePropertyStore((s) => s.renameProperty);

  const pushToast = useToastStore((s) => s.push);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState(property.name);
  const [mobileOpen, setMobileOpen] = useState(false);

  function startRename(id: string, current: string) {
    setEditingId(id);
    setDraftName(current);
  }

  function commitRename() {
    if (editingId) {
      renameRoom(editingId, draftName);
    }
    setEditingId(null);
    setDraftName('');
  }

  function commitPropertyRename() {
    renameProperty(propertyDraft);
    setEditingProperty(false);
  }

  function handleDelete(id: string, name: string) {
    if (property.rooms.length <= 1) {
      pushToast("A property must have at least one room.", 'warn');
      setConfirmingDeleteId(null);
      return;
    }
    removeRoom(id);
    pushToast(`Deleted "${name}"`, 'info');
    setConfirmingDeleteId(null);
  }

  const body = (
    <>
      <div className="border-b border-ppw-stone px-3 py-3">
        <p className="text-[10px] uppercase tracking-wide text-ppw-slate">Property</p>
        {editingProperty ? (
          <div className="mt-1 flex gap-1">
            <input
              autoFocus
              type="text"
              value={propertyDraft}
              onChange={(e) => setPropertyDraft(e.target.value)}
              onBlur={commitPropertyRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPropertyRename();
                if (e.key === 'Escape') {
                  setPropertyDraft(property.name);
                  setEditingProperty(false);
                }
              }}
              className="flex-1 rounded-md border border-ppw-teal bg-white px-2 py-1 text-sm font-semibold text-ppw-ink focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPropertyDraft(property.name);
              setEditingProperty(true);
            }}
            className="mt-0.5 block w-full truncate text-left text-sm font-semibold text-ppw-ink hover:text-ppw-teal"
            title="Rename property"
          >
            {property.name}
          </button>
        )}
        <p className="mt-0.5 text-[10px] text-ppw-slate">
          {property.rooms.length} room{property.rooms.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="scroll-pane flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1.5">
          {property.rooms.map((room) => {
            const isActive = room.id === property.activeRoomId;
            const area = polygonArea(room.polygon);
            const items = room.placedItems.length;
            const isEditing = editingId === room.id;
            const isConfirming = confirmingDeleteId === room.id;
            return (
              <li
                key={room.id}
                className={`group rounded-md border p-2 transition ${
                  isActive
                    ? 'border-ppw-teal bg-ppw-teal/5'
                    : 'border-ppw-stone bg-white hover:border-ppw-teal'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setDraftName('');
                        }
                      }}
                      className="flex-1 rounded-md border border-ppw-teal bg-white px-1.5 py-0.5 text-sm font-medium text-ppw-ink focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRoom(room.id);
                        setMobileOpen(false);
                      }}
                      onDoubleClick={() => startRename(room.id, room.name)}
                      className="min-w-0 flex-1 text-left"
                      title="Click to activate · double-click to rename"
                    >
                      <p
                        className={`truncate text-sm font-medium ${
                          isActive ? 'text-ppw-teal' : 'text-ppw-ink'
                        }`}
                      >
                        {room.name}
                        {isActive && (
                          <span className="ml-1.5 rounded-sm bg-ppw-teal px-1 py-[1px] text-[9px] font-semibold uppercase text-white">
                            Active
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ppw-slate">
                        {area.toFixed(2)} m² · {items} item{items === 1 ? '' : 's'}
                      </p>
                    </button>
                  )}
                  {!isEditing && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startRename(room.id, room.name)}
                        className="rounded-md border border-ppw-stone bg-white px-1.5 py-0.5 text-[10px] text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
                        title="Rename room"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(room.id)}
                        className="rounded-md border border-ppw-stone bg-white px-1.5 py-0.5 text-[10px] text-ppw-slate hover:border-ppw-coral hover:text-ppw-coral"
                        title="Delete room"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {isConfirming && (
                  <div className="mt-2 rounded-md border border-ppw-coral bg-ppw-coral/10 p-2 text-[11px]">
                    <p className="text-ppw-ink">Delete "{room.name}" and its items?</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(room.id, room.name)}
                        className="flex-1 rounded-md bg-ppw-coral px-2 py-1 text-[11px] font-semibold text-white hover:bg-ppw-coral/90"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="flex-1 rounded-md border border-ppw-stone bg-white px-2 py-1 text-[11px] font-semibold text-ppw-slate hover:border-ppw-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            onRequestAddRoom();
            setMobileOpen(false);
          }}
          className="mt-3 w-full rounded-md border-2 border-dashed border-ppw-stone bg-white px-3 py-2 text-xs font-semibold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
          title="Add a new room (rectangle quick mode or draw polygon)"
        >
          + Add room
        </button>
      </div>

      <div className="border-t border-ppw-stone bg-ppw-sand px-3 py-2 text-[10px] leading-snug text-ppw-slate">
        Click a room to switch · ✎ rename · × delete
      </div>
    </>
  );

  const activeRoom = property.rooms.find((r) => r.id === property.activeRoomId);

  return (
    <>
      <aside className="hidden md:flex h-full w-56 flex-col border-r border-ppw-stone bg-white">
        {body}
      </aside>

      {/* Mobile dropdown trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden absolute left-2 top-2 z-30 rounded-md border border-ppw-stone bg-white/95 px-2.5 py-1 text-xs font-medium text-ppw-ink shadow-sm hover:border-ppw-teal"
      >
        Rooms ({property.rooms.length})
        <span className="ml-1 text-ppw-slate">· {activeRoom?.name ?? '—'}</span>
      </button>

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed left-0 right-0 top-14 z-40 mx-2 flex max-h-[70vh] flex-col rounded-lg border border-ppw-stone bg-white shadow-2xl">
            {body}
          </aside>
        </>
      )}
    </>
  );
}
