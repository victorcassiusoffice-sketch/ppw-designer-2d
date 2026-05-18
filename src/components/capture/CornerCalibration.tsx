/**
 * Sims-Parity DT-06 — CornerCalibration draggable pins UI.
 *
 * After CameraStage (DT-05) captures a frame, this component renders
 * the still photo with four draggable corner pins. The merchant
 * snaps each pin to a visible corner of the printed A4 reference
 * page. On confirm, `scaleFromMarker` is invoked and the result
 * propagates upstream.
 *
 * V4-AU-1 palette: gold pins, dashed ink outline between them.
 */

import { useEffect, useRef, useState } from 'react';
import { scaleFromMarker, type CornerPoint, type ScaleFromMarkerOutput } from '../../lib/capture/scaleFromMarker';

export interface CornerCalibrationProps {
  /** The captured photo as a Blob URL or object URL. */
  imageSrc: string;
  imageWidthPx: number;
  imageHeightPx: number;
  /** Called when the merchant confirms. */
  onConfirm: (result: ScaleFromMarkerOutput) => void;
  /** Called when the merchant chooses to retake. */
  onRetake: () => void;
}

type CornerKey = 'tl' | 'tr' | 'br' | 'bl';
const CORNER_ORDER: CornerKey[] = ['tl', 'tr', 'br', 'bl'];

function initialCorners(w: number, h: number): Record<CornerKey, CornerPoint> {
  const inset = 0.15;
  return {
    tl: { xPx: w * inset, yPx: h * inset },
    tr: { xPx: w * (1 - inset), yPx: h * inset },
    br: { xPx: w * (1 - inset), yPx: h * (1 - inset) },
    bl: { xPx: w * inset, yPx: h * (1 - inset) },
  };
}

export function CornerCalibration(props: CornerCalibrationProps): JSX.Element {
  const { imageSrc, imageWidthPx, imageHeightPx, onConfirm, onRetake } = props;
  const [corners, setCorners] = useState<Record<CornerKey, CornerPoint>>(() => initialCorners(imageWidthPx, imageHeightPx));
  const [dragging, setDragging] = useState<CornerKey | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Pointer-move tracking while a pin is being dragged.
  useEffect(() => {
    if (!dragging) return undefined;
    const draggingKey: CornerKey = dragging;
    function onMove(e: PointerEvent): void {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const xPx = ((e.clientX - rect.left) / rect.width) * imageWidthPx;
      const yPx = ((e.clientY - rect.top) / rect.height) * imageHeightPx;
      setCorners((c) => ({ ...c, [draggingKey]: { xPx, yPx } }));
    }
    function onUp(): void {
      setDragging(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, imageWidthPx, imageHeightPx]);

  function handleConfirm(): void {
    const cornersArr: [CornerPoint, CornerPoint, CornerPoint, CornerPoint] = [
      corners.tl, corners.tr, corners.br, corners.bl,
    ];
    const result = scaleFromMarker({
      corners: cornersArr,
      imageWidthPx,
      imageHeightPx,
    });
    onConfirm(result);
  }

  return (
    <div>
      <div
        ref={stageRef}
        role="img"
        aria-label="Captured photo with draggable corner pins"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 720,
          aspectRatio: `${imageWidthPx} / ${imageHeightPx}`,
          backgroundImage: `url("${imageSrc}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 8,
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        {/* Connecting quad outline. */}
        <svg
          viewBox={`0 0 ${imageWidthPx} ${imageHeightPx}`}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', pointerEvents: 'none',
          }}
        >
          <polygon
            points={CORNER_ORDER.map((k) => `${corners[k].xPx},${corners[k].yPx}`).join(' ')}
            fill="rgba(192, 166, 126, 0.12)"
            stroke="#0E0E10"
            strokeWidth={2}
            strokeDasharray="6 6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {CORNER_ORDER.map((k) => {
          const c = corners[k];
          return (
            <button
              key={k}
              type="button"
              aria-label={`Drag ${k.toUpperCase()} corner pin`}
              onPointerDown={() => setDragging(k)}
              style={{
                position: 'absolute',
                left: `${(c.xPx / imageWidthPx) * 100}%`,
                top: `${(c.yPx / imageHeightPx) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#C0A67E',
                border: '3px solid #F5EFE6',
                boxShadow: '0 0 0 1px rgba(14,14,16,0.6)',
                cursor: 'grab',
                touchAction: 'none',
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <button
          type="button"
          onClick={onRetake}
          style={{
            background: 'transparent',
            border: '1px solid #0E0E10',
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Retake photo
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          style={{
            background: '#C0A67E',
            border: '1px solid #C0A67E',
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Confirm corners
        </button>
      </div>
    </div>
  );
}
