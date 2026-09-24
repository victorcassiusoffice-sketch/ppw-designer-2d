/**
 * Dimensional furniture previews for the existing, sourced Courts range.
 * These are purpose-built planning silhouettes, NOT manufacturer models or
 * product photographs. The catalog remains the source of size and price;
 * no extra objects are placed and an available product GLTF takes priority.
 *
 * Each body owns its geometry, materials and small surface maps. Parts are
 * merged by material once on construction to keep the phone draw count low.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ItemSolid } from '../../designer/roomSolids';
import { itemPose } from '../../designer/fitToSize';
import { furniturePreviewKind, FURNITURE_PREVIEW_NOTE } from '../../data/dimensionalPreview';

/** Small neutral height maps add fabric weave / wood pores, never a fake photo. */
function surfaceMap(kind: 'fabric' | 'wood'): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const weave = ((x % 4 < 2) === (y % 4 < 2) ? 14 : -14);
    const grain = Math.sin((x + Math.sin(y * 0.17) * 0.75) * 1.6) * 18;
    const value = 128 + (kind === 'fabric' ? weave : grain);
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(kind === 'fabric' ? 5 : 2, kind === 'fabric' ? 5 : 1);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

class Parts {
  readonly root = new THREE.Group();
  readonly textures: THREE.Texture[] = [];
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly maps = new Map<string, THREE.DataTexture>();

  material(name: string, color: string, finish: 'fabric' | 'wood' | 'metal' | 'stone' | 'glass' | 'enamel' | 'screen' = 'wood'): THREE.MeshStandardMaterial {
    const existing = this.materials.get(name);
    if (existing) return existing;
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: finish === 'fabric' ? 0.88 : finish === 'metal' ? 0.34 : finish === 'stone' ? 0.4 : finish === 'glass' || finish === 'screen' ? 0.16 : finish === 'enamel' ? 0.28 : 0.63,
      metalness: finish === 'metal' ? 0.65 : 0,
      sheen: finish === 'fabric' ? 0.22 : 0,
      sheenRoughness: 0.8,
      sheenColor: finish === 'fabric' ? color : '#000000',
      transparent: finish === 'glass',
      opacity: finish === 'glass' ? 0.55 : 1,
      depthWrite: finish !== 'glass',
      clearcoat: finish === 'screen' ? 0.95 : finish === 'enamel' ? 0.35 : 0,
      clearcoatRoughness: finish === 'screen' ? 0.12 : 0.25,
    });
    material.name = name;
    if (finish === 'fabric' || finish === 'wood') {
      let map = this.maps.get(finish);
      if (!map) {
        map = surfaceMap(finish);
        this.maps.set(finish, map);
        this.textures.push(map);
      }
      material.bumpMap = map;
      material.bumpScale = finish === 'fabric' ? 0.002 : 0.001;
    }
    this.materials.set(name, material);
    return material;
  }

  box(name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material, radius = 0): THREE.Mesh {
    const [w, h, d] = size;
    const geometry = radius > 0
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3))
      : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    this.root.add(mesh);
    return mesh;
  }

  rod(name: string, from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material): void {
    const direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    this.root.add(mesh);
  }

  cylinder(name: string, radii: [number, number], height: number, position: [number, number, number], material: THREE.Material, open = false): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radii[0], radii[1], height, 20, 1, open);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    this.root.add(mesh);
    return mesh;
  }

  legs(w: number, d: number, height: number, material: THREE.Material, inset = 0.08): void {
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      this.box('leg', [Math.min(w, d) * 0.075, height, Math.min(w, d) * 0.075], [x * w * (0.5 - inset), height / 2, z * d * (0.5 - inset)], material, 0.006);
    }
  }

  /** At most one draw per material, with no shared geometry between instances. */
  merge(): THREE.Group {
    this.root.updateMatrixWorld(true);
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const names: string[] = [];
    for (const child of this.root.children) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      names.push(mesh.name);
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const list = groups.get(mesh.material) ?? [];
      list.push(geometry);
      groups.set(mesh.material, list);
      mesh.geometry.dispose();
    }
    const group = new THREE.Group();
    for (const [material, geometries] of groups) {
      const merged = mergeGeometries(geometries, false)!;
      geometries.forEach((geometry) => geometry.dispose());
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = material.name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    group.userData.previewParts = names;
    return group;
  }
}

