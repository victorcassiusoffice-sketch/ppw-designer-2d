import * as THREE from 'three';
import { ECO_LIMITS, type EcoTree } from '../../designer/eco';
import { gardenElevationAt, type Garden } from '../../designer/garden';

/** Illustrative, bounded tree geometry. Survey height and crown radius are used
 * directly in metres; species names never imply a botanical asset match. */
export function ecoTreeMeshes(trees: readonly EcoTree[], garden?: Garden): THREE.Group {
  const group = new THREE.Group(); group.name = 'eco-trees';
  const records = trees.slice(0, ECO_LIMITS.trees);
  if (!records.length) return group;
  const foliage = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96 }), records.length * 5);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 8),
    new THREE.MeshStandardMaterial({ color: '#776252', roughness: 1 }), records.length);
  foliage.name = 'measured-tree-canopies'; trunks.name = 'tree-stems';
  foliage.castShadow = trunks.castShadow = true;
  foliage.receiveShadow = trunks.receiveShadow = true;
  const transform = new THREE.Object3D();
  const colour = new THREE.Color();
  records.forEach((tree, index) => {
    const base = garden ? gardenElevationAt(garden, tree) : 0;
    const r = tree.canopyRadiusM, h = tree.heightM;
    const stemRadius = tree.stemDiameterMm != null ? tree.stemDiameterMm / 2000 : Math.min(r * 0.1, h * 0.025);
    transform.position.set(tree.x, base + h * 0.335, tree.y);
    transform.scale.set(stemRadius, h * 0.67, stemRadius); transform.updateMatrix();
    trunks.setMatrixAt(index, transform.matrix);
    // Central crown reaches the exact entered height; the four side crowns
    // reach the exact entered canopy radius without expanding the envelope.
    const lobes = [[0, 0, 0.7, 0.72, 0.30], [-0.35, 0, 0.66, 0.65, 0.24], [0.35, 0, 0.68, 0.65, 0.24], [0, -0.35, 0.67, 0.65, 0.24], [0, 0.35, 0.65, 0.65, 0.24]];
    lobes.forEach(([x, z, y, radius, height], part) => {
      transform.position.set(tree.x + x * r, base + y * h, tree.y + z * r);
      transform.scale.set(radius * r, height * h, radius * r); transform.updateMatrix();
      foliage.setMatrixAt(index * 5 + part, transform.matrix);
      colour.set(tree.status === 'existing' ? '#4f7046' : '#7b9860').multiplyScalar(0.92 + part * 0.035);
      foliage.setColorAt(index * 5 + part, colour);
    });
  });
  foliage.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = true;
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  foliage.computeBoundingBox(); trunks.computeBoundingBox();
  group.add(trunks, foliage); group.updateMatrixWorld(true);
  return group;
}
