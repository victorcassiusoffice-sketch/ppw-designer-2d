/**
 * joinery — the small things that make a wall read as a wall in a game (3D
 * Mode P3 realism, 2026-09-19): a skirting board along the floor, an
 * architrave and a panelled leaf on every door, a frame, a mullion and a
 * sill on every window. The Sims draws all of these; without them a room is
 * a set of coloured slabs.
 *
 * Everything is built in the WALL'S LOCAL FRAME the stage already uses for
 * a slab (see ThreeStage.slabObject / placeWall): u along the wall (x), v up
 * (y), w through the thickness (z) from the OUTER face at z = 0 to the
 * INNER face at z = thickness (the room side). Openings arrive as spans
 * (t0M..t1M along u, bottomM..topM up).
 *
 * Materials are shared singletons (white-painted timber for frames and
 * skirting, a warm-white leaf) so a room with forty openings costs a
 * handful of draw calls; the metrics are UK/MU standard joinery sizes.
 */
import * as THREE from 'three';
import type { WallOpeningSolid } from '../../designer/roomSolids';

export const SKIRTING_HEIGHT_M = 0.1;
export const SKIRTING_PROUD_M = 0.014;
export const ARCHITRAVE_WIDTH_M = 0.07;
export const ARCHITRAVE_PROUD_M = 0.018;
export const DOOR_LEAF_THICKNESS_M = 0.04;
export const WINDOW_FRAME_M = 0.05;
export const SILL_PROUD_M = 0.04;
export const SILL_THICK_M = 0.03;

const JOINERY_HEX = '#F3F0EA';
const LEAF_HEX = '#EDE8DF';
const HANDLE_HEX = '#8C8A84';

let mats: { joinery: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial; handle: THREE.MeshStandardMaterial } | null = null;
/** Shared joinery materials (created once). Satin white timber, a soft leaf, a brushed handle. */
export function joineryMaterials() {
  if (!mats) {
    mats = {
      joinery: new THREE.MeshStandardMaterial({ color: JOINERY_HEX, roughness: 0.55, metalness: 0 }),
      leaf: new THREE.MeshStandardMaterial({ color: LEAF_HEX, roughness: 0.6, metalness: 0 }),
      handle: new THREE.MeshStandardMaterial({ color: HANDLE_HEX, roughness: 0.35, metalness: 0.6 }),
    };
  }
  return mats;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, castShadow = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

/** The spans of a wall's base (metres along it) that are NOT a door or doorway — where a skirting or a floor shade can run. */
export function doorRuns(lengthM: number, openings: readonly WallOpeningSolid[]): Array<[number, number]> {
  const cuts = openings.filter((o) => o.kind !== 'window' && o.bottomM < SKIRTING_HEIGHT_M).map((o) => [o.t0M, o.t1M] as const).sort((a, b) => a[0] - b[0]);
  let u = 0;
  const runs: Array<[number, number]> = [];
  for (const [t0, t1] of cuts) {
    if (t0 > u + 0.02) runs.push([u, Math.min(t0, lengthM)]);
    u = Math.max(u, t1);
  }
  if (lengthM > u + 0.02) runs.push([u, lengthM]);
  return runs;
}

/**
 * Skirting along the inner face of a wall, interrupted by door / doorway
 * openings (a skirting board never runs across a door). Returns a group in
 * the wall's local frame, or null for a wall with no run left.
 */
export function skirtingObject(lengthM: number, thicknessM: number, openings: readonly WallOpeningSolid[], heightM: number): THREE.Group | null {
  if (heightM < SKIRTING_HEIGHT_M + 0.02) return null;
  const { joinery } = joineryMaterials();
  const g = new THREE.Group();
  for (const [a, b] of doorRuns(lengthM, openings)) {
    const len = b - a;
    // Proud of the inner face, into the room: z from thickness to thickness + proud.
    g.add(box(len, SKIRTING_HEIGHT_M, SKIRTING_PROUD_M, joinery, a + len / 2, SKIRTING_HEIGHT_M / 2, thicknessM + SKIRTING_PROUD_M / 2, false));
  }
  if (g.children.length === 0) return null;
  g.userData = { joinery: 'skirting' };
  return g;
}

/**
 * A door: an architrave on the room side, and for a real door (not a
 * doorway) a closed panelled leaf in the middle of the opening with a lever
 * handle. In the wall's local frame.
 */
export function doorObject(o: WallOpeningSolid, thicknessM: number, wallHeightM: number): THREE.Group {
  const { joinery, leaf, handle } = joineryMaterials();
  const g = new THREE.Group();
  const w = o.t1M - o.t0M;
  const top = Math.min(o.topM, wallHeightM);
  const h = top - o.bottomM;
  const cx = (o.t0M + o.t1M) / 2;
  const zIn = thicknessM + ARCHITRAVE_PROUD_M / 2; // proud of the inner face
  const aw = ARCHITRAVE_WIDTH_M;
  // Architrave: two jambs and a head, on the room side.
  g.add(box(aw, h + aw, ARCHITRAVE_PROUD_M, joinery, o.t0M - aw / 2, o.bottomM + (h + aw) / 2, zIn, false));
  g.add(box(aw, h + aw, ARCHITRAVE_PROUD_M, joinery, o.t1M + aw / 2, o.bottomM + (h + aw) / 2, zIn, false));
  g.add(box(w + 2 * aw, aw, ARCHITRAVE_PROUD_M, joinery, cx, top + aw / 2, zIn, false));
  // Door lining inside the reveal (thin, covers the raw reveal at the jambs).
  const lining = 0.012;
  g.add(box(lining, h, thicknessM, joinery, o.t0M + lining / 2, o.bottomM + h / 2, thicknessM / 2, false));
  g.add(box(lining, h, thicknessM, joinery, o.t1M - lining / 2, o.bottomM + h / 2, thicknessM / 2, false));
  g.add(box(w, lining, thicknessM, joinery, cx, top - lining / 2, thicknessM / 2, false));
  if (o.kind === 'door') {
    const zLeaf = thicknessM / 2;
    const lw = w - 2 * lining - 0.006;
    const lh = h - lining - 0.008;
    const leafMesh = box(lw, lh, DOOR_LEAF_THICKNESS_M, leaf, cx, o.bottomM + lh / 2 + 0.004, zLeaf, true);
    g.add(leafMesh);
    // Six raised panels (two columns, three rows) on both faces read as a panelled door.
    const px = lw * 0.36;
    const rows = [0.16, 0.5, 0.84];
    const ph = lh * 0.22;
    for (const face of [1, -1]) {
      for (const col of [-1, 1]) {
        for (const r of rows) {
          g.add(box(px, ph, 0.008, leaf, cx + col * lw * 0.24, o.bottomM + 0.004 + lh * r, zLeaf + face * (DOOR_LEAF_THICKNESS_M / 2 + 0.004), false));
        }
      }
    }
    // Lever handle at 1.0 m, on the room side, on the opening side away from the hinge.
    const hy = o.bottomM + Math.min(1.0, lh * 0.55);
    const hx = cx + lw * 0.38;
    for (const face of [1, -1]) {
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 16), handle);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(hx, hy, zLeaf + face * (DOOR_LEAF_THICKNESS_M / 2 + 0.005));
      g.add(rose);
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.11, 10), handle);
      lever.rotation.z = Math.PI / 2;
      lever.position.set(hx - 0.045, hy, zLeaf + face * (DOOR_LEAF_THICKNESS_M / 2 + 0.03));
      g.add(lever);
    }
  }
  g.userData = { joinery: o.kind };
  return g;
}

