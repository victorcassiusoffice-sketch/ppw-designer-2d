import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ItemSolid } from '../../designer/roomSolids';
import { serviceProductById, serviceProductSizeM, type ServiceProductDefinition } from '../../data/serviceProducts';

/** Original, intentionally simplified bodies. Supplier dimensions describe the
 * envelope only; ribs, lid, ceramic rim and screw positions are illustrative.
 */
export function createServiceProductBody(definition: ServiceProductDefinition): THREE.Group {
  const sizeM = serviceProductSizeM(definition);
  const detail = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (colour: string) => {
    let value = materials.get(colour);
    if (!value) {
      value = new THREE.MeshStandardMaterial({ color: colour,
        roughness: ['toilet-bowl', 'bidet', 'washbasin'].includes(definition.shape) ? .23 : .68 });
      materials.set(colour, value);
    }
    return value;
  };
  const add = (geometry: THREE.BufferGeometry, colour: string, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material(colour));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    detail.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colour: string) =>
    add(new THREE.BoxGeometry(w, h, d), colour, x, y, z);
  const rounded = (x: number, y: number, z: number, w: number, h: number, d: number, colour: string, radius = .035) =>
    add(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 3, h / 3, d / 3)), colour, x, y, z);

  if (definition.shape === 'tank-horizontal') {
    const tank = add(new THREE.CylinderGeometry(.46, .46, 1, 48), '#bacbb7', 0, .46, 0);
    tank.rotation.z = Math.PI / 2;
    for (const x of [-.31, .31]) {
      const rib = add(new THREE.TorusGeometry(.459, .023, 8, 48), '#91a58f', x, .46, 0);
      rib.rotation.y = Math.PI / 2;
    }
    box(-.3, .045, 0, .17, .09, .64, '#657e64');
    box(.3, .045, 0, .17, .09, .64, '#657e64');
    add(new THREE.CylinderGeometry(.17, .17, .075, 32), '#536e56', 0, .96, 0);
  } else if (definition.shape === 'tank-round') {
    const profile = [[0, 0], [.43, 0], [.49, .04], [.5, .16], [.5, .7], [.46, .81], [.36, .89], [.18, .92], [0, .92]];
    add(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 48), '#cbd7c6', 0, 0, 0);
    add(new THREE.CylinderGeometry(.185, .185, .08, 32), '#657e64', 0, .96, 0);
  } else if (definition.shape === 'toilet-bowl') {
    // No invented cistern: published envelope is a 400 mm-high ceramic bowl.
    const pedestal = add(new THREE.SphereGeometry(1, 24, 18), '#e9ede4', .14, .25, 0);
    pedestal.scale.set(.28, .25, .26);
    const bowl = add(new THREE.SphereGeometry(1, 32, 18), '#f2f2ea', -.06, .61, 0);
    bowl.scale.set(.5, .29, .38);
    const hollow = add(new THREE.SphereGeometry(1, 32, 16), '#afc4b9', -.12, .82, 0);
    hollow.scale.set(.36, .055, .255);
    const rim = add(new THREE.TorusGeometry(.3, .045, 10, 40), '#f7f7ef', -.12, .855, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.37, 1, 1);
    box(.38, .53, 0, .22, .6, .42, '#e9ede4');
  } else if (definition.shape === 'bidet') {
    const base = add(new THREE.SphereGeometry(1, 32, 20), '#efeee6', .06, .31, 0);
    base.scale.set(.4, .31, .34);
    rounded(.33, .46, 0, .25, .9, .58, '#f2f1e9', .08);
    const bowl = add(new THREE.SphereGeometry(1, 40, 24), '#f4f3ec', -.02, .7, 0);
    bowl.scale.set(.5, .27, .4);
    const well = add(new THREE.SphereGeometry(1, 32, 16), '#b5c7bd', -.075, .925, 0);
    well.scale.set(.32, .033, .255);
    const rim = add(new THREE.TorusGeometry(.295, .03, 12, 48), '#fffef6', -.075, .95, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.2, .96, 1);
    // Only the ceramic tap hole is shown; no unpriced tap or trap is invented.
    add(new THREE.CylinderGeometry(.03, .03, .006, 24), '#697c72', .36, .945, 0);
  } else if (definition.shape === 'washbasin') {
    // A basin shell with an inset well; cabinet and tap are separate products.
    rounded(0, .075, .055, .8, .15, .66, '#eceee4', .055);
    rounded(0, .83, -.415, 1, .34, .17, '#f7f5ee', .04);
    rounded(-.46, .6, .045, .08, .74, .91, '#f5f4ec', .035);
    rounded(.46, .6, .045, .08, .74, .91, '#f5f4ec', .035);
    rounded(0, .62, .455, .87, .72, .09, '#f5f4ec', .035);
    rounded(0, .16, .035, .77, .09, .69, '#becfc5', .04);
    add(new THREE.CylinderGeometry(.025, .025, .008, 24), '#7d8b85', 0, .21, .035);
    add(new THREE.CylinderGeometry(.022, .022, .008, 24), '#697c72', 0, 1.004, -.415);
  } else if (definition.shape === 'garden-sofa') {
    // Original acacia-frame interpretation of the measured Seville sofa component.
    // No set companions or whole-set weight are added to this one catalogue item.
    for (const x of [-.455, .455]) {
      for (const z of [-.385, .365]) rounded(x, .235, z, .06, .47, .07, '#876449', .008);
      rounded(x, .55, 0, .09, .055, .88, '#a57b54', .014);
      rounded(x, .45, -.405, .06, .9, .06, '#8e6846', .008);
    }
    rounded(0, .27, 0, .96, .075, .85, '#906b49', .012);
    for (const x of [-.345, -.23, -.115, 0, .115, .23, .345]) {
      rounded(x, .68, -.405, .075, .39, .05, '#b1875d', .006);
    }
    rounded(0, .945, -.405, .98, .06, .065, '#9b724e', .009);
    for (const x of [-.222, .222]) {
      rounded(x, .36, .015, .43, .13, .78, '#e1dfd2', .052);
      const cushion = rounded(x, .675, -.295, .43, .48, .18, '#e5e2d6', .057);
      cushion.rotation.x = -.09;
      rounded(x, .425, .015, .398, .004, .735, '#c8c7ba', .001);
    }
  } else if (definition.shape === 'pipe') {
    // Closed schematic ends intentionally avoid depicting a fabricated internal bore.
    const cylinder = add(new THREE.CylinderGeometry(.5, .5, 1, 40), definition.colour ?? '#717876', 0, .5, 0);
    cylinder.rotation.z = Math.PI / 2;
  } else if (definition.shape === 'surface-box') {
    // Open empty housing: do not depict or cost sockets/breakers that aren't supplied.
    box(0, .5, -.44, 1, 1, .12, '#dce2d8');
    box(-.47, .5, .015, .06, 1, .91, '#edf0e7');
    box(.47, .5, .015, .06, 1, .91, '#edf0e7');
    box(0, .03, .015, .88, .06, .91, '#edf0e7');
    box(0, .97, .015, .88, .06, .91, '#edf0e7');
    for (const x of [-.38, .38]) box(x, .5, .23, .1, .12, .3, '#b5c1b6');
  } else {
    box(0, .44, 0, .88, .88, .88, '#49624d');
    box(0, .91, 0, 1, .12, 1, '#74917a');
    box(0, .985, 0, .86, .03, .86, '#5d7f65');
    for (const x of [-.24, 0, .24]) box(x, 1.006, 0, .035, .012, .65, '#8ba191');
  }

  // Fit actual vertices once, including every decorative part, into one envelope.
  detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(detail, true);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  detail.scale.set(sizeM.lengthM / size.x, sizeM.heightM / size.y, sizeM.widthM / size.z);
  detail.position.set(-centre.x * detail.scale.x, -bounds.min.y * detail.scale.y, -centre.z * detail.scale.z);
  const root = new THREE.Group();
  root.add(detail);
  root.name = `service-product-${definition.referenceProductId}`;
  root.userData = { referenceProductId: definition.referenceProductId, body: true, approximatePreview: true,
    pairedServiceProduct: true, dimensionsBasis: definition.dimensionsBasis,
    previewNote: 'Published dimensional envelope; simplified original model. Installation and connection geometry require supplier review.' };
  return root;
}

/** Ordinary placed products and the service workspace can use the same body factory. */
export function serviceProductPreview(item: ItemSolid): THREE.Group | null {
  const definition = serviceProductById(item.productId);
  if (!definition || ![item.lengthM, item.widthM, item.heightM].every(value => Number.isFinite(value) && value > 0)) return null;
  const model = createServiceProductBody(definition);
  const canonical = serviceProductSizeM(definition);
  model.scale.set(item.lengthM / canonical.lengthM, item.heightM / canonical.heightM, item.widthM / canonical.widthM);
  model.position.set((item.x0 + item.x1) / 2, item.z0, (item.y0 + item.y1) / 2);
  model.rotation.y = -item.rotationDeg * Math.PI / 180;
  model.userData = { ...model.userData, key: item.key, instanceId: item.instanceId };
  return model;
}
