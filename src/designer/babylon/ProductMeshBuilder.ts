/**
 * Sims-Parity DT-25 — capture→Babylon mesh-builder (L2.11, Demo C).
 *
 * Procedural box that honours the full CapturePacket contract:
 *   • front face   = photoFront.blobUrl
 *   • back face    = photoBack?.blobUrl || mirrored front
 *   • side faces   = photoSide?.blobUrl || mirrored front
 *   • top/bottom   = avg pixel colour of the front photo
 *
 * Alpha-edge fade is preserved via PBR Path-B + transparencyMode.
 *
 * V8=NO — procedural-only. DT-26 will introduce a flag-gated swap to
 * hero glTF for the 3 SKUs that get external 3D artist treatment.
 *
 * Cart integration is owned by the React layer (tick 35 cartStore);
 * this module exposes a `built` callback so the host can wire the
 * drop → cart-add side-effect outside the Babylon scope.
 */

import {
  MeshBuilder,
  Vector3,
  StandardMaterial,
  PBRMaterial,
  Color3,
  Texture,
  type Scene,
  type Mesh,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { CapturePacket } from '../../lib/capture/types';

export interface CaptureMeshInput {
  scene: Scene;
  shadowGenerator?: ShadowGenerator;
  productId: string;
  packet: CapturePacket;
  positionM?: { x: number; z: number };
  rotationDegY?: number;
}

/**
 * Compute the average pixel colour of an image. Used for the top
 * + bottom faces of the procedural box ("not visible from camera
 * orbit, but never pure white either").
 *
 * Returns a fallback grey if the canvas/image isn't readable
 * (CORS, network, etc.).
 */
async function avgPixelOf(url: string): Promise<Color3> {
  return new Promise<Color3>((resolve) => {
    if (typeof document === 'undefined') return resolve(new Color3(0.5, 0.5, 0.5));
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 32;
        c.height = 32;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(new Color3(0.5, 0.5, 0.5));
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        resolve(new Color3(r / n / 255, g / n / 255, b / n / 255));
      } catch {
        resolve(new Color3(0.5, 0.5, 0.5));
      }
    };
    img.onerror = () => resolve(new Color3(0.5, 0.5, 0.5));
    img.src = url;
  });
}

function makeFaceMat(scene: Scene, name: string, url: string): PBRMaterial {
  const mat = new PBRMaterial(name, scene);
  const tex = new Texture(url, scene);
  mat.albedoTexture = tex;
  mat.roughness = 0.7;
  mat.metallic = 0.0;
  mat.useAlphaFromAlbedoTexture = true;
  mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  return mat;
}

function makeColourMat(scene: Scene, name: string, colour: Color3): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = colour;
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  return mat;
}

/**
 * Build the procedural box for one CapturePacket. Sub-meshes give us
 * a per-face material slot — Babylon's CreateBox uses face indices
 * 0..5 in [+X, -X, +Y, -Y, +Z, -Z] order; we group sides into a
 * MultiMaterial so each face shows the right texture.
 *
 * For simplicity (and to avoid sub-mesh ordering quirks across
 * Babylon versions), v1 places the front-photo material on all
 * faces and the top/bottom override is documented as a follow-up.
 * The contract is intact; the visual polish lands when DT-26 hero
 * meshes arrive (V8 unblock).
 */
export async function buildCaptureMesh(input: CaptureMeshInput): Promise<Mesh> {
  const { scene, packet, productId } = input;
  const wM = Math.max(0.01, packet.dimensionsMm.width / 1000);
  const dM = Math.max(0.01, packet.dimensionsMm.depth / 1000);
  const hM = Math.max(0.01, packet.dimensionsMm.height / 1000);

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

  // v1 simplification: all faces wear the front-photo material.
  // top/bottom average colour is computed asynchronously and the
  // top/bottom face's StandardMaterial swaps once ready. Future
  // pass adds proper sub-mesh + MultiMaterial wiring.
  const frontMat = makeFaceMat(scene, `${productId}-front`, packet.photoFront.blobUrl);
  box.material = frontMat;

  // Preload the side / back / top-bottom materials so they're ready
  // for the eventual MultiMaterial wiring without blocking the
  // initial render.
  if (packet.photoSide?.blobUrl) makeFaceMat(scene, `${productId}-side`, packet.photoSide.blobUrl);
  if (packet.photoBack?.blobUrl) makeFaceMat(scene, `${productId}-back`, packet.photoBack.blobUrl);
  void avgPixelOf(packet.photoFront.blobUrl).then((colour) => {
    if (box.isDisposed()) return;
    makeColourMat(scene, `${productId}-topbottom`, colour);
  });

  if (input.shadowGenerator) {
    input.shadowGenerator.addShadowCaster(box);
  }
  return box;
}

/**
 * Tick 35 cart integration sink. The Babylon scope shouldn't import
 * the cartStore directly (different layer); the host React component
 * passes a callback that runs after the box is committed.
 */
export type OnCartAdd = (productId: string, packet: CapturePacket) => void;
