import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyContentPresentation, applyRendererPresentation, presentationProfile } from '../renderPresentation';
import { disposeDressingTextures, groundPlane, skyDome, updateGroundPresentation, updateSkyDome } from '../dressing';
import { GROUND_HEX } from '../../../designer/roomView3d';

describe('architectural presentation without changing the saved finishes', () => {
  it('keeps the measured studio renderer and light rig in BOTH presentations (colour truth outside the Paint tool)', () => {
    // Colour-truth law: no tone mapping, exposure 1, the studio rig, white sky,
    // no rim, no day-lit lamps, the measured floor gain — in every presentation.
    for (const presentation of ['studio', 'architectural'] as const) {
      const renderer = { toneMapping: THREE.ACESFilmicToneMapping as THREE.ToneMapping, toneMappingExposure: 1.05 };
      applyRendererPresentation(renderer, presentation);
      expect(renderer).toEqual({ toneMapping: THREE.NoToneMapping, toneMappingExposure: 1 });
      const profile = presentationProfile(presentation);
      expect(profile.day).toEqual({ hemi: 0.72, sun: 0.25, fill: 0.25, rim: 0 });
      expect(profile.night).toEqual(presentationProfile().night);
      expect([profile.sky, profile.bounce, profile.fill, profile.sun]).toEqual(['#ffffff', '#f2ede4', '#ffffff', '#fff6ea']);
      expect(profile.sunDirection).toEqual(presentationProfile().sunDirection);
      expect(profile.floorGain).toBe(0.9);
      expect(profile.lampFactor).toBe(0);
      expect(profile.cornerAlpha).toBe(presentationProfile().cornerAlpha);
      expect(profile.contactAlpha).toBe(presentationProfile().contactAlpha);
    }
    // What the architectural look may change: the unpriced wall edges only.
    expect(presentationProfile('architectural').cap).not.toBe(presentationProfile().cap);
    expect(presentationProfile('architectural').exterior).toBe(presentationProfile().exterior);
  });

  it('changes edge contrast and floor shadows in place, preserving paint colour, finish and geometry', () => {
    const root = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: '#4c493f', roughness: 0.3, clearcoat: 0.2, normalMap: new THREE.Texture() });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.7, 0.15), paint);
    const edge = new THREE.MeshStandardMaterial();
    edge.userData.stageSurface = 'cap';
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4, 0.04, 0.15), edge);
    const floorMaterial = new THREE.MeshPhysicalMaterial({ color: '#66717a', map: new THREE.Texture(), roughness: 0.7 });
    floorMaterial.userData = { stageSurface: 'floor', floorHex: '#66717a' };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), floorMaterial);
    floor.userData.floor = true;
    root.add(wall, cap, floor);
    const geometry = wall.geometry;
    const floorMap = floorMaterial.map;
    const normalMap = paint.normalMap;
    applyContentPresentation(root, 'architectural');
    expect(edge.color.getHexString()).toBe('cbd6e2');
    expect(floor.castShadow).toBe(true);
    // The laid floor is a priced product: the measured 0.9 gain holds in both looks.
    expect(floorMaterial.color.equals(new THREE.Color('#66717a').multiplyScalar(0.9))).toBe(true);
    applyContentPresentation(root, 'studio');
    expect(edge.color.getHexString()).toBe('b5afa2');
    expect(floor.castShadow).toBe(false);
    expect(floorMaterial.color.equals(new THREE.Color('#66717a').multiplyScalar(0.9))).toBe(true);
    expect(paint.color.getHexString()).toBe('4c493f');
    expect(paint.roughness).toBe(0.3);
    expect(paint.clearcoat).toBe(0.2);
    expect(paint.normalMap).toBe(normalMap);
    expect(wall.geometry).toBe(geometry);
    expect(floorMaterial.map).toBe(floorMap);
  });

  it('owns its dark backdrop maps and disposes each replaced map without disposing shared finish maps', () => {
    const sky = skyDome(1, 'architectural');
    const skyMaterial = sky.material as THREE.MeshBasicMaterial;
    const original = skyMaterial.map!;
    const originalDispose = vi.spyOn(original, 'dispose');
    const pixels = (original as THREE.DataTexture).image.data!;
    expect(original.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(pixels[2]).toBeGreaterThan(pixels[0]);
    expect(skyMaterial.toneMapped).toBe(false);
    updateSkyDome(sky, 0, 'architectural');
    expect(originalDispose).toHaveBeenCalledTimes(1);
    expect(sky.userData.presentation).toBe('architectural');
    const currentDispose = vi.spyOn(skyMaterial.map!, 'dispose');
    const ground = groundPlane();
    const groundMaterial = ground.material as THREE.MeshStandardMaterial;
    const groundDispose = vi.spyOn(groundMaterial.map!, 'dispose');
    updateGroundPresentation(ground, 'architectural');
    expect(groundMaterial.color.getHexString()).toBe('304566');
    updateGroundPresentation(ground, 'studio');
    expect(groundMaterial.color.equals(new THREE.Color(GROUND_HEX))).toBe(true);
    const sharedTexture = new THREE.Texture();
    const sharedDispose = vi.spyOn(sharedTexture, 'dispose');
    const sharedFloor = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ map: sharedTexture }));
    const scene = new THREE.Group();
    scene.add(sky, ground, sharedFloor);
    disposeDressingTextures(scene);
    expect(currentDispose).toHaveBeenCalledTimes(1);
    expect(groundDispose).toHaveBeenCalledTimes(1);
    expect(sharedDispose).not.toHaveBeenCalled();
    expect(originalDispose).toHaveBeenCalledTimes(1);
  });
});
