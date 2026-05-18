/**
 * Sims-Parity DT-11 — wood-plank floor pattern.
 *
 * Procedural wood-plank canvas pattern generated at mount time so we
 * don't ship a 120 KB JPEG. The pattern is then sealed into a
 * `Konva.Rect` via `fillPatternImage` per spec.
 *
 * Plank dimensions chosen to read "wide oak" at room scale: 200 mm
 * (long axis) × 36 mm (short axis). The fillPatternRotation aligns
 * grain to the room's longest axis (woodGrainRotationDeg helper).
 */

import { useEffect, useState } from 'react';
import { Rect } from 'react-konva';

function buildWoodPattern(): HTMLImageElement {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base oak tone.
    ctx.fillStyle = '#b48a5e';
    ctx.fillRect(0, 0, size, size);
    // Plank rows — 6 rows of ~170 px each.
    const rowH = 170;
    const plankW = 320;
    for (let row = 0; row < Math.ceil(size / rowH); row++) {
      const yTop = row * rowH;
      const stagger = (row % 2) * 80;
      for (let col = -1; col < Math.ceil(size / plankW) + 1; col++) {
        const xLeft = col * plankW + stagger;
        // Slight per-plank tone variance.
        const tone = 70 + (Math.abs(Math.sin((row * 7 + col * 13) % 1000)) * 50);
        ctx.fillStyle = `hsl(28, 35%, ${tone / 2 + 18}%)`;
        ctx.fillRect(xLeft, yTop, plankW - 2, rowH - 2);
        // Faint grain lines.
        ctx.strokeStyle = 'rgba(40, 24, 12, 0.18)';
        ctx.lineWidth = 1;
        for (let g = 0; g < 4; g++) {
          ctx.beginPath();
          const gy = yTop + 20 + g * 32;
          ctx.moveTo(xLeft, gy);
          ctx.lineTo(xLeft + plankW - 2, gy + (Math.sin((row + col + g) * 1.3) * 4));
          ctx.stroke();
        }
      }
    }
  }
  const img = new window.Image();
  img.src = canvas.toDataURL('image/jpeg', 0.7);
  return img;
}

export interface WoodPlankFloorProps {
  widthPx: number;
  heightPx: number;
  /** Wood-grain rotation in degrees — 0 (horizontal grain) or 90 (vertical). */
  grainRotationDeg: number;
}

export function WoodPlankFloor(props: WoodPlankFloorProps): JSX.Element {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const i = buildWoodPattern();
    if (i.complete) setImg(i);
    else i.onload = () => setImg(i);
    return () => { i.onload = null; };
  }, []);

  return (
    <Rect
      x={0}
      y={0}
      width={props.widthPx}
      height={props.heightPx}
      fillPatternImage={img ?? undefined}
      fillPatternRotation={props.grainRotationDeg}
      fill={img ? undefined : '#b48a5e'}
      listening={false}
    />
  );
}
