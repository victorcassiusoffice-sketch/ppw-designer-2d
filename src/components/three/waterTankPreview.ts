/** Original dimensional planning body; no manufacturer mesh or copied artwork. */
import * as THREE from 'three';
import type { ItemSolid } from '../../designer/roomSolids';
import { getProductById } from '../../data/products';

export function waterTankPreview(item: ItemSolid): THREE.Group | null {
  const product = item.productId ? getProductById(item.productId) : undefined;
  if (product?.sku !== 'DURACO-WATER-CYL-1000') return null;
  const { lengthM: length, widthM: width, heightM: height } = item;
  if (![length, width, height].every(value => Number.isFinite(value) && value > 0)) return null;
  const root = new THREE.Group();
  root.userData = { key: item.key, instanceId: item.instanceId, body: true, approximatePreview: true,
    previewKind: 'water-tank', previewNote: 'Original dimensional tank preview — confirm colour and fittings with Duraco.' };
  // Normalised geometry retains the manufacturer's overall envelope after fitting.
  // The ribs and curved shoulders are illustrative moulding details.
  const profile = [
    [0, 0], [.44, 0], [.485, .025], [.49, .08], [.475, .10], [.48, .16],
    [.5, .175], [.5, .195], [.478, .21], [.478, .31], [.5, .325], [.5, .345],
    [.478, .36], [.478, .46], [.5, .475], [.5, .495], [.478, .51], [.478, .61],
    [.5, .625], [.5, .645], [.478, .66], [.478, .75], [.49, .77], [.485, .81],
    [.46, .845], [.41, .885], [.32, .925], [.22, .945], [0, .945],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64),
    new THREE.MeshStandardMaterial({ color: '#52624b', roughness: .82, metalness: 0 }));
  body.name = 'tank-ribbed-body'; root.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(.225, .225, .055, 48),
    new THREE.MeshStandardMaterial({ color: '#354331', roughness: .88 }));
  lid.position.y = .9725; lid.name = 'tank-screw-lid'; root.add(lid);
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .055, 16),
    new THREE.MeshStandardMaterial({ color: '#bab4a2', roughness: .55, metalness: .15 }));
  outlet.rotation.x = Math.PI / 2; outlet.position.set(0, .085, .465);
  outlet.name = 'tank-outlet'; root.add(outlet);
  root.scale.set(length, height, width);
  root.position.set((item.x0 + item.x1) / 2, item.z0, (item.y0 + item.y1) / 2);
  root.rotation.y = -item.rotationDeg * Math.PI / 180;
  root.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
  return root;
}
