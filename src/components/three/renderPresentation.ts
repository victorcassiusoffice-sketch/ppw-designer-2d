import * as THREE from 'three';

export type ScenePresentation = 'studio' | 'architectural';

/** Intensities are multiples of π, matching three's physical Lambert response. */
const STUDIO = {
  toneMapping: THREE.NoToneMapping, exposure: 1,
  day: { hemi: 0.72, sun: 0.25, fill: 0.25, rim: 0 },
  night: { hemi: 0.14, sun: 0, fill: 0.07, rim: 0 },
  sky: '#ffffff', bounce: '#f2ede4', fill: '#ffffff', sun: '#fff6ea',
  sunDirection: [-0.45, 1, -0.55] as const,
  reveal: '#C9C3B6', cap: '#B5AFA2', exterior: '#E4E0D6',
  floorGain: 0.9, cornerAlpha: 0.16, contactAlpha: 0.3, lampFactor: 0,
};

/**
 * The architectural presentation keeps the studio LIGHT RIG byte for byte.
 * Colour truth (measured 2026-09-19: a #808080 wall reads 118–127 on every
 * wall and camera; floors take the measured 0.9 gain) forbids tone mapping,
 * any exposure other than 1, a tinted sky/bounce, a rim light or day-lit
 * lamps on priced surfaces. What this look changes is only what is not for
 * sale: the sky dome, the ground plane, the far fog and the unpriced
 * reveal / cap edges of the walls. A paint picked in the Paint tool must
 * look the same the moment the tool closes.
 */
const ARCHITECTURAL = {
  ...STUDIO,
  reveal: '#a6b1bc', cap: '#cbd6e2',
};

export function presentationProfile(presentation: ScenePresentation = 'studio') {
  return presentation === 'architectural' ? ARCHITECTURAL : STUDIO;
}

/** Switching presentation is reversible and never remounts the WebGL context. */
export function applyRendererPresentation(
  renderer: Pick<THREE.WebGLRenderer, 'toneMapping' | 'toneMappingExposure'>,
  presentation: ScenePresentation,
): void {
  const profile = presentationProfile(presentation);
  renderer.toneMapping = profile.toneMapping;
  renderer.toneMappingExposure = profile.exposure;
}

/** Only renderer-owned, unpriced building edges change colour. Paint is untouched. */
export function applyContentPresentation(root: THREE.Object3D, presentation: ScenePresentation): void {
  const profile = presentationProfile(presentation);
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.floor) mesh.castShadow = presentation === 'architectural';
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (seen.has(material)) continue;
      seen.add(material);
      const surface: unknown = material.userData.stageSurface;
      const physical = material as THREE.MeshPhysicalMaterial;
      if (surface === 'reveal' || surface === 'cap' || surface === 'exterior') physical.color.set(profile[surface]);
      if (surface === 'floor' && typeof material.userData.floorHex === 'string') {
        physical.color.set(material.userData.floorHex).multiplyScalar(profile.floorGain);
      }
      if (surface === 'corner') material.opacity = profile.cornerAlpha;
      if (surface === 'contact') material.opacity = profile.contactAlpha;
    }
  });
}
