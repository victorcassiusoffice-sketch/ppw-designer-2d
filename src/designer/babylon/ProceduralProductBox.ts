/**
 * Sims-Parity DT-22 — procedural product box mesh (L2.05).
 *
 * V8=NO means procedural-only — no hero glTF this DT. Each merchant
 * product becomes a CreateBox with the front photo applied to all
 * six faces (via PBR Path B "six-face UV with alpha-edge fade").
 *
 * Inputs:
 *   • photoUrl     ← product.photo_front_url
 *   • dimensionsMm ← { width, depth, height }
 *
 * Outputs: a positioned + shadow-casting mesh, dropped into the scene
 * at the supplied (x, z) ground anchor.
 */

import {
  MeshBuilder,
  Vector3,
  type Scene,
  type Mesh,
  type ShadowGenerator,
} from '@babylonjs/core';
import { buildProductPhotoMaterial } from './Materials';

export interface ProceduralProductBoxInput {
  scene: Scene;
  shadowGenerator?: ShadowGenerator;
  productId: string;
  photoUrl: string;
  /** Physical dimensions in millimetres. */
  dimensionsMm: { width: number; depth: number; height: number };
  /** Floor anchor in metres (x = right, z = depth). */
  positionM?: { x: number; z: number };
  rotationDegY?: number;
}

export function buildProceduralProductBox(input: ProceduralProductBoxInput): Mesh {
  const { scene, productId, photoUrl, dimensionsMm } = input;
  const wM = Math.max(0.01, dimensionsMm.width / 1000);
  const dM = Math.max(0.01, dimensionsMm.depth / 1000);
  const hM = Math.max(0.01, dimensionsMm.height / 1000);

  const box = MeshBuilder.CreateBox(
    `product-${productId}`,
    { width: wM, depth: dM, height: hM },
    scene,
  );
  const anchor = input.positionM ?? { x: 0, z: 0 };
  box.position = new Vector3(anchor.x, hM / 2, anchor.z);
  if (input.rotationDegY !== undefined) {
    box.rotation = new Vector3(0, (input.rotationDegY * Math.PI) / 180, 0);
  }

  const mat = buildProductPhotoMaterial(scene, photoUrl, `product-${productId}`);
  box.material = mat;

  if (input.shadowGenerator) {
    input.shadowGenerator.addShadowCaster(box);
  }

  return box;
}