function sofa(p: Parts, w: number, d: number, h: number, corner: boolean): void {
  const upholstery = p.material('upholstery', corner ? '#8b343a' : '#79665a', 'fabric');
  const cushion = p.material('seat cushions', corner ? '#a64346' : '#927e6c', 'fabric');
  const accent = p.material('scatter cushions', corner ? '#d3b7a1' : '#c8b59e', 'fabric');
  const legs = p.material('dark timber legs', '#302923');
  p.legs(w, d, h * 0.14, legs);
  p.box('upholstered frame', [w * 0.97, h * 0.24, d * 0.95], [0, h * 0.24, 0], upholstery, h * 0.05);
  p.box('sofa back', [w * 0.98, h * 0.68, d * 0.18], [0, h * 0.66, -d * 0.41], upholstery, h * 0.06);
  const armWidth = Math.min(w * 0.12, d * 0.18);
  for (const side of [-1, 1]) p.box('rounded arm', [armWidth, h * 0.51, d], [side * (w - armWidth) / 2, h * 0.415, 0], upholstery, armWidth * 0.3);
  const count = corner ? 1 : 3;
  const seatWidth = (w - armWidth * 2.1) / count;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * seatWidth;
    p.box('individual seat cushion', [seatWidth * 0.97, h * 0.16, d * 0.74], [x, h * 0.42, d * 0.065], cushion, h * 0.055);
    p.box('back cushion', [seatWidth * 0.97, h * 0.39, d * 0.15], [x, h * 0.73, -d * 0.235], cushion, h * 0.065);
    const pillow = p.box('scatter pillow', [Math.min(seatWidth * 0.6, h * 0.31), h * 0.29, d * 0.12], [x + seatWidth * 0.13, h * 0.62, -d * 0.085], accent, h * 0.07);
    pillow.rotation.z = i % 2 ? 0.13 : -0.13;
  }
}

function bed(p: Parts, w: number, d: number, h: number): void {
  const oak = p.material('oak bed frame', '#827361');
  const linen = p.material('ivory linen', '#ece7df', 'fabric');
  const duvet = p.material('muted blue duvet', '#6a8188', 'fabric');
  const fold = p.material('duvet fold', '#91a1a4', 'fabric');
  p.legs(w, d, h * 0.18, oak);
  p.box('bed frame', [w, h * 0.21, d], [0, h * 0.27, 0], oak, 0.015);
  p.box('headboard', [w, h * 0.87, d * 0.045], [0, h * 0.565, -d * 0.475], oak, 0.018);
  p.box('mattress', [w * 0.94, h * 0.23, d * 0.94], [0, h * 0.47, d * 0.02], linen, h * 0.055);
  p.box('duvet', [w * 0.955, h * 0.07, d * 0.65], [0, h * 0.61, d * 0.16], duvet, 0.02);
  p.box('folded duvet edge', [w * 0.94, h * 0.075, d * 0.11], [0, h * 0.645, -d * 0.13], fold, 0.025);
  for (const side of [-1, 1]) p.box('pillow', [w * 0.37, h * 0.12, d * 0.21], [side * w * 0.245, h * 0.64, -d * 0.325], linen, h * 0.05);
  // A few stitched channels catch grazing light without a large texture.
  for (const side of [-1, 0, 1]) p.box('duvet seam', [0.003, 0.002, d * 0.5], [side * w * 0.23, h * 0.647, d * 0.18], fold);
}

