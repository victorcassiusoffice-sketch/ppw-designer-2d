import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BARE_PLASTER_HEX } from '../../../data/wallPaints';
import { applyWallLook, type WallTextures } from '../wallSurfaces';

const textures: WallTextures = {
  plasterMap: new THREE.Texture(),
  plasterNormal: new THREE.Texture(),
  rollerNormal: new THREE.Texture(),
  paintRoughness: new THREE.Texture(),
  brickMap: new THREE.Texture(), brickNormal: new THREE.Texture(),
  concreteMap: new THREE.Texture(), concreteNormal: new THREE.Texture(),
};

describe('paint material transitions', () => {
  it('keeps brick mortar relief under paint and removes its brick colour map', () => {
    const material = new THREE.MeshPhysicalMaterial();
    applyWallLook(material, { hex: '#A36B50', construction: 'brick' }, null, textures);
    expect(material.map).toBe(textures.brickMap);
    expect(material.normalMap).toBe(textures.brickNormal);
    applyWallLook(material, { hex: '#557755', finish: 'matt', construction: 'brick' }, null, textures);
    expect(material.color.getHexString()).toBe('557755');
    expect(material.map).toBeNull();
    expect(material.normalMap).toBe(textures.brickNormal);
  });

  it('gives concrete distinct pores then returns to plaster without stale maps', () => {
    const material = new THREE.MeshPhysicalMaterial();
    applyWallLook(material, { hex: '#A7A49C', construction: 'concrete' }, null, textures);
    expect(material.map).toBe(textures.concreteMap);
    expect(material.normalMap).toBe(textures.concreteNormal);
    applyWallLook(material, { hex: BARE_PLASTER_HEX, construction: 'plastered-brick' }, null, textures);
    expect(material.map).toBe(textures.plasterMap);
    expect(material.normalMap).toBe(textures.plasterNormal);
  });
  it('preserves the tint while matt, satin and gloss get visibly different reflections', () => {
    const env = new THREE.Texture();
    const surfaces = ['matt', 'satin', 'gloss'].map((finish) => {
      const material = new THREE.MeshPhysicalMaterial();
      applyWallLook(material, { hex: '#4C493F', finish }, env, textures);
      expect(material.color.getHexString()).toBe('4c493f');
      expect(material.map).toBeNull();
      expect(material.metalness).toBe(0);
      expect(material.normalMap).toBe(textures.rollerNormal);
      expect(material.roughnessMap).toBe(textures.paintRoughness);
      return material;
    });
    const [matt, satin, gloss] = surfaces;
    expect(matt.roughness - satin.roughness).toBeGreaterThan(0.4);
    expect(satin.roughness - gloss.roughness).toBeGreaterThan(0.2);
    expect(matt.envMap).toBeNull();
    expect(matt.clearcoat).toBe(0);
    expect(satin.envMap).toBe(env);
    expect(gloss.clearcoat).toBeGreaterThan(satin.clearcoat);
    expect(gloss.clearcoatRoughness).toBeLessThan(satin.clearcoatRoughness);
    expect(satin.clearcoatNormalMap).toBe(textures.rollerNormal);
    expect(gloss.normalScale.x).toBeLessThan(matt.normalScale.x);
  });

  it('restores plaster and matt completely after previewing gloss on the same material', () => {
    const material = new THREE.MeshPhysicalMaterial();
    applyWallLook(material, { hex: '#808080', finish: 'gloss' }, new THREE.Texture(), textures);
    applyWallLook(material, { hex: BARE_PLASTER_HEX }, null, textures);
    expect(material.map).toBe(textures.plasterMap);
    expect(material.normalMap).toBe(textures.plasterNormal);
    expect(material.roughnessMap).toBeNull();
    expect(material.clearcoatNormalMap).toBeNull();
    expect(material.clearcoatRoughnessMap).toBeNull();
    expect(material.envMap).toBeNull();
    expect(material.specularIntensity).toBe(0);
    applyWallLook(material, { hex: '#FFFFFF', finish: 'matt' }, new THREE.Texture(), textures);
    expect(material.map).toBeNull();
    expect(material.color.getHexString()).toBe('ffffff');
    expect(material.clearcoat).toBe(0);
    expect(material.envMap).toBeNull();
  });
});
