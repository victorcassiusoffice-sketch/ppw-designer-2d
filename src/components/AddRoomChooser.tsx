/**
 * AddRoomChooser — modal opened from RoomList's "+ Add room" button.
 *
 * Lets the user pick between:
 *   - Rectangle quick mode (asks for L × W, commits immediately)
 *   - Draw mode (defers to the canvas overlay — caller flips top-level state)
 *
 * The modal does NOT do polygon drawing itself; for draw mode it just
 * tells the parent App to enter draw mode, where RoomDrawMode takes over.
 */

import { useState } from 'react';
import { usePropertyStore, selectActiveRoom } from '../store/propertyStore';
import { nextRoomName, ROOM_TYPES } from '../designer/roomNaming';
import { useToastStore } from '../store/toastStore';
import { rectToPolygon } from '../lib/geometry';
// Attached multi-room (2026-08-26) — a new rectangle attaches flush-right
// of the plan instead of landing on top of it at the origin.
import { isDrawnPolygon, nextRectanglePosition, translatePolygon } from '../designer/roomLayout';

export interface AddRoomChooserProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user picks "Draw mode" — caller enters draw mode. */
  onRequestDrawMode: () => void;
}

export function AddRoomChooser({ open, onClose, onRequestDrawMode }: AddRoomChooserProps) {
  const addRectangleRoom = usePropertyStore((s) => s.addRectangleRoom);
  const pushToast = useToastStore((s) => s.push);

  // Seeded from the shared vocabulary rather than the placeholder "New Room",
  // so the field opens with a real, usable name the customer can accept or
  // replace instead of a label nobody would ship.
  const [name, setName] = useState(() =>
    nextRoomName(usePropertyStore.getState().property.rooms),
  );
  const [lengthM, setLengthM] = useState(5);
  const [widthM, setWidthM] = useState(4);
  const [mode, setMode] = useState<'rect' | 'draw'>('rect');

  if (!open) return null;

  function clampDim(n: number): number {
    return Math.max(1, Math.min(50, Number.isFinite(n) ? n : 1));
  }

  function commitRectangle() {
    const L = clampDim(lengthM);
    const W = clampDim(widthM);
    const ps = usePropertyStore.getState();
    const trimmed = name.trim() || nextRoomName(ps.property.rooms);
    // Anchor flush-right of everything already drawn, so the new rectangle
    // SHARES the plan's east wall instead of stacking at the origin.
    const anchor = nextRectanglePosition(ps.property.rooms, { lengthM: L, widthM: W });
    const active = selectActiveRoom(ps);
    // The predicate is "the ACTIVE room is blank", never "do rooms exist" —
    // every property always holds >= 1 room object, so the latter is always
    // true and would orphan the blank seed room forever.
    if (active && !isDrawnPolygon(active.polygon)) {
      ps.setRoomPolygon(
        active.id,
        translatePolygon(rectToPolygon({ lengthM: L, widthM: W }), anchor.x, anchor.y),
      );
      ps.renameRoom(active.id, trimmed);
    } else {
      addRectangleRoom(trimmed, { lengthM: L, widthM: W }, anchor);
    }
    pushToast(`Room "${trimmed}" added (${L} × ${W} m)`, 'success');
    onClose();
  }

  function commitDraw() {
    onRequestDrawMode();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[min(92vw,420px)] rounded-lg bg-white p-5 shadow-2xl">
        <p className="text-sm font-semibold text-ppw-ink">Add a room</p>
        <p className="mt-1 text-xs text-ppw-slate">
          Pick a quick rectangle or sketch a custom polygon on the canvas.
          New rooms attach to the ones you already have and share their walls.
        </p>

        <div className="mt-4 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setMode('rect')}
            className={`flex-1 rounded-md border px-3 py-2 font-semibold ${
              mode === 'rect'
                ? 'border-ppw-teal bg-ppw-teal text-white'
                : 'border-ppw-stone bg-white text-ppw-slate'
            }`}
          >
            Rectangle
          </button>
          <button
            type="button"
            onClick={() => setMode('draw')}
            className={`flex-1 rounded-md border px-3 py-2 font-semibold ${
              mode === 'draw'
                ? 'border-ppw-teal bg-ppw-teal text-white'
                : 'border-ppw-stone bg-white text-ppw-slate'
            }`}
          >
            Draw polygon
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {/* Room TYPE, not a number. Professional planners never ship
              "Room 1" as a final label, and the type is what will let the
              catalog filter itself to what belongs in that kind of space. */}
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-ppw-slate">
              Room type
            </span>
            <div className="mt-1 flex flex-wrap gap-1" data-testid="room-type-picker">
              {ROOM_TYPES.slice(0, 8).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setName(t)}
                  data-testid={`room-type-${t.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    name === t
                      ? 'border-ppw-teal bg-ppw-teal text-white'
                      : 'border-ppw-stone bg-white text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ppw-slate">
            Room name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1.5 text-sm font-medium text-ppw-ink focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
            />
          </label>

          {mode === 'rect' && (
            <div className="flex gap-2">
              <label className="flex-1 text-[10px] uppercase tracking-wide text-ppw-slate">
                Length (m)
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={0.5}
                  value={lengthM}
                  onChange={(e) => setLengthM(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1.5 text-sm font-medium text-ppw-ink focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
                />
              </label>
              <label className="flex-1 text-[10px] uppercase tracking-wide text-ppw-slate">
                Width (m)
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={0.5}
                  value={widthM}
                  onChange={(e) => setWidthM(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1.5 text-sm font-medium text-ppw-ink focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
                />
              </label>
            </div>
          )}

          {mode === 'draw' && (
            <p className="rounded-md border border-dashed border-ppw-stone bg-ppw-mist p-2 text-[11px] leading-snug text-ppw-slate">
              The canvas will switch to Draw mode. Click to drop vertices,
              click the first vertex (or land within 0.4 m of it) to close
              the polygon. Cancel with Esc. Vertices snap onto the walls of
              rooms you have already drawn, so the rooms share those walls.
            </p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={mode === 'rect' ? commitRectangle : commitDraw}
            className="flex-1 rounded-md bg-ppw-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-ppw-teal/90"
          >
            {mode === 'rect' ? 'Create' : 'Start drawing'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-ppw-stone bg-white px-3 py-1.5 text-sm font-semibold text-ppw-slate hover:border-ppw-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
