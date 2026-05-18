/**
 * Sims-Parity DT-21 — Babylon Layer 2 scene boot (L2.02).
 *
 * Pure-fn: builds a Babylon.js Scene against a supplied Engine + canvas.
 * Contains:
 *   • Ground plane (10×8 m default; configurable via room dims).
 *   • Four walls (1.2 m height for the v1 — easy to extend in DT-22).
 *   • Optional ceiling.
 *   • Hemispheric ambient + directional light.
 *   • ShadowGenerator wired to the directional light.
 *
 * Materials are deliberately flat placeholders here — DT-22 swaps them
 * for PBR with the Polyhaven texture set.
 *
 * Engine + canvas come from BabylonRoom.tsx. Scene returned so the
 * caller can attach the ArcRotateCamera (Camera.ts) + dispose on
 * unmount.
 *
 * Mobile workaround: ShadowGenerator size is bumped down on iOS so
 * Safari shadow-map perf stays usable (24 fps acceptable; 10 fps not).
 */

import {
  Scene,
  type Engine,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  ShadowGenerator,
  Color4,
} from '@babylonjs/core';

export interface BabylonSceneOptions {
  /** Room dimensions in metres. Defaults to 5×4 m floor. */
  roomWidthM?: number;
  roomDepthM?: number;
  /** Wall height in metres. Defaults to 1.2 m. */
  wallHeightM?: number;
  /** Whether to render a ceiling plane. Defaults to false. */
  ceiling?: boolean;
  /** True on iOS Safari — bumps shadow map size down. */
  isMobile?: boolean;
}

const PALETTE_WALL = new Color3(0.96, 0.94, 0.90); // ~V4-AU-1 cream
const PALETTE_FLOOR = new Color3(0.71, 0.54, 0.37); // oak brown
const PALETTE_CEILING = new Color3(0.94, 0.92, 0.88);
const PALETTE_BG = new Color4(0.054, 0.054, 0.062, 1); // V4-AU-1 ink

export interface BuiltScene {
  scene: Scene;
  shadowGenerator: ShadowGenerator;
  groundMesh: ReturnType<typeof MeshBuilder.CreateGround>;
}

export function buildBabylonScene(engine: Engine, opts: BabylonSceneOptions = {}): BuiltScene {
  const widthM = opts.roomWidthM ?? 5;
  const depthM = opts.roomDepthM ?? 4;
  const wallH = opts.wallHeightM ?? 1.2;
  const wantCeiling = opts.ceiling ?? false;
  const mobile = opts.isMobile ?? false;

  const scene = new Scene(engine);
  scene.clearColor = PALETTE_BG;

  // Ambient sky-light.
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;

  // Key directional light — drives the shadow generator.
  const dir = new DirectionalLight('dir', new Vector3(-0.5, -1, -0.5), scene);
  dir.position = new Vector3(5, 8, 5);
  dir.intensity = 0.9;

  const shadowSize = mobile ? 1024 : 2048;
  const shadowGenerator = new ShadowGenerator(shadowSize, dir);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 32;

  // Ground plane (XZ).
  const groundMesh = MeshBuilder.CreateGround('ground', { width: widthM, height: depthM }, scene);
  const groundMat = new StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = PALETTE_FLOOR;
  groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
  groundMesh.material = groundMat;
  groundMesh.receiveShadows = true;

  // Four walls.
  const wallMat = new StandardMaterial('wallMat', scene);
  wallMat.diffuseColor = PALETTE_WALL;
  wallMat.specularColor = new Color3(0.05, 0.05, 0.05);
  wallMat.backFaceCulling = false;

  const halfW = widthM / 2;
  const halfD = depthM / 2;

  const wallNorth = MeshBuilder.CreatePlane(
    'wallNorth',
    { width: widthM, height: wallH },
    scene,
  );
  wallNorth.position = new Vector3(0, wallH / 2, -halfD);
  wallNorth.material = wallMat;
  wallNorth.receiveShadows = true;

  const wallSouth = MeshBuilder.CreatePlane(
    'wallSouth',
    { width: widthM, height: wallH },
    scene,
  );
  wallSouth.position = new Vector3(0, wallH / 2, halfD);
  wallSouth.rotation.y = Math.PI;
  wallSouth.material = wallMat;
  wallSouth.receiveShadows = true;

  const wallWest = MeshBuilder.CreatePlane(
    'wallWest',
    { width: depthM, height: wallH },
    scene,
  );
  wallWest.position = new Vector3(-halfW, wallH / 2, 0);
  wallWest.rotation.y = Math.PI / 2;
  wallWest.material = wallMat;
  wallWest.receiveShadows = true;

  const wallEast = MeshBuilder.CreatePlane(
    'wallEast',
    { width: depthM, height: wallH },
    scene,
  );
  wallEast.position = new Vector3(halfW, wallH / 2, 0);
  wallEast.rotation.y = -Math.PI / 2;
  wallEast.material = wallMat;
  wallEast.receiveShadows = true;

  if (wantCeiling) {
    const ceilingMesh = MeshBuilder.CreatePlane(
      'ceiling',
      { width: widthM, height: depthM },
      scene,
    );
    ceilingMesh.position = new Vector3(0, wallH, 0);
    ceilingMesh.rotation.x = Math.PI / 2;
    const ceilingMat = new StandardMaterial('ceilingMat', scene);
    ceilingMat.diffuseColor = PALETTE_CEILING;
    ceilingMesh.material = ceilingMat;
  }

  return { scene, shadowGenerator, groundMesh };
}
