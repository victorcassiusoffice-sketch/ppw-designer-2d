import { Arrow, Group, Line, Text } from 'react-konva';
import { stairPlanSymbols } from '../designer/stairPlan';
import type { Property } from '../store/propertyStore';

/** Passive architectural stair symbols; selection/moving stays in the building controls. */
export function BuildingPlanLayer({ property, activeLevelId, pxPerMetre, scale }: {
  property: Pick<Property, 'levels' | 'stairs' | 'wallHeightM'>;
  activeLevelId: string;
  pxPerMetre: number;
  scale: number;
}) {
  const symbols = stairPlanSymbols(property, activeLevelId);
  if (symbols.length === 0) return null;
  const zoom = Math.max(0.05, scale);
  return <Group name="building-stairs" listening={false}>
    {symbols.map((symbol) => {
      const xs = symbol.footprint.map((point) => point.x * pxPerMetre);
      const ys = symbol.footprint.map((point) => point.y * pxPerMetre);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const labelWidth = Math.max(...xs) - minX;
      return <Group key={symbol.id} name={`stairs-${symbol.id}`}>
        <Line points={symbol.footprint.flatMap((point) => [point.x * pxPerMetre, point.y * pxPerMetre])}
          closed fill={symbol.ascending ? '#e5ece7' : '#edf0ed'} stroke="#52685f" strokeWidth={1.5 / zoom}
          dash={symbol.ascending ? undefined : [5 / zoom, 3 / zoom]} />
        {symbol.treads.map((tread, index) => <Line key={index}
          points={tread.flatMap((point) => [point.x * pxPerMetre, point.y * pxPerMetre])}
          stroke="#7b8980" strokeWidth={0.8 / zoom} />)}
        <Arrow points={symbol.arrow.flatMap((point) => [point.x * pxPerMetre, point.y * pxPerMetre])}
          stroke="#0f766e" fill="#0f766e" strokeWidth={2 / zoom} pointerWidth={6 / zoom} pointerLength={7 / zoom} />
        {labelWidth * zoom > 55 && <Text x={minX} y={minY - 16 / zoom} width={labelWidth}
          text={symbol.label} fontSize={10 / zoom} align="center" fontFamily="Inter, sans-serif" fill="#355b4f" />}
      </Group>;
    })}
  </Group>;
}
