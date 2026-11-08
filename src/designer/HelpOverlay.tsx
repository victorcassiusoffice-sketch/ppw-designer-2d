/**
 * Sims-Parity DT-18 — keyboard-shortcut help overlay (GL1.15).
 *
 * Triggered by `?` key or a `?` icon in the TopBar overflow. Modal
 * with categorised shortcut rows. Esc dismisses.
 *
 * Lessons (game programme part 2, 8 Nov 2026): two tabs, Lessons first (every
 * lesson ticked when done, any one replayed, the first-build quest, tips and
 * sounds on or off), then the key list. The Lessons tab's code loads only
 * when the panel opens, so the first picture never carries it.
 */

import { lazy, Suspense, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useAppPreferences } from '../i18n/AppPreferences';
import { useDrawProgressStore } from '../store/drawProgressStore';
import { useDesignStore } from '../store/designStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { useBelowMd } from '../lib/useBelowMd';
import { useGardenEditorStore } from '../store/gardenEditorStore';
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
      { keys: 'Select', label: 'Select a placed item to move, rotate (R) or delete it (Del); Esc returns to Select' },
      { keys: 'PageUp / PageDown', label: 'Go up / down one storey' },
      { keys: 'Storeys', label: 'Add, rename or remove storeys' },
      { keys: 'Plot', label: 'Lock the plot size (scale + capacity)' },
      { keys: 'Door', label: 'Pick Door · Doorway · Window, hover a wall, click to place' },
      { keys: 'F / H (Door)', label: 'Flip side (which way it opens) · Flip hinge' },
      { keys: 'Click a placed opening', label: 'Select its dimensions, hinge and removal controls; click away to close' },
      { keys: 'Menu → Door (phone)', label: 'Choose an opening and tap a wall; Cancel returns to Select' },
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

export type HelpTab = 'lessons' | 'keys';

const LessonsList = lazy(() => import('./lessons/LessonsList'));

export interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Which tab shows (Lessons by default). */
  tab?: HelpTab;
  onTab?: (tab: HelpTab) => void;
}

export function HelpOverlay(props: HelpOverlayProps): JSX.Element | null {
  const { t } = useAppPreferences();
  const tab: HelpTab = props.tab ?? 'lessons';
  const tabRefs = useRef<Record<HelpTab, HTMLButtonElement | null>>({ lessons: null, keys: null });
  useEffect(() => {
    if (!props.open) return undefined;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  if (!props.open) return null;

  const tabs: Array<{ id: HelpTab; label: string }> = [
    { id: 'lessons', label: t('Lessons') },
    { id: 'keys', label: t('Keyboard keys') },
  ];
  const onTabKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next: HelpTab = tab === 'lessons' ? 'keys' : 'lessons';
    props.onTab?.(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t('Lessons and keyboard shortcuts')}
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
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div role="tablist" aria-label={t('Lessons and keyboard shortcuts')} style={{ display: 'flex', gap: 6 }}>
            {tabs.map((item) => {
              const on = item.id === tab;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabRefs.current[item.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`help-tab-${item.id}`}
                  aria-selected={on}
                  aria-controls={`help-panel-${item.id}`}
                  tabIndex={on ? 0 : -1}
                  onKeyDown={onTabKey}
                  onClick={() => props.onTab?.(item.id)}
                  style={{
                    minHeight: 40,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: `1px solid ${on ? CHROME_ACTIVE_BG : CHROME_RIM}`,
                    background: on ? CHROME_ACTIVE_BG : CHROME_BG,
                    color: on ? CHROME_ACTIVE_TEXT : CHROME_TEXT,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label={t('Close lessons and keys')}
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

        {tab === 'lessons' ? (
          <div role="tabpanel" id="help-panel-lessons" aria-labelledby="help-tab-lessons">
            <Suspense fallback={<p role="status" style={{ color: CHROME_TEXT_2, fontSize: 13 }}>{t('Loading lessons…')}</p>}>
              <LessonsList onClose={props.onClose} />
            </Suspense>
          </div>
        ) : (
          <div role="tabpanel" id="help-panel-keys" aria-labelledby="help-tab-keys">
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>Designer shortcuts</h2>
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
        )}
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
 * of the phone, so there it still unmounts.
 *
 * Straight-to-draw (Vic 2026-09-08): the launcher used to unmount whenever
 * the pen was open, which was fine while drawing was something you chose. A
 * blank plan now OPENS with the pen in hand, so that rule hid the only way
 * into the help — and the three onboarding cards moved in here when the
 * auto-opening coach was retired. It now folds only below md, where the
 * pen's HUD really does own the bottom of the screen.
 */
export function HelpLauncherIcon({ onOpen }: { onOpen: () => void }): JSX.Element | null {
  const penOpen = useDrawProgressStore((s) => s.enabled);
  const itemSelected = useDesignStore((s) => s.selectedInstanceId !== null);
  // Phone pass (2026-09-16): the Floor / Door / Wall-paint HUD cards and the
  // full-screen 3D room view own the bottom of a phone the way the pen does.
  // The launcher used to land on the paint card's Done corner and float
  // over the 3D view (z 35 sits above the overlay's 34).
  const toolHudOpen = useDesignerUIStore((s) => s.tool === 'floor' || s.tool === 'door' || s.tool === 'wallpaint');
  const view3d = useDesignerUIStore((s) => s.viewMode === '3d');
  const gardenOpen = useGardenEditorStore(s => s.panelOpen);
  const belowMd = useBelowMd();
  // House Studio exposes Help in Project tools; a floating launcher would
  // cover the scene now that the old permanent left rail is gone.
  if (view3d || gardenOpen || (belowMd && (penOpen || itemSelected || toolHudOpen))) return null;
  const besidePanel = itemSelected && !belowMd;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open keyboard shortcuts help"
      title="Lessons and keys (?)"
      // Repair round 1 (2026-08-29): 44 px on the phone tier (<md), 40 px at
      // md+ — the contract's control heights; it was a flat 40 at 390.
      className="h-11 w-11 md:h-10 md:w-10 transition-colors duration-[120ms] ease-out hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] motion-reduce:transition-none"
      style={{
        position: 'fixed',
        bottom:
          'calc(max(1rem, env(safe-area-inset-bottom)) + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px) + 56px)',
        // Left of the DetailsPanel (w-80 = 20 rem) while it is open, and left
        // of the docked Floor / Wall paint / Energy panel (which publishes its
        // width as --floor-panel-w) — it used to sit over the paint panel's
        // colour row and its Clear button (the 2026-09-19 paint-UX audit).
        left: view3d ? 13 : undefined,
        right: view3d ? undefined : besidePanel ? 'calc(max(20rem, var(--floor-panel-w, 0px)) + 1rem)' : 'calc(var(--floor-panel-w, 0px) + 1rem)',
        borderRadius: 8,
        background: view3d ? '#1c2b43' : CHROME_BG,
        border: `1px solid ${view3d ? '#445c77' : CHROME_RIM}`,
        cursor: 'pointer',
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1,
        color: view3d ? '#c0d4ed' : CHROME_TEXT,
        zIndex: 35,
        boxShadow: '0 1px 2px rgba(42,41,38,0.08)',
      }}
    >
      ?
    </button>
  );
}
