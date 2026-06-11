/**
 * Sims-Parity DT-05 — CaptureModal (capture-flow FSM).
 *
 * The merchant onboarding capture journey. `p1-capture-flow-finish` turned
 * this from a happy-path front-only stub into a finished flow:
 *
 *   1. prepare      — print + open the A4 reference PDF (with a fetch-error
 *                     recover path; the PDF route used to 500 silently)
 *   2. camera       — capture the calibrated FRONT shot (CameraStage)
 *   3. calibrate    — corner-tap the printed page (CornerCalibration)
 *   4. dimensions   — type W×D×H vs measured (DimensionForm)
 *   5. shots        — optional SIDE + BACK photos, retake/remove (ShotSet)
 *   6. review       — reconcile every shot + measurement, submit gated
 *                     until the required set is complete (ReviewSubmit)
 *
 * The state machine + gating + error catalogue live in the pure
 * `lib/capture/captureFsm` module so they are deterministically testable.
 */

import { useEffect, useMemo, useState } from 'react';
import { CameraStage, type CapturedFrame } from './CameraStage';
import { CornerCalibration } from './CornerCalibration';
import { DimensionForm } from './DimensionForm';
import { ShotSet } from './ShotSet';
import { ReviewSubmit } from './ReviewSubmit';
import {
  STEP_ORDER,
  nextStep,
  shotGuidance,
  submitBlockedReason,
  describeError,
  type CaptureStep,
} from '../../lib/capture/captureFsm';
import type { ScaleFromMarkerOutput } from '../../lib/capture/scaleFromMarker';

export interface DimensionResult {
  dimensionsMm: { width: number; depth: number; height: number };
  typedVsMeasured: { deltaPct: number; flagged: boolean; overrideReason?: string };
}

export type { CaptureStep };

const REFERENCE_PDF_URL = '/api/capture/reference-page.pdf';

export interface CaptureModalProps {
  merchantSlug: string;
  merchantId: number;
  /** Called when the modal closes for any reason. */
  onClose: () => void;
  /** Called when a scale-lock has been minted server-side. */
  onComplete?: (scaleLockId: string) => void;
  /** Initial step — defaults to 'prepare'. Useful for tests. */
  initialStep?: CaptureStep;
  /** Optional test stream for the CameraStage. */
  __testStream?: MediaStream;
  /** fetch injector — used for the prepare-step PDF reachability check. */
  __testFetch?: typeof globalThis.fetch;
}

