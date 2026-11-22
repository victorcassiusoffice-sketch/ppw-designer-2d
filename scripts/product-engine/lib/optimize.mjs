/**
 * Two served copies of a raw body: the laptop one (about 20,000 triangles, WebP 1024/512, Draco)
 * and the phone one (about 5,000 triangles, WebP 512/256, Draco). Reuses `optimizeGlb` from
 * scripts/optimize-models.mjs, the September pipeline.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { optimizeGlb } from '../../optimize-models.mjs';

/** The budgets the gate checks. Bytes are the served file on disk; triangles as read back from it. */
export const BUDGETS = {
  // `error` is the simplifier's first bound; it loosens in steps up to `maxError` until the count
  // is within 15 % of `target` (a 500k-triangle Hunyuan body needs that; most bodies never do).
  served: { target: 20000, triangles: 25000, bytes: 350 * 1024, base: 1024, mr: 512, error: 0.001, maxError: 0.02 },
  // The phone limit is 10,000: a dense body with many separate shells (Hunyuan3D v3) has a floor
  // near 8,500 triangles that no error bound passes; 10,000 × 20 items is still light for a phone.
  phone: { target: 5000, triangles: 10000, bytes: 150 * 1024, base: 512, mr: 256, error: 0.02, maxError: 0.2 },
};

/** The pictures' quality, colour then the rest, tried in this order until a copy is within its byte limit. */
const QUALITY_STEPS = [[82, 70], [76, 64], [70, 58], [62, 50]];

/** One copy, its pictures a step poorer each time it is over the byte limit (a rich body's pictures pack less). */
async function copyWithin(rawPath, outPath, budget) {
  let made = null;
  let step = 0;
  for (; step < QUALITY_STEPS.length; step++) {
    const [quality, mrQuality] = QUALITY_STEPS[step];
    made = await optimizeGlb(rawPath, outPath, { target: budget.target, base: budget.base, mr: budget.mr, error: budget.error, maxError: budget.maxError, quality, mrQuality });
    if (fs.statSync(outPath).size <= budget.bytes) break;
  }
  return { ...made, quality: QUALITY_STEPS[Math.min(step, QUALITY_STEPS.length - 1)][0] };
}

/**
 * `phoneRawPath`: a lighter mesh of the same body to make the phone copy from (the studio's own, about 5,000
 * triangles). Without it the phone copy is cut down from `rawPath`.
 */
export async function makeCopies(rawPath, servedPath, phonePath, { phoneRawPath = null } = {}) {
  const served = await copyWithin(rawPath, servedPath, BUDGETS.served);
  const phone = await copyWithin(phoneRawPath ?? rawPath, phonePath, BUDGETS.phone);
  return {
    served: { path: servedPath, bytes: fs.statSync(servedPath).size, triangles: Math.round(served.triangles), rawBytes: served.inBytes, passes: served.passes, quality: served.quality },
    phone: { path: phonePath, bytes: fs.statSync(phonePath).size, triangles: Math.round(phone.triangles), passes: phone.passes, quality: phone.quality },
  };
}

/**
 * The high copy: what a strong machine and the desktop game show. It keeps the body's shape (a small error
 * bound, a generous triangle count) and its pictures up to 4096 px in their own format, with plain meshes (no
 * Draco) so that any reader takes it. It is never served to a browser and never goes into git: it is made
 * again from the raw body by `reprocess`.
 */
export const HIGH_COPY = { triangles: 300000, texture: 4096, error: 0.0005 };

export async function makeHighCopy(rawPath, outPath, limits = HIGH_COPY) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
  const doc = await io.read(rawPath);
  const count = () => {
    let n = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        n += idx ? idx.getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3;
      }
    }
    return n;
  };
  // Pictures: only a picture larger than the limit is made smaller; each keeps its own format.
  let maxTexture = 0;
  let tooLarge = false;
  for (const tex of doc.getRoot().listTextures()) {
    const size = tex.getSize();
    if (!size) continue;
    if (Math.max(size[0], size[1]) > limits.texture) tooLarge = true;
    maxTexture = Math.max(maxTexture, Math.min(limits.texture, Math.max(size[0], size[1])));
  }
  if (tooLarge) await doc.transform(textureCompress({ encoder: sharp, resize: [limits.texture, limits.texture] }));
  // Shape: weld, then simplify only when the body has more triangles than the limit.
  await doc.transform(dedup(), weld());
  const before = count();
  if (before > limits.triangles) {
    await MeshoptSimplifier.ready;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: limits.triangles / before, error: limits.error }));
  }
  await doc.transform(prune());
  // Written with no mesh compression: the desktop game's reader takes plain meshes only.
  for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  await io.write(outPath, doc);
  return { path: outPath, bytes: fs.statSync(outPath).size, triangles: Math.round(count()), rawTriangles: Math.round(before), maxTexture };
}

export function withinBudget(copy, budget) {
  return { triangles: copy.triangles <= budget.triangles, bytes: copy.bytes <= budget.bytes };
}
