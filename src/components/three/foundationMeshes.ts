import * as THREE from 'three';
import {
  foundationExcavationBounds,
  foundationIsFilled,
  normaliseFoundation,
  type FoundationModel,
} from '../../designer/foundation';
import { foundationSoilFaces } from '../../designer/foundationExcavation';

/** Uses the same centre/length/width/depth as the takeoff and 2D plan. A
 * translucent concrete envelope exposes below-floor coordination in foundation
 * mode. No decorative thickness or reinforcement is added to priced volumes. */
export function foundationMeshes(
  model: FoundationModel,
  groundElevationM = 0,
  translucent = false,
  inspection = false,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'measured-foundation';
  const checked = normaliseFoundation(model);
  if (!checked?.enabled || !Number.isFinite(groundElevationM)) return group;
  const material = new THREE.MeshStandardMaterial({
    color: '#a9afa1',
    roughness: 0.94,
    metalness: 0,
    transparent: translucent,
    opacity: translucent ? 0.42 : 1,
    depthWrite: !translucent,
  });
  for (const element of checked.elements.filter(foundationIsFilled)) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(element.lengthM, element.depthM, element.widthM),
      material,
    );
    mesh.name = `foundation-${element.id}`;
    mesh.position.set(
      element.x,
      groundElevationM + element.topElevationM - element.depthM / 2,
      element.y,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { foundationId: element.id, buildingPart: 'foundation' };
    group.add(mesh);
  }
  if (!checked.elements.some(foundationIsFilled)) material.dispose();
  if (inspection && checked.elements.some((e) => e.excavation)) {
    const soil = new THREE.MeshStandardMaterial({
      color: '#947655',
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const base = new THREE.MeshStandardMaterial({
      color: '#786449',
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const rim = new THREE.MeshStandardMaterial({
      color: '#8c9e69',
      roughness: 1,
      side: THREE.DoubleSide,
    });
    for (const face of foundationSoilFaces(checked, groundElevationM)) {
      const vertices = face.points.flatMap((p) => [p.x, p.z, p.y]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geometry,
        face.kind === 'rim' ? rim : face.kind === 'base' ? base : soil,
      );
      mesh.name = face.key;
      mesh.receiveShadow = true;
      mesh.userData = { buildingPart: 'excavation', quantitySurface: face.kind !== 'rim' };
      group.add(mesh);
    }
    for (const element of checked.elements) {
      const b = foundationExcavationBounds(element);
      if (!b || !element.excavation) continue;
      const a = new THREE.Vector3(b.minX, groundElevationM + b.minElevationM, b.minY);
      const c = new THREE.Vector3(b.minX, groundElevationM + b.maxElevationM, b.minY);
      const line = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints([
          a,
          c,
          a.clone().add(new THREE.Vector3(-0.15, 0, 0)),
          a.clone().add(new THREE.Vector3(0.15, 0, 0)),
          c.clone().add(new THREE.Vector3(-0.15, 0, 0)),
          c.clone().add(new THREE.Vector3(0.15, 0, 0)),
        ]),
        new THREE.LineBasicMaterial({ color: '#f2dfad', depthTest: false }),
      );
      line.name = `excavation-depth-${element.id}`;
      line.userData = {
        depthM: element.excavation.depthM,
        label: `${element.excavation.depthM} m deep`,
      };
      line.renderOrder = 8;
      group.add(line);
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#263d31';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.font = '600 56px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f8ecd4';
          ctx.fillText(
            `${element.excavation.depthM.toLocaleString('en-GB', { maximumFractionDigits: 3 })} m deep`,
            canvas.width / 2,
            canvas.height / 2,
          );
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          const labelMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
          labelMaterial.userData.dressingTextures = [texture];
          const label = new THREE.Sprite(labelMaterial);
          label.name = `excavation-label-${element.id}`;
          label.position.copy(c).add(new THREE.Vector3(0, 0.45, 0));
          label.scale.set(3.2, 0.8, 1);
          label.renderOrder = 9;
          group.add(label);
        }
      }
    }
  }
  return group;
}
