import { z } from 'zod';
import { id, day } from './contract.js';
import { safeJson, type Json } from '../sharedBuild/contract.js';
const text = z.string().trim().max(500),
  label = z.string().trim().min(1).max(160);
export const jobSchema = z
  .object({
    id,
    site: id,
    step: id,
    title: label,
    scope: text,
    trade: label,
    progress: z.array(z.object({ state: label, date: day, note: text }).strict()).max(40),
    quote: z
      .object({
        trade: label,
        validUntil: day,
        state: z.enum(['received', 'approved', 'declined']),
      })
      .strict()
      .optional(),
  })
  .strict();
export type PilotJob = z.infer<typeof jobSchema>;
const spatialKeys = new Set(
  'id name activeRoomId activeLevelId wallHeightM rooms levels walls site stairs roof garden terrainCuts boundaryComponents foundation services shade polygon placedItems removedWallEdges openings floorFinish floorCovering floorCoverings floorTiles wallPaints wallFinishes wallConstructions wallSegments wallMaterials kind type category unit key index levelId fromLevelId toLevelId roofSourceLevelId sourceLevelId roofType shape style surface material materialId productId instanceId parentInstanceId rotation lightOn mountHeightCm widthM lengthM heightM heightCm thicknessM slabThicknessM overhangM riseM pitchDeg elevationM sillHeightM headHeightM depthM radiusM runM areaM2 rise run slope thickness offset edgeIndex offsetM width height length size x y z a b c start end center centre origin position point points vertices segments control controls curve polygon holes corners paths pads beams columns footings strips slabs elements patches plantings boundaries edges cutouts heading direction swing hand side open handedness hinge colour color hex colourHex paintColourHex paintId finishId finishProductId exterior interior wall floor tile tiles cell row col materialId wallHeightM ridgeAxis ridgeDirection landingM structure framing skin panel footprint profile angleDeg radius level placement stairs widthCm lengthCm pitched pitch scale mode sourceFloorLevelId surfaceThicknessM construction finish paint paintColourName boundary widthCm snapM baseThicknessM bores claddingFaces claddingId concrete concreteProductId construction cuts deltaM diameterM diameterMm endConnection endElevationM excavation excavationMarginM exteriorPaint fences fixtureId fixtures junctionId junctions level levelIds marginM materialProductId model order originM outline p paintFaces path pavingProductId pilotPermeable pool portElevationsM portId productReferenceId r rebar rect room runs shellDepthM stage startConnection startElevationM subBaseDepthM surfaces system tileHm tileWm topElevationM topM version wallThicknessM waterDepthM wholeTiles zone cells rects flipHand flipFacing powerOn handrail from to startM endM'.split(
    ' ',
  ),
);
const allowedKey = (k: string) =>
  spatialKeys.has(k) ||
  (/^(floor|wall|roof|stair|edge|paint|finish|frame|tile|surface|outline|corner|ridge|level|material|boundary|terrain|footing|slab|garden|light|foundation|service|pipe|cable|control|curve)[A-Z][a-zA-Z0-9]*$/.test(
    k,
  ) &&
    !/(price|cost|rate|quote|amount|supplier|contact|email|url|photo|invoice|budget|currency|trade|note)/i.test(
      k,
    ));
function geometry(value: Json): Json {
  if (Array.isArray(value)) return value.map(geometry);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => allowedKey(k) || /^\d{1,4}$/.test(k))
        .map(([k, v]) => [k, geometry(v)]),
    );
  if (
    typeof value === 'string' &&
    (value.length > 200 || /^(https?:|data:|javascript:|blob:)/i.test(value))
  )
    return '';
  return value;
}
const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const graphicId = z.string().regex(/^[a-zA-Z0-9:._-]{1,150}$/);
const core = z.object({
  id,
  label: label.optional(),
  name: label,
  activeRoomId: graphicId,
  rooms: z
    .array(
      z.object({
        id: graphicId,
        name: label,
        polygon: z.array(point).max(5000),
        placedItems: z
          .array(
            z.object({
              instanceId: graphicId,
              productId: graphicId,
              x: z.number(),
              y: z.number(),
              rotation: z.number(),
            }),
          )
          .max(5000),
      }),
    )
    .max(1000),
});
export function visitGeometry(raw: unknown) {
  if (!safeJson(raw) || !raw || Array.isArray(raw) || typeof raw !== 'object')
    throw Error('Choose a saved plan.');
  const input = Object.fromEntries(
    Object.entries(raw).filter(([k]) =>
      [
        'id',
        'name',
        'activeRoomId',
        'activeLevelId',
        'rooms',
        'levels',
        'walls',
        'site',
        'stairs',
        'roof',
        'garden',
        'terrainCuts',
        'boundaryComponents',
        'foundation',
        'services',
        'shade',
        'wallHeightM',
      ].includes(k),
    ),
  );
  const shape = geometry(input) as Record<string, Json>;
  core.parse(shape);
  if (JSON.stringify(shape).length > 1400000)
    throw Error('The visit exceeds the snapshot size limit.');
  return shape;
}
