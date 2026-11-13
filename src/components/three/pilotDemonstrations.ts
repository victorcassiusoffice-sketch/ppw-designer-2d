import * as THREE from 'three';
/** Scale illustrations in metres, deliberately not manufacturer performance models. */
export function pilotDemonstration(kind: 'wind' | 'kinetic') {
  const group = new THREE.Group();
  group.name = 'pilot-' + kind;
  const metal = new THREE.MeshStandardMaterial({ color: '#d1d7d0', roughness: 0.65 });
  const green = new THREE.MeshStandardMaterial({ color: '#496f58', roughness: 0.85 });
  function part(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  if (kind === 'wind') {
    part(new THREE.CylinderGeometry(0.055, 0.1, 2.8, 12), metal, 0, 1.4, 0);
    part(new THREE.SphereGeometry(0.13, 12, 8), green, 0, 2.8, 0.12);
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      const blade = part(
        new THREE.BoxGeometry(0.1, 0.66, 0.045),
        metal,
        -0.34 * Math.sin(a),
        2.8 + 0.34 * Math.cos(a),
        0.14,
      );
      blade.rotation.z = a;
    }
  } else {
    part(new THREE.BoxGeometry(1.2, 0.06, 1.2), green, 0, 0.03, 0);
    for (const x of [-0.3, 0.3])
      for (const z of [-0.3, 0.3])
        part(new THREE.BoxGeometry(0.55, 0.025, 0.55), metal, x, 0.0725, z);
  }
  return group;
}
