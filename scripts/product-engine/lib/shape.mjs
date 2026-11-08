/**
 * What a body is, before it is fitted: its box, its triangles, its textures, which way is up,
 * where its head is, and whether its proportions are the product's. All in Node with glTF
 * Transform, nothing rendered.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

let io;
export async function getIO() {
  if (!io) {
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });
  }
  return io;
}

function sniffMime(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return null;
}

/** Positions of every primitive, transformed by its node's world matrix (a body may carry nested transforms). */
function worldPositions(doc) {
  const out = [];
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) return out;
  const visit = (node, parent) => {
    const local = node.getMatrix();
    const world = parent ? multiply(parent, local) : local;
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const arr = pos.getArray();
        const idx = prim.getIndices()?.getArray() ?? null;
        const uv = prim.getAttribute('TEXCOORD_0')?.getArray() ?? null;
        const mat = prim.getMaterial();
        const tex = mat?.getBaseColorTexture() ?? null;
        out.push({ positions: arr, indices: idx, uvs: uv, world, texture: tex, mode: prim.getMode() });
      }
    }
    for (const child of node.listChildren()) visit(child, world);
  };
  for (const node of scene.listChildren()) visit(node, null);
  return out;
}

function multiply(a, b) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function apply(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/** Box, triangle count, textures and a vertex sample of a GLB. */
export async function readBody(file) {
  const io = await getIO();
  const doc = await io.read(file);
  const prims = worldPositions(doc);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  let vertices = 0;
  for (const p of prims) {
    const n = p.positions.length / 3;
    vertices += n;
    triangles += p.mode === 4 || p.mode === undefined ? (p.indices ? p.indices.length / 3 : n / 3) : 0;
    for (let i = 0; i < p.positions.length; i += 3) {
      const [x, y, z] = apply(p.world, p.positions[i], p.positions[i + 1], p.positions[i + 2]);
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    }
  }
  const textures = doc.getRoot().listTextures().map((t) => {
    const img = t.getImage();
    return { mime: sniffMime(img) ?? t.getMimeType(), labelled: t.getMimeType(), bytes: img?.length ?? 0 };
  });
  const baseColorTextures = new Set(doc.getRoot().listMaterials().map((m) => m.getBaseColorTexture()).filter(Boolean)).size;
  return {
    doc,
    prims,
    bounds: { min, max },
    extents: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    triangles: Math.round(triangles),
    vertices,
    textures,
    baseColorTextures,
    animations: doc.getRoot().listAnimations().map((a) => a.getName()),
    skins: doc.getRoot().listSkins().length,
  };
}

/** Panels, mats, tiles, rolls: a product whose height is a small fraction of its footprint. */
export function catalogueIsFlat(dims) {
  return dims.height < 0.2 * Math.min(dims.length, dims.width);
}

/**
 * Which model axis points up. glTF is y-up; an image-to-3D generator builds a flat product as an
 * upright slab whose photo face is ±z, so the plan lays it down. If the slab's thin axis is x the
 * body needs a quarter turn baked in first (`bakeYaw`), so its thin axis becomes z.
 */
export function detectUp(extents, dims, photoFace = -1) {
  const [ex, ey, ez] = extents;
  if (!catalogueIsFlat(dims)) return { up: '+y', bakeYaw: false, why: 'the product is not flat; y stays up' };
  const thinnest = ex <= ey && ex <= ez ? 'x' : ey <= ex && ey <= ez ? 'y' : 'z';
  if (thinnest === 'y') return { up: '+y', bakeYaw: false, why: 'flat product already lying down (its thin axis is y)' };
  const up = photoFace > 0 ? '+z' : '-z';
  if (thinnest === 'z') return { up, bakeYaw: false, why: `flat product built as an upright slab, thin along z; photo face ${up} turns up` };
  return { up, bakeYaw: true, why: `flat product built as an upright slab, thin along x; a quarter turn makes it thin along z, then photo face ${up} turns up` };
}

/** The extents after the up-pitch (`pitchedBox` in fitToSize): '+z'/'-z' swap y and z. */
export function pitchedExtents(extents, up) {
  return up === '+z' || up === '-z' ? [extents[0], extents[2], extents[1]] : [...extents];
}

/**
 * The raw shape check: before any fitting, the body's proportions must be the product's within
 * `tolerance` (15 %). Footprint aspect (long/short) and height over the long side, both compared
 * with the catalogue. A failure means the generator made the wrong shape, not the wrong size.
 */
export function rawShapeCheck(pitched, dims, tolerance = 0.15) {
  const [ex, ey, ez] = pitched;
  // A flat product (a panel, a mat) comes out of every generator as a slab far thicker than its
  // 3 cm; the fit squashes that and the look stays right. Only its footprint aspect is judged.
  const flat = catalogueIsFlat(dims);
  const [bodyLong, bodyShort] = ex >= ez ? [ex, ez] : [ez, ex];
  const [catLong, catShort] = dims.length >= dims.width ? [dims.length, dims.width] : [dims.width, dims.length];
  const aspectBody = bodyLong / Math.max(1e-9, bodyShort);
  const aspectCat = catLong / Math.max(1e-9, catShort);
  const aspectError = Math.abs(aspectBody - aspectCat) / aspectCat;
  const heightBody = ey / Math.max(1e-9, bodyLong);
  const heightCat = dims.height / catLong;
  const heightError = Math.abs(heightBody - heightCat) / Math.max(1e-9, heightCat);
  return {
    pass: aspectError <= tolerance && (flat || heightError <= tolerance),
    aspectError,
    heightError,
    heightJudged: !flat,
    body: { long: bodyLong, short: bodyShort, height: ey },
    tolerance,
  };
}

/**
 * The head's centroid: the vertices in the top 25 % of the height (after the up-pitch), as a
 * fraction of the half-extents. Strong +x means "the head is at +x". `n` vertices counted.
 */
export function headDirection(body, up = '+y') {
  const pts = [];
  for (const p of body.prims) {
    for (let i = 0; i < p.positions.length; i += 3) {
      const w = apply(p.world, p.positions[i], p.positions[i + 1], p.positions[i + 2]);
      // Pitch to the upright frame: '+z' → y' = z, z' = −y; '-z' → y' = −z, z' = y.
      pts.push(up === '+z' ? [w[0], w[2], -w[1]] : up === '-z' ? [w[0], -w[2], w[1]] : w);
    }
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) {
    if (p[k] < min[k]) min[k] = p[k];
    if (p[k] > max[k]) max[k] = p[k];
  }
  const half = [0, 1, 2].map((k) => (max[k] - min[k]) / 2 || 1);
  const mid = [0, 1, 2].map((k) => (max[k] + min[k]) / 2);
  const yCut = min[1] + 0.75 * (max[1] - min[1]);
  let n = 0;
  let sx = 0;
  let sz = 0;
  for (const p of pts) {
    if (p[1] < yCut) continue;
    n++;
    sx += (p[0] - mid[0]) / half[0];
    sz += (p[2] - mid[2]) / half[2];
  }
  return { x: n ? sx / n : 0, z: n ? sz / n : 0, n };
}

/**
 * Which ±z side the photo was painted on. The generator textures the side it saw with the photo;
 * the hidden side is flatter. Sample the base-colour texture at the UV centroid of triangles whose
 * normal faces +z or −z and compare the colour variance. +1 = +z is the photo face, −1 = −z.
 */
export async function photoFaceSign(body, { maxTriangles = 30000 } = {}) {
  const cache = new Map();
  const acc = { pos: { n: 0, s: 0, s2: 0 }, neg: { n: 0, s: 0, s2: 0 } };
  for (const p of body.prims) {
    if (!p.texture || !p.uvs) continue;
    const img = p.texture.getImage();
    if (!img) continue;
    let tex = cache.get(p.texture);
    if (!tex) {
      try {
        const { data, info } = await sharp(Buffer.from(img)).resize(256, 256, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        tex = { data, w: info.width, h: info.height };
      } catch {
        tex = null;
      }
      cache.set(p.texture, tex);
    }
    if (!tex) continue;
    const count = p.indices ? p.indices.length / 3 : p.positions.length / 9;
    const step = Math.max(1, Math.ceil(count / maxTriangles));
    for (let t = 0; t < count; t += step) {
      const ids = p.indices ? [p.indices[t * 3], p.indices[t * 3 + 1], p.indices[t * 3 + 2]] : [t * 3, t * 3 + 1, t * 3 + 2];
      const v = ids.map((i) => apply(p.world, p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]));
      const ax = v[1][0] - v[0][0];
      const ay = v[1][1] - v[0][1];
      const az = v[1][2] - v[0][2];
      const bx = v[2][0] - v[0][0];
      const by = v[2][1] - v[0][1];
      const bz = v[2][2] - v[0][2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz) || 1;
      const fz = nz / len;
      if (Math.abs(fz) < 0.7) continue;
      const u = (p.uvs[ids[0] * 2] + p.uvs[ids[1] * 2] + p.uvs[ids[2] * 2]) / 3;
      const vv = (p.uvs[ids[0] * 2 + 1] + p.uvs[ids[1] * 2 + 1] + p.uvs[ids[2] * 2 + 1]) / 3;
      const px = Math.min(tex.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * tex.w)));
      const py = Math.min(tex.h - 1, Math.max(0, Math.floor((vv - Math.floor(vv)) * tex.h)));
      const o = (py * tex.w + px) * 3;
      const lum = 0.299 * tex.data[o] + 0.587 * tex.data[o + 1] + 0.114 * tex.data[o + 2];
      const a = fz > 0 ? acc.pos : acc.neg;
      a.n++;
      a.s += lum;
      a.s2 += lum * lum;
    }
  }
  const variance = (a) => (a.n < 20 ? null : a.s2 / a.n - (a.s / a.n) ** 2);
  const vPos = variance(acc.pos);
  const vNeg = variance(acc.neg);
  if (vPos === null && vNeg === null) return { sign: -1, why: 'no textured ±z faces found; September\'s convention (-z) kept', vPos, vNeg };
  if (vPos === null) return { sign: -1, why: 'only −z faces are textured', vPos, vNeg };
  if (vNeg === null) return { sign: 1, why: 'only +z faces are textured', vPos, vNeg };
  return { sign: vPos >= vNeg ? 1 : -1, why: `texture variance +z ${vPos.toFixed(0)} vs −z ${vNeg.toFixed(0)}`, vPos, vNeg };
}

