/**
 * Sims-Parity DT-11 — Konva placed-item renderer.
 *
 * Renders a single product on the Gaming Layer 1 stage with:
 *   • Konva.Image of `photo_front_url` sized by `dimensions_mm`.
 *   • Ground-shadow ellipse picked per `photo_alpha_clean` (GL1.04
 *     behind for alpha_clean=true, GL1.04b synthetic offset-below
 *     for false).
 *   • Optional silhouette_bbox_px crop (GL1.01b) before sizing.
 *
 * Mounted only when `?ui=gaming-v1` is active (DT-19 server-flag flip).
 * The Konva render-core at `src/components/RoomCanvas.tsx` is NOT
 * touched — this component is additive, dropped into a new Layer.
 */

import { useEffect, useState } from 'react';
import { Ellipse, Group, Image as KonvaImage } from 'react-konva';
import { cropRect, shadowGeometry, type PlacedItemModel } from './placedItemMath';

export interface PlacedItemProps {
  /** Stable id (PlacedItemSchema.id from MASTER-BUILD-PLAN §1). */
  id: string;
  model: PlacedItemModel;
  /** photo_front_url consumed via the standard contract. */
  photoFrontUrl: string;
  /** Click → select. */
  onSelect?: (id: string) => void;
}

export function PlacedItem(props: PlacedItemProps): JSX.Element | null {
  const { id, model, photoFrontUrl, onSelect } = props;
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const i = new window.Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => setImg(i);
    i.onerror = () => setImg(null);
    i.src = photoFrontUrl;
    return () => {
      i.onload = null;
      i.onerror = null;
    };
  }, [photoFrontUrl]);

  if (!img) return null;

  const shadow = shadowGeometry(model);
  const crop = cropRect({
    ...model,
    imageNaturalWidthPx: img.naturalWidth,
    imageNaturalHeightPx: img.naturalHeight,
  });

  const wPx = model.widthMm * model.pxPerMm;
  const dPx = model.depthMm * model.pxPerMm;

  // GL1.04 path requires shadow drawn BEHIND the photo — wrap in a
  // Group so render order is shadow → image. GL1.04b draws the
  // shadow at a Y BELOW the photo, so render order doesn't matter
  // visually, but we keep the same Group structure for consistency.
  return (
    <Group
      onClick={() => onSelect?.(id)}
      onTap={() => onSelect?.(id)}
    >
      <Ellipse
        x={shadow.centreXPx + shadow.offsetXPx}
        y={shadow.centreYPx + shadow.offsetYPx}
        radiusX={shadow.radiusXPx}
        radiusY={shadow.radiusYPx}
        fill={shadow.fillRgb}
        opacity={shadow.opacity}
        listening={false}
      />
      <KonvaImage
        image={img}
        x={model.xPx}
        y={model.yPx}
        width={wPx}
        height={dPx}
        crop={crop ?? undefined}
      />
    </Group>
  );
}