/**
 * A window: a frame around the reveal, a vertical mullion, and a sill on the
 * room side. The stage's glass pane sits in the middle of the thickness
 * already; this dresses it. In the wall's local frame.
 */
export function windowObject(o: WallOpeningSolid, thicknessM: number, wallHeightM: number): THREE.Group {
  const { joinery } = joineryMaterials();
  const g = new THREE.Group();
  const w = o.t1M - o.t0M;
  const top = Math.min(o.topM, wallHeightM);
  const h = top - o.bottomM;
  const cx = (o.t0M + o.t1M) / 2;
  const cy = (o.bottomM + top) / 2;
  const f = WINDOW_FRAME_M;
  const fd = Math.min(0.06, thicknessM * 0.5); // frame depth through the reveal
  const zf = thicknessM / 2; // centred on the pane
  // Frame: jambs, head, bottom rail, all inside the reveal.
  g.add(box(f, h, fd, joinery, o.t0M + f / 2, cy, zf, false));
  g.add(box(f, h, fd, joinery, o.t1M - f / 2, cy, zf, false));
  g.add(box(w, f, fd, joinery, cx, top - f / 2, zf, false));
  g.add(box(w, f, fd, joinery, cx, o.bottomM + f / 2, zf, false));
  // A mullion when the window is wide enough for two lights.
  if (w > 0.9) g.add(box(0.04, h - 2 * f, fd * 0.8, joinery, cx, cy, zf, false));
  // Sill on the room side: proud of the inner face, a little wider than the opening.
  g.add(box(w + 0.08, SILL_THICK_M, thicknessM * 0.4 + SILL_PROUD_M, joinery, cx, o.bottomM - SILL_THICK_M / 2, thicknessM - (thicknessM * 0.4) / 2 + SILL_PROUD_M / 2, false));
  g.userData = { joinery: 'window' };
  return g;
}

/** Everything joinery for one wall (skirting + every opening), in the wall's local frame. */
export function wallJoinery(lengthM: number, thicknessM: number, heightM: number, openings: readonly WallOpeningSolid[]): THREE.Group {
  const g = new THREE.Group();
  const sk = skirtingObject(lengthM, thicknessM, openings, heightM);
  if (sk) g.add(sk);
  for (const o of openings) {
    if (o.bottomM >= heightM) continue;
    g.add(o.kind === 'window' ? windowObject(o, thicknessM, heightM) : doorObject(o, thicknessM, heightM));
  }
  g.userData = { joinery: 'wall' };
  return g;
}