function table(p: Parts, w: number, d: number, h: number, kind: 'coffee' | 'desk' | 'dining'): void {
  const frame = p.material('table frame', kind === 'coffee' ? '#262d31' : kind === 'desk' ? '#a58764' : '#473428', kind === 'coffee' ? 'metal' : 'wood');
  const top = p.material('table top', kind === 'coffee' ? '#999a94' : kind === 'desk' ? '#bed1d2' : '#503c2d', kind === 'coffee' ? 'stone' : kind === 'desk' ? 'glass' : 'wood');
  const thickness = Math.min(0.06, h * 0.12);
  p.legs(w, d, h - thickness, frame);
  p.box('table surface', [w, thickness, d], [0, h - thickness / 2, 0], top, 0.012);
  if (kind === 'coffee') {
    for (const z of [-1, 1]) p.box('lower frame rail', [w * 0.9, 0.025, 0.025], [0, h * 0.15, z * d * 0.42], frame);
  } else {
    for (const z of [-1, 1]) p.box('table apron', [w * 0.84, h * 0.12, 0.035], [0, h * 0.83, z * d * 0.39], frame);
  }
}

function dining(p: Parts, w: number, d: number, h: number): void {
  // Published 150×90 table within the catalog's 240×180 set footprint.
  table(p, w * 150 / 240, d * 90 / 180, h * 0.83, 'dining');
  const wood = p.material('chair timber', '#473428');
  const seat = p.material('dining seat', '#a28c74', 'fabric');
  const cw = w * 0.17;
  const cd = d * 0.235;
  const chair = (x: number, z: number, angle: number) => {
    const before = p.root.children.length;
    p.legs(cw, cd, h * 0.43, wood, 0.12);
    p.box('dining chair seat', [cw, h * 0.075, cd], [0, h * 0.45, 0], seat, 0.016);
    for (const side of [-1, 1]) p.box('dining chair back post', [0.025, h * 0.61, 0.025], [side * cw * 0.43, h * 0.695, -cd * 0.43], wood);
    p.box('dining chair back', [cw, h * 0.23, 0.035], [0, h * 0.88, -cd * 0.44], wood, 0.008);
    for (const child of p.root.children.slice(before)) {
      child.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(new THREE.Vector3(x, 0, z));
      child.rotation.y += angle;
    }
  };
  for (const x of [-w * 0.2, w * 0.2]) {
    chair(x, -d * 0.382, 0);
    chair(x, d * 0.382, Math.PI);
  }
  chair(-w * 0.41, 0, Math.PI / 2);
  chair(w * 0.41, 0, -Math.PI / 2);
}

function officeChair(p: Parts, w: number, d: number, h: number): void {
  const frame = p.material('chair frame', '#343b42', 'metal');
  const fabric = p.material('grey chair mesh', '#969fa7', 'fabric');
  const seat = p.material('blue chair fabric', '#466776', 'fabric');
  p.rod('gas lift', new THREE.Vector3(0, h * 0.06, 0), new THREE.Vector3(0, h * 0.38, 0), w * 0.035, frame);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const x = Math.sin(angle) * w * 0.43;
    const z = Math.cos(angle) * d * 0.43;
    p.rod('caster spoke', new THREE.Vector3(0, h * 0.11, 0), new THREE.Vector3(x, h * 0.05, z), w * 0.022, frame);
    p.box('caster', [w * 0.07, h * 0.06, d * 0.09], [x, h * 0.03, z], frame, 0.01);
  }
  p.box('chair seat cushion', [w * 0.84, h * 0.075, d * 0.77], [0, h * 0.39, d * 0.06], seat, 0.035);
  p.box('chair back frame', [w * 0.76, h * 0.46, d * 0.12], [0, h * 0.67, -d * 0.34], frame, 0.035);
  p.box('chair back mesh', [w * 0.67, h * 0.41, d * 0.13], [0, h * 0.67, -d * 0.325], fabric, 0.03);
  p.box('headrest', [w * 0.48, h * 0.11, d * 0.13], [0, h * 0.945, -d * 0.32], fabric, 0.025);
  for (const side of [-1, 1]) {
    p.box('arm support', [w * 0.045, h * 0.18, d * 0.05], [side * w * 0.47, h * 0.47, 0], frame);
    p.box('arm pad', [w * 0.075, h * 0.04, d * 0.42], [side * w * 0.46, h * 0.56, d * 0.05], frame, 0.01);
  }
}

