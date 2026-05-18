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

export interface CameraStageProps {
  /** Called with the captured frame after a successful shutter. */
  onCapture: (frame: CapturedFrame) => void;
  /** Called when the user closes the camera before shooting. */
  onCancel: () => void;
  /** Target capture width — defaults to 1920 per spec. */
  targetWidth?: number;
  /** Blur threshold override (Laplacian variance) — defaults to 100. */
  blurThreshold?: number;
  /** Mock stream injector for tests. */
  __testStream?: MediaStream;
}

export function CameraStage(props: CameraStageProps): JSX.Element {
  const { onCapture, onCancel, targetWidth = 1920, blurThreshold = 100 } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');

  // Mount: request the camera stream.
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
        setError('getUserMedia is not available in this browser.');
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
        setError(err instanceof Error ? err.message : 'Camera permission denied.');
      }
    }

    void acquire();
    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [targetWidth, props.__testStream]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'capture failed');
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

      {permissionState === 'pending' && (
        <div role="status" style={overlayCentre()}>
          Requesting camera permission…
        </div>
      )}
      {error && (
        <div role="alert" style={overlayCentre()}>
          {error}
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
