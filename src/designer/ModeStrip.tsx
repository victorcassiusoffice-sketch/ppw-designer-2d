/**
 * Sims-Parity DT-15 — GL1.10 mode strip (bottom-left).
 *
 * Move · Buy · Paint (V-GAME-2 stub) · Inspect. Active mode gets gold
 * outline + ink fill. Paint click fires `onPaintStubToast` ("Coming
 * soon"). Cursor change is the consumer's responsibility (see
 * `cursorForMode`).
 */

import { DESIGNER_MODES, labelForMode, type DesignerMode } from './useDesignerMode';

export interface ModeStripProps {
  active: DesignerMode;
  onChange: (mode: DesignerMode) => void;
  onPaintStubToast?: () => void;
  /**
   * Tweak 04 (Phase A) — invoked when the user clicks the "Clear" affordance
   * baked into the strip. Hosting layer owns the confirm-modal UX.
   */
  onClearClick?: () => void;
}

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

export function ModeStrip(props: ModeStripProps): JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label="Designer mode"
      style={{
        // Fix 2.5 (Vic 2026-05-22) — the right-side floating banner
        // overlapped the canvas. Mode strip now sits bottom-center over
        // the canvas, above CartStrip (CartStrip is bottom:0; strip sits
        // ~76px above it so the gold pill clears the cart bar).
        // Mobile Sims rebuild (2026-05-23) — also clear the sticky Sims
        // toolbar: `--sims-toolbar-h` is its live height (0 on desktop,
        // where the toolbar is display:none, so desktop stays at 76px).
        position: 'fixed',
        bottom: 'calc(76px + var(--sims-toolbar-h, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 700,
        background: 'rgba(245, 239, 230, 0.95)',
        border: `2px solid ${PALETTE.gold}`,
        borderRadius: 999,
        padding: '4px 6px',
        display: 'flex',
        gap: 4,
        boxShadow: '0 4px 12px rgba(14,14,16,0.18)',
      }}
    >
      {DESIGNER_MODES.map((m) => {
        const active = m === props.active;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (m === 'paint') {
                props.onPaintStubToast?.();
                return;
              }
              // Tweak 04 (Phase A): re-clicking the active mode still
              // fires onChange so the host can reset in-flight state
              // (un-committed polylines).
              props.onChange(m);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: `1px solid ${active ? PALETTE.gold : 'transparent'}`,
              background: active ? PALETTE.gold : 'transparent',
              color: PALETTE.ink,
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {labelForMode(m)}
          </button>
        );
      })}
      {props.onClearClick && (
        <button
          type="button"
          onClick={props.onClearClick}
          aria-label="Clear active layer"
          title="Clear walls / placed items in the active layer (Ctrl+Z restores)"
          data-testid="mode-strip-clear"
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #C73030',
            background: 'transparent',
            color: '#C73030',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginLeft: 4,
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
