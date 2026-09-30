/** Catalog envelopes, in metres, shared by imported bodies and fallbacks. */
import * as THREE from 'three';
import type { ItemSolid } from '../../designer/roomSolids';
import { fitToSize, itemPose, pitchedBox, upPitchRad } from '../../designer/fitToSize';

export interface BodyTemplate {
  scene: THREE.Group;
  bbox: THREE.Box3;
}

/** Scan actual transformed vertices once per loaded model, not a padded
 * union of its rotated local boxes. The latter silently shrank curved and
 * diagonal supplier geometry to less than the saved product dimensions. */
export function bodyTemplate(scene: THREE.Group): BodyTemplate {
  scene.updateWorldMatrix(true, true);
  const bbox = new THREE.Box3().setFromObject(scene, true);
  const size = bbox.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 1e-9)) {
    throw new Error('Product model needs finite three-dimensional bounds');
  }
  return { scene, bbox };
}

/** The true oriented envelope; a diagonal item's collision AABB is NOT its
 * geometry. The pivot stays at half-height for existing carry semantics. */
export function productEnvelope(item: ItemSolid) {
  const size = { x: item.lengthM, y: item.heightM, z: item.widthM };
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Product dimensions must be positive finite metres');
  }
  const pose = itemPose({ x: item.x0, y: item.y0, footprintW: item.x1 - item.x0,
    footprintH: item.y1 - item.y0, rotationDeg: item.rotationDeg, z0: item.z0 });
  return { size, position: new THREE.Vector3(pose.centre.x, pose.centre.z + size.y / 2, pose.centre.y), yawRad: pose.yawRad };
}

/** Fit without mutating the cached supplier scene, geometry, or materials. */
export function bodyObject(item: ItemSolid, template: BodyTemplate): THREE.Group {
  productEnvelope(item); // Reject corrupt dimensions before cloning any resources.
  const fit = fitToSize({ bbox: pitchedBox(template.bbox, item.modelUp),
    lengthCm: item.lengthM * 100, widthCm: item.widthM * 100, heightCm: item.heightM * 100,
    frontEdge: item.frontEdge, modelFront: item.modelFront, lengthAxis: item.lengthAxis });
  const model = template.scene.clone(true);
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(material => material.clone()) : mesh.material.clone();
  });
  const upright = new THREE.Group();
  upright.rotation.x = upPitchRad(item.modelUp);
  upright.add(model);
  const inner = new THREE.Group();
  inner.add(upright);
  inner.scale.set(fit.scale.x, fit.scale.y, fit.scale.z);
  inner.rotation.y = fit.yawRad;
  inner.position.set(fit.offset.x, fit.offset.y, fit.offset.z);
  const pose = itemPose({ x: item.x0, y: item.y0, footprintW: item.x1 - item.x0,
    footprintH: item.y1 - item.y0, rotationDeg: item.rotationDeg, z0: item.z0 });
  const holder = new THREE.Group();
  holder.position.set(pose.centre.x, pose.centre.z, pose.centre.y);
  holder.rotation.y = pose.yawRad;
  holder.add(inner);
  holder.userData = { key: item.key, instanceId: item.instanceId, body: true };
  return holder;
}
