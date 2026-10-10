import {
  foundationExcavationBounds,
  type FoundationBox,
  type FoundationModel,
} from './foundation.js';

type Rect = { u0: number; u1: number; v0: number; v1: number };
type Axis = 'x' | 'y' | 'z';
export interface FoundationSoilFace {
  key: string;
  kind: 'soil' | 'base' | 'rim';
  points: { x: number; y: number; z: number }[];
}
const epsilon = 1e-8;
const range = (box: FoundationBox, axis: Axis): [number, number] =>
  axis === 'x'
    ? [box.minX, box.maxX]
    : axis === 'y'
      ? [box.minY, box.maxY]
      : [box.minElevationM, box.maxElevationM];

/** Subtract a rectangle without rasterisation. This removes internal soil faces
 * where excavations meet; visible surfaces and volume use the same envelopes. */
function subtract(a: Rect, b: Rect): Rect[] {
  const u0 = Math.max(a.u0, b.u0),
    u1 = Math.min(a.u1, b.u1),
    v0 = Math.max(a.v0, b.v0),
    v1 = Math.min(a.v1, b.v1);
  if (u1 - u0 < epsilon || v1 - v0 < epsilon) return [a];
  return [
    { u0: a.u0, u1: u0, v0: a.v0, v1: a.v1 },
    { u0: u1, u1: a.u1, v0: a.v0, v1: a.v1 },
    { u0, u1, v0: a.v0, v1: v0 },
    { u0, u1, v0: v1, v1: a.v1 },
  ].filter((r) => r.u1 - r.u0 > epsilon && r.v1 - r.v0 > epsilon);
}

export function foundationSoilFaces(
  model?: FoundationModel,
  groundElevationM = 0,
): FoundationSoilFace[] {
  if (!model?.enabled) return [];
  const holes = model.elements.flatMap((e) => {
    const box = foundationExcavationBounds(e);
    return box ? [{ ...box, id: e.id }] : [];
  });
  const faces: FoundationSoilFace[] = [];
  const face = (index: number, axis: Axis, side: 0 | 1, u: Axis, v: Axis) => {
    const box = holes[index],
      fixed = range(box, axis)[side],
      ur = range(box, u),
      vr = range(box, v);
    let pieces: Rect[] = [{ u0: ur[0], u1: ur[1], v0: vr[0], v1: vr[1] }];
    holes.forEach((other, otherIndex) => {
      if (index === otherIndex) return;
      const ar = range(other, axis),
        probe = fixed + (side ? epsilon : -epsilon);
      const outsideAlsoExcavated = ar[0] < probe && ar[1] > probe;
      const earlierCoplanarFace = otherIndex < index && Math.abs(ar[side] - fixed) < epsilon;
      if (!outsideAlsoExcavated && !earlierCoplanarFace) return;
      const ou = range(other, u),
        ov = range(other, v);
      pieces = pieces.flatMap((piece) =>
        subtract(piece, { u0: ou[0], u1: ou[1], v0: ov[0], v1: ov[1] }),
      );
    });
    pieces.forEach((piece, part) => {
      const points = [
        [piece.u0, piece.v0],
        [piece.u1, piece.v0],
        [piece.u1, piece.v1],
        [piece.u0, piece.v1],
      ].map(([pu, pv]) => {
        const p = { x: 0, y: 0, z: 0 };
        p[axis] = fixed;
        p[u] = pu;
        p[v] = pv;
        p.z += groundElevationM;
        return p;
      });
      faces.push({
        key: `excavation-${box.id}-${axis}-${side}-${part}`,
        kind: axis === 'z' ? 'base' : 'soil',
        points,
      });
    });
  };
  holes.forEach((_box, i) => {
    face(i, 'x', 0, 'y', 'z');
    face(i, 'x', 1, 'y', 'z');
    face(i, 'y', 0, 'x', 'z');
    face(i, 'y', 1, 'x', 'z');
    face(i, 'z', 0, 'x', 'y'); // Open top: never cap a measured hole.
  });
  // A small surface rim gives context while the ordinary infinite ground is
  // hidden. It is visual context only, excluded from earthwork quantities.
  const rims: { rect: Rect; elevation: number }[] = [];
  holes.forEach((box, index) => {
    const rim = 0.35;
    const candidates: Rect[] = [
      { u0: box.minX - rim, u1: box.maxX + rim, v0: box.minY - rim, v1: box.minY },
      { u0: box.minX - rim, u1: box.maxX + rim, v0: box.maxY, v1: box.maxY + rim },
      { u0: box.minX - rim, u1: box.minX, v0: box.minY, v1: box.maxY },
      { u0: box.maxX, u1: box.maxX + rim, v0: box.minY, v1: box.maxY },
    ];
    let pieces = candidates;
    for (const other of holes)
      if (
        other.minElevationM < box.maxElevationM &&
        other.maxElevationM >= box.maxElevationM - epsilon
      ) {
        pieces = pieces.flatMap((p) =>
          subtract(p, { u0: other.minX, u1: other.maxX, v0: other.minY, v1: other.maxY }),
        );
      }
    for (const earlier of rims)
      if (Math.abs(earlier.elevation - box.maxElevationM) < epsilon)
        pieces = pieces.flatMap((p) => subtract(p, earlier.rect));
    pieces.forEach((p, part) => {
      rims.push({ rect: p, elevation: box.maxElevationM });
      faces.push({
        key: `excavation-rim-${index}-${part}`,
        kind: 'rim',
        points: [
          { x: p.u0, y: p.v0, z: box.maxElevationM + groundElevationM },
          { x: p.u1, y: p.v0, z: box.maxElevationM + groundElevationM },
          { x: p.u1, y: p.v1, z: box.maxElevationM + groundElevationM },
          { x: p.u0, y: p.v1, z: box.maxElevationM + groundElevationM },
        ],
      });
    });
  });
  return faces;
}
