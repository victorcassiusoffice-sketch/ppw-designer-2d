import * as THREE from 'three';
import { SERVICE_SYSTEMS, serviceRunPoints3D } from '../../designer/buildingServices';
import type { ServiceRunPlacement } from '../../designer/serviceScene';
import { serviceMaterialById } from '../../data/buildingServicesCatalog';

/** Dimensioned coordination envelope. Bend markers are not certified fitting-body models. */
export function serviceRouteMesh(run: ServiceRunPlacement): THREE.Group {
  const group = new THREE.Group();
  group.name = `service-route-${run.id}`;
  group.userData = { serviceFixtureId: run.id, serviceRunId: run.id, levelId: run.levelId };
  const materialRef = serviceMaterialById(run.materialId);
  const matchingMaterial = materialRef?.system === run.system && Math.abs(materialRef.nominalDiameterMm - run.diameterMm) < 0.001;
  const radius = (matchingMaterial ? materialRef.outerDiameterMm ?? run.diameterMm : run.diameterMm) / 2000;
  const colour = SERVICE_SYSTEMS.find(system => system.id === run.system)?.colour ?? '#387e85';
  const material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.48, metalness: run.system === 'refrigerant' ? 0.55 : 0.08 });
  const points = serviceRunPoints3D(run).map(point => new THREE.Vector3(point.x, run.baseElevationM + point.elevationM, point.y));
  const segments = points.slice(1).map((to, index) => ({ from: points[index], to })).filter(({ from, to }) => from.distanceTo(to) > 0.00001);
  const pipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12), material, segments.length);
  const transform = new THREE.Object3D(), axis = new THREE.Vector3(0, 1, 0);
  segments.forEach(({ from, to }, index) => {
    const delta = to.clone().sub(from);
    transform.position.copy(from).add(to).multiplyScalar(0.5);
    transform.quaternion.setFromUnitVectors(axis, delta.clone().normalize());
    transform.scale.set(radius, delta.length(), radius); transform.updateMatrix(); pipes.setMatrixAt(index, transform.matrix);
  });
  pipes.instanceMatrix.needsUpdate = true; pipes.castShadow = true; pipes.receiveShadow = true; group.add(pipes);
  const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 10, 6), material, points.length);
  points.forEach((point, index) => { transform.position.copy(point); transform.quaternion.identity(); transform.scale.setScalar(1); transform.updateMatrix(); joints.setMatrixAt(index, transform.matrix); });
  joints.instanceMatrix.needsUpdate = true; group.add(joints);
  return group;
}
