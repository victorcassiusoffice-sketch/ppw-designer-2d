/** World-scaled plaster and rolled paint. Paint alters reflection, never its tint. */
import * as THREE from 'three';
import { wallFinishLook } from '../../data/wallPaints';
import { canvasTexture, noiseField, normalFromHeight } from './surfaces';

export interface WallTextures {
  plasterMap: THREE.Texture;
  plasterNormal: THREE.Texture;
  rollerNormal: THREE.Texture;
  paintRoughness: THREE.Texture;
  brickMap?: THREE.Texture;
  brickNormal?: THREE.Texture;
  concreteMap?: THREE.Texture;
  concreteNormal?: THREE.Texture;
}

let cached: WallTextures | null = null;

export function wallTextures(): WallTextures {
  if (cached) return cached;
  const size = 256;
  const trowel = noiseField(size, 7, 4);
  const fine = noiseField(size, 11, 1);
  const nap = noiseField(size, 19, 3);
  // A 32 cm repeat gives a millimetre-scale roller nap. The broad variation
  // breaks up highlights without adding visible dirt or changing the colour.
  const roller = fine.map((v, i) => v * 0.78 + nap[i] * 0.22);
  // Two 220 mm bricks + 10 mm mortar, four 65 mm courses + 10 mm joints.
  // The wall geometry's UVs are metres, so these proportions never stretch.
  const brickHeight = new Float32Array(size * size);
  const brickMap = canvasTexture(size, (d) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const row = Math.floor(y / 64);
      const shifted = (x + (row % 2) * 64) % 128;
      const mortar = y % 64 < 8 || shifted < 5;
      brickHeight[i] = mortar ? 0.18 : 0.75 + fine[i] * 0.13;
      const variation = (fine[i] - 0.5) * 13 + Math.sin(row * 71 + Math.floor((x + (row % 2) * 64) / 128) * 37) * 7;
      const rgb = mortar ? [184, 177, 159] : [168, 108, 78];
      for (let channel = 0; channel < 3; channel++) d[i * 4 + channel] = rgb[channel] + variation;
      d[i * 4 + 3] = 255;
    }
  }, THREE.SRGBColorSpace, 1);
  const brickNormal = normalFromHeight(size, brickHeight, 2.6, 1);
  brickMap.repeat.set(1 / 0.46, 1 / 0.30);
  brickNormal.repeat.copy(brickMap.repeat);
  const concreteHeights = fine.map((v, i) => v < 0.10 ? 0.1 : 0.65 + trowel[i] * 0.14 + v * 0.1);
  const concreteMap = canvasTexture(size, (d) => {
    for (let i = 0; i < size * size; i++) {
      const value = 228 + (trowel[i] - 0.5) * 25 + (fine[i] - 0.5) * 12 - (fine[i] < 0.10 ? 28 : 0);
      d[i * 4] = value; d[i * 4 + 1] = value; d[i * 4 + 2] = value - 2; d[i * 4 + 3] = 255;
    }
  }, THREE.SRGBColorSpace, 1.25);
  const plasterMap = canvasTexture(size, (d) => {
    for (let i = 0; i < size * size; i++) {
      const v = 240 + trowel[i] * 10 + (fine[i] - 0.5) * 6;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  }, THREE.SRGBColorSpace, 2);
  const paintRoughness = canvasTexture(size, (d) => {
    for (let i = 0; i < size * size; i++) {
      // Three multiplies roughness by GREEN. Stay close to 1 so this texture
      // cannot turn matt paint glossy or overwhelm a product's finish.
      const v = 236 + nap[i] * 19;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  }, THREE.NoColorSpace, 3.125);
  cached = {
    plasterMap,
    plasterNormal: normalFromHeight(size, trowel, 2.5, 2),
    rollerNormal: normalFromHeight(size, roller, 3, 3.125),
    paintRoughness,
    brickMap, brickNormal, concreteMap,
    concreteNormal: normalFromHeight(size, concreteHeights, 2, 1.25),
  };
  return cached;
}

/** Also used for hover previews: a finish change must reset every surface map. */
export function applyWallLook(
  material: THREE.MeshPhysicalMaterial,
  wall: { hex: string; finish?: string | null; construction?: import('../../designer/wallConstruction').WallConstruction },
  environment: THREE.Texture | null,
  textures = wallTextures(),
): void {
  const look = wallFinishLook(wall.finish);
  const painted = !!wall.finish;
  material.color.set(wall.hex);
  material.roughness = look.roughness;
  material.metalness = 0;
  material.specularIntensity = look.specularIntensity;
  material.clearcoat = look.clearcoat;
  material.clearcoatRoughness = look.clearcoatRoughness;
  material.map = painted ? null : textures.plasterMap;
  material.normalMap = painted ? textures.rollerNormal : textures.plasterNormal;
  material.normalScale.set(look.grain, look.grain);
  material.roughnessMap = painted ? textures.paintRoughness : null;
  // The coating follows the same roller nap; a perfectly smooth extra layer
  // on top was making satin resemble laminated plastic.
  material.clearcoatNormalMap = painted && look.clearcoat > 0 ? textures.rollerNormal : null;
  material.clearcoatNormalScale.set(look.grain * 0.65, look.grain * 0.65);
  material.clearcoatRoughnessMap = painted && look.clearcoat > 0 ? textures.paintRoughness : null;
  material.envMap = look.useEnv ? environment : null;
  material.envMapIntensity = look.envMapIntensity;
  if (wall.construction === 'brick') {
    if (!painted && textures.brickMap) { material.map = textures.brickMap; material.color.set('#FFFFFF'); }
    material.normalMap = textures.brickNormal ?? textures.plasterNormal;
    material.normalScale.set(0.8, 0.8);
  } else if (wall.construction === 'concrete') {
    if (!painted) material.map = textures.concreteMap ?? textures.plasterMap;
    material.normalMap = textures.concreteNormal ?? textures.plasterNormal;
    material.normalScale.set(painted ? 0.25 : 0.55, painted ? 0.25 : 0.55);
  }
  material.needsUpdate = true;
}