function storage(p: Parts, w: number, d: number, h: number, kind: 'cabinet' | 'wardrobe' | 'shelf', id: string): void {
  const pale = id.includes('arte') || id.includes('aurum') || id.includes('nexus');
  const timber = p.material('cabinet timber', id.includes('malden') ? '#884143' : pale ? '#b5a184' : '#8d7458');
  const front = p.material('cabinet fronts', pale ? '#e4e0d5' : '#a58c6d');
  const inside = p.material('cabinet interior', '#615649');
  const handle = p.material('cabinet handles', '#5c5b57', 'metal');
  const t = Math.min(0.035, w * 0.06, h * 0.05);
  const base = kind === 'cabinet' ? h * 0.12 : h * 0.04;
  p.box('recessed plinth', [w * 0.91, base, d * 0.87], [0, base / 2, 0], inside);
  for (const side of [-1, 1]) p.box('cabinet side', [t, h - base, d], [side * (w - t) / 2, (h + base) / 2, 0], timber);
  for (const y of [base, h - t]) p.box('cabinet shelf', [w, t, d], [0, y + t / 2, 0], timber);
  p.box('cabinet back', [w - t, h - base, t], [0, (h + base) / 2, -d / 2 + t / 2], inside);
  if (kind === 'shelf') {
    const tiers = id.includes('malden') ? 5 : 3;
    for (let i = 1; i < tiers; i++) p.box('open shelf', [w - t * 2, t, d], [0, base + (h - base) * i / tiers, 0], timber);
    return;
  }
  const columns = kind === 'wardrobe' ? 4 : w > 1.7 ? 3 : w > 0.6 ? 2 : 1;
  const panelWidth = (w - 2 * t) / columns;
  for (let i = 0; i < columns; i++) {
    const x = -w / 2 + t + panelWidth * (i + 0.5);
    const rows = kind === 'cabinet' && (columns === 1 || i === Math.floor(columns / 2)) ? 3 : 1;
    const rowHeight = (h - base - t * 2) / rows;
    for (let r = 0; r < rows; r++) {
      const y = base + t + rowHeight * (r + 0.5);
      p.box(rows > 1 ? 'drawer front' : 'door panel', [panelWidth - 0.009, rowHeight - 0.008, t], [x, y, d / 2 - t * 0.65], front, 0.003);
      p.box('handle', [Math.min(0.14, panelWidth * 0.5), 0.012, 0.018], [x, rows > 1 ? y + rowHeight * 0.3 : y, d / 2 - 0.004], handle, 0.003);
    }
  }
}

function appliance(p: Parts, w: number, d: number, h: number, kind: 'fridge' | 'tv'): void {
  const metal = p.material('appliance body', kind === 'fridge' ? '#aab1b3' : '#20262c', 'metal');
  const dark = p.material('appliance trim', '#192027', 'enamel');
  if (kind === 'fridge') {
    const door = p.material('satin steel doors', '#c2c8c8', 'metal');
    p.legs(w, d, h * 0.025, dark, 0.14);
    p.box('fridge cabinet', [w, h * 0.975, d * 0.9], [0, h * 0.5125, -d * 0.05], metal, 0.018);
    // A visible gasket and separate bottom-freezer door catch light at the seam.
    p.box('door gasket', [w * 0.985, h * 0.965, d * 0.018], [0, h * 0.51, d * 0.405], dark, 0.007);
    for (const [y, height] of [[h * 0.202, h * 0.341], [h * 0.69, h * 0.607]]) {
      p.box('fridge door', [w * 0.985, height, d * 0.085], [0, y, d * 0.4575], door, 0.012);
    }
    p.box('upper recessed handle', [w * 0.72, h * 0.01, d * 0.018], [0, h * 0.394, d * 0.497], dark, 0.003);
    p.box('freezer recessed handle', [w * 0.72, h * 0.01, d * 0.018], [0, h * 0.362, d * 0.497], dark, 0.003);
    p.box('fridge lower plinth', [w * 0.89, h * 0.02, d * 0.06], [0, h * 0.027, d * 0.43], dark, 0.003);
  } else {
    const screen = p.material('unlit reflective screen', '#101e2a', 'screen');
    // Both supported sets are wall mounted in the catalog: no invented stand.
    p.box('television bezel', [w, h, d * 0.36], [0, h / 2, d * 0.32], metal, 0.006);
    p.box('television screen', [w * 0.976, h * 0.945, d * 0.025], [0, h * 0.509, d * 0.491], screen, 0.003);
    p.box('television rear housing', [w * 0.61, h * 0.57, d * 0.68], [0, h * 0.325, -d * 0.16], dark, 0.012);
    p.box('lower television bezel', [w * 0.99, h * 0.031, d * 0.38], [0, h * 0.018, d * 0.311], dark, 0.003);
    for (let i = 0; i < 12; i++) {
      p.box('rear ventilation slot', [w * 0.009, h * 0.11, d * 0.012], [(i - 5.5) * w * 0.033, h * 0.47, -d * 0.501], metal);
    }
  }
}

