/**
 * Sims-Parity DT-18 — keyboard-shortcut help overlay (GL1.15).
 *
 * Triggered by `?` key or a `?` icon in the TopBar overflow. Modal
 * with categorised shortcut rows. Esc dismisses.
 */

import { useEffect, useState } from 'react';
import { useDrawProgressStore } from '../store/drawProgressStore';
import { useDesignStore } from '../store/designStore';
import {
  CHROME_BG,
  CHROME_RIM,
  CHROME_TEXT,
  CHROME_TEXT_2,
  CHROME_ACTIVE_BG,
  CHROME_ACTIVE_TEXT,
} from './blueprintTheme';

export interface ShortcutRow {
  keys: string;
  label: string;
}

// Module-private (repair round 1, 2026-08-29): it was exported alongside the
// components, which tripped react-refresh/only-export-components; nothing
// outside this file imports it.
const DEFAULT_SHORTCUTS: Array<{ category: string; rows: ShortcutRow[] }> = [
  {
    category: 'Walls',
    rows: [
      { keys: 'Click', label: 'Drop a wall point (Walls, or Box | Custom)' },
      { keys: 'Enter / click first point', label: 'Close the shape as a room (Make room)' },
      { keys: 'Alt+Enter / Done', label: 'Keep the run as open walls' },
      { keys: 'Shift+Enter', label: 'Close the room and keep drawing' },
      { keys: '+ / − (while drawing)', label: 'Finer / coarser unit' },
      { keys: '[ / ]', label: 'Coarser / finer unit, any time' },
      { keys: '1 – 6', label: 'Unit: 1 cm · 10 cm · 25 cm · 50 cm · 1 m · 10 m' },
      { keys: 'Ctrl+Z', label: 'Undo last wall point' },
      { keys: 'Esc', label: 'Cancel the run' },
    ],
  },
  {
    category: 'Placing',
    rows: [
      { keys: 'Drag from dock', label: 'Place a product — inside a room or outside in the garden' },
      { keys: 'R / Shift+R / Alt+R', label: 'Rotate the armed item 90° / 15° / 90° CCW' },
      { keys: 'Shift + click', label: 'Stamp copies without disarming' },
      { keys: 'Esc / right-click', label: 'Cancel placement' },
    ],
  },
  {
    category: 'Selected item',
    rows: [
      { keys: 'R / , / .', label: 'Rotate 90° (Shift+R 15°, Alt+R CCW)' },
      { keys: 'Drag the handle', label: 'Free rotate in 15° steps (Shift for any angle)' },
      { keys: 'D', label: 'Duplicate' },
      { keys: 'L', label: 'Light on / off (lamps, pendants, sconces)' },
      { keys: 'Del / Backspace', label: 'Delete' },
      { keys: 'Esc', label: 'Deselect' },
    ],
  },
  {
    category: 'Building',
    rows: [
      { keys: 'PageUp / PageDown', label: 'Go up / down one storey' },
      { keys: 'Storeys', label: 'Add, rename or remove storeys' },
      { keys: 'Plot', label: 'Lock the plot size (scale + capacity)' },
      { keys: 'Door', label: 'Hover a wall to cut a door, doorway or window' },
      { keys: 'Floor', label: 'Click a tile · drag an area · Room lays the whole room' },
      { keys: 'Shift / Ctrl (Floor)', label: 'Shift fills the room · Ctrl erases · Esc or Done puts the tool away' },
      { keys: 'M', label: 'Measure — retype a wall length' },
      { keys: 'H / E / J', label: 'Hand · eyedropper · sledgehammer' },
    ],
  },
  {
    category: 'View + history',
    rows: [
      { keys: 'Wheel / pinch', label: 'Zoom' },
      { keys: '+ / − (not drawing)', label: 'Zoom in / out' },
      { keys: 'W A S D / arrows', label: 'Pan' },
      { keys: 'Ctrl+Z', label: 'Undo (removes both visual + cart line)' },
      { keys: 'Ctrl+Y / Ctrl+Shift+Z', label: 'Redo' },
      { keys: 'Shift+P / Shift+X', label: 'Clear products / clear all' },
      { keys: 'More', label: 'New · Save as… · Load · Shop · Help' },
    ],
  },
];

export interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function HelpOverlay(props: HelpOverlayProps): JSX.Element | null {
  useEffect(() => {
    if (!props.open) return undefined;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed', inset: 0, zIndex: 950,
        background: 'rgba(42,41,38,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CHROME_BG,
          color: CHROME_TEXT,
          width: '100%',
          maxWidth: 560,
          padding: 24,
          borderRadius: 12,
          border: `1px solid ${CHROME_RIM}`,
          boxShadow: '0 12px 32px rgba(42,41,38,0.18)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Designer shortcuts</h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close help"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: CHROME_BG,
              border: `1px solid ${CHROME_RIM}`,
              color: CHROME_TEXT,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        {DEFAULT_SHORTCUTS.map((cat) => (
          <section key={cat.category} style={{ marginBottom: 18 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: CHROME_TEXT_2 }}>
              {cat.category}
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {cat.rows.map((r) => (
                <li key={r.keys} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minHeight: 36, alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${CHROME_RIM}`, fontSize: 13 }}>
                  <code style={{ background: CHROME_ACTIVE_BG, color: CHROME_ACTIVE_TEXT, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.keys}</code>
                  <span style={{ color: CHROME_TEXT_2, textAlign: 'right' }}>{r.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Standalone "?" launcher. Toolbar pass (2026-08-29): it used to be pinned
 * top-right at 204 px / z 700, where it covered the floor-paint chip and
 * floated over the open phone sheet. It now sits bottom-right, directly
 * ABOVE the cart pill (which is 44 px tall at
 * `1rem + dock + toolbar`; 56 px clears it with a 12 px gap), in the chrome
 * register, and below every sheet (z 35 > the pill's 30, < the sheets' 40+).
 * While the wall pen is open the HUD owns the bottom band (the cart pill and
 * Clear pills step aside too), so the launcher steps aside with them — on a
 * 390 px phone it would otherwise sit on the HUD's Discard button. Likewise
 * while an item is selected: the DetailsPanel overlay owns the right edge
 * on desktop (its Buy button sits exactly here) and the selection cluster
 * owns the phone; `?` still opens the same dialog at any time.
 *
 * Polish (2026-08-29): while an item is selected on md+ the launcher stays
 * MOUNTED and steps LEFT of the 20 rem DetailsPanel (`right: 20rem + 1rem`)
 * so it never covers the panel; below md the selection sheet owns the bottom
 * of the phone, so there it still unmounts. Hidden while the pen is open.
 */
export function HelpLauncherIcon({ onOpen }: { onOpen: () => void }): JSX.Element | null {
  const penOpen = useDrawProgressStore((s) => s.enabled);
  const itemSelected = useDesignStore((s) => s.selectedInstanceId !== null);
  const belowMd = useBelowMd();
  if (penOpen || (itemSelected && belowMd)) return null;
  const besidePanel = itemSelected && !belowMd;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open keyboard shortcuts help"
      title="Keyboard shortcuts (?)"
      // Repair round 1 (2026-08-29): 44 px on the phone tier (<md), 40 px at
      // md+ — the contract's control heights; it was a flat 40 at 390.
      className="h-11 w-11 md:h-10 md:w-10 transition-colors duration-[120ms] ease-out hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] motion-reduce:transition-none"
      style={{
        position: 'fixed',
        bottom:
          'calc(max(1rem, env(safe-area-inset-bottom)) + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px) + 56px)',
        // Left of the DetailsPanel (w-80 = 20 rem) while it is open.
        right: besidePanel ? 'calc(20rem + 1rem)' : '1rem',
        borderRadius: 8,
        background: CHROME_BG,
        border: `1px solid ${CHROME_RIM}`,
        cursor: 'pointer',
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1,
        color: CHROME_TEXT,
        zIndex: 35,
        boxShadow: '0 1px 2px rgba(42,41,38,0.08)',
      }}
    >
      ?
    </button>
  );
}

/**
 * `true` below Tailwind's `md` (768 px) — where the DetailsPanel is a bottom
 * sheet rather than a right-hand column. Falls back to "not below md" where
 * `matchMedia` is missing (jsdom / SSR).
 */
function useBelowMd(): boolean {
  const query = '(max-width: 767.98px)';
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
}
