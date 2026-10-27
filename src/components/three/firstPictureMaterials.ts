import * as THREE from 'three';

/** The first Natural picture uses the real scene and its real diffuse maps,
 * with a smaller lighting shader. Original materials are restored before any
 * picking, asynchronous compile or subsequent full-detail render can run. */
export function createFirstPictureMaterials() {
  const temporary = new Map<THREE.Material, THREE.MeshLambertMaterial>();
  function lightweight(material: THREE.Material): THREE.Material {
    const source = material as THREE.MeshStandardMaterial;
    if (!source.isMeshStandardMaterial) return material;
    let preview = temporary.get(source);
    if (!preview) {
      preview = new THREE.MeshLambertMaterial({
        color: source.color, map: source.map, alphaMap: source.alphaMap,
        emissive: source.emissive, emissiveMap: source.emissiveMap,
        emissiveIntensity: source.emissiveIntensity,
        transparent: source.transparent, opacity: source.opacity,
        alphaTest: source.alphaTest, side: source.side, depthWrite: source.depthWrite,
        depthTest: source.depthTest, vertexColors: source.vertexColors,
        fog: source.fog, toneMapped: source.toneMapped,
      });
      temporary.set(source, preview);
    }
    const shaderChanged = preview.map !== source.map || preview.alphaMap !== source.alphaMap
      || preview.transparent !== source.transparent || preview.alphaTest !== source.alphaTest
      || preview.side !== source.side || preview.vertexColors !== source.vertexColors
      || preview.fog !== source.fog || preview.toneMapped !== source.toneMapped;
    preview.map = source.map; preview.alphaMap = source.alphaMap;
    preview.transparent = source.transparent; preview.alphaTest = source.alphaTest;
    preview.side = source.side; preview.vertexColors = source.vertexColors;
    preview.fog = source.fog; preview.toneMapped = source.toneMapped;
    preview.depthWrite = source.depthWrite; preview.depthTest = source.depthTest;
    preview.color.copy(source.color);
    preview.opacity = source.opacity;
    preview.emissive.copy(source.emissive); preview.emissiveIntensity = source.emissiveIntensity;
    if (shaderChanged) preview.needsUpdate = true;
    return preview;
  }
  return {
    draw<T>(scene: THREE.Scene, render: () => T): T {
      const originals: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
      scene.traverseVisible(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        originals.push([mesh, mesh.material]);
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(lightweight) : lightweight(mesh.material);
      });
      try { return render(); }
      finally { for (const [mesh, material] of originals) mesh.material = material; }
    },
    dispose() { for (const material of temporary.values()) material.dispose(); temporary.clear(); },
  };
}
