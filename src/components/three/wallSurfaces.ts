/** World-scaled plaster and rolled paint. Paint alters reflection, never its tint. */
import * as THREE from 'three';
import { wallFinishLook } from '../../data/wallPaints';
import { canvasTexture, noiseField, normalFromHeight } from './surfaces';

export interface WallTextures {
  plasterMap: THREE.Texture;
  plasterNormal: THREE.Texture;
  rollerNormal: THREE.Texture;
  paintRoughness: THREE.Texture;
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
  };
  return cached;
}

/** Also used for hover previews: a finish change must reset every surface map. */
export function applyWallLook(
  material: THREE.MeshPhysicalMaterial,
  wall: { hex: string; finish?: string | null },
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
  material.needsUpdate = true;
}