function airConditioner(p: Parts, w: number, d: number, h: number): void {
  const shell = p.material('white appliance enamel', '#eceeea', 'enamel');
  const seam = p.material('casing seams', '#bbc3c4', 'enamel');
  const vent = p.material('air outlet', '#283338', 'enamel');
  p.box('split unit casing', [w, h, d * 0.92], [0, h / 2, -d * 0.04], shell, Math.min(h * 0.14, d * 0.14));
  p.box('front cover seam', [w * 0.967, h * 0.63, d * 0.015], [0, h * 0.656, d * 0.423], seam, h * 0.055);
  p.box('curved front cover', [w * 0.96, h * 0.61, d * 0.12], [0, h * 0.663, d * 0.44], shell, h * 0.05);
  p.box('recessed outlet', [w * 0.9, h * 0.19, d * 0.04], [0, h * 0.2, d * 0.43], vent, h * 0.018);
  for (let i = 0; i < 9; i++) {
    p.box('air direction vane', [w * 0.004, h * 0.145, d * 0.045], [(i - 4) * w * 0.092, h * 0.2, d * 0.458], seam);
  }
  const louvre = p.box('air outlet louvre', [w * 0.91, h * 0.048, d * 0.2], [0, h * 0.14, d * 0.435], shell, h * 0.012);
  louvre.rotation.x = -0.2;
  p.box('status window', [w * 0.05, h * 0.035, d * 0.015], [w * 0.36, h * 0.43, d * 0.507], vent, h * 0.01);
}

function lamp(p: Parts, w: number, d: number, h: number, pendant: boolean, id: string): void {
  const bamboo = id.includes('bamboo');
  const wood = bamboo || id.includes('wood-d25');
  const marble = id.includes('marble');
  const black = id.includes('black-canopy');
  const frame = p.material('lamp stem', marble ? '#a98a4a' : black ? '#252a2b' : '#8e7760', wood ? 'wood' : 'metal');
  const base = p.material('lamp base', marble ? '#d9d9d0' : wood ? '#ac8559' : '#b4a287', wood ? 'wood' : marble ? 'stone' : 'enamel');
  const shade = p.material('lamp shade', black ? '#343638' : '#e6d9be', black ? 'metal' : 'fabric');
  shade.side = THREE.DoubleSide;
  const radius = Math.min(w, d) / 2;
  if (pendant) {
    p.cylinder('ceiling rose', [radius * 0.23, radius * 0.23], h * 0.045, [0, h * 0.9775, 0], frame);
    p.cylinder('pendant cord', [radius * 0.02, radius * 0.02], h * 0.685, [0, h * 0.6125, 0], frame);
    p.cylinder('pendant shade', [radius * 0.33, radius], h * 0.28, [0, h * 0.14, 0], shade, true);
    p.cylinder('shade lower rim', [radius, radius], h * 0.012, [0, h * 0.006, 0], frame, true);
  } else if (bamboo) {
    p.cylinder('bamboo lamp foot', [radius, radius], h * 0.06, [0, h * 0.03, 0], base);
    p.cylinder('lamp diffuser', [radius * 0.8, radius * 0.8], h * 0.89, [0, h * 0.51, 0], shade);
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      p.cylinder('bamboo shade slat', [radius * 0.045, radius * 0.045], h * 0.94, [Math.sin(angle) * radius * 0.95, h * 0.53, Math.cos(angle) * radius * 0.95], frame);
    }
    p.cylinder('bamboo top rim', [radius, radius], h * 0.035, [0, h * 0.9825, 0], base, true);
  } else {
    p.cylinder('table lamp foot', [radius * 0.58, radius * 0.62], h * 0.06, [0, h * 0.03, 0], base);
    if (marble || wood) {
      p.cylinder('table lamp post', [radius * 0.055, radius * 0.08], h * 0.64, [0, h * 0.38, 0], frame);
    } else {
      p.cylinder('ceramic lamp body', [radius * 0.22, radius * 0.46], h * 0.38, [0, h * 0.25, 0], base);
      p.cylinder('ceramic lamp neck', [radius * 0.12, radius * 0.22], h * 0.18, [0, h * 0.53, 0], base);
    }
    p.cylinder('tapered fabric shade', [radius * 0.7, radius], h * 0.38, [0, h * 0.81, 0], shade, true);
    p.cylinder('shade lower seam', [radius, radius], h * 0.012, [0, h * 0.626, 0], shade, true);
  }
}