/** Quaternion [x, y, z, w] for a turn about one axis. */
export function axisQuat(axis, rad) {
  const s = Math.sin(rad / 2);
  const c = Math.cos(rad / 2);
  return axis === 'x' ? [s, 0, 0, c] : axis === 'y' ? [0, s, 0, c] : [0, 0, s, c];
}
/** a ⊗ b: apply b first, then a. */
export function mulQuat(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}
/** Rotate a point by a quaternion. */
export function rotatePoint(q, p) {
  const [qx, qy, qz, qw] = q;
  const [px, py, pz] = p;
  const ix = qw * px + qy * pz - qz * py;
  const iy = qw * py + qz * px - qx * pz;
  const iz = qw * pz + qx * py - qy * px;
  const iw = -qx * px - qy * py - qz * pz;
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
}

/**
 * The turn that bakes a yaw (about y) and then a levelling (pitch about x, roll about z) into the
 * scene: one pivot node above everything, so the file's own nodes are untouched.
 */
export function bakeQuat({ yawRad = 0, pitchRad = 0, rollRad = 0 } = {}) {
  let q = axisQuat('y', yawRad);
  if (pitchRad) q = mulQuat(axisQuat('x', pitchRad), q);
  if (rollRad) q = mulQuat(axisQuat('z', rollRad), q);
  return q;
}

