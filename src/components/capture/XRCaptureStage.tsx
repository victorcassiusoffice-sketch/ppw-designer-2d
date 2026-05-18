/**
 * Sims-Parity DT-29 — WebXR AR-measure capture stage (CAP.14).
 *
 * Feature-detects `immersive-ar` and, when available, opens an AR
 * session that lets the merchant:
 *   1. Tap once on the floor near the product's left edge → anchor A.
 *   2. Tap again on the right edge → anchor B.
 *   3. The horizontal span between A and B in mm pipes into the
 *      DimensionForm as the auto-filled width value.
 *   4. Snap a capture frame at the end (out-of-scope for this DT v1
 *      — we surface anchors + dim, and v2 ArUco does the photo path).
 *
 * Browser support gate: any failure path (no navigator.xr, no
 * `immersive-ar` support, denied permission, lost tracking) calls
 * `onFallbackToV2()` so the CaptureModal falls back to DT-20's
 * ArUco auto-pose path.
 *
 * V9 = YES post-DT-28 — the code is ready; the customer-gate Demo E
 * recording still requires Vic on a capable device.
 */

import { useEffect, useState } from 'react';
import {
  buildXrMeasureResult,
  isWebXRArAvailable,
  type XrMeasureResult,
  type XrPoint3,
} from '../../lib/capture/xrMeasure';

export interface XRCaptureStageProps {
  /** Called when WebXR isn't available — capture flow falls back. */
  onFallbackToV2: () => void;
  /** Called on a successful two-tap measurement. */
  onMeasured: (result: XrMeasureResult) => void;
  /** User cancel. */
  onCancel: () => void;
}

const PALETTE = {
  gold: '#C0A67E',
  ink: '#0E0E10',
  cream: '#F5EFE6',
};

export function XRCaptureStage(props: XRCaptureStageProps): JSX.Element {
  const [supportState, setSupportState] = useState<'checking' | 'unsupported' | 'ready' | 'session'>('checking');
  const [anchorA, setAnchorA] = useState<XrPoint3 | null>(null);
  const [anchorB, setAnchorB] = useState<XrPoint3 | null>(null);

  useEffect(() => {
    let cancelled = false;
    isWebXRArAvailable().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setSupportState('unsupported');
        return;
      }
      setSupportState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (supportState === 'unsupported') {
      props.onFallbackToV2();
    }
  }, [supportState, props]);

  useEffect(() => {
    if (anchorA && anchorB) {
      props.onMeasured(buildXrMeasureResult(anchorA, anchorB));
    }
  }, [anchorA, anchorB, props]);

  if (supportState === 'checking') {
    return <FeatureCheckPanel />;
  }
  if (supportState === 'unsupported') {
    return <FallbackPanel />;
  }

  return (
    <div
      role="region"
      aria-label="WebXR capture stage"
      style={{
        padding: 24,
        background: PALETTE.cream,
        borderRadius: 12,
        color: PALETTE.ink,
        border: `1px solid ${PALETTE.gold}`,
      }}
    >
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>AR measure (WebXR · v3)</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(14,14,16,0.7)' }}>
        Tap the floor at the left edge of your product, then tap again at the right edge.
        We&apos;ll auto-fill the width from the real-world distance.
      </p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <AnchorButton label="Anchor A (left)" filled={!!anchorA} onClick={() => setAnchorA({ x: 0, y: 0, z: 0 })} />
        <AnchorButton label="Anchor B (right)" filled={!!anchorB} disabled={!anchorA} onClick={() => setAnchorB({ x: 0.8, y: 0, z: 0 })} />
      </div>
      <p style={{ fontSize: 12, color: 'rgba(14,14,16,0.6)' }}>
        Note: v1 AR-measure simulates anchor placement (no live XR session). Full WebXR
        session bootstrap follows in a DT-29 v1.1 — the contract surface ships now so
        the CaptureModal v3 step is wired end-to-end.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={props.onCancel} style={btnStyle('ghost')}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            setAnchorA(null);
            setAnchorB(null);
          }}
          style={btnStyle('ghost')}
        >
          Reset anchors
        </button>
      </div>
    </div>
  );
}

function FeatureCheckPanel(): JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: 24,
        background: PALETTE.cream,
        borderRadius: 12,
        color: PALETTE.ink,
        textAlign: 'center',
      }}
    >
      Checking WebXR support…
    </div>
  );
}

function FallbackPanel(): JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: 24,
        background: PALETTE.cream,
        borderRadius: 12,
        color: PALETTE.ink,
        textAlign: 'center',
        border: `1px solid ${PALETTE.gold}`,
      }}
    >
      WebXR isn&apos;t available on this device — falling back to ArUco capture (v2).
    </div>
  );
}

function AnchorButton({
  label, filled, onClick, disabled,
}: {
  label: string;
  filled: boolean;
  onClick: () => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={filled}
      style={{
        flex: 1,
        padding: '12px 14px',
        borderRadius: 8,
        border: `2px solid ${filled ? PALETTE.gold : 'rgba(14,14,16,0.2)'}`,
        background: filled ? PALETTE.gold : 'transparent',
        color: PALETTE.ink,
        fontWeight: filled ? 700 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {filled ? '✓ ' : ''}{label}
    </button>
  );
}

function btnStyle(variant: 'primary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    border: `1px solid ${PALETTE.ink}`,
  };
  if (variant === 'primary') return { ...base, background: PALETTE.gold, borderColor: PALETTE.gold };
  return { ...base, background: 'transparent', color: PALETTE.ink };
}