export function CaptureModal(props: CaptureModalProps): JSX.Element {
  const [step, setStep] = useState<CaptureStep>(props.initialStep ?? 'prepare');
  const [frontFrame, setFrontFrame] = useState<CapturedFrame | null>(null);
  const [sideFrame, setSideFrame] = useState<CapturedFrame | null>(null);
  const [backFrame, setBackFrame] = useState<CapturedFrame | null>(null);
  const [calibration, setCalibration] = useState<ScaleFromMarkerOutput | null>(null);
  const [dimensions, setDimensions] = useState<DimensionResult | null>(null);

  const frameUrl = useObjectUrl(frontFrame);
  const sideUrl = useObjectUrl(sideFrame);
  const backUrl = useObjectUrl(backFrame);

  function advance(): void {
    setStep((s) => nextStep(s));
  }

  function captureOptional(slot: 'side' | 'back', frame: CapturedFrame): void {
    if (slot === 'side') setSideFrame(frame);
    else setBackFrame(frame);
  }
  function removeOptional(slot: 'side' | 'back'): void {
    if (slot === 'side') setSideFrame(null);
    else setBackFrame(null);
  }

  // Retaking the FRONT shot invalidates the calibration + dimensions
  // derived from it — clear them and walk back to the camera step. Side
  // and back shots are kept.
  function retakeFront(): void {
    setCalibration(null);
    setDimensions(null);
    setFrontFrame(null);
    setStep('camera');
  }

  const blockedReason = submitBlockedReason({
    hasFront: Boolean(frontFrame),
    hasCalibration: Boolean(calibration),
    hasDimensions: Boolean(dimensions),
  });

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Capture product photo"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(14, 14, 16, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#F5EFE6',
          width: '100%',
          maxWidth: 720,
          padding: 24,
          borderRadius: 12,
          color: '#0E0E10',
        }}
      >
        <StepStrip current={step} />

        {step === 'prepare' && (
          <PrepareStep
            onContinue={advance}
            onCancel={props.onClose}
            __testFetch={props.__testFetch}
          />
        )}

        {step === 'camera' && (
          <div>
            <ShotIntro slot="front" />
            <CameraStage
              guidance={{ label: shotGuidance('front').label, instruction: shotGuidance('front').instruction }}
              onCapture={(frame) => {
                setFrontFrame(frame);
                advance();
              }}
              onCancel={props.onClose}
              __testStream={props.__testStream}
            />
          </div>
        )}

        {step === 'calibrate' && frontFrame && frameUrl && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(14,14,16,0.7)' }}>
              Drag each gold pin to a corner of the printed A4 reference page.
              Captured at {frontFrame.widthPx}×{frontFrame.heightPx} · blur variance
              {' '}{frontFrame.blur.variance.toFixed(0)} ({frontFrame.blur.sharp ? 'sharp' : 'blurry — retake?'}).
            </p>
            <CornerCalibration
              imageSrc={frameUrl}
              imageWidthPx={frontFrame.widthPx}
              imageHeightPx={frontFrame.heightPx}
              onRetake={() => setStep('camera')}
              onConfirm={(result) => {
                setCalibration(result);
                advance();
              }}
            />
          </div>
        )}
        {step === 'calibrate' && (!frontFrame || !frameUrl) && (
          <Panel
            title="Awaiting a captured frame"
            body="Return to the camera step."
            primaryLabel="Back to camera"
            onPrimary={() => setStep('camera')}
            secondaryLabel="Cancel"
            onSecondary={props.onClose}
          />
        )}

        {step === 'dimensions' && (
          <DimensionForm
            measuredWidthMm={calibration && calibration.silhouette_bbox_px.width > 0
              ? calibration.silhouette_bbox_px.width / Math.max(calibration.pixelsPerMm, 0.0001)
              : undefined}
            initial={dimensions ? {
              width: dimensions.dimensionsMm.width,
              depth: dimensions.dimensionsMm.depth,
              height: dimensions.dimensionsMm.height,
              unit: 'mm',
            } : undefined}
            onConfirm={(out) => { setDimensions(out); advance(); }}
            onBack={() => setStep('calibrate')}
            onRetake={retakeFront}
          />
        )}

        {step === 'shots' && frontFrame && frameUrl && (
          <ShotSet
            frontFrameUrl={frameUrl}
            side={sideFrame}
            sideUrl={sideUrl}
            back={backFrame}
            backUrl={backUrl}
            onCapture={captureOptional}
            onRemove={removeOptional}
            onRetakeFront={retakeFront}
            onContinue={advance}
            onBack={() => setStep('dimensions')}
            __testStream={props.__testStream}
          />
        )}
        {step === 'shots' && (!frontFrame || !frameUrl) && (
          <Panel
            title="Capture the front photo first"
            body="Return to the camera step to take the front shot."
            primaryLabel="Back to camera"
            onPrimary={() => setStep('camera')}
            secondaryLabel="Cancel"
            onSecondary={props.onClose}
          />
        )}

        {step === 'review' && frontFrame && frameUrl && calibration && dimensions && (
          <ReviewSubmit
            merchantSlug={props.merchantSlug}
            merchantId={props.merchantId}
            frontFrame={frontFrame}
            frontFrameUrl={frameUrl}
            sideFrame={sideFrame}
            sideFrameUrl={sideUrl}
            backFrame={backFrame}
            backFrameUrl={backUrl}
            calibration={calibration}
            dimensions={dimensions}
            blockedReason={blockedReason}
            onComplete={(scaleLockId) => {
              props.onComplete?.(scaleLockId);
              props.onClose();
            }}
            onBack={() => setStep('shots')}
            onCancel={props.onClose}
          />
        )}
        {step === 'review' && (!frontFrame || !calibration || !dimensions) && (
          <Panel
            title="Missing capture data"
            body="Return to an earlier step to finish the required photo + measurements."
            primaryLabel="Back to start"
            onPrimary={() => setStep('prepare')}
            secondaryLabel="Cancel"
            onSecondary={props.onClose}
          />
        )}
      </div>
    </div>
  );
}