/** Turn the whole scene (yaw about y, then a levelling pitch and roll) and write it back. */
export async function bakeTransform(file, outFile, turn) {
  const io = await getIO();
  const doc = await io.read(file);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const pivot = doc.createNode('engine-turn').setRotation(bakeQuat(turn));
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    pivot.addChild(child);
  }
  scene.addChild(pivot);
  await io.write(outFile, doc);
}

/** Turn the whole scene a quarter turn about y (for a slab thin along x) and write it back. */
export async function bakeYaw(file, outFile, yawRad = Math.PI / 2) {
  return bakeTransform(file, outFile, { yawRad });
}

/**
 * Is the body standing level? A plane y = a·x + b·z + c through the lowest `frac` of the vertices
 * (the feet, the deck, the base): its slope about x is the pitch, about z the roll, in degrees.
 * A generator that aligns the body to a photo taken from above can hand back a tilted body; the
 * fit would then put a leaning product on the floor. `n` vertices were used.
 */
export function baseTilt(body, { frac = 0.03, sample = 60000 } = {}) {
  const pts = [];
  let total = 0;
  for (const p of body.prims) total += p.positions.length / 3;
  const stride = Math.max(1, Math.floor(total / sample));
  let k = 0;
  for (const p of body.prims) {
    for (let i = 0; i < p.positions.length; i += 3) {
      if (k++ % stride) continue;
      pts.push(apply(p.world, p.positions[i], p.positions[i + 1], p.positions[i + 2]));
    }
  }
  if (pts.length < 12) return { pitchDeg: 0, rollDeg: 0, n: 0 };
  const ys = pts.map((p) => p[1]).sort((a, b) => a - b);
  const cut = ys[Math.min(ys.length - 1, Math.floor(ys.length * frac))];
  const base = pts.filter((p) => p[1] <= cut);
  let sxx = 0; let szz = 0; let sxz = 0; let sx = 0; let sz = 0; let sy = 0; let sxy = 0; let szy = 0;
  const n = base.length;
  for (const [x, y, z] of base) { sxx += x * x; szz += z * z; sxz += x * z; sx += x; sz += z; sy += y; sxy += x * y; szy += z * y; }
  const sol = solve3([[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, n]], [sxy, szy, sy]);
  if (!sol) return { pitchDeg: 0, rollDeg: 0, n };
  const [a, b] = sol;
  return { pitchDeg: (Math.atan(b) * 180) / Math.PI, rollDeg: (Math.atan(a) * 180) / Math.PI, n };
}

