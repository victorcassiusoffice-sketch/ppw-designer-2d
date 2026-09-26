import { useRef, useState } from 'react';
import type Konva from 'konva';
import { Layer, Rect, Text } from 'react-konva';
import { gardenRectFromPoints, moveGardenFence } from '../designer/garden';
import { useGardenEditorStore } from '../store/gardenEditorStore';
import { usePropertyStore } from '../store/propertyStore';

/** A transient top layer owns only the explicitly armed garden gesture. */
export function GardenDrawLayer({ pxPerMetre, scale }: { pxPerMetre: number; scale: number }) {
  const placement = useGardenEditorStore((s) => s.placement);
  const anchor = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof gardenRectFromPoints>>(null);
  const point = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const p = event.target.getStage()?.getRelativePointerPosition();
    return p ? { x: p.x / pxPerMetre, y: p.y / pxPerMetre } : null;
  };
  if (!placement) return null;
  return <Layer name="garden-draw">
    <Rect x={-10000 * pxPerMetre} y={-10000 * pxPerMetre} width={20000 * pxPerMetre} height={20000 * pxPerMetre} fill="rgba(0,0,0,0)"
      onPointerDown={(event) => {
        event.cancelBubble = true;
        if (event.evt.isPrimary === false || (event.evt.pointerType === 'mouse' && event.evt.button !== 0)) return;
        const p = point(event);
        if (!p) return;
        anchor.current = { ...p, pointerId: event.evt.pointerId };
        event.target.setPointerCapture(event.evt.pointerId);
      }}
      onPointerMove={(event) => {
        event.cancelBubble = true;
        const p = point(event);
        if (p && anchor.current && event.evt.pointerId === anchor.current.pointerId && placement.mode === 'resize') setPreview(gardenRectFromPoints(anchor.current, p));
      }}
      onPointerUp={(event) => {
        event.cancelBubble = true;
        const from = anchor.current;
        if (!from || from.pointerId !== event.evt.pointerId) return;
        anchor.current = null;
        setPreview(null);
        event.target.releaseCapture(event.evt.pointerId);
        const p = point(event);
        if (!p) return;
        const store = usePropertyStore.getState();
        let committed = false;
        if (placement.kind === 'surface') {
          const surface = store.property.garden?.surfaces.find((s) => s.id === placement.id);
          const patch = placement.mode === 'resize' ? gardenRectFromPoints(from, p) : surface ? { x: Math.round((p.x - surface.widthM / 2) * 10) / 10, y: Math.round((p.y - surface.depthM / 2) * 10) / 10 } : null;
          if (patch) committed = store.updateGardenSurface(placement.id, patch);
        } else {
          const fence = store.property.garden?.fences.find((f) => f.id === placement.id);
          if (fence) committed = store.updateGardenFence(fence.id, moveGardenFence(fence, p));
        }
        if (committed) useGardenEditorStore.getState().place(null);
      }}
      onPointerCancel={(event) => { event.cancelBubble = true; anchor.current = null; setPreview(null); }}
      onClick={(event) => { event.cancelBubble = true; }} onTap={(event) => { event.cancelBubble = true; }} />
    {preview && <>
      <Rect listening={false} x={preview.x * pxPerMetre} y={preview.y * pxPerMetre} width={preview.widthM * pxPerMetre} height={preview.depthM * pxPerMetre} stroke="#2c8a75" fill="rgba(64,155,126,0.22)" strokeWidth={2 / scale} dash={[5 / scale, 3 / scale]} />
      <Text listening={false} x={preview.x * pxPerMetre + 8 / scale} y={preview.y * pxPerMetre + 8 / scale} text={`${preview.widthM.toFixed(1)} × ${preview.depthM.toFixed(1)} m · ${(preview.widthM * preview.depthM).toFixed(1)} m²`} fontSize={12 / scale} fill="#154e41" />
    </>}
  </Layer>;
}
