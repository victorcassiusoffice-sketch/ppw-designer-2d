/**
 * Sims-Parity DT-18 — keyboard-shortcut help overlay (GL1.15).
 *
 * Triggered by `?` key or a `?` icon in the TopBar overflow. Modal
 * with categorised shortcut rows. Esc dismisses.
 */

import { useEffect } from 'react';

export interface ShortcutRow {
  keys: string;
  label: string;
}

export const DEFAULT_SHORTCUTS: Array<{ category: string; rows: ShortcutRow[] }> = [
  {
    category: 'Build mode',
    rows: [
      { keys: 'Click + drag', label: 'Place product' },
      { keys: 'Shift', label: 'Free-place (bypass 50 cm snap)' },
      { keys: 'Esc', label: 'Cancel placement' },
      { keys: 'R / Shift+R', label: 'Rotate 15° CW / CCW' },
      { keys: 'Right-click drag', label: 'Free rotate (snap off w/ Shift)' },
    ],
  },
  {
    category: 'Selection',
    rows: [
      { keys: 'Click', label: 'Select item' },
      { keys: 'Shift + click', label: 'Add to selection' },
      { keys: 'Drag on empty floor', label: 'Marquee select (desktop only)' },
    ],
  },
  {
    category: 'History',
    rows: [
      { keys: 'Ctrl+Z', label: 'Undo (removes both visual + cart line)' },
      { keys: 'Ctrl+Y / Ctrl+Shift+Z', label: 'Redo' },
    ],
  },
  {
    category: 'Misc',
    rows: [
      { keys: '?', label: 'Open this help' },
      { keys: 'Right-click / long-press', label: 'Context menu' },
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
        background: 'rgba(14,14,16,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#F5EFE6',
          color: '#0E0E10',
          width: '100%',
          maxWidth: 560,
          padding: 24,
          borderRadius: 12,
          border: '1px solid #C0A67E',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Designer shortcuts</h2>
          <button type="button" onClick={props.onClose} aria-label="Close help" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </header>

        {DEFAULT_SHORTCUTS.map((cat) => (
          <section key={cat.category} style={{ marginBottom: 18 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C0A67E' }}>
              {cat.category}
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {cat.rows.map((r) => (
                <li key={r.keys} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(14,14,16,0.08)', fontSize: 13 }}>
                  <code style={{ background: 'rgba(192,166,126,0.18)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{r.keys}</code>
                  <span style={{ color: 'rgba(14,14,16,0.7)' }}>{r.label}</span>
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
 * Standalone "?" icon launcher that mounts at the top-right; an
 * alternative to wiring into the TopBar overflow.
 */
export function HelpLauncherIcon({ onOpen }: { onOpen: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open keyboard shortcuts help"
      style={{
        // PCF-2 — moved below StatusCard + ModeStrip cluster so the
        // top-right MiniCartPill keeps its slot. Top-right column:
        //   88 px : StatusCard
        //   152 px: ModeStrip
        //   204 px: this Help button
        position: 'fixed',
        top: 204,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#F5EFE6',
        border: '2px solid #C0A67E',
        cursor: 'pointer',
        fontSize: 16,
        fontWeight: 700,
        color: '#0E0E10',
        zIndex: 700,
        boxShadow: '0 4px 12px rgba(14,14,16,0.18)',
      }}
    >
      ?
    </button>
  );
}
