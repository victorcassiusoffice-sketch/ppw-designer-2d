/** Original dimensional Jinko planning preview, with catalog dimensions and a readable cell face. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ItemSolid } from '../../designer/roomSolids';
import { getProductById } from '../../data/products';
import { hasSolarPanelPreview, SOLAR_PANEL_PREVIEW_NOTE } from '../../data/solarPreview';

export function solarPanelPreview(item: ItemSolid): THREE.Group | null {
  if (!hasSolarPanelPreview(item.productId ? getProductById(item.productId) : undefined)) return null;
  const { lengthM: length, widthM: width, heightM: height } = item;
  if (![length, width, height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const root = new THREE.Group();
  root.userData = { key: item.key, instanceId: item.instanceId, body: true, approximatePreview: true, previewKind: 'solar-panel', previewNote: SOLAR_PANEL_PREVIEW_NOTE };
  const frameWidth = Math.min(0.018, Math.min(length, width) / 15);
  const backThickness = Math.min(0.004, height / 4);
  const back = new THREE.Mesh(new THREE.BoxGeometry(length, backThickness, width),
    new THREE.MeshStandardMaterial({ color: '#525b64', roughness: 0.72, metalness: 0.05 }));
  back.name = 'solar-backing'; back.position.y = backThickness / 2; root.add(back);

  const parts: THREE.BufferGeometry[] = [];
  const bar = (x: number, z: number, w: number, d: number) => {
    const geometry = new THREE.BoxGeometry(w, height, d);
    geometry.translate(x, height / 2, z); parts.push(geometry);
  };
  bar(0, -(width - frameWidth) / 2, length, frameWidth);
  bar(0, (width - frameWidth) / 2, length, frameWidth);
  bar(-(length - frameWidth) / 2, 0, frameWidth, width - 2 * frameWidth);
  bar((length - frameWidth) / 2, 0, frameWidth, width - 2 * frameWidth);
  const frame = new THREE.Mesh(mergeGeometries(parts),
    new THREE.MeshStandardMaterial({ color: '#3b424a', roughness: 0.36, metalness: 0.65 }));
  frame.name = 'solar-frame'; root.add(frame); parts.forEach((geometry) => geometry.dispose());

  const innerLength = length - 2 * frameWidth, innerWidth = width - 2 * frameWidth;
  const surfaceY = height - Math.min(0.002, height / 8);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(innerLength, innerWidth),
    new THREE.MeshStandardMaterial({ color: '#71808e', roughness: 0.65, metalness: 0.05 }));
  bed.rotation.x = -Math.PI / 2; bed.position.y = surfaceY - Math.min(0.001, height / 16);
  bed.name = 'solar-cell-grid'; root.add(bed);
  // The sourced Jinko photo has six cells across its short dimension and
  // eighteen along its long dimension. This is a planning mesh, not CAD.
  const positions: number[] = [];
  const gap = Math.min(0.004, innerWidth / 120);
  const cellLength = innerLength / 18, cellWidth = innerWidth / 6;
  for (let row = 0; row < 6; row++) for (let column = 0; column < 18; column++) {
    const x0 = -innerLength / 2 + column * cellLength + gap / 2, x1 = x0 + cellLength - gap;
    const z0 = -innerWidth / 2 + row * cellWidth + gap / 2, z1 = z0 + cellWidth - gap;
    const cut = Math.min(cellLength, cellWidth) * 0.08;
    const ring = [[x0 + cut, z0], [x1 - cut, z0], [x1, z0 + cut], [x1, z1 - cut], [x1 - cut, z1], [x0 + cut, z1], [x0, z1 - cut], [x0, z0 + cut]];
    for (let index = 1; index < ring.length - 1; index++) {
      for (const point of [ring[0], ring[index + 1], ring[index]]) positions.push(point[0], surfaceY, point[1]);
    }
  }
  const cellGeometry = new THREE.BufferGeometry();
  cellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  cellGeometry.computeVertexNormals();
  const cells = new THREE.Mesh(cellGeometry, new THREE.MeshPhysicalMaterial({
    color: '#101924', roughness: 0.48, metalness: 0.02,
    clearcoat: 0.16, clearcoatRoughness: 0.3, envMapIntensity: 0.15,
  }));
  cells.name = 'solar-cells';
  // Selection is already shown by the frame and hull; emissive selection
  // tint would wash out the dark glass and make it look like a pale slab.
  cells.userData.selectionKeepsColour = true;
  root.add(cells);
  root.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
  root.position.set((item.x0 + item.x1) / 2, item.z0, (item.y0 + item.y1) / 2);
  root.rotation.y = -item.rotationDeg * Math.PI / 180;
  return root;
}