/** Build + revoke an object URL for a captured frame's blob. */
function useObjectUrl(frame: CapturedFrame | null): string | null {
  const url = useMemo(() => {
    if (!frame) return null;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    return URL.createObjectURL(frame.blob);
  }, [frame]);
  useEffect(() => () => {
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }, [url]);
  return url;
}

/** Step 1 — print/open the A4 reference page, with a fetch-failure recover path. */
function PrepareStep(props: {
  onContinue: () => void;
  onCancel: () => void;
  __testFetch?: typeof globalThis.fetch;
}): JSX.Element {
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function openReferencePdf(): Promise<void> {
    setPdfState('loading');
    try {
      const fetchImpl = props.__testFetch ?? globalThis.fetch;
      const res = await fetchImpl(REFERENCE_PDF_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error('empty PDF');
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          && typeof window !== 'undefined' && typeof window.open === 'function') {
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank', 'noopener');
      }
      setPdfState('idle');
    } catch {
      setPdfState('error');
    }
  }

  if (pdfState === 'error') {
    const err = describeError('pdf-unreachable');
    return (
      <div role="alert">
        <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>{err.title}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(14,14,16,0.7)' }}>{err.body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={props.onCancel} style={{ ...ctaBtn('ghost'), marginRight: 'auto' }}>
            Cancel
          </button>
          <button type="button" onClick={() => void openReferencePdf()} style={ctaBtn('ghost')}>
            Retry
          </button>
          <button type="button" onClick={props.onContinue} style={ctaBtn('primary')}>
            I already printed it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Print the A4 reference page</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(14,14,16,0.7)' }}>
        Download and print the PDF at 100% scale. Lay it flat next to your product.
      </p>
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => void openReferencePdf()}
          disabled={pdfState === 'loading'}
          style={ctaBtn('ghost')}
        >
          {pdfState === 'loading' ? 'Opening…' : 'Open reference PDF'}
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={props.onCancel} style={ctaBtn('ghost')}>Cancel</button>
        <button type="button" onClick={props.onContinue} style={ctaBtn('primary')}>I've printed it</button>
      </div>
    </div>
  );
}

/** Tiny per-shot heading shown above the front CameraStage. */
function ShotIntro({ slot }: { slot: 'front' | 'side' | 'back' }): JSX.Element {
  const g = shotGuidance(slot);
  return (
    <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>
      {g.label}
      {g.optional ? <span style={{ color: 'rgba(14,14,16,0.5)', fontWeight: 400 }}> · optional</span> : null}
    </h2>
  );
}

function StepStrip({ current }: { current: CaptureStep }): JSX.Element {
  return (
    <ol
      aria-label="Capture progress"
      style={{
        display: 'flex',
        gap: 8,
        padding: 0,
        margin: '0 0 24px',
        listStyle: 'none',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}
    >
      {STEP_ORDER.map((s) => (
        <li
          key={s}
          aria-current={s === current ? 'step' : undefined}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 4,
            background: s === current ? '#C0A67E' : 'transparent',
            color: s === current ? '#0E0E10' : 'rgba(14,14,16,0.5)',
            border: `1px solid ${s === current ? '#C0A67E' : 'rgba(14,14,16,0.15)'}`,
            textAlign: 'center',
          }}
        >
          {s}
        </li>
      ))}
    </ol>
  );
}

function Panel({
  title, body, primaryLabel, onPrimary, secondaryLabel, onSecondary, extra,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  extra?: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>{title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(14,14,16,0.7)' }}>{body}</p>
      {extra && <div style={{ marginBottom: 16 }}>{extra}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={onSecondary} style={ctaBtn('ghost')}>
          {secondaryLabel}
        </button>
        <button type="button" onClick={onPrimary} style={ctaBtn('primary')}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

function ctaBtn(variant: 'primary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    border: '1px solid #0E0E10',
    background: 'transparent',
    color: '#0E0E10',
  };
  if (variant === 'primary') return { ...base, background: '#C0A67E', borderColor: '#C0A67E' };
  return base;
}