/** Returns null for every product without an explicitly supported preview. */
export function furniturePreview(it: ItemSolid): THREE.Group | null {
  const kind = furniturePreviewKind(it.productId);
  if (!kind || ![it.lengthM, it.widthM, it.heightM].every((value) => Number.isFinite(value) && value > 0)) return null;
  const p = new Parts();
  const [w, d, h] = [it.lengthM, it.widthM, it.heightM];
  switch (kind) {
    case 'sofa': case 'corner': sofa(p, w, d, h, kind === 'corner'); break;
    case 'bed': bed(p, w, d, h); break;
    case 'coffee': case 'desk': table(p, w, d, h, kind); break;
    case 'dining': dining(p, w, d, h); break;
    case 'chair': officeChair(p, w, d, h); break;
    case 'cabinet': case 'wardrobe': case 'shelf': storage(p, w, d, h, kind, it.productId!); break;
    case 'fridge': case 'tv': appliance(p, w, d, h, kind); break;
    case 'air-conditioner': airConditioner(p, w, d, h); break;
    case 'table-lamp': case 'pendant': lamp(p, w, d, h, kind === 'pendant', it.productId!); break;
  }
  const model = p.merge();
  model.rotation.y = it.frontEdge === 'top' ? Math.PI : it.frontEdge === 'left' ? -Math.PI / 2 : it.frontEdge === 'right' ? Math.PI / 2 : 0;
  // Normalize AFTER the catalog front turn: a left/right front must still
  // occupy length along plan x and width along plan y, never swap the box.
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const fitted = new THREE.Group();
  fitted.scale.set(w / size.x, h / size.y, d / size.z);
  model.position.set(-centre.x, -bounds.min.y, -centre.z);
  fitted.add(model);
  const pose = itemPose({ x: it.x0, y: it.y0, footprintW: it.x1 - it.x0, footprintH: it.y1 - it.y0, rotationDeg: it.rotationDeg, z0: it.z0 });
  const root = new THREE.Group();
  root.position.set(pose.centre.x, pose.centre.z, pose.centre.y);
  root.rotation.y = pose.yawRad;
  root.add(fitted);
  root.userData = { key: it.key, instanceId: it.instanceId, body: true, approximatePreview: true, previewKind: kind, previewNote: FURNITURE_PREVIEW_NOTE, previewParts: model.userData.previewParts, furnitureTextures: p.textures };
  return root;
}

/** The stage also disposes meshes/materials; these private maps need ownership. */
export function disposeFurnitureTextures(root: THREE.Object3D): void {
  const seen = new Set<THREE.Texture>();
  root.traverse((object) => {
    const textures = object.userData.furnitureTextures as THREE.Texture[] | undefined;
    for (const texture of textures ?? []) {
      if (!seen.has(texture)) texture.dispose();
      seen.add(texture);
    }
    if (textures) object.userData.furnitureTextures = [];
  });
}
