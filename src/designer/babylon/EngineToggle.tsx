/**
 * Sims-Parity DT-27 — engine side-by-side toggle (L2.13).
 *
 * Floating pill toolbar that switches between `?engine=konva`
 * (current default, Konva render path) and `?engine=babylon`
 * (DT-21..DT-25 Babylon scene). Hard-refreshes the page to apply
 * the new flag — the choice has to live in `isBabylonActive()`
 * which is captured at mount time.
 *
 * Sentry diff: every engine switch emits a breadcrumb so the
 * 2-week soak (W12-14) can correlate error spikes to engine
 * flips. Soak telemetry sits at:
 *   - data-flow §7 → Sentry Dev Free
 *   - the Designer engine flag is the dimension that distinguishes
 *     Konva vs Babylon error rates.
 */

import { useCallback, useMemo } from 'react';
import { isBabylonActive } from './engineFlag';

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

export interface EngineToggleProps {
  /** Optional override — when supplied, forces a particular state. */
  forceActive?: boolean;
}

function setEngineParamAndReload(value: 'konva' | 'babylon'): void {
  try {
    const url = new URL(window.location.href);
    if (value === 'konva') {
      url.searchParams.delete('engine');
    } else {
      url.searchParams.set('engine', value);
    }
    // Best-effort Sentry breadcrumb. The window.Sentry global is
    // populated by the @sentry/react init in main.tsx when SENTRY_DSN
    // is configured; gracefully no-op when absent.
    interface MaybeSentry {
      addBreadcrumb?: (b: Record<string, unknown>) => void;
    }
    const sentry = (window as unknown as { Sentry?: MaybeSentry }).Sentry;
    if (sentry?.addBreadcrumb) {
      sentry.addBreadcrumb({
        category: 'engine-toggle',
        message: `switched to ${value}`,
        level: 'info',
        data: { fromUrl: window.location.href, toEngine: value },
      });
    }
    window.location.assign(url.toString());
  } catch {
    // ignore — bad URLs shouldn't crash the app
  }
}

export function EngineToggle(props: EngineToggleProps): JSX.Element | null {
  const active = useMemo<'konva' | 'babylon'>(() => {
    if (typeof props.forceActive === 'boolean') {
      return props.forceActive ? 'babylon' : 'konva';
    }
    return isBabylonActive() ? 'babylon' : 'konva';
  }, [props.forceActive]);

  const onPick = useCallback((value: 'konva' | 'babylon') => {
    if (value === active) return;
    setEngineParamAndReload(value);
  }, [active]);

  return (
    <div
      role="toolbar"
      aria-label="Designer engine toggle"
      style={{
        position: 'fixed',
        // Clear the mobile Sims toolbar (var is 0 on desktop, where the
        // toolbar is display:none — so desktop stays at bottom:16).
        bottom: 'calc(16px + var(--sims-toolbar-h, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 720,
        background: 'rgba(245,239,230,0.95)',
        border: `2px solid ${PALETTE.gold}`,
        borderRadius: 999,
        padding: '4px 6px',
        display: 'flex',
        gap: 4,
        boxShadow: '0 4px 14px rgba(14,14,16,0.22)',
      }}
    >
      <button
        type="button"
        onClick={() => onPick('konva')}
        aria-pressed={active === 'konva'}
        style={pillStyle(active === 'konva')}
      >
        Konva 2D
      </button>
      <button
        type="button"
        onClick={() => onPick('babylon')}
        aria-pressed={active === 'babylon'}
        style={pillStyle(active === 'babylon')}
      >
        Babylon 3D
      </button>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? '#C0A67E' : 'transparent'}`,
    background: active ? '#C0A67E' : 'transparent',
    color: '#0E0E10',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };
}
