import * as THREE from 'three';

/** Furniture-local contact shading, baked once into vertices before merging.
 * A short-range box approximation is deliberate: it adds the creases between
 * cushions and the recess under joinery without a full-screen AO pass, another
 * render target, ray tracing or changes to the calibrated building light rig.
 * Nothing outside this one product participates in the bake. */
export function furnitureOcclusion(
  geometry: THREE.BufferGeometry,
  owner: THREE.Box3,
  neighbours: readonly THREE.Box3[],
): void {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colours = new Float32Array(positions.count * 3);
  const reach = 0.13;
  const influence = owner.clone().expandByScalar(reach);
  const nearby = neighbours.filter((box) => box !== owner && influence.intersectsBox(box));
  const centres = nearby.map((box) => box.getCenter(new THREE.Vector3()));
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), closest = new THREE.Vector3(), toward = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i).normalize();
    let shade = 0;
    for (let j = 0; j < nearby.length; j++) {
      nearby[j].clampPoint(point, closest);
      const distance = point.distanceTo(closest);
      if (distance >= reach) continue;
      toward.copy(centres[j]).sub(point).normalize();
      const facing = Math.max(0, normal.dot(toward));
      // Max instead of sum prevents piles of screws/legs over-darkening a mesh.
      shade = Math.max(shade, Math.pow(1 - distance / reach, 2) * facing * 0.29);
    }
    colours[i * 3] = colours[i * 3 + 1] = colours[i * 3 + 2] = 1 - shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}
