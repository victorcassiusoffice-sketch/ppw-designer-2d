import * as THREE from 'three';
import type { ServiceFixturePlacement } from '../../designer/serviceFixtures';

/** Generic, measured service fixtures. These bodies deliberately carry no SKU,
 * product identity, price, water demand or compliance claim. */
export function serviceFixtureMesh(fixture: ServiceFixturePlacement): THREE.Group {
  const root = new THREE.Group();
  root.name = `service-fixture-${fixture.id}`;
  root.userData = {
    serviceFixtureId: fixture.id,
    levelId: fixture.levelId,
    genericServiceFixture: true,
  };
  const body = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({
    color: '#eceee6',
    roughness: 0.22,
    metalness: 0,
  });
  const inset = new THREE.MeshStandardMaterial({ color: '#bacbc1', roughness: 0.3, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({
    color: '#aebbb4',
    roughness: 0.3,
    metalness: 0.7,
  });
  const dark = new THREE.MeshStandardMaterial({ color: '#425e50', roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({
    color: '#b89559',
    roughness: 0.38,
    metalness: 0.65,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    scale?: [number, number, number],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);
    return mesh;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material = ceramic,
  ) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const sphere = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material = ceramic,
  ) => add(new THREE.SphereGeometry(1, 24, 14), material, x, y, z, [w / 2, h / 2, d / 2]);
  const tube = (points: THREE.Vector3[], radius: number, material = metal) =>
    add(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, radius, 10, false),
      material,
      0,
      0,
      0,
    );

  if (fixture.kind === 'toilet') {
    // Pedestal, softly curved bowl, a dark basin inside an actual open seat.
    sphere(0, 0.22, 0.1, 0.56, 0.44, 0.62);
    sphere(0, 0.45, 0.12, 0.98, 0.34, 0.82);
    sphere(0, 0.575, 0.14, 0.65, 0.055, 0.54, inset);
    const seat = add(
      new THREE.TorusGeometry(0.35, 0.055, 10, 32),
      ceramic,
      0,
      0.59,
      0.13,
      [1.17, 1, 1],
    );
    seat.rotation.x = Math.PI / 2;
    box(0, 0.72, -0.33, 0.86, 0.52, 0.27);
    box(0, 0.99, -0.33, 0.91, 0.035, 0.3);
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 14), metal, 0.2, 1.015, -0.33);
  } else if (fixture.kind === 'sink') {
    // Oval ceramic basin with rim and a tap over the bowl, on a pedestal.
    sphere(0, 0.77, 0.03, 1, 0.28, 0.9);
    sphere(0, 0.9, 0.06, 0.8, 0.04, 0.63, inset);
    const rim = add(
      new THREE.TorusGeometry(0.34, 0.05, 10, 32),
      ceramic,
      0,
      0.9,
      0.05,
      [1.36, 1, 1],
    );
    rim.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.13, 0.2, 0.67, 16), ceramic, 0, 0.34, -0.08);
    tube(
      [
        new THREE.Vector3(0, 0.88, -0.32),
        new THREE.Vector3(0, 1.06, -0.32),
        new THREE.Vector3(0, 1.09, -0.12),
        new THREE.Vector3(0, 1.01, -0.1),
      ],
      0.025,
    );
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 12), metal, 0, 0.928, 0.05);
  } else if (fixture.kind === 'mains-tap') {
    tube(
      [
        new THREE.Vector3(0, 0, -0.1),
        new THREE.Vector3(0, 0.71, -0.1),
        new THREE.Vector3(0, 0.75, 0.22),
        new THREE.Vector3(0, 0.61, 0.28),
      ],
      0.055,
      brass,
    );
    box(0, 0.78, -0.08, 0.16, 0.13, 0.15, brass);
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10), brass, 0, 0.92, -0.08);
    const wheel = add(new THREE.TorusGeometry(0.18, 0.028, 8, 20), dark, 0, 1, -0.08);
    wheel.rotation.x = Math.PI / 2;
    box(0, 1, -0.08, 0.36, 0.025, 0.04, dark);
    box(0, 1, -0.08, 0.04, 0.025, 0.36, dark);
  } else if (fixture.kind === 'sewer-connection') {
    // Generic inspection chamber marker; no claimed authority or product size.
    box(0, 0.45, 0, 1, 0.9, 1, inset);
    box(0, 0.95, 0, 1, 0.1, 1, dark);
    for (const x of [-0.28, 0, 0.28]) box(x, 1.005, 0, 0.055, 0.025, 0.8, metal);
  } else {
    box(0, 0.5, 0, 1, 1, 1);
    box(0, 0.5, 0.51, 0.88, 0.9, 0.04, inset);
    for (let row = 0; row < 2; row++)
      for (let column = 0; column < 5; column++) {
        box(-0.29 + column * 0.145, 0.66 - row * 0.26, 0.55, 0.11, 0.18, 0.045, dark);
        box(-0.29 + column * 0.145, 0.7 - row * 0.26, 0.585, 0.065, 0.04, 0.035, ceramic);
      }
    box(0.38, 0.46, 0.565, 0.04, 0.18, 0.03, metal);
  }
  // Fit the entire body including tap and seat into the user-owned envelope.
  // Mesh detail cannot enlarge the calculated footprint or installation height.
  body.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(body);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  body.scale.set(fixture.widthM / size.x, fixture.heightM / size.y, fixture.depthM / size.z);
  body.position.set(
    -centre.x * body.scale.x,
    -bounds.min.y * body.scale.y,
    -centre.z * body.scale.z,
  );
  root.add(body);
  root.position.set(fixture.x, fixture.elevationM, fixture.y);
  root.rotation.y = (-fixture.rotation * Math.PI) / 180;
  // Dispose only materials actually used; unused construction choices never
  // enter the scene and should not wait for a later renderer disposal pass.
  const used = new Set<THREE.Material>();
  body.traverse((object) => {
    if (object instanceof THREE.Mesh) used.add(object.material as THREE.Material);
  });
  for (const material of [ceramic, inset, metal, dark, brass])
    if (!used.has(material)) material.dispose();
  return root;
}