/** The pitch (about x) and roll (about z) that level a base plane measured by `baseTilt`. */
export function levelCorrection(tilt) {
  return { pitchRad: (tilt.pitchDeg * Math.PI) / 180, rollRad: (-tilt.rollDeg * Math.PI) / 180 };
}

function solve3(A, v) {
  const m = A.map((r, i) => [...r, v[i]]);
  for (let i = 0; i < 3; i++) {
    let piv = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[piv][i])) piv = r;
    [m[i], m[piv]] = [m[piv], m[i]];
    if (Math.abs(m[i][i]) < 1e-12) return null;
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f = m[r][i] / m[i][i];
      for (let c = i; c < 4; c++) m[r][c] -= f * m[i][c];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/**
 * The yaw (about y) that squares the body's footprint: the turn that makes the smallest
 * axis-aligned rectangle around the vertices seen from above. A generator that aligns the body
 * to a three-quarter photo (Tripo's `align_image`) hands back a diagonal body; its axis-aligned
 * box then has the wrong proportions and the per-axis fit would distort it. Returns radians in
 * (-45°, 45°]; the 90° ambiguity is left to the axis swap and `modelFront`. `sample` vertices at most.
 */
export function footprintYaw(body, { sample = 24000, stepDeg = 0.5 } = {}) {
  const pts = [];
  let total = 0;
  for (const p of body.prims) total += p.positions.length / 3;
  const stride = Math.max(1, Math.floor(total / sample));
  let k = 0;
  for (const p of body.prims) {
    for (let i = 0; i < p.positions.length; i += 3) {
      if (k++ % stride) continue;
      const [x, , z] = apply(p.world, p.positions[i], p.positions[i + 1], p.positions[i + 2]);
      pts.push(x, z);
    }
  }
  if (pts.length < 6) return { yaw: 0, areaBefore: 0, areaAfter: 0, degrees: 0 };
  const area = (c, s) => {
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const x = c * pts[i] + s * pts[i + 1];
      const z = -s * pts[i] + c * pts[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    return (maxX - minX) * (maxZ - minZ);
  };
  const before = area(1, 0);
  let best = { deg: 0, area: before };
  for (let deg = -45 + stepDeg; deg <= 45; deg += stepDeg) {
    const r = (deg * Math.PI) / 180;
    const a = area(Math.cos(r), Math.sin(r));
    if (a < best.area * 0.9995) best = { deg, area: a };
  }
  // Then a fine pass around the best coarse step: on a 2 m product half a degree of yaw adds
  // 1.7 cm to the width the fit must undo; a twentieth of a degree is nothing.
  if (best.deg !== 0) {
    const fine = stepDeg / 10;
    for (let deg = best.deg - stepDeg; deg <= best.deg + stepDeg + 1e-9; deg += fine) {
      const r = (deg * Math.PI) / 180;
      const a = area(Math.cos(r), Math.sin(r));
      if (a < best.area) best = { deg: Math.round(deg / fine) * fine, area: a };
    }
  }
  return { yaw: (best.deg * Math.PI) / 180, degrees: best.deg, areaBefore: before, areaAfter: best.area };
}

/** The axis the body's photo side faces after a yaw: the +z face turned by `yawRad`, snapped to an axis. */
export function frontAfterYaw(yawRad, front = '+z') {
  const base = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }[front] ?? 0;
  const a = base + yawRad;
  const snapped = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  const n = ((Math.round(snapped / (Math.PI / 2)) % 4) + 4) % 4;
  return ['+z', '+x', '-z', '-x'][n];
}
