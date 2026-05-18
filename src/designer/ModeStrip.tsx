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
        // PCF-2 — repositioned to top-right of canvas, just below the
        // StatusCard (was bottom-left where it overlapped CartStrip).
        position: 'fixed',
        top: 152,
        right: 16,
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
    </div>
  );
}
