import { Group, Rect } from 'react-konva';
import {
  foundationElementBounds,
  foundationExcavationBounds,
  foundationIsFilled,
  type FoundationModel,
} from '../designer/foundation';

/** Ground-only measured footprint. Render behind floor surfaces; the dedicated
 * workspace owns selection so this overlay never blocks normal house tools. */
export function FoundationPlanLayer({
  model,
  pxPerMetre,
}: {
  model?: FoundationModel;
  pxPerMetre: number;
}) {
  if (!model?.enabled) return null;
  return (
    <Group name="foundations" listening={false}>
      {model.elements.map((element) => {
        const b = foundationElementBounds(element);
        const hole = foundationExcavationBounds(element);
        return (
          <Group key={element.id}>
            {hole && (
              <Rect
                name={`excavation-${element.id}`}
                x={hole.minX * pxPerMetre}
                y={hole.minY * pxPerMetre}
                width={(hole.maxX - hole.minX) * pxPerMetre}
                height={(hole.maxY - hole.minY) * pxPerMetre}
                fill="#927a5c"
                opacity={0.35}
                stroke="#765b40"
                strokeWidth={0.025 * pxPerMetre}
                dash={[0.15 * pxPerMetre, 0.08 * pxPerMetre]}
              />
            )}
            <Rect
              key={element.id}
              name={`foundation-${element.id}`}
              x={b.minX * pxPerMetre}
              y={b.minY * pxPerMetre}
              width={element.lengthM * pxPerMetre}
              height={element.widthM * pxPerMetre}
              fill="#aab59f"
              opacity={foundationIsFilled(element) ? 0.6 : 0.08}
              stroke="#607a5b"
              strokeWidth={0.025 * pxPerMetre}
              dash={[0.15 * pxPerMetre, 0.08 * pxPerMetre]}
            />
          </Group>
        );
      })}
    </Group>
  );
}
