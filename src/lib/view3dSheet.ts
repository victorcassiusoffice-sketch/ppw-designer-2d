/**
 * A 3D view of the house as a picture, for a sheet of the PDF.
 *
 * It needs no graphics card and no screen: the solids of the export (`components/three/exportModel`) are drawn
 * by sums into a grid of points, each point keeping what is nearest to the eye. The view is a parallel one, as a
 * drawing sheet has it: lines that are parallel on the house are parallel on the sheet, and a length can be
 * compared with another anywhere on it.
 */

export interface SheetPart {
  /** `#rrggbb`. */
  colourHex: string;
  /** Triangles: nine numbers each, in metres: x east, y north, z up. */
  positions: Float32Array;
}

export interface SheetView {
  /** Where the eye stands, as a compass bearing from the house: 180 is south of it, 225 south-west. */
  fromDeg: number;
  /** How high the eye is above the horizon, in degrees: 90 looks straight down. */
  aboveDeg: number;
}

export interface SheetImage {
  /** Red, green, blue, alpha for each point, row after row from the top. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** How many faces were drawn (those that look toward the eye). */
  faces: number;
  /** The share of the picture the house covers, from 0 to 1. */
  covered: number;
  /** Metres of the house for one point of the picture. */
  metresPerPoint: number;
}

const PAPER = [255, 255, 255];
const INK = [38, 46, 51];

/** The three axes of a view in the frame of the parts: to the right on the sheet, up on the sheet, toward the eye. */
export function viewAxes(view: SheetView) {
  const a = (view.fromDeg * Math.PI) / 180;
  const e = (Math.min(90, Math.max(0, view.aboveDeg)) * Math.PI) / 180;
  const eye = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  const right = [-Math.cos(a), Math.sin(a), 0];
  const up = [
    eye[1] * right[2] - eye[2] * right[1],
    eye[2] * right[0] - eye[0] * right[2],
    eye[0] * right[1] - eye[1] * right[0],
  ];
  return { right, up, eye };
}

/**
 * Draws the parts as seen from `view` into a picture of `width` by `height` points. The house is fitted into the
 * picture with a margin. Faces are lit from the upper left, flat; the edges where two faces of different slope or
 * of different parts meet are drawn darker, so that the picture reads as a drawing.
 */
