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
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';

export interface AddRoomChooserProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user picks "Draw mode" — caller enters draw mode. */
  onRequestDrawMode: () => void;
}

export function AddRoomChooser({ open, onClose, onRequestDrawMode }: AddRoomChooserProps) {
  const addRectangleRoom = usePropertyStore((s) => s.addRectangleRoom);
  const pushToast = useToastStore((s) => s.push);

  const [name, setName] = useState('New Room');
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
    const trimmed = name.trim() || 'New Room';
    addRectangleRoom(trimmed, { lengthM: L, widthM: W });
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
              the polygon. Cancel with Esc.
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
