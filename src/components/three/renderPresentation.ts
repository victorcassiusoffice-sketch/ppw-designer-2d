import * as THREE from 'three';

export type ScenePresentation = 'studio' | 'architectural' | 'natural';

/** Backdrop tokens are deliberately separate from illumination / sold finishes. */
export const ARCHITECTURAL_GROUND_HEX = '#d8ddd5';
export const ARCHITECTURAL_HORIZON_HEX = '#dedbd2';
export function architecturalBackdrop(day: number): { top: number[]; horizon: number[] } {
  const daylight = Number.isFinite(day) ? Math.max(0, Math.min(1, day)) : 1;
  const mix = (night: number[], noon: number[]) => night.map((value, i) => Math.round(value + (noon[i] - value) * daylight));
  return {
    top: mix([31, 36, 36], [216, 221, 213]),
    horizon: mix([49, 53, 52], [222, 219, 210]),
  };
}

/** Intensities are multiples of π, matching three's physical Lambert response. */
const STUDIO = {
  toneMapping: THREE.NoToneMapping, exposure: 1,
  day: { hemi: 0.72, sun: 0.25, fill: 0.25, rim: 0 },
  night: { hemi: 0.14, sun: 0, fill: 0.07, rim: 0 },
  sky: '#ffffff', bounce: '#f2ede4', fill: '#ffffff', sun: '#fff6ea',
  sunDirection: [-0.45, 1, -0.55] as const,
  reveal: '#C9C3B6', cap: '#B5AFA2', exterior: '#E4E0D6',
  floorGain: 0.9, cornerAlpha: 0.16, contactAlpha: 0.3, lampFactor: 0,
  shadowRadius: 1,
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
  reveal: '#aaa99d', cap: '#ddd9cc',
};

/** Explicit natural-light preview, not a calibrated colour card. The neutral
 * highlight shoulder avoids clipped white walls; a stronger directional key
 * and quieter uniform fill let shape and recesses read at house scale. The
 * saved paint/floor albedo, product finish and physical light calculations are
 * unchanged. Colour check uses STUDIO/ARCHITECTURAL exactly as before. */
const NATURAL = {
  ...ARCHITECTURAL,
  toneMapping: THREE.NeutralToneMapping,
  day: { hemi: 0.40, sun: 0.55, fill: 0.10, rim: 0 },
  cap: '#7c8076',
  cornerAlpha: 0.23,
  contactAlpha: 0.38,
  shadowRadius: 2.5,
};

export function presentationProfile(presentation: ScenePresentation = 'studio') {
  return presentation === 'natural' ? NATURAL : presentation === 'architectural' ? ARCHITECTURAL : STUDIO;
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

/**
 * Only renderer-owned, unpriced building edges change their albedo. Paint is
 * untouched, and so are the shadow flags: a laid floor never casts a shadow
 * in any look (a floor that cast in one presentation and not the other
 * moved the priced pixels beside it).
 */
export function applyContentPresentation(root: THREE.Object3D, presentation: ScenePresentation): void {
  const profile = presentationProfile(presentation);
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
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
