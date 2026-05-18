/**
 * Sims-Parity DT-22 — PBR materials (L2.04).
 *
 * Procedural-only per V8=NO. No Polyhaven texture downloads in this
 * pass — colour-only PBR materials are enough to demo the engine
 * upgrade. The hero-glTF + 2K KTX2 wood/grass textures land in a
 * later DT once the $1,800 budget is approved (V8 still parked).
 *
 * Materials returned by builders:
 *   • woodFloorMat — warm oak StandardPBR with slight roughness.
 *   • whiteWallMat — matte cream wall PBR.
 *   • grassExteriorMat — green PBR for outside-the-room view (used
 *     when ceiling is off so the BG reads as outdoor).
 *   • skyDomeMat — sky-blue PBR for the inside of an inverted sphere.
 */

import {
  PBRMaterial,
  Color3,
  Texture,
  type Scene,
  MeshBuilder,
  Vector3,
} from '@babylonjs/core';

const PALETTE_WOOD_DIFFUSE = new Color3(0.71, 0.54, 0.37);
const PALETTE_WALL_DIFFUSE = new Color3(0.96, 0.94, 0.90);
const PALETTE_GRASS_DIFFUSE = new Color3(0.42, 0.55, 0.32);
const PALETTE_SKY_DIFFUSE = new Color3(0.66, 0.81, 0.95);

export function buildWoodFloorMaterial(scene: Scene): PBRMaterial {
  const mat = new PBRMaterial('woodFloorMat', scene);
  mat.albedoColor = PALETTE_WOOD_DIFFUSE;
  mat.roughness = 0.68;
  mat.metallic = 0.0;
  mat.environmentIntensity = 0.6;
  return mat;
}

export function buildWhiteWallMaterial(scene: Scene): PBRMaterial {
  const mat = new PBRMaterial('whiteWallMat', scene);
  mat.albedoColor = PALETTE_WALL_DIFFUSE;
  mat.roughness = 0.85;
  mat.metallic = 0.0;
  mat.backFaceCulling = false;
  return mat;
}

export function buildGrassExteriorMaterial(scene: Scene): PBRMaterial {
  const mat = new PBRMaterial('grassExteriorMat', scene);
  mat.albedoColor = PALETTE_GRASS_DIFFUSE;
  mat.roughness = 0.95;
  mat.metallic = 0.0;
  mat.environmentIntensity = 0.4;
  return mat;
}

export function buildSkyDomeMaterial(scene: Scene): PBRMaterial {
  const mat = new PBRMaterial('skyDomeMat', scene);
  mat.albedoColor = PALETTE_SKY_DIFFUSE;
  mat.roughness = 1.0;
  mat.metallic = 0.0;
  mat.backFaceCulling = false; // visible from inside the sphere
  mat.emissiveColor = PALETTE_SKY_DIFFUSE.scale(0.15);
  return mat;
}

/**
 * Mount a sky dome around the room — inverted sphere with sky-blue
 * inside-facing material. Replaces the flat ink clear-color when
 * called.
 */
export function mountSkyDome(scene: Scene, radius = 50): void {
  const sky = MeshBuilder.CreateSphere('skyDome', { diameter: radius * 2, segments: 32 }, scene);
  sky.material = buildSkyDomeMaterial(scene);
  sky.infiniteDistance = true;
  sky.position = new Vector3(0, 0, 0);
}

/**
 * Build a PBR material textured with a single image URL (the
 * `photo_front_url` per data-flow §6). Used by ProceduralProductBox.
 *
 * The texture is set on all six faces uniformly; alpha-edge fade is
 * applied via `useAlphaFromAlbedoTexture` so a partially-transparent
 * PNG/WebP front-photo renders correctly at the box edges.
 */
export function buildProductPhotoMaterial(
  scene: Scene,
  photoUrl: string,
  name: string,
): PBRMaterial {
  const mat = new PBRMaterial(`${name}-mat`, scene);
  const tex = new Texture(photoUrl, scene);
  mat.albedoTexture = tex;
  mat.roughness = 0.7;
  mat.metallic = 0.0;
  mat.useAlphaFromAlbedoTexture = true;
  mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  return mat;
}
