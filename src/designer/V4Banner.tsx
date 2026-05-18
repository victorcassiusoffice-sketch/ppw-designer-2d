/**
 * Sims-Parity PCF-2 — V4 default-on visible signal.
 *
 * Vic surfaced "I don't see any gaming changes live" — the additive
 * Gaming Layer 1 overlays were rendering but visually buried under
 * existing layout sidebars. This banner sits at the top edge of the
 * viewport (below TopBar) as a slim gold strip that screams "V4 is
 * on", names the headline win (merchant catalog now visible), and
 * counts the merchant SKUs live in the catalog so Vic can verify at
 * a glance during the K1 walkthrough.
 *
 * One-time dismiss via `localStorage.ppw_v4_banner_dismissed_v1`.
 * Re-show by clearing that key.
 */

import { useEffect, useState } from 'react';

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

const DISMISS_KEY = 'ppw_v4_banner_dismissed_v1';

export interface V4BannerProps {
  /** Optional merchant-product count to display. */
  merchantProductCount?: number;
}

export function V4Banner(props: V4BannerProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(DISMISS_KEY) === '1';
      }
    } catch {
      // ignore
    }
    return false;
  });

  // PCF-2 safety: clear any stale `gaming_v1='0'` localStorage value
  // that might have been set during pre-flip dev sessions. The flag
  // is now permanently default-on; honour explicit ?ui=classic via
  // URL only.
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      if (localStorage.getItem('gaming_v1') === '0') {
        // eslint-disable-next-line no-console
        console.info(
          '[v4] Clearing stale gaming_v1=0 override from a prior dev session. The V4 default is now on.',
        );
        localStorage.removeItem('gaming_v1');
      }
    } catch {
      // ignore
    }
  }, []);

  if (dismissed) return null;

  const countLabel = props.merchantProductCount !== undefined && props.merchantProductCount > 0
    ? ` · ${props.merchantProductCount} merchant SKU${props.merchantProductCount === 1 ? '' : 's'} live`
    : '';

  return (
    <div
      role="status"
      aria-label="V4 designer mode banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 750,
        background: `linear-gradient(90deg, ${PALETTE.ink} 0%, #2a1e0e 50%, ${PALETTE.ink} 100%)`,
        color: PALETTE.cream,
        borderBottom: `2px solid ${PALETTE.gold}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 2px 12px rgba(14,14,16,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            background: PALETTE.gold,
            color: PALETTE.ink,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          V4
        </span>
        <span>
          <strong style={{ color: PALETTE.gold }}>Wellness Designer</strong>{' '}
          — gaming UI default · merchant catalog active{countLabel}
        </span>
      </div>
      <button
        type="button"
        aria-label="Dismiss V4 banner"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            // ignore
          }
          setDismissed(true);
        }}
        style={{
          background: 'transparent',
          color: PALETTE.cream,
          border: `1px solid ${PALETTE.gold}`,
          borderRadius: 4,
          padding: '2px 10px',
          fontSize: 11,
          cursor: 'pointer',
          opacity: 0.85,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
