/**
 * fitToSize — the hard-coded "to scale" law for 3D product bodies (2026-09-17).
 *
 * Vic: "importance on it fitting realistically to scale, hard coding the
 * algorithms to measure and display with 100% accuracy."
 *
 * A generated or downloaded model arrives at an arbitrary size, in an
 * arbitrary unit, facing an arbitrary way. The catalog is the truth: every
 * product carries `dimensions_cm` (length × width × height) and a
 * `front_edge`. This module turns the model's bounding box into the exact
 * transform that makes its box EQUAL the catalog box — per axis, so the
 * error is zero by construction — and faces it the way the plan says.
 *
 * Conventions (the plan's, verified against `rotatedFootprint`):
 *   • at rotation 0 the footprint spans `length` along plan x (east) and
 *     `width` along plan y (south); height is up;
 *   • `front_edge` names which edge of the TOP-DOWN image is the product's
 *     front at rotation 0 (`bottom` = toward the viewer = plan +y);
 *   • glTF models are y-up and, by the format's convention, face +z.
 *   • plan → three: (x, y, z) → (x, z, y); a plan rotation `r` (degrees,
 *     clockwise on the y-down page) is a rotation of −r about three's +y
 *     (verified by the AABB test: a 200 × 90 item at 90° occupies 0.9 × 2.0).
 *
 * PURE: numbers in, numbers out. No three here; the stage applies the
 * result with one matrix. Unit-tested to 1e-9.
 */