export function drawSheet(
  parts: readonly SheetPart[],
  view: SheetView,
  width: number,
  height: number,
): SheetImage {
  const W = Math.max(8, Math.floor(width));
  const H = Math.max(8, Math.floor(height));
  // Drawn twice as fine and brought down: the edges of the faces come out smooth.
  const S = 2;
  const w = W * S;
  const h = H * S;
  const { right, up, eye } = viewAxes(view);
  const dot = (p: ArrayLike<number>, i: number, axis: number[]) =>
    p[i] * axis[0] + p[i + 1] * axis[1] + p[i + 2] * axis[2];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const part of parts)
    for (let i = 0; i + 2 < part.positions.length; i += 3) {
      const x = dot(part.positions, i, right);
      const y = dot(part.positions, i, up);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = PAPER[0];
    data[i + 1] = PAPER[1];
    data[i + 2] = PAPER[2];
    data[i + 3] = 255;
  }
  if (!(maxX > minX) || !(maxY > minY))
    return { data, width: W, height: H, faces: 0, covered: 0, metresPerPoint: 0 };

  const margin = 0.06;
  const scale = Math.min(
    (w * (1 - 2 * margin)) / (maxX - minX),
    (h * (1 - 2 * margin)) / (maxY - minY),
  );
  const offX = (w - (maxX - minX) * scale) / 2;
  const offY = (h - (maxY - minY) * scale) / 2;

  const depth = new Float32Array(w * h).fill(-Infinity);
  const colour = new Uint8ClampedArray(w * h * 3);
  // What a point shows: the part and the slope of its face, to find the edges afterwards.
  const mark = new Int32Array(w * h).fill(-1);
  const light = [-0.2, 0.55, 0.81];
  const lit = [
    light[0] * right[0] + light[1] * up[0] + light[2] * eye[0],
    light[0] * right[1] + light[1] * up[1] + light[2] * eye[1],
    light[0] * right[2] + light[1] * up[2] + light[2] * eye[2],
  ];
  let faces = 0;
  parts.forEach((part, partIndex) => {
    const p = part.positions;
    const base = [
      parseInt(part.colourHex.slice(1, 3), 16) || 0,
      parseInt(part.colourHex.slice(3, 5), 16) || 0,
      parseInt(part.colourHex.slice(5, 7), 16) || 0,
    ];
    for (let i = 0; i + 8 < p.length; i += 9) {
      const ux = p[i + 3] - p[i];
      const uy = p[i + 4] - p[i + 1];
      const uz = p[i + 5] - p[i + 2];
      const vx = p[i + 6] - p[i];
      const vy = p[i + 7] - p[i + 1];
      const vz = p[i + 8] - p[i + 2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const length = Math.hypot(nx, ny, nz);
      if (!(length > 0)) continue;
      nx /= length;
      ny /= length;
      nz /= length;
      // A face that looks away from the eye is the back of a closed solid: it is not seen.
      if (nx * eye[0] + ny * eye[1] + nz * eye[2] <= 1e-6) continue;
      faces++;
      const shade = 0.6 + 0.4 * Math.max(0, nx * lit[0] + ny * lit[1] + nz * lit[2]);
      const r = base[0] * shade;
      const g = base[1] * shade;
      const b = base[2] * shade;
      const slope =
        (Math.round((nx + 1) * 7) * 15 + Math.round((ny + 1) * 7)) * 15 + Math.round((nz + 1) * 7);
      const id = partIndex * 4096 + slope;
      const sx = [0, 3, 6].map((k) => offX + (dot(p, i + k, right) - minX) * scale);
      const sy = [0, 3, 6].map((k) => offY + (maxY - dot(p, i + k, up)) * scale);
      const sz = [0, 3, 6].map((k) => dot(p, i + k, eye));
      const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
      const x1 = Math.min(w - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
      const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
      const y1 = Math.min(h - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((sx[1] - px) * (sy[2] - py) - (sx[2] - px) * (sy[1] - py)) / area;
          const w1 = ((sx[2] - px) * (sy[0] - py) - (sx[0] - px) * (sy[2] - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2];
          const at = y * w + x;
          if (z <= depth[at]) continue;
          depth[at] = z;
          mark[at] = id;
          colour[at * 3] = r;
          colour[at * 3 + 1] = g;
          colour[at * 3 + 2] = b;
        }
      }
    }
  });

  let coveredPoints = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let any = 0;
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const fx = x * S + dx;
          const fy = y * S + dy;
          const at = fy * w + fx;
          const here = mark[at];
          let c: ArrayLike<number> = PAPER;
          let ci = 0;
          if (here >= 0) {
            any++;
            c = colour;
            ci = at * 3;
          }
          // An edge: the next point to the right or below shows another part, another slope, or the paper.
          const edge =
            (fx + 1 < w && mark[at + 1] !== here) || (fy + 1 < h && mark[at + w] !== here);
          if (edge) {
            r += c[ci] * 0.35 + INK[0] * 0.65;
            g += c[ci + 1] * 0.35 + INK[1] * 0.65;
            b += c[ci + 2] * 0.35 + INK[2] * 0.65;
          } else {
            r += c[ci];
            g += c[ci + 1];
            b += c[ci + 2];
          }
        }
      }
      const o = (y * W + x) * 4;
      data[o] = r / (S * S);
      data[o + 1] = g / (S * S);
      data[o + 2] = b / (S * S);
      if (any > 0) coveredPoints++;
    }
  }
  return {
    data,
    width: W,
    height: H,
    faces,
    covered: coveredPoints / (W * H),
    metresPerPoint: S / scale,
  };
}
