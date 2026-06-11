/**
 * Sims-Parity DT-08 — Review + Submit step.
 *
 * Final step of the 6-step CaptureModal. Receives:
 *   • frontFrame  — captured photo Blob + meta from DT-05
 *   • calibration — pixelsPerMm + homography + bbox from DT-06
 *   • dimensions  — typed W×D×H + typedVsMeasured from DT-07
 *
 * Action: PUT the photo to Vercel Blob via uploadCaptureBlob (DT-03),
 * then POST the assembled CapturePacket to /api/merchants/:slug/
 * capture/calibrate (DT-04). On 200 → green check + onComplete().
 * On error → retry chain.
 *
 * NOTE: v1 background removal is preview-only at this DT — the bytes
 * that ride to Blob are the raw camera capture; the calibrate handler
 * persists `alphaClean: false` in the packet so the renderer (DT-11)
 * uses the GL1.04b synthetic offset-below shadow path. v2 (DT-20)
 * will switch to alphaClean: true with a true alpha-cleaned upload.
 */

import { useState } from 'react';
import { uploadCaptureBlob, UploadBlobError } from '../../lib/capture/uploadBlob';
import type { CapturedFrame } from './CameraStage';
import type { ScaleFromMarkerOutput } from '../../lib/capture/scaleFromMarker';
import { describeError } from '../../lib/capture/captureFsm';

export interface ReviewSubmitProps {
  merchantSlug: string;
  merchantId: number;
  frontFrame: CapturedFrame;
  frontFrameUrl: string;
  /** Optional extra shots captured in the ShotSet step. */
  sideFrame?: CapturedFrame | null;
  sideFrameUrl?: string | null;
  backFrame?: CapturedFrame | null;
  backFrameUrl?: string | null;
  calibration: ScaleFromMarkerOutput;
  dimensions: {
    dimensionsMm: { width: number; depth: number; height: number };
    typedVsMeasured: { deltaPct: number; flagged: boolean; overrideReason?: string };
  };
  /**
   * When set, Submit is disabled and this reason is shown — the reconcile
   * gate (front + calibration + dimensions must all be present). The modal
   * computes it via `submitBlockedReason`; null/undefined ⇒ ready.
   */
  blockedReason?: string | null;
  onComplete: (scaleLockId: string) => void;
  /** Route back to the shot-set step to retake/add shots. */
  onBack: () => void;
  onCancel: () => void;
  /** Test injector for fetch. */
  __testFetch?: typeof globalThis.fetch;
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'calibrating' }
  | { kind: 'success'; scaleLockId: string }
  | { kind: 'error'; message: string; phase: 'upload' | 'calibrate' };