export interface Box3Like {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface FitInput {
  /** The model's own bounding box, in its own units, y-up. */
  bbox: Box3Like;
  /** Catalog truth, centimetres. */
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** Which model axis runs along the product's LENGTH: 'x' or 'z' (auto = by aspect). */
  lengthAxis?: 'x' | 'z' | 'auto';
  /** Which way the model's front faces in its own frame. glTF convention is +z. */
  modelFront?: '+z' | '-z' | '+x' | '-x';
  /** Catalog front edge at rotation 0 (absent → 'bottom'). */
  frontEdge?: 'top' | 'bottom' | 'left' | 'right';
}

export interface FitResult {
  /** Per-axis scale applied in the model's own frame (x, y, z). */
  scale: { x: number; y: number; z: number };
  /** Rotation about three's +y, radians, applied after scaling (model frame → plan frame at rotation 0). */
  yawRad: number;
  /** Translation applied after scale + yaw: the model's base rests on y = 0 and its footprint centre sits at the origin. */
  offset: { x: number; y: number; z: number };
  /** True when the model's x extent was mapped to the product's WIDTH (a 90° swap). */
  swapped: boolean;
  /** The exact extents the fitted box has, metres (== catalog / 100). */
  fittedM: { length: number; width: number; height: number };
}

const EPS = 1e-9;

/** Front edge → the direction the front faces on the plan, as a yaw about +y in three's frame (rotation 0). */
function frontEdgeYawRad(edge: FitInput['frontEdge']): number {
  // Plan +y (south) is three +z. glTF front is +z, so 'bottom' needs no turn.
  switch (edge) {
    case 'top':
      return Math.PI; // front faces plan −y = three −z
    case 'left':
      return -Math.PI / 2; // front faces plan −x: rotating +z by −90° about +y gives −x
    case 'right':
      return Math.PI / 2; // front faces plan +x: +90° about +y takes +z to +x
    case 'bottom':
    default:
      return 0;
  }
}

/** Yaw that turns the model's declared front onto +z (glTF convention). */
function modelFrontYawRad(front: FitInput['modelFront']): number {
  switch (front) {
    case '-z':
      return Math.PI;
    case '+x':
      return -Math.PI / 2; // −90° about +y takes +x to +z
    case '-x':
      return Math.PI / 2; // +90° about +y takes −x to +z
    case '+z':
    default:
      return 0;
  }
}

/**
 * The exact transform. Scale is per axis, so the fitted box is the catalog
 * box to floating-point precision whatever the source proportions — a
 * model that is 3 % too long simply becomes 3 % shorter; nothing is ever
 * "approximately" to scale.
 */
export function fitToSize(input: FitInput): FitResult {
  const { bbox } = input;
  const ex = Math.max(EPS, bbox.max.x - bbox.min.x);
  const ey = Math.max(EPS, bbox.max.y - bbox.min.y);
  const ez = Math.max(EPS, bbox.max.z - bbox.min.z);
  const L = Math.max(EPS, input.lengthCm / 100);
  const W = Math.max(EPS, input.widthCm / 100);
  const H = Math.max(EPS, input.heightCm / 100);

  // Which horizontal model axis carries the length? By default the one
  // whose aspect matches the catalog's, so a model that was authored the
  // other way round is turned, not squashed.
  let swapped: boolean;
  if (input.lengthAxis === 'x') swapped = false;
  else if (input.lengthAxis === 'z') swapped = true;
  else {
    const catalogAspect = L / W;
    const asIs = Math.abs(Math.log((ex / ez) / catalogAspect));
    const turned = Math.abs(Math.log((ez / ex) / catalogAspect));
    swapped = turned + EPS < asIs;
  }

  // Scale in the model's own frame so that, once it is turned into the plan
  // frame, x spans the length and z the width.
  const sx = (swapped ? W : L) / ex;
  const sz = (swapped ? L : W) / ez;
  const sy = H / ey;

  // Yaw: bring the model's front to +z, then turn a swapped model by 90° so
  // its length lies along x, then turn the front onto the catalog's edge.
  const swapYaw = swapped ? Math.PI / 2 : 0;
  const yawRad = normalise(modelFrontYawRad(input.modelFront) + swapYaw + frontEdgeYawRad(input.frontEdge));

  // Offset: the scaled box's footprint centre at the origin, its base on the ground.
  const cx = ((bbox.min.x + bbox.max.x) / 2) * sx;
  const cz = ((bbox.min.z + bbox.max.z) / 2) * sz;
  const baseY = bbox.min.y * sy;
  // The centre offset is applied in the model frame BEFORE the yaw, so rotate it too.
  const c = Math.cos(yawRad);
  const s = Math.sin(yawRad);
  const rx = cx * c + cz * s;
  const rz = -cx * s + cz * c;

  return {
    scale: { x: sx, y: sy, z: sz },
    yawRad,
    offset: { x: -rx, y: -baseY, z: -rz },
    swapped,
    fittedM: { length: L, width: W, height: H },
  };
}

function normalise(rad: number): number {
  let r = rad % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

/**
 * Where an item's body goes in the plan frame: the footprint centre of the
 * rotated item (the plan stores the top-left of the axis-aligned footprint)
 * and the item's own rotation as a yaw about three's +y.
 */
export function itemPose(input: {
  /** Plan top-left of the axis-aligned footprint, metres. */
  x: number;
  y: number;
  /** Axis-aligned footprint extents after rotation, metres. */
  footprintW: number;
  footprintH: number;
  rotationDeg: number;
  /** Height of the base above the floor (wall/ceiling items), metres. */
  z0?: number;
}): { centre: { x: number; y: number; z: number }; yawRad: number } {
  return {
    centre: { x: input.x + input.footprintW / 2, y: input.y + input.footprintH / 2, z: input.z0 ?? 0 },
    // Plan rotation is clockwise on the y-down page; in three's y-up frame
    // that is a NEGATIVE rotation about +y.
    yawRad: (-input.rotationDeg * Math.PI) / 180,
  };
}

/** The fitted box's axis-aligned footprint on the plan at a rotation — must equal `rotatedFootprint`'s. */
export function fittedFootprintAt(fit: FitResult, rotationDeg: number): { w: number; h: number } {
  const r = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return {
    w: fit.fittedM.length * c + fit.fittedM.width * s,
    h: fit.fittedM.length * s + fit.fittedM.width * c,
  };
}
