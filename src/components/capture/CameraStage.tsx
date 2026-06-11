/**
 * Sims-Parity DT-05 — CameraStage.
 *
 * Step 2 of the six-step CaptureModal flow. Acquires a getUserMedia
 * stream with the rear-facing camera, renders it inside an iOS-Safari-
 * compatible `<video playsinline>`, overlays a ghost A4 outline so the
 * merchant aligns the printed reference page (DT-02 PDF), and on
 * shutter captures a frame to a canvas → Blob (webp), runs a
 * Laplacian-variance blur check, and emits the capture upstream.
 *
 * V4-AU-1 palette: gold #C0A67E (active shutter), ink #0E0E10 (overlay),
 * cream #F5EFE6 (frame border).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { assessBlur, type BlurVerdict } from '../../lib/capture/blurDetection';
import { describeError, type CaptureErrorKind } from '../../lib/capture/captureFsm';

const A4_ASPECT = 210 / 297; // portrait

export interface CapturedFrame {
  /** The blob to PUT to Vercel Blob in DT-08 ReviewSubmit. */
  blob: Blob;
  /** Width of the source video frame in px. */
  widthPx: number;
  /** Height of the source video frame in px. */
  heightPx: number;
  /** Laplacian-variance blur verdict. */
  blur: BlurVerdict;
}

export interface CameraStageGuidance {
  /** Short slot label, e.g. "Side photo". */
  label: string;
  /** One-line instruction shown above the shutter for this shot. */
  instruction: string;
}

export interface CameraStageProps {
  /** Called with the captured frame after a successful shutter. */
  onCapture: (frame: CapturedFrame) => void;
  /** Called when the user closes the camera before shooting. */
  onCancel: () => void;
  /** Per-shot guidance (front/side/back) rendered as an overlay banner. */
  guidance?: CameraStageGuidance;
  /** Target capture width — defaults to 1920 per spec. */
  targetWidth?: number;
  /** Blur threshold override (Laplacian variance) — defaults to 100. */
  blurThreshold?: number;
  /** Mock stream injector for tests. */
  __testStream?: MediaStream;
}

/** Map a getUserMedia rejection to a recover-able error kind. */
function classifyCameraError(err: unknown): CaptureErrorKind {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') {
    return 'camera-unavailable';
  }
  return 'camera-denied';
}

export function CameraStage(props: CameraStageProps): JSX.Element {
  const { onCapture, onCancel, guidance, targetWidth = 1920, blurThreshold = 100 } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorKind, setErrorKind] = useState<CaptureErrorKind | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [permissionState, setPermissionState] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');

  // Re-acquire the camera. Bumping retryKey re-runs the effect below — the
  // recover action when permission was denied or the device had no camera.
  const retryCamera = useCallback(() => {
    setErrorKind(null);
    setPermissionState('idle');
    setRetryKey((k) => k + 1);
  }, []);

  // Mount (and every retry): request the camera stream.
  useEffect(() => {
    let cancelled = false;

    async function acquire(): Promise<void> {
      if (props.__testStream) {
        streamRef.current = props.__testStream;
        if (videoRef.current) {
          videoRef.current.srcObject = props.__testStream;
        }
        setPermissionState('granted');
        return;
      }
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setPermissionState('denied');
        setErrorKind('camera-unavailable');
        return;
      }
      setPermissionState('pending');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: targetWidth } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setPermissionState('granted');
      } catch (err) {
        setPermissionState('denied');
        setErrorKind(classifyCameraError(err));
      }
    }

    void acquire();
    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [targetWidth, props.__testStream, retryKey]);

  const handleShutter = useCallback(async () => {
    if (busy || !videoRef.current || !streamRef.current) return;
    setBusy(true);
    try {
      const video = videoRef.current;
      const w = video.videoWidth || targetWidth;
      const h = video.videoHeight || Math.round(targetWidth / A4_ASPECT);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas context unavailable');
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const blur = assessBlur(imageData, blurThreshold);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.9);
      });
      if (!blob) throw new Error('canvas.toBlob returned null');

      // Haptic confirm — Android only; iOS Safari ignores silently.
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(50);
        }
      } catch {
        // Ignore — non-fatal.
      }

      onCapture({ blob, widthPx: w, heightPx: h, blur });
    } catch {
      setErrorKind('capture-failed');
    } finally {
      setBusy(false);
    }
  }, [busy, blurThreshold, onCapture, targetWidth]);

  return (
    <div
      role="region"
      aria-label="Camera capture stage"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 720,
        aspectRatio: `${A4_ASPECT}`,
        background: '#0E0E10',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Ghost A4 overlay — dashed gold rectangle inset 8% on all sides. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '8%',
          border: '2px dashed #C0A67E',
          borderRadius: 6,
          pointerEvents: 'none',
        }}
      />
      {/* Corner gold ticks for finger targets at the four corners. */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <span
          key={c}
          aria-hidden
          style={{
            position: 'absolute',
            width: 16,
            height: 16,
            borderColor: '#C0A67E',
            borderStyle: 'solid',
            ...positionsForCornerTick(c),
          }}
        />
      ))}

      {/* Per-shot guidance banner (front/side/back). */}
      {guidance && !errorKind && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '10px 16px',
            background: 'rgba(14, 14, 16, 0.55)',
            color: '#F5EFE6',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <strong style={{ display: 'block', fontSize: 13 }}>{guidance.label}</strong>
          {guidance.instruction}
        </div>
      )}

      {permissionState === 'pending' && (
        <div role="status" style={overlayCentre()}>
          Requesting camera permission…
        </div>
      )}
      {errorKind && (
        <div role="alert" style={{ ...overlayCentre(), flexDirection: 'column', gap: 12 }}>
          <div>
            <strong style={{ display: 'block', marginBottom: 6 }}>
              {describeError(errorKind).title}
            </strong>
            <span style={{ fontSize: 13, opacity: 0.9 }}>{describeError(errorKind).body}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={retryCamera}
              style={{
                background: '#C0A67E',
                color: '#0E0E10',
                border: '1px solid #C0A67E',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              {describeError(errorKind).actions[0]?.label ?? 'Try again'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: 'transparent',
                color: '#F5EFE6',
                border: '1px solid #F5EFE6',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel capture"
          style={{
            background: 'transparent',
            border: '1px solid #F5EFE6',
            color: '#F5EFE6',
            borderRadius: 999,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleShutter}
          aria-label="Capture photo"
          disabled={busy || permissionState !== 'granted'}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#C0A67E',
            border: '4px solid #F5EFE6',
            opacity: busy || permissionState !== 'granted' ? 0.5 : 1,
            cursor: busy ? 'wait' : 'pointer',
          }}
        />

        <span aria-hidden style={{ width: 80 }} />
      </div>
    </div>
  );
}

function positionsForCornerTick(c: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties {
  const inset = '6%';
  const baseTL: React.CSSProperties = { top: inset, left: inset, borderWidth: '3px 0 0 3px' };
  const baseTR: React.CSSProperties = { top: inset, right: inset, borderWidth: '3px 3px 0 0' };
  const baseBL: React.CSSProperties = { bottom: inset, left: inset, borderWidth: '0 0 3px 3px' };
  const baseBR: React.CSSProperties = { bottom: inset, right: inset, borderWidth: '0 3px 3px 0' };
  return c === 'tl' ? baseTL : c === 'tr' ? baseTR : c === 'bl' ? baseBL : baseBR;
}

function overlayCentre(): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#F5EFE6',
    background: 'rgba(14, 14, 16, 0.6)',
    fontSize: 14,
    padding: 16,
    textAlign: 'center',
  };
}
