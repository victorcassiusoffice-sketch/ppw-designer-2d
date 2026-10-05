import * as THREE from 'three';
import type { ServiceFixturePlacement } from '../../designer/serviceFixtures';

/** Generic, measured service fixtures. These bodies deliberately carry no SKU,
 * product identity, price, water demand or compliance claim. */
export function serviceFixtureMesh(fixture: ServiceFixturePlacement): THREE.Group {
  const root = new THREE.Group();
  root.name = `service-fixture-${fixture.id}`;
  root.userData = { serviceFixtureId: fixture.id, levelId: fixture.levelId, genericServiceFixture: true };
  const body = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: '#eceee6', roughness: .22, metalness: 0 });
  const inset = new THREE.MeshStandardMaterial({ color: '#bacbc1', roughness: .3, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: '#aebbb4', roughness: .3, metalness: .7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#425e50', roughness: .6 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b89559', roughness: .38, metalness: .65 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, scale?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material = ceramic) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const sphere = (x: number, y: number, z: number, w: number, h: number, d: number, material = ceramic) => add(new THREE.SphereGeometry(1, 24, 14), material, x, y, z, [w / 2, h / 2, d / 2]);
  const tube = (points: THREE.Vector3[], radius: number, material = metal) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, radius, 10, false), material, 0, 0, 0);

  if (fixture.kind === 'toilet') {
    // Pedestal, softly curved bowl, a dark basin inside an actual open seat.
    sphere(0, .22, .1, .56, .44, .62);
    sphere(0, .45, .12, .98, .34, .82);
    sphere(0, .575, .14, .65, .055, .54, inset);
    const seat = add(new THREE.TorusGeometry(.35, .055, 10, 32), ceramic, 0, .59, .13, [1.17, 1, 1]);
    seat.rotation.x = Math.PI / 2;
    box(0, .72, -.33, .86, .52, .27);
    box(0, .99, -.33, .91, .035, .3);
    add(new THREE.CylinderGeometry(.045, .045, .015, 14), metal, .2, 1.015, -.33);
  } else if (fixture.kind === 'sink') {
    // Oval ceramic basin with rim and a tap over the bowl, on a pedestal.
    sphere(0, .77, .03, 1, .28, .9);
    sphere(0, .9, .06, .8, .04, .63, inset);
    const rim = add(new THREE.TorusGeometry(.34, .05, 10, 32), ceramic, 0, .9, .05, [1.36, 1, 1]);
    rim.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(.13, .2, .67, 16), ceramic, 0, .34, -.08);
    tube([new THREE.Vector3(0,.88,-.32),new THREE.Vector3(0,1.06,-.32),new THREE.Vector3(0,1.09,-.12),new THREE.Vector3(0,1.01,-.1)], .025);
    add(new THREE.CylinderGeometry(.035, .035, .008, 12), metal, 0, .928, .05);
  } else if (fixture.kind === 'mains-tap') {
    tube([new THREE.Vector3(0,0,-.1),new THREE.Vector3(0,.71,-.1),new THREE.Vector3(0,.75,.22),new THREE.Vector3(0,.61,.28)], .055, brass);
    box(0, .78, -.08, .16, .13, .15, brass);
    add(new THREE.CylinderGeometry(.045, .045, .14, 10), brass, 0, .92, -.08);
    const wheel = add(new THREE.TorusGeometry(.18, .028, 8, 20), dark, 0, 1, -.08);
    wheel.rotation.x = Math.PI / 2;
    box(0,1,-.08,.36,.025,.04,dark);
    box(0,1,-.08,.04,.025,.36,dark);
  } else {
    box(0,.5,0,1,1,1);
    box(0,.5,.51,.88,.9,.04,inset);
    for (let row=0;row<2;row++) for (let column=0;column<5;column++) {
      box(-.29 + column*.145,.66-row*.26,.55,.11,.18,.045,dark);
      box(-.29 + column*.145,.7-row*.26,.585,.065,.04,.035,ceramic);
    }
    box(.38,.46,.565,.04,.18,.03,metal);
  }
  // Fit the entire body including tap and seat into the user-owned envelope.
  // Mesh detail cannot enlarge the calculated footprint or installation height.
  body.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(body);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  body.scale.set(fixture.widthM / size.x, fixture.heightM / size.y, fixture.depthM / size.z);
  body.position.set(-centre.x * body.scale.x, -bounds.min.y * body.scale.y, -centre.z * body.scale.z);
  root.add(body);
  root.position.set(fixture.x, fixture.elevationM, fixture.y);
  root.rotation.y = -fixture.rotation * Math.PI / 180;
  // Dispose only materials actually used; unused construction choices never
  // enter the scene and should not wait for a later renderer disposal pass.
  const used = new Set<THREE.Material>();
  body.traverse(object => { if (object instanceof THREE.Mesh) used.add(object.material as THREE.Material); });
  for (const material of [ceramic, inset, metal, dark, brass]) if (!used.has(material)) material.dispose();
  return root;
}
