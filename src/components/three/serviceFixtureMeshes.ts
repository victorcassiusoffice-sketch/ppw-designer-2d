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
  const red = new THREE.MeshStandardMaterial({
    color: '#a72f2a',
    roughness: 0.36,
    metalness: 0.15,
  });
  const black = new THREE.MeshStandardMaterial({ color: '#182c32', roughness: 0.28 });
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
  } else if (fixture.kind === 'air-conditioner') {
    box(0, 0.51, 0, 1, 0.92, 0.82);
    sphere(0, 0.5, 0.23, 0.99, 0.93, 0.48);
    box(0, 0.19, 0.48, 0.88, 0.16, 0.04, dark);
    for (let i = 0; i < 4; i++) box(0, 0.14 + i * 0.04, 0.51, 0.86, 0.012, 0.035, ceramic);
    box(0.36, 0.55, 0.48, 0.08, 0.025, 0.02, inset);
  } else if (fixture.kind === 'outdoor-ac') {
    box(0, 0.53, 0, 1, 0.9, 0.82);
    const fan = add(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 32), dark, -0.16, 0.54, 0.44);
    fan.rotation.x = Math.PI / 2;
    for (const radius of [0.14, 0.23, 0.31])
      add(new THREE.TorusGeometry(radius, 0.008, 6, 32), metal, -0.16, 0.54, 0.47);
    for (let i = 0; i < 8; i++) box(0.31, 0.2 + i * 0.08, 0.43, 0.19, 0.025, 0.025, inset);
    for (const x of [-0.3, 0.3]) box(x, 0.04, 0, 0.16, 0.08, 1, metal);
  } else if (fixture.kind === 'air-grille') {
    box(0, 0.5, 0, 1, 1, 0.3);
    box(0, 0.5, 0.18, 0.89, 0.87, 0.1, dark);
    for (let i = 0; i < 9; i++) box(0, 0.14 + i * 0.09, 0.25, 0.87, 0.035, 0.3, ceramic);
  } else if (fixture.kind === 'extractor-fan') {
    box(0, 0.5, 0, 1, 1, 0.16);
    const duct = add(new THREE.CylinderGeometry(0.38, 0.38, 0.75, 28), inset, 0, 0.5, -0.35);
    duct.rotation.x = Math.PI / 2;
    const opening = add(new THREE.CylinderGeometry(0.39, 0.39, 0.03, 28), dark, 0, 0.5, 0.11);
    opening.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const blade = box(
        Math.cos(angle) * 0.17,
        0.5 + Math.sin(angle) * 0.17,
        0.15,
        0.33,
        0.1,
        0.025,
        ceramic,
      );
      blade.rotation.z = angle + 0.5;
    }
    sphere(0, 0.5, 0.17, 0.2, 0.2, 0.1, metal);
  } else if (fixture.kind === 'sprinkler') {
    add(new THREE.CylinderGeometry(0.19, 0.19, 0.38, 12), brass, 0, 0.81, 0);
    for (const x of [-0.23, 0.23]) box(x, 0.42, 0, 0.06, 0.53, 0.08, brass);
    sphere(0, 0.39, 0, 0.11, 0.4, 0.11, red);
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), brass, 0, 0.11, 0);
    // A thermal bulb and deflector symbol: no spray radius or certified coverage.
  } else if (fixture.kind === 'fire-extinguisher') {
    add(new THREE.CylinderGeometry(0.31, 0.31, 0.65, 24), red, 0, 0.35, 0);
    sphere(0, 0.68, 0, 0.61, 0.22, 0.61, red);
    box(0, 0.85, 0, 0.15, 0.2, 0.16, brass);
    box(0.1, 0.95, 0, 0.45, 0.07, 0.1, black);
    box(0, 0.44, 0.315, 0.34, 0.3, 0.015, ceramic);
    tube(
      [
        new THREE.Vector3(-0.07, 0.88, 0),
        new THREE.Vector3(-0.42, 0.82, 0),
        new THREE.Vector3(-0.39, 0.25, 0),
      ],
      0.04,
      black,
    );
  } else if (fixture.kind === 'security-camera') {
    const barrel = add(new THREE.CylinderGeometry(0.32, 0.32, 0.72, 24), ceramic, 0, 0.58, 0.03);
    barrel.rotation.x = Math.PI / 2;
    const lens = add(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), black, 0, 0.58, 0.41);
    lens.rotation.x = Math.PI / 2;
    sphere(0, 0.58, 0.44, 0.16, 0.16, 0.04, inset);
    box(0, 0.17, -0.25, 0.12, 0.3, 0.16, metal);
    box(0, 0.025, -0.25, 0.58, 0.05, 0.42, ceramic);
  } else if (fixture.kind === 'network-switch') {
    box(0, 0.5, 0, 1, 1, 1, dark);
    box(0, 0.5, 0.51, 0.96, 0.8, 0.03, metal);
    for (let i = 0; i < 8; i++) {
      box(-0.4 + i * 0.114, 0.45, 0.54, 0.085, 0.35, 0.025, black);
      box(-0.4 + i * 0.114, 0.76, 0.54, 0.025, 0.07, 0.025, inset);
    }
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
  for (const material of [ceramic, inset, metal, dark, brass, red, black])
    if (!used.has(material)) material.dispose();
  return root;
}
