import * as THREE from 'three';

/** Product-local reflections: never attach the environment to the whole scene,
 * where it would change calibrated paint and flooring. Apply identically to a
 * dimensional preview and its eventual supplier model, so loading a GLB cannot
 * suddenly make an otherwise identical material glossy. */
export function applyProductSurfaceLighting(root: THREE.Object3D, environment: THREE.Texture | null, maxAnisotropy = 1): void {
  const anisotropy = Math.max(1, Math.min(4, Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1));
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
