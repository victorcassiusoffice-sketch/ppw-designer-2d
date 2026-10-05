import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyContentPresentation, applyRendererPresentation, architecturalBackdrop, presentationProfile } from '../renderPresentation';
import { disposeDressingTextures, groundPlane, skyDome, updateGroundPresentation, updateSkyDome } from '../dressing';
import { GROUND_HEX } from '../../../designer/roomView3d';
import { floorMesh } from '../dressing';
import { NATURAL_BARE_FLOOR_HEX } from '../../../designer/architecturalSurface';

describe('architectural presentation without changing the saved finishes', () => {
  it('visualises only unfinished slabs as mineral concrete, then restores the exact colour-check finish', () => {
    const data = { key: 'bare', roomId: 'r', polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], hex: '#F1EBDD' };
    const unfinished = floorMesh(data, 'screed', 0.5, null);
    const bought = floorMesh({ ...data, key: 'laid', hex: '#736453' }, 'wood', 0.5, null);
    const root = new THREE.Group(); root.add(unfinished, bought);
    const bare = unfinished.material as THREE.MeshPhysicalMaterial, wood = bought.material as THREE.MeshPhysicalMaterial;
    const originalMap = bare.map, boughtMap = wood.map, geometry = unfinished.geometry;
    applyContentPresentation(root, 'natural');
    expect(bare.color.equals(new THREE.Color(NATURAL_BARE_FLOOR_HEX).multiplyScalar(0.9))).toBe(true);
    expect(bare.map).not.toBe(originalMap);
    expect(wood.map).toBe(boughtMap);
    expect(wood.color.equals(new THREE.Color('#736453').multiplyScalar(0.9))).toBe(true);
    expect(unfinished.geometry).toBe(geometry);
    applyContentPresentation(root, 'architectural');
    expect(bare.color.equals(new THREE.Color(data.hex).multiplyScalar(0.9))).toBe(true);
    expect(bare.map).toBe(originalMap);
    expect(bare.normalScale.x).toBe(0);
  });
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

  it('changes edge contrast in place, preserving paint colour, finish, geometry and the floor shadow flags', () => {
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
    expect(edge.color.getHexString()).toBe('ddd9cc');
    // Floors never cast a shadow, in either look — a cast floor moved the priced pixels beside it.
    expect(floor.castShadow).toBe(false);
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

  it('offers an explicitly separate natural-light rig while retaining source materials and the colour-check renderer', () => {
    const renderer = { toneMapping: THREE.NoToneMapping as THREE.ToneMapping, toneMappingExposure: 1 };
    const natural = presentationProfile('natural');
    applyRendererPresentation(renderer, 'natural');
    expect(renderer.toneMapping).toBe(THREE.NeutralToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);
    // A stronger key and substantially quieter fill create readable volume;
    // this cannot silently replace the colour-card calibration.
    const checked = presentationProfile('studio');
    expect(natural.day.hemi + natural.day.fill).toBeLessThan((checked.day.hemi + checked.day.fill) * 0.6);
    expect(natural.day.sun).toBeGreaterThan(checked.day.sun * 2);
    expect(natural.day.rim).toBe(0);
    expect(natural.shadowRadius).toBeGreaterThan(checked.shadowRadius);
    expect(natural.floorGain).toBe(checked.floorGain);
    expect(natural.lampFactor).toBe(0);

    const paint = new THREE.MeshPhysicalMaterial({ color: '#d1aa85', roughness: 0.23, normalMap: new THREE.Texture() });
    const floor = new THREE.MeshPhysicalMaterial({ map: new THREE.Texture(), color: '#665747', roughness: 0.8 });
    floor.userData = { stageSurface: 'floor', floorHex: '#665747' };
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(3, 2.7, 0.2), paint), new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 4), floor));
    root.position.set(12, 6.4, -8);
    const beforeBounds = new THREE.Box3().setFromObject(root);
    const map = floor.map, normalMap = paint.normalMap;
    applyContentPresentation(root, 'natural');
    expect(paint.color.getHexString()).toBe('d1aa85');
    expect(paint.roughness).toBe(0.23);
    expect(paint.normalMap).toBe(normalMap);
    expect(floor.map).toBe(map);
    expect(floor.color.equals(new THREE.Color('#665747').multiplyScalar(checked.floorGain))).toBe(true);
    expect(new THREE.Box3().setFromObject(root).equals(beforeBounds)).toBe(true);
    applyRendererPresentation(renderer, 'architectural');
    expect(renderer).toEqual({ toneMapping: THREE.NoToneMapping, toneMappingExposure: 1 });
    expect(presentationProfile('architectural').day).toEqual(checked.day);
  });

  it('shares the architectural backdrop with natural light without tone mapping the sky', () => {
    const natural = skyDome(1, 'natural');
    const architectural = skyDome(1, 'architectural');
    const naturalMaterial = natural.material as THREE.MeshBasicMaterial;
    const architecturalMaterial = architectural.material as THREE.MeshBasicMaterial;
    expect((naturalMaterial.map as THREE.DataTexture).image.data).toEqual((architecturalMaterial.map as THREE.DataTexture).image.data);
    expect(naturalMaterial.toneMapped).toBe(false);
    const ground = groundPlane();
    updateGroundPresentation(ground, 'natural');
    expect((ground.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('a9bbb4');
    disposeDressingTextures(natural);
    disposeDressingTextures(architectural);
    disposeDressingTextures(ground);
  });

  it('owns its neutral backdrop maps and disposes each replaced map without disposing shared finish maps', () => {
    const sky = skyDome(1, 'architectural');
    const skyMaterial = sky.material as THREE.MeshBasicMaterial;
    const original = skyMaterial.map!;
    const originalDispose = vi.spyOn(original, 'dispose');
    const pixels = (original as THREE.DataTexture).image.data!;
    expect(original.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(Array.from(pixels).slice(0, 3)).toEqual(architecturalBackdrop(1).top);
    expect(skyMaterial.toneMapped).toBe(false);
    updateSkyDome(sky, 0, 'architectural');
    expect(originalDispose).toHaveBeenCalledTimes(1);
    expect(sky.userData.presentation).toBe('architectural');
    const currentDispose = vi.spyOn(skyMaterial.map!, 'dispose');
    const ground = groundPlane();
    const groundMaterial = ground.material as THREE.MeshStandardMaterial;
    const groundDispose = vi.spyOn(groundMaterial.map!, 'dispose');
    updateGroundPresentation(ground, 'architectural');
    expect(groundMaterial.color.getHexString()).toBe('a9bbb4');
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
