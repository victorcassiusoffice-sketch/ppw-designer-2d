import * as THREE from 'three';

/** Product-local reflections: never attach the environment to the whole scene,
 * where it would change calibrated paint and flooring. Apply identically to a
 * dimensional preview and its eventual supplier model, so loading a GLB cannot
 * suddenly make an otherwise identical material glossy. */
export function applyProductSurfaceLighting(root: THREE.Object3D, environment: THREE.Texture | null, maxAnisotropy = 1): void {
  const anisotropy = Math.max(1, Math.min(8, Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1));
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      if (!(material as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
      const standard = material as THREE.MeshStandardMaterial;
      standard.envMap = environment;
      standard.envMapIntensity = environment ? 0.35 : 0;
      for (const texture of [standard.map, standard.normalMap, standard.bumpMap, standard.roughnessMap, standard.metalnessMap]) {
        if (texture && texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      }
      standard.needsUpdate = true;
    }
  });
}

/** Filter quality applies to the existing PBR maps, never their repeat/scale,
 * albedo or material quantities. Shared textures are updated once per scene. */
export function applySceneTextureSampling(root: THREE.Object3D, maxAnisotropy: number): void {
  const anisotropy = Math.max(1, Math.min(8, Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1));
  const seen = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const standard = material as THREE.MeshStandardMaterial;
      for (const texture of [standard.map, standard.normalMap, standard.bumpMap, standard.roughnessMap, standard.metalnessMap, standard.aoMap, standard.emissiveMap]) {
        if (!texture || seen.has(texture)) continue;
        seen.add(texture);
        if (texture.anisotropy !== anisotropy) { texture.anisotropy = anisotropy; texture.needsUpdate = true; }
      }
    }
  });
}