export function ReviewSubmit(props: ReviewSubmitProps): JSX.Element {
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });
  /** Non-fatal note when an OPTIONAL side/back shot failed to upload. */
  const [optionalWarning, setOptionalWarning] = useState<string | null>(null);

  /** Best-effort upload for an optional side/back shot — never fatal. */
  async function uploadOptional(
    slot: 'side' | 'back',
    frame: CapturedFrame,
  ): Promise<{ blobUrl: string } | null> {
    try {
      const upload = await uploadCaptureBlob({
        merchantSlug: props.merchantSlug,
        file: frame.blob,
        filename: `${slot}-${Date.now()}.webp`,
        contentType: 'image/webp',
        slot,
        deps: props.__testFetch ? { fetch: props.__testFetch } : undefined,
      });
      return { blobUrl: upload.blobUrl };
    } catch {
      // Optional shot — record a warning, do not block the submit.
      setOptionalWarning(
        `The ${slot} photo couldn't be uploaded and was left off — your listing still went through.`,
      );
      return null;
    }
  }

  async function handleSubmit(): Promise<void> {
    if (props.blockedReason) return;
    setOptionalWarning(null);
    setState({ kind: 'uploading' });
    let blobKey: string;
    let blobUrl: string;
    try {
      const filename = `front-${Date.now()}.webp`;
      const upload = await uploadCaptureBlob({
        merchantSlug: props.merchantSlug,
        file: props.frontFrame.blob,
        filename,
        contentType: 'image/webp',
        slot: 'front',
        deps: props.__testFetch ? { fetch: props.__testFetch } : undefined,
      });
      blobKey = upload.blobKey;
      blobUrl = upload.blobUrl;
    } catch (err) {
      const msg = err instanceof UploadBlobError ? err.message : 'upload failed';
      setState({ kind: 'error', message: msg, phase: 'upload' });
      return;
    }

    // Optional shots — uploaded after the (fatal) front shot. A failure
    // here only drops that one photo; the listing still submits.
    const photoSide = props.sideFrame ? await uploadOptional('side', props.sideFrame) : null;
    const photoBack = props.backFrame ? await uploadOptional('back', props.backFrame) : null;

    // Mint scaleLockId on the server; client sends a placeholder UUID
    // so the Zod CapturePacketSchema accepts the shape. The server
    // ignores client-supplied scaleLockId — calibrateHandler always
    // mints a fresh one via DB default gen_random_uuid().
    const packet = {
      scaleLockId: '00000000-0000-4000-8000-000000000000',
      capturedAt: new Date().toISOString(),
      path: 'a4-corner-tap' as const,
      photoFront: {
        blobUrl,
        widthPx: props.frontFrame.widthPx,
        heightPx: props.frontFrame.heightPx,
        pixelsPerMm: props.calibration.pixelsPerMm,
        rmsCalibrationError: props.calibration.rmsCalibrationError,
        alphaClean: false,
        silhouette_bbox_px: props.calibration.silhouette_bbox_px,
      },
      ...(photoSide ? { photoSide } : {}),
      ...(photoBack ? { photoBack } : {}),
      dimensionsMm: props.dimensions.dimensionsMm,
      typedVsMeasured: props.dimensions.typedVsMeasured,
    };

    setState({ kind: 'calibrating' });
    try {
      const fetchImpl = props.__testFetch ?? globalThis.fetch;
      const res = await fetchImpl(
        `/api/merchants/${encodeURIComponent(props.merchantSlug)}/capture/calibrate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantId: props.merchantId, packet }),
        },
      );
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          kind: 'error',
          message: errBody.error ?? `calibrate failed (HTTP ${res.status})`,
          phase: 'calibrate',
        });
        return;
      }
      const body = (await res.json()) as { scaleLockId: string };
      setState({ kind: 'success', scaleLockId: body.scaleLockId });
      // Don't auto-close — let the user see the green check, then click "Done".
      void blobKey;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'calibrate request failed';
      setState({ kind: 'error', message: msg, phase: 'calibrate' });
    }
  }

  const dimText = `${props.dimensions.dimensionsMm.width} × ${props.dimensions.dimensionsMm.depth} × ${props.dimensions.dimensionsMm.height} mm`;

  const shots: { label: string; url: string }[] = [
    { label: 'Front', url: props.frontFrameUrl },
    ...(props.sideFrame && props.sideFrameUrl ? [{ label: 'Side', url: props.sideFrameUrl }] : []),
    ...(props.backFrame && props.backFrameUrl ? [{ label: 'Back', url: props.backFrameUrl }] : []),
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Review &amp; submit</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(14,14,16,0.7)' }}>
        Confirm your {shots.length === 1 ? 'photo' : `${shots.length} photos`} + measurements,
        or go back to retake, before we mint the scale-lock.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }} aria-label="Captured photos preview">
          {shots.map((s) => (
            <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  aspectRatio: '210 / 297',
                  backgroundImage: `url("${s.url}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: 8,
                  border: '1px solid rgba(14,14,16,0.15)',
                }}
                aria-label={`${s.label} photo`}
              />
              <span style={{ fontSize: 10, textAlign: 'center', color: 'rgba(14,14,16,0.6)' }}>{s.label}</span>
            </div>
          ))}
        </div>
        <dl style={{ margin: 0, fontSize: 13 }}>
          <Row k="Dimensions" v={dimText} />
          <Row k="Pixels/mm" v={props.calibration.pixelsPerMm.toFixed(3)} />
          <Row k="RMS error" v={`${props.calibration.rmsCalibrationError.toFixed(2)} px`} />
          <Row k="Δ width" v={`${(props.dimensions.typedVsMeasured.deltaPct * 100).toFixed(1)}%`} />
          {props.dimensions.typedVsMeasured.overrideReason && (
            <Row k="Override" v={props.dimensions.typedVsMeasured.overrideReason} />
          )}
          <Row k="Background v1" v="A4-rect alpha-mask (alphaClean=false)" />
        </dl>
      </div>

      {state.kind === 'success' && (
        <div role="status" style={successStyle()}>
          ✓ Scale-lock minted: <code style={{ fontSize: 11 }}>{state.scaleLockId}</code>
        </div>
      )}
      {optionalWarning && state.kind !== 'error' && (
        <div role="status" style={warningStyle()}>{optionalWarning}</div>
      )}
      {state.kind === 'error' && (
        <div role="alert" style={errorStyle()}>
          <strong style={{ display: 'block' }}>
            {describeError(state.phase === 'upload' ? 'upload-failed' : 'calibrate-failed').title}
          </strong>
          {state.message}
        </div>
      )}
      {props.blockedReason && state.kind === 'idle' && (
        <div role="alert" style={warningStyle()}>{props.blockedReason}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        {state.kind !== 'success' && (
          <>
            <button type="button" onClick={props.onBack} style={btn('ghost')}>Edit shots</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                state.kind === 'uploading'
                || state.kind === 'calibrating'
                || Boolean(props.blockedReason)
              }
              style={btn('primary')}
              aria-disabled={Boolean(props.blockedReason)}
            >
              {state.kind === 'uploading' ? 'Uploading…'
                : state.kind === 'calibrating' ? 'Minting scale-lock…'
                : 'Submit'}
            </button>
          </>
        )}
        {state.kind === 'success' && (
          <button type="button" onClick={() => props.onComplete(state.scaleLockId)} style={btn('primary')}>
            Done
          </button>
        )}
        {state.kind === 'error' && (
          <button type="button" onClick={() => setState({ kind: 'idle' })} style={btn('ghost')}>
            Retry
          </button>
        )}
        {state.kind === 'idle' && (
          <button type="button" onClick={props.onCancel} style={{ ...btn('ghost'), order: -1 }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(14,14,16,0.08)' }}>
      <dt style={{ color: 'rgba(14,14,16,0.6)' }}>{k}</dt>
      <dd style={{ margin: 0, color: '#0E0E10', fontWeight: 500 }}>{v}</dd>
    </div>
  );
}

function successStyle(): React.CSSProperties {
  return {
    background: 'rgba(192,166,126,0.25)',
    border: '1px solid #C0A67E',
    color: '#0E0E10',
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 16,
  };
}
function errorStyle(): React.CSSProperties {
  return {
    background: 'rgba(255, 80, 80, 0.1)',
    border: '1px solid rgba(255, 80, 80, 0.5)',
    color: '#7a1a1a',
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 16,
  };
}
function warningStyle(): React.CSSProperties {
  return {
    background: 'rgba(192,166,126,0.18)',
    border: '1px solid rgba(192,166,126,0.6)',
    color: '#5c4a25',
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 16,
  };
}
function btn(variant: 'primary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
    fontSize: 14, border: '1px solid #0E0E10',
  };
  if (variant === 'primary') return { ...base, background: '#C0A67E', borderColor: '#C0A67E', color: '#0E0E10' };
  return { ...base, background: 'transparent', color: '#0E0E10' };
}
