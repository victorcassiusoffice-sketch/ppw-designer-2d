import * as THREE from 'three';
import { normaliseShade, shadeSailSurface, shadeSailCorners, type ShadeModel, type ShadeSail } from '../../designer/shade';

/** Plan (x, y, height) maps to THREE (x, height, y), like every room mesh. The
 * membrane is the interpolated saddle from the engine's surface sampler over the
 * same scalloped outline the plan draws; posts stand on the ground datum and
 * lean away from the sail the way installers set them. Presentation only: the
 * engine's quantities never read these meshes. */
export function shadeMeshes(model: ShadeModel | undefined, groundElevationM = 0): THREE.Group {
  const group = new THREE.Group();
  group.name = 'shade-sails';
  const checked = normaliseShade(model);
  if (!checked?.enabled || !Number.isFinite(groundElevationM)) return group;
  for (const sail of checked.sails) group.add(sailGroup(sail, groundElevationM));
  return group;
}

const STEEL = new THREE.Color('#9aa3a6');
const POST_LEAN_RAD = (7 * Math.PI) / 180;

function sailGroup(sail: ShadeSail, ground: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `shade-sail-${sail.id}`;
  group.userData = { shadeSailId: sail.id, buildingPart: 'shade-sail' };
  const surface = shadeSailSurface(sail);
  const geometry = new THREE.BufferGeometry();
  const positions = surface.positions.slice();
  for (let i = 1; i < positions.length; i += 3) positions[i] += ground;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(surface.indices);
  geometry.computeVertexNormals();
  const knit = sail.fabric === 'hdpe-knit';
  const membrane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: sail.colour, roughness: knit ? 0.92 : 0.6, metalness: 0, side: THREE.DoubleSide,
    transparent: knit, opacity: knit ? 0.9 : 1, depthWrite: true,
  }));
  membrane.name = `shade-membrane-${sail.id}`;
  membrane.castShadow = true;
  membrane.receiveShadow = true;
  group.add(membrane);
  // Edge cable along the scalloped outline, closed.
  const ring = surface.outline.map(p => new THREE.Vector3(p.x, p.z + ground, p.y));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true, 'centripetal'), ring.length * 2, 0.008, 6, true), new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.7, roughness: 0.35 }));
  cable.name = `shade-cable-${sail.id}`;
  group.add(cable);
  const hardwareMaterial = new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.75, roughness: 0.3 });
  const corners = shadeSailCorners(sail);
  const cx = sail.anchors.reduce((s, a) => s + a.x, 0) / sail.anchors.length, cy = sail.anchors.reduce((s, a) => s + a.y, 0) / sail.anchors.length;
  sail.anchors.forEach((anchor, index) => {
    const corner = corners[index];
    const fixing = new THREE.Vector3(anchor.x, anchor.heightM + ground, anchor.y);
    const sailCorner = new THREE.Vector3(corner.x, corner.z + ground, corner.y);
    // Turnbuckle: the hardware gap between the fixing point and the sail corner.
    const gap = new THREE.Vector3().subVectors(sailCorner, fixing);
    const length = Math.max(0.05, gap.length());
    const turnbuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, length, 8), hardwareMaterial);
    turnbuckle.position.copy(fixing).addScaledVector(gap, 0.5);
    turnbuckle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), gap.clone().normalize());
    turnbuckle.name = `shade-turnbuckle-${anchor.id}`;
    group.add(turnbuckle);
    if (anchor.support === 'post') {
      // The post leans away from the sail centre; its base sits on the ground
      // so the fixing point lands exactly where the plan says.
      const away = new THREE.Vector3(anchor.x - cx, 0, anchor.y - cy);
      if (away.lengthSq() < 1e-9) away.set(1, 0, 0);
      away.normalize();
      const height = anchor.heightM + 0.06;
      const radius = sail.anchors.some(a => Math.hypot(a.x - anchor.x, a.y - anchor.y) > 5) ? 0.07 : 0.05;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), hardwareMaterial);
      const base = new THREE.Vector3(anchor.x - away.x * Math.tan(POST_LEAN_RAD) * anchor.heightM, ground, anchor.y - away.z * Math.tan(POST_LEAN_RAD) * anchor.heightM);
      const axis = new THREE.Vector3().subVectors(fixing, base);
      post.position.copy(base).addScaledVector(axis.clone().normalize(), height / 2);
      post.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
      post.name = `shade-post-${anchor.id}`;
      post.userData = { shadeAnchorId: anchor.id, buildingPart: 'shade-post' };
      post.castShadow = true;
      post.receiveShadow = true;
      group.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.01, radius + 0.01, 0.02, 16), hardwareMaterial);
      cap.position.copy(fixing).addScaledVector(axis.clone().normalize(), 0.06);
      cap.quaternion.copy(post.quaternion);
      cap.name = `shade-post-cap-${anchor.id}`;
      group.add(cap);
    } else {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), hardwareMaterial);
      bracket.position.copy(fixing);
      bracket.name = `shade-bracket-${anchor.id}`;
      bracket.userData = { shadeAnchorId: anchor.id, buildingPart: 'shade-bracket' };
      group.add(bracket);
    }
  });
  return group;
}
