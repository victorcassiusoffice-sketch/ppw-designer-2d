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

/** Turn the whole scene a quarter turn about y (for a slab thin along x) and write it back. */
export async function bakeYaw(file, outFile) {
  const io = await getIO();
  const doc = await io.read(file);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const pivot = doc.createNode('engine-yaw').setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    pivot.addChild(child);
  }
  scene.addChild(pivot);
  await io.write(outFile, doc);
}
