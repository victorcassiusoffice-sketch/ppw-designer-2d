/**
 * Sims-Parity DT-07 — typed W×D×H form + unit toggle + live volume +
 * reconciliation modal.
 *
 * Inputs:
 *   • measuredWidthMm — derived from DT-06 calibration; optional.
 *
 * Outputs:
 *   • dimensionsMm  : { width, depth, height } in mm.
 *   • typedVsMeasured: { deltaPct, flagged, overrideReason? }
 *
 * V4-AU-1 palette throughout (gold accent on the volume readout).
 */

import { useState } from 'react';
import {
  fromMm,
  reconcileDimensions,
  toMm,
  type DimensionUnit,
} from '../../lib/capture/reconcileDimensions';

const UNITS: DimensionUnit[] = ['mm', 'cm', 'm'];

export interface DimensionFormProps {
  measuredWidthMm?: number;
  initial?: { width?: number; depth?: number; height?: number; unit?: DimensionUnit };
  /** Called when the merchant confirms. */
  onConfirm: (out: {
    dimensionsMm: { width: number; depth: number; height: number };
    typedVsMeasured: { deltaPct: number; flagged: boolean; overrideReason?: string };
  }) => void;
  onBack: () => void;
  onRetake: () => void;
}

export function DimensionForm(props: DimensionFormProps): JSX.Element {
  const [unit, setUnit] = useState<DimensionUnit>(props.initial?.unit ?? 'mm');
  const [width, setWidth] = useState<number | ''>(props.initial?.width ?? '');
  const [depth, setDepth] = useState<number | ''>(props.initial?.depth ?? '');
  const [height, setHeight] = useState<number | ''>(props.initial?.height ?? '');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [showReconcile, setShowReconcile] = useState<boolean>(false);

  const widthMm = typeof width === 'number' ? toMm(width, unit) : 0;
  const depthMm = typeof depth === 'number' ? toMm(depth, unit) : 0;
  const heightMm = typeof height === 'number' ? toMm(height, unit) : 0;

  const volumeM3 = (widthMm * depthMm * heightMm) / 1_000_000_000;

  const reconciliation = reconcileDimensions({
    width: { typedMm: widthMm, measuredMm: props.measuredWidthMm ?? widthMm, overrideReason },
  });

  function handleSubmit(): void {
    if (reconciliation.anyFlagged) {
      setShowReconcile(true);
      return;
    }
    if (widthMm <= 0 || depthMm <= 0 || heightMm <= 0) return;
    props.onConfirm({
      dimensionsMm: { width: Math.round(widthMm), depth: Math.round(depthMm), height: Math.round(heightMm) },
      typedVsMeasured: {
        deltaPct: reconciliation.width.deltaPct,
        flagged: false,
        overrideReason: overrideReason.trim().length > 0 ? overrideReason.trim() : undefined,
      },
    });
  }

  function handleAcceptOverride(): void {
    if (overrideReason.trim().length === 0) return;
    props.onConfirm({
      dimensionsMm: { width: Math.round(widthMm), depth: Math.round(depthMm), height: Math.round(heightMm) },
      typedVsMeasured: {
        deltaPct: reconciliation.width.deltaPct,
        flagged: true,
        overrideReason: overrideReason.trim(),
      },
    });
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>Type your product dimensions</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(14,14,16,0.7)' }}>
        Width, depth, height of the physical product. We&apos;ll compare against the
        calibrated measurement and ask you to reconcile any large mismatch.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {UNITS.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            aria-pressed={unit === u}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              border: `1px solid ${unit === u ? '#C0A67E' : 'rgba(14,14,16,0.2)'}`,
              background: unit === u ? '#C0A67E' : 'transparent',
              color: unit === u ? '#0E0E10' : 'rgba(14,14,16,0.7)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: 11,
              letterSpacing: '0.1em',
            }}
          >
            {u}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <DimField label={`Width (${unit})`} value={width} onChange={setWidth} />
        <DimField label={`Depth (${unit})`} value={depth} onChange={setDepth} />
        <DimField label={`Height (${unit})`} value={height} onChange={setHeight} />
      </div>

      <p style={{ marginTop: 16, fontSize: 13 }}>
        Volume: <strong style={{ color: '#C0A67E' }}>{volumeM3.toFixed(4)} m³</strong>
        {props.measuredWidthMm !== undefined && widthMm > 0 && (
          <span style={{ marginLeft: 12, fontSize: 12, color: 'rgba(14,14,16,0.6)' }}>
            calibrated width ≈ {fromMm(props.measuredWidthMm, unit).toFixed(1)} {unit}
            {' · Δ '}
            {(reconciliation.width.deltaPct * 100).toFixed(1)}%
          </span>
        )}
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button
          type="button"
          onClick={props.onBack}
          style={btn('ghost')}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={widthMm <= 0 || depthMm <= 0 || heightMm <= 0}
          style={btn('primary')}
        >
          Next
        </button>
      </div>

      {showReconcile && (
        <div
          role="dialog"
          aria-modal
          aria-label="Reconcile measured vs typed width"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(14,14,16,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div style={{
            background: '#F5EFE6', padding: 24, borderRadius: 12, maxWidth: 480,
            border: '1px solid #C0A67E',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>
              Width mismatch of {(reconciliation.width.deltaPct * 100).toFixed(1)}%
            </h3>
            <p style={{ fontSize: 13, margin: '0 0 12px' }}>
              You typed <strong>{fromMm(widthMm, unit).toFixed(1)} {unit}</strong> but the
              calibrated capture suggests <strong>{fromMm(props.measuredWidthMm ?? 0, unit).toFixed(1)} {unit}</strong>.
            </p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Override reason (required to accept your typed value)
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={3}
              placeholder="e.g. tape-measured the product myself"
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 6,
                border: '1px solid rgba(14,14,16,0.2)',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button type="button" onClick={() => { setShowReconcile(false); props.onRetake(); }} style={btn('ghost')}>
                Retake photo
              </button>
              <button
                type="button"
                onClick={() => { setShowReconcile(false); handleAcceptOverride(); }}
                disabled={overrideReason.trim().length === 0}
                style={btn('primary')}
              >
                Accept my typed value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DimField({ label, value, onChange }: {
  label: string;
  value: number | '';
  onChange: (n: number | '') => void;
}): JSX.Element {
  return (
    <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      <span style={{ color: 'rgba(14,14,16,0.6)' }}>{label}</span>
      <input
        type="number"
        min={0}
        value={value === '' ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') onChange('');
          else {
            const n = Number(v);
            onChange(Number.isFinite(n) && n >= 0 ? n : '');
          }
        }}
        style={{
          width: '100%',
          marginTop: 4,
          padding: '8px 10px',
          fontSize: 16,
          border: '1px solid rgba(14,14,16,0.2)',
          borderRadius: 6,
        }}
      />
    </label>
  );
}

function btn(variant: 'primary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid #0E0E10',
    cursor: 'pointer',
    fontSize: 14,
  };
  if (variant === 'primary') {
    return { ...base, background: '#C0A67E', borderColor: '#C0A67E', color: '#0E0E10' };
  }
  return { ...base, background: 'transparent', color: '#0E0E10' };
}
