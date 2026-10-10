import { foundationElementBounds, foundationIsFilled, type FoundationModel } from './foundation';
import { foundationSoilFaces } from './foundationExcavation';
import type { SceneFace } from './roomView3d';

/** Same measured envelope for the non-WebGL fallback; no unit conversions or
 * decorative expansion. These faces never become paintable house walls. */
export function foundationSceneFaces(
  model: FoundationModel | undefined,
  groundElevationM = 0,
  inspection = false,
): SceneFace[] {
  if (!model?.enabled) return [];
  const concrete = model.elements.filter(foundationIsFilled).flatMap((element) => {
    const b = foundationElementBounds(element),
      bottom = groundElevationM + b.minElevationM,
      top = groundElevationM + b.maxElevationM;
    const ring = [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ];
    const faces: SceneFace[] = [
      {
        key: `foundation-${element.id}-top`,
        kind: 'item-top',
        pts: ring.map((p) => ({ ...p, z: top })),
        fill: '#a9afa1',
        stroke: '#697963',
      },
    ];
    ring.forEach((a, index) => {
      const c = ring[(index + 1) % ring.length];
      faces.push({
        key: `foundation-${element.id}-${index}`,
        kind: 'item',
        pts: [
          { ...a, z: bottom },
          { ...c, z: bottom },
          { ...c, z: top },
          { ...a, z: top },
        ],
        fill: '#a9afa1',
        stroke: '#697963',
      });
    });
    return faces;
  });
  return [
    ...concrete,
    ...(inspection
      ? foundationSoilFaces(model, groundElevationM).map((face) => ({
          key: face.key,
          kind: 'item' as const,
          pts: face.points,
          fill: face.kind === 'rim' ? '#8c9e69' : face.kind === 'base' ? '#786449' : '#947655',
          stroke: '#766146',
        }))
      : []),
  ];
}
