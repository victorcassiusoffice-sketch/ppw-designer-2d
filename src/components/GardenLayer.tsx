import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Group, Line, Rect, Text, Transformer } from 'react-konva';
import { FENCE_MATERIALS, GARDEN_SURFACES, fenceLengthM, type Garden, type GardenSurface } from '../designer/garden';
import { findOutdoorPavingProduct } from '../data/outdoorPaving';
import { useGardenEditorStore } from '../store/gardenEditorStore';
import { usePropertyStore } from '../store/propertyStore';

function SurfaceShape({ surface, pxPerMetre, scale, interactive, selected }: {
  surface: GardenSurface; pxPerMetre: number; scale: number; interactive: boolean; selected: boolean;
}) {
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (selected && rectRef.current && transformerRef.current) {
      transformerRef.current.nodes([rectRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected, interactive]);
  const paving = surface.kind === 'path' ? findOutdoorPavingProduct(surface.pavingProductId) : undefined;
  const select = () => {
    useGardenEditorStore.getState().select(surface.id);
    usePropertyStore.getState().selectItemAcrossRooms(null);
  };
  const edit = () => { select(); window.dispatchEvent(new CustomEvent('ppw:edit-garden', { detail: { id: surface.id } })); };
  return <Group name={`garden-surface-${surface.id}`}>
    <Rect ref={rectRef} x={surface.x * pxPerMetre} y={surface.y * pxPerMetre} width={surface.widthM * pxPerMetre} height={surface.depthM * pxPerMetre}
      fill={paving?.renderHex ?? GARDEN_SURFACES[surface.kind].hex} stroke={selected ? '#28786e' : '#536344'} strokeWidth={(selected ? 2 : 1) / scale} opacity={0.85}
      draggable={interactive} listening={interactive}
      onClick={(e) => { e.cancelBubble = true; edit(); }} onTap={(e) => { e.cancelBubble = true; edit(); }}
      onDragStart={(e) => { e.cancelBubble = true; select(); }} onDragMove={(e) => { e.cancelBubble = true; }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        const snap = (n: number) => Math.round(n / pxPerMetre * 10) / 10;
        usePropertyStore.getState().updateGardenSurface(surface.id, { x: snap(e.target.x()), y: snap(e.target.y()) });
      }}
      onTransformEnd={(e) => {
        e.cancelBubble = true;
        const rect = rectRef.current;
        if (!rect) return;
        const round = (n: number) => Math.round(n * 100) / 100;
        const patch = { x: round(rect.x() / pxPerMetre), y: round(rect.y() / pxPerMetre), widthM: Math.max(0.2, round(rect.width() * rect.scaleX() / pxPerMetre)), depthM: Math.max(0.2, round(rect.height() * rect.scaleY() / pxPerMetre)) };
        rect.scale({ x: 1, y: 1 });
        usePropertyStore.getState().updateGardenSurface(surface.id, patch);
      }} />
    {surface.widthM * pxPerMetre * scale > 85 && <Text listening={false}
      x={surface.x * pxPerMetre + 5 / scale} y={surface.y * pxPerMetre + 5 / scale}
      width={Math.max(0, surface.widthM * pxPerMetre - 10 / scale)}
      text={`${paving?.name ?? GARDEN_SURFACES[surface.kind].label} · ${(surface.widthM * surface.depthM).toFixed(1)} m²${surface.elevationM ? ` · +${surface.elevationM} m` : ''}`}
      fontFamily="Inter, sans-serif" fontSize={11 / scale} fill="#263523" />}
    {selected && interactive && <Transformer ref={transformerRef} rotateEnabled={false} flipEnabled={false} keepRatio={false}
      anchorSize={18} anchorCornerRadius={9} anchorFill="#eafff9" anchorStroke="#28786e" borderStroke="#28786e" borderDash={[4, 3]}
      boundBoxFunc={(oldBox, newBox) => newBox.width < 0.2 * pxPerMetre * scale || newBox.height < 0.2 * pxPerMetre * scale || newBox.width > 500 * pxPerMetre * scale || newBox.height > 500 * pxPerMetre * scale ? oldBox : newBox}
      onPointerDown={(e) => { e.cancelBubble = true; }} />}
  </Group>;
}

/** Select-mode editing leaves the existing wall, floor and product hit paths alone. */
export function GardenLayer({ garden, pxPerMetre, scale, interactive = false }: { garden?: Garden; pxPerMetre: number; scale: number; interactive?: boolean }) {
  const selectedId = useGardenEditorStore((s) => s.selectedId);
  if (!garden) return null;
  return <Group name="garden" listening={interactive}>
    {garden.surfaces.map((surface) => <SurfaceShape key={surface.id} surface={surface} pxPerMetre={pxPerMetre} scale={scale} interactive={interactive} selected={surface.id === selectedId} />)}
    {garden.fences.map((fence) => <Group key={fence.id} name={`garden-fence-${fence.id}`} draggable={interactive}
      onClick={(e) => { e.cancelBubble = true; useGardenEditorStore.getState().select(fence.id); window.dispatchEvent(new CustomEvent('ppw:edit-garden', { detail: { id: fence.id } })); }}
      onTap={(e) => { e.cancelBubble = true; useGardenEditorStore.getState().select(fence.id); window.dispatchEvent(new CustomEvent('ppw:edit-garden', { detail: { id: fence.id } })); }}
      onDragStart={(e) => { e.cancelBubble = true; useGardenEditorStore.getState().select(fence.id); }} onDragMove={(e) => { e.cancelBubble = true; }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        const dx = Math.round(e.target.x() / pxPerMetre * 10) / 10;
        const dy = Math.round(e.target.y() / pxPerMetre * 10) / 10;
        e.target.position({ x: 0, y: 0 });
        usePropertyStore.getState().updateGardenFence(fence.id, { a: { x: fence.a.x + dx, y: fence.a.y + dy }, b: { x: fence.b.x + dx, y: fence.b.y + dy } });
      }}>
      <Line points={[fence.a.x * pxPerMetre, fence.a.y * pxPerMetre, fence.b.x * pxPerMetre, fence.b.y * pxPerMetre]}
        stroke={fence.id === selectedId ? '#28786e' : FENCE_MATERIALS[fence.material].hex} strokeWidth={Math.max(4 / scale, pxPerMetre * (fence.material === 'hedge' ? 0.4 : 0.1))}
        hitStrokeWidth={20 / scale} dash={fence.material === 'hedge' ? undefined : [7 / scale, 3 / scale]} lineCap="square" />
      {fenceLengthM(fence) * pxPerMetre * scale > 100 && <Text listening={false}
        x={(fence.a.x + fence.b.x) / 2 * pxPerMetre} y={(fence.a.y + fence.b.y) / 2 * pxPerMetre - 15 / scale}
        text={`${fenceLengthM(fence).toFixed(1)} m`} fontFamily="Inter, sans-serif" fontSize={11 / scale} fill="#37362f" />}
    </Group>)}
  </Group>;
}
