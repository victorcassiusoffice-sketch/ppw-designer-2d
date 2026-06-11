/**
 * Capture-flow — multi-shot collection step (`p1-capture-flow-finish`).
 *
 * Replaces the old `side-back` placeholder Panel ("optional — skip ahead").
 * The merchant has already taken the calibrated FRONT shot; here they may
 * add an optional SIDE and BACK photo, each with its own guidance, and
 * retake or remove any of them. Front is shown locked (retaking it returns
 * to the camera step because it would invalidate the calibration).
 *
 * Capturing reuses CameraStage with per-shot guidance. Pure-presentational
 * over the shot state owned by CaptureModal.
 */

import { useState } from 'react';
import { CameraStage, type CapturedFrame } from './CameraStage';
import { shotGuidance, type ShotSlot } from '../../lib/capture/captureFsm';

export interface ShotSetProps {
  frontFrameUrl: string;
  side: CapturedFrame | null;
  sideUrl: string | null;
  back: CapturedFrame | null;
  backUrl: string | null;
  /** Store a freshly captured optional shot. */
  onCapture: (slot: 'side' | 'back', frame: CapturedFrame) => void;
  /** Drop an optional shot. */
  onRemove: (slot: 'side' | 'back') => void;
  /** Retake the front shot — re-runs calibration (handled by the modal). */
  onRetakeFront: () => void;
  onContinue: () => void;
  onBack: () => void;
  /** Test stream injector forwarded to CameraStage. */
  __testStream?: MediaStream;
}

export function ShotSet(props: ShotSetProps): JSX.Element {
  const [capturing, setCapturing] = useState<'side' | 'back' | null>(null);

  if (capturing) {
    const g = shotGuidance(capturing);
    return (
      <div>
        <CameraStage
          guidance={{ label: g.label, instruction: g.instruction }}
          onCapture={(frame) => {
            props.onCapture(capturing, frame);
            setCapturing(null);
          }}
          onCancel={() => setCapturing(null)}
          __testStream={props.__testStream}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Add side &amp; back photos</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(14,14,16,0.7)' }}>
        The front photo is all we need to list your product — side and back are
        optional but help customers see it from every angle.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <ShotTile
          slot="front"
          url={props.frontFrameUrl}
          captured
          primaryLabel="Retake"
          onPrimary={props.onRetakeFront}
        />
        <ShotTile
          slot="side"
          url={props.sideUrl}
          captured={Boolean(props.side)}
          primaryLabel={props.side ? 'Retake' : 'Add side'}
          onPrimary={() => setCapturing('side')}
          onRemove={props.side ? () => props.onRemove('side') : undefined}
        />
        <ShotTile
          slot="back"
          url={props.backUrl}
          captured={Boolean(props.back)}
          primaryLabel={props.back ? 'Retake' : 'Add back'}
          onPrimary={() => setCapturing('back')}
          onRemove={props.back ? () => props.onRemove('back') : undefined}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={props.onBack} style={btn('ghost')}>
          Back
        </button>
        <button type="button" onClick={props.onContinue} style={btn('primary')}>
          Continue to review
        </button>
      </div>
    </div>
  );
}

function ShotTile({
  slot, url, captured, primaryLabel, onPrimary, onRemove,
}: {
  slot: ShotSlot;
  url: string | null;
  captured: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  onRemove?: () => void;
}): JSX.Element {
  const g = shotGuidance(slot);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        aria-label={`${g.label} ${captured ? 'captured' : 'not captured'}`}
        style={{
          aspectRatio: '210 / 297',
          borderRadius: 8,
          border: '1px solid rgba(14,14,16,0.15)',
          backgroundColor: 'rgba(14,14,16,0.04)',
          backgroundImage: captured && url ? `url("${url}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(14,14,16,0.45)',
          fontSize: 11,
          textAlign: 'center',
          padding: 8,
        }}
      >
        {!captured && g.label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600 }}>
        {g.label}
        {g.optional ? <span style={{ color: 'rgba(14,14,16,0.45)', fontWeight: 400 }}> · optional</span> : null}
      </div>
      <button type="button" onClick={onPrimary} style={btn('ghost')}>
        {primaryLabel}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ ...btn('ghost'), color: '#7a1a1a', borderColor: 'rgba(122,26,26,0.4)' }}>
          Remove
        </button>
      )}
    </div>
  );
}

function btn(variant: 'primary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
    fontSize: 13, border: '1px solid #0E0E10', background: 'transparent', color: '#0E0E10',
  };
  if (variant === 'primary') return { ...base, background: '#C0A67E', borderColor: '#C0A67E' };
  return base;
}
