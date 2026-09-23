import { Group, Line, Rect, Text } from 'react-konva';
import { FENCE_MATERIALS, GARDEN_SURFACES, fenceLengthM, type Garden } from '../designer/garden';

/** Passive plan layer: furniture, room drawing and selection keep their existing hit paths. */
export function GardenLayer({ garden, pxPerMetre, scale }: { garden?: Garden; pxPerMetre: number; scale: number }) {
  if (!garden) return null;
  return <Group name="garden" listening={false}>
    {garden.surfaces.map((surface) => <Group key={surface.id} name={`garden-surface-${surface.id}`}>
      <Rect x={surface.x * pxPerMetre} y={surface.y * pxPerMetre} width={surface.widthM * pxPerMetre} height={surface.depthM * pxPerMetre}
        fill={GARDEN_SURFACES[surface.kind].hex} stroke="#536344" strokeWidth={1 / scale} opacity={0.85} />
      {surface.widthM * pxPerMetre * scale > 85 && <Text
        x={surface.x * pxPerMetre + 5 / scale} y={surface.y * pxPerMetre + 5 / scale}
        width={Math.max(0, surface.widthM * pxPerMetre - 10 / scale)}
        text={`${GARDEN_SURFACES[surface.kind].label} · ${(surface.widthM * surface.depthM).toFixed(1)} m²${surface.elevationM ? ` · +${surface.elevationM} m` : ''}`}
        fontFamily="Inter, sans-serif" fontSize={11 / scale} fill="#263523" />}
    </Group>)}
    {garden.fences.map((fence) => <Group key={fence.id} name={`garden-fence-${fence.id}`}>
      <Line points={[fence.a.x * pxPerMetre, fence.a.y * pxPerMetre, fence.b.x * pxPerMetre, fence.b.y * pxPerMetre]}
        stroke={FENCE_MATERIALS[fence.material].hex} strokeWidth={Math.max(4 / scale, pxPerMetre * (fence.material === 'hedge' ? 0.4 : 0.1))}
        dash={fence.material === 'hedge' ? undefined : [7 / scale, 3 / scale]} lineCap="square" />
      {fenceLengthM(fence) * pxPerMetre * scale > 100 && <Text
        x={(fence.a.x + fence.b.x) / 2 * pxPerMetre} y={(fence.a.y + fence.b.y) / 2 * pxPerMetre - 15 / scale}
        text={`${fenceLengthM(fence).toFixed(1)} m`} fontFamily="Inter, sans-serif" fontSize={11 / scale} fill="#37362f" />}
    </Group>)}
  </Group>;
}
