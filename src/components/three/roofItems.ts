/** Apply roof mounting to any catalog model/preview without changing its physical size. */
import * as THREE from 'three';
import type { ItemSolid } from '../../designer/roomSolids';
import type { RoofItemMount } from '../../designer/roofSurface';
import type { Vertex } from '../../lib/geometry';

type Footprint = Pick<ItemSolid, 'x0' | 'y0' | 'x1' | 'y1' | 'rotationDeg'>;

export function poseRoofItem(root: THREE.Object3D, item: Footprint, mount: RoofItemMount): void {
  root.position.set((item.x0 + item.x1) / 2, mount.elevationM, (item.y0 + item.y1) / 2);
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-mount.slopeX, 1, -mount.slopeY).normalize());
  const heading = root.getObjectByName('roof-item-heading');
  if (heading) heading.rotation.y = -(item.rotationDeg - (root.userData.roofBaseRotationDeg as number)) * Math.PI / 180;
  root.updateMatrixWorld(true);
}

export function mountRoofItem(body: THREE.Object3D, item: ItemSolid): THREE.Object3D {
  if (!item.roofMount) return body;
  const root = new THREE.Group();
  root.userData = { ...body.userData, roofMounted: true, roofBaseRotationDeg: item.rotationDeg };
  // Model/preview roots use world coordinates. Convert once to the panel's
  // base centre; the outer transform tilts the complete product rigidly.
  body.position.sub(new THREE.Vector3((item.x0 + item.x1) / 2, item.z0, (item.y0 + item.y1) / 2));
  const heading = new THREE.Group();
  heading.name = 'roof-item-heading';
  heading.add(body);
  root.add(heading);
  poseRoofItem(root, item, item.roofMount);
  return root;
}

/** Pick only the upper covering, not its fascia or the slab hidden below it. */
export function roofPointFromRay(ray: THREE.Raycaster, roofs: THREE.Object3D[]): Vertex | null {
  const surfaces = roofs.map((roof) => roof.getObjectByName('roof-covering')).filter((roof): roof is THREE.Object3D => !!roof);
  const hit = ray.intersectObjects(surfaces, false).find((candidate) => {
    if (!candidate.face) return false;
    const normal = candidate.face.normal.clone().transformDirection(candidate.object.matrixWorld);
    return ray.ray.direction.dot(normal) < 0;
  });
  return hit ? { x: hit.point.x, y: hit.point.z } : null;
}
