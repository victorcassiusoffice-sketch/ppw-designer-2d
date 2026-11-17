import * as THREE from 'three';
import { SERVICE_SYSTEMS, serviceRunPoints3D } from '../../designer/buildingServices';
import type { TankPortNozzle } from '../../designer/tankNetwork';
import type { ServiceRunPlacement } from '../../designer/serviceScene';
import { serviceMaterialById } from '../../data/buildingServicesCatalog';

/** Schematic bulkhead sleeves terminate at the measured pipe face. Their concealed
 * shanks overlap the tank interior irrespective of the approximate model profile. */
export function tankPortNozzleMesh(nozzles: TankPortNozzle[], diameterMm: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tank-port-nozzles';
  if (!nozzles.length) return group;
  const metal = new THREE.MeshStandardMaterial({ color: '#79888a', roughness: 0.56, metalness: 0.25 });
  const radius = diameterMm / 2000;
  for (const nozzle of nozzles) {
    const root = new THREE.Vector3(nozzle.from.x, nozzle.elevationM, nozzle.from.y);
    const tip = new THREE.Vector3(nozzle.terminal.x, nozzle.elevationM, nozzle.terminal.y);
    const direction = tip.clone().sub(root);
    const length = direction.length();
    if (length < .00001) continue;
    direction.normalize();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.28, radius * 1.28, length, 16), metal);
    sleeve.position.copy(root).add(tip).multiplyScalar(.5);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction);
    const depth = Math.min(length, radius * 1.8);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.75, radius * 1.75, depth, 6), metal);
    collar.position.copy(tip).addScaledVector(direction, -depth / 2);
    collar.quaternion.copy(sleeve.quaternion);
    group.add(sleeve, collar);
  }
  return group;
}

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
  if (run.tankNozzles?.length) group.add(tankPortNozzleMesh(run.tankNozzles, radius * 2000));
  return group;
}
