/**
 * Sims-Parity DT-05 — CaptureModal scaffold.
 *
 * Six-step state machine harness that downstream DTs hang their own
 * step implementations on:
 *
 *   1. prepare      — DT-02 PDF print instructions
 *   2. camera       — DT-05 CameraStage (this DT)
 *   3. calibrate    — DT-06 CornerCalibration
 *   4. dimensions   — DT-07 DimensionForm
 *   5. side+back    — DT-08 optional second/third shots
 *   6. review       — DT-08 ReviewSubmit → POST /calibrate
 *
 * The modal renders the Camera step today + step-strip nav. Step
 * 3-6 render placeholder panels until their owning DTs land. The
 * top-level state machine is fully wired so each step can move
 * forward by emitting its data.
 */

import { useEffect, useMemo, useState } from 'react';
import { CameraStage, type CapturedFrame } from './CameraStage';
import { CornerCalibration } from './CornerCalibration';
import { DimensionForm } from './DimensionForm';
import { ReviewSubmit } from './ReviewSubmit';
import type { ScaleFromMarkerOutput } from '../../lib/capture/scaleFromMarker';

export interface DimensionResult {
  dimensionsMm: { width: number; depth: number; height: number };
  typedVsMeasured: { deltaPct: number; flagged: boolean; overrideReason?: string };
}

export type CaptureStep = 'prepare' | 'camera' | 'calibrate' | 'dimensions' | 'side-back' | 'review';

const STEP_ORDER: CaptureStep[] = ['prepare', 'camera', 'calibrate', 'dimensions', 'side-back', 'review'];

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
}

export function CaptureModal(props: CaptureModalProps): JSX.Element {
  const [step, setStep] = useState<CaptureStep>(props.initialStep ?? 'prepare');
  const [frontFrame, setFrontFrame] = useState<CapturedFrame | null>(null);
  const [calibration, setCalibration] = useState<ScaleFromMarkerOutput | null>(null);
  const [dimensions, setDimensions] = useState<DimensionResult | null>(null);

  // Build + revoke object URL for the captured photo.
  const frameUrl = useMemo(() => {
    if (!frontFrame) return null;
    return URL.createObjectURL(frontFrame.blob);
  }, [frontFrame]);
  useEffect(() => () => {
    if (frameUrl) URL.revokeObjectURL(frameUrl);
  }, [frameUrl]);

  function advance(): void {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  }

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
          <Panel
            title="Print the A4 reference page"
            body="Download and print the PDF at 100% scale. Lay it flat next to your product."
            primaryLabel="I've printed it"
            onPrimary={advance}
            secondaryLabel="Cancel"
            onSecondary={props.onClose}
            extra={
              <a
                href="/api/capture/reference-page.pdf"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#C0A67E', textDecoration: 'underline' }}
              >
                Open reference PDF (new tab)
              </a>
            }
          />
        )}

        {step === 'camera' && (
          <CameraStage
            onCapture={(frame) => {
              setFrontFrame(frame);
              advance();
            }}
            onCancel={props.onClose}
            __testStream={props.__testStream}
          />
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
            onRetake={() => setStep('camera')}
          />
        )}

        {step === 'side-back' && (
          <Panel
            title="Extra photos (optional)"
            body="The front photo and measurements above are all we need to list your product. You can add side and back photos later from the product page — skip ahead to review and submit now."
            primaryLabel="Continue to review"
            onPrimary={advance}
            secondaryLabel="Back"
            onSecondary={() => setStep('dimensions')}
          />
        )}

        {step === 'review' && frontFrame && frameUrl && calibration && dimensions && (
          <ReviewSubmit
            merchantSlug={props.merchantSlug}
            merchantId={props.merchantId}
            frontFrame={frontFrame}
            frontFrameUrl={frameUrl}
            calibration={calibration}
            dimensions={dimensions}
            onComplete={(scaleLockId) => {
              props.onComplete?.(scaleLockId);
              props.onClose();
            }}
            onBack={() => setStep('side-back')}
            onCancel={props.onClose}
          />
        )}
        {step === 'review' && (!frontFrame || !calibration || !dimensions) && (
          <Panel
            title="Missing capture data"
            body="Return to an earlier step."
            primaryLabel="Restart"
            onPrimary={() => setStep('prepare')}
            secondaryLabel="Cancel"
            onSecondary={props.onClose}
          />
        )}
      </div>
    </div>
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
        <button
          type="button"
          onClick={onSecondary}
          style={{
            background: 'transparent',
            border: '1px solid #0E0E10',
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {secondaryLabel}
        </button>
        <button
          type="button"
          onClick={onPrimary}
          style={{
            background: '#C0A67E',
            color: '#0E0E10',
            border: '1px solid #C0A67E',
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
