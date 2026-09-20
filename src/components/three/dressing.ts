/**
 * dressing — the set dressing that turns coloured slabs into a room (3D Mode
 * P3 realism, 2026-09-19): a sky dome that goes from noon to night, a ground
 * that recedes, real floor surfaces, soft corner shading where walls meet
 * the floor and each other (the cheap, phone-safe stand-in for ambient
 * occlusion), contact shadows under every body, and warm lights that come
 * on after dark.
 *
 * Every builder returns plain three objects for ThreeStage to add; none of
 * them touches the renderer. Colour-truth law: nothing here lights a
 * painted wall — the shades are alpha-blended darkening only where a game
 * artist would bake occlusion, and the day rig (see ThreeStage) is unchanged
 * at the default hour, so the measured pixels stay measured.
 */
import * as THREE from 'three';
import type { FloorSolid, ItemSolid, WallOpeningSolid, WallSolid } from '../../designer/roomSolids';
import { GROUND_HEX } from '../../designer/roomView3d';
import { cornerShadeTexture, floorSurface, groundTexture, skyTexture, softShadowTexture, type FloorKind } from './surfaces';
import { doorRuns } from './joinery';

export const SKY_RADIUS_M = 220;
/** How dark the corner shading gets right at the junction (alpha). */
export const CORNER_SHADE_ALPHA = 0.16;
export const CORNER_SHADE_FLOOR_M = 0.22;
export const CORNER_SHADE_WALL_M = 0.18;
export const CORNER_SHADE_VERTICAL_M = 0.14;
export const CONTACT_SHADOW_ALPHA = 0.3;
export const CONTACT_SHADOW_MARGIN_M = 0.1;

// ---------------------------------------------------------------------------
// Sky + ground.
// ---------------------------------------------------------------------------
/** An inside-out sphere carrying the sky gradient; unlit, drawn first, never writes depth. */
export function skyDome(day: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(SKY_RADIUS_M, 32, 20);
  const mat = new THREE.MeshBasicMaterial({ map: skyTexture(day), side: THREE.BackSide, depthWrite: false, fog: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -10;
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.userData = { sky: true, day };
  return dome;
}

/** Re-tint the dome for another hour (day 0..1). */
export function updateSkyDome(dome: THREE.Mesh, day: number): void {
  const mat = dome.material as THREE.MeshBasicMaterial;
  mat.map?.dispose();
  mat.map = skyTexture(day);
  mat.needsUpdate = true;
  dome.userData.day = day;
}

/** The ground plane: the plot's neutral ground with a soft radial fall-off so distance reads. */
export function groundPlane(): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: GROUND_HEX, map: groundTexture(), roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  ground.name = 'ground';
  return ground;
}

// ---------------------------------------------------------------------------
// Floors.
// ---------------------------------------------------------------------------
/**
 * A room's floor as a real surface: the laid product's grain and joints at
 * real size, its hex, its sheen. ShapeGeometry UVs are the shape's own
 * coordinates — plan metres — so a texture repeated `1/tile` per metre
 * lands one joint per real tile.
 */
export function floorMesh(f: FloorSolid, kind: FloorKind, tileM: number, env: THREE.Texture | null): THREE.Mesh {
  const shape = new THREE.Shape(f.polygon.map((v) => new THREE.Vector2(v.x, v.y)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2); // plan (x, y) → three (x, 0, y)
  const s = floorSurface(kind, tileM);
  const mat = new THREE.MeshPhysicalMaterial({
    color: f.hex,
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(s.normalScale, s.normalScale),
    roughness: s.roughness,
    metalness: 0,
    side: THREE.DoubleSide,
    specularIntensity: s.sheen,
    envMap: s.sheen > 0 ? env : null,
    envMapIntensity: s.sheen * 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.001;
  mesh.receiveShadow = true;
  mesh.userData = { key: f.key, floor: true, kind };
  return mesh;
}

// ---------------------------------------------------------------------------
// Corner shading — the occlusion a game bakes, drawn as alpha strips.
// ---------------------------------------------------------------------------
function shadeMaterial(flip: boolean): THREE.MeshBasicMaterial {
  const tex = cornerShadeTexture().clone();
  tex.needsUpdate = true;
  if (flip) {
    tex.repeat.set(1, -1);
    tex.offset.set(0, 1);
  }
  return new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: CORNER_SHADE_ALPHA, alphaMap: tex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}

/**
 * Corner shading for one wall, in the WALL'S LOCAL FRAME (u along, v up, w
 * through; inner face at z = thickness): a strip on the floor against the
 * wall, a strip up the base of the face, and a strip up each end of the
 * face where the next wall meets it. Door spans are left clear.
 */
export function cornerShades(w: WallSolid, heightM: number, openings: readonly WallOpeningSolid[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'corner-shades';
  const zFace = w.thicknessM + 0.003;
  const runs = doorRuns(w.lengthM, openings);
  for (const [a, b] of runs) {
    const len = b - a;
    if (len < 0.05) continue;
    // On the floor, darkest against the wall (v = 0 edge of the texture is transparent, so flip).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(len, CORNER_SHADE_FLOOR_M), shadeMaterial(false));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(a + len / 2, 0.004, w.thicknessM + CORNER_SHADE_FLOOR_M / 2);
    floor.renderOrder = 2;
    g.add(floor);
    // Up the base of the face, darkest at the floor.
    const base = new THREE.Mesh(new THREE.PlaneGeometry(len, CORNER_SHADE_WALL_M), shadeMaterial(true));
    base.position.set(a + len / 2, CORNER_SHADE_WALL_M / 2, zFace);
    base.renderOrder = 2;
    g.add(base);
  }
  // Vertical strips at each end of the face (where walls meet), full height.
  if (heightM > 0.5) {
    for (const [u, dir] of [
      [0, 1],
      [w.lengthM, -1],
    ] as const) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(CORNER_SHADE_VERTICAL_M, heightM), shadeMaterial(false));
      // The gradient runs along v by default; turn it so it runs along u, dark at the end.
      strip.rotation.z = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      strip.position.set(u + (dir * CORNER_SHADE_VERTICAL_M) / 2, heightM / 2, zFace);
      strip.renderOrder = 2;
      g.add(strip);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Contact shadows under bodies.
// ---------------------------------------------------------------------------
/** A soft dark pool under a floor-standing item, sized to its footprint; wall and ceiling items get none. */
export function contactShadow(it: ItemSolid): THREE.Mesh | null {
  if (it.placement === 'wall' || it.placement === 'ceiling' || it.placement === 'surface' || it.z0 > 0.05) return null;
  const w = it.x1 - it.x0 + 2 * CONTACT_SHADOW_MARGIN_M;
  const h = it.y1 - it.y0 + 2 * CONTACT_SHADOW_MARGIN_M;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: CONTACT_SHADOW_ALPHA, alphaMap: softShadowTexture(), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((it.x0 + it.x1) / 2, 0.006, (it.y0 + it.y1) / 2);
  mesh.renderOrder = 1;
  mesh.userData = { key: `shadow-${it.key}`, shadow: true };
  return mesh;
}

// ---------------------------------------------------------------------------
// Night lights.
// ---------------------------------------------------------------------------
export interface NightLight {
  light: THREE.PointLight;
  glow: THREE.Mesh;
}

/**
 * A warm point light where a lamp is, plus a small emissive glow so the
 * lamp itself reads as lit. `mountM` is the height of the light source above
 * the floor (a pendant hangs from the ceiling, a sconce sits at 1.7 m, a
 * floor lamp's shade is near its top).
 */
export function nightLight(it: ItemSolid, mountM: number, intensity = 22): NightLight {
  const x = (it.x0 + it.x1) / 2;
  const z = (it.y0 + it.y1) / 2;
  const light = new THREE.PointLight(0xffd9a3, intensity, 8, 2);
  light.position.set(x, mountM, z);
  light.castShadow = false;
  light.userData = { key: `light-${it.key}`, nightLight: true };
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe9c4 }));
  glow.position.copy(light.position);
  glow.userData = { key: `glow-${it.key}`, nightLight: true };
  return { light, glow };
}

/** Blend factor for the lamps: fully on below −2° sun, off above +8°. */
export function lampsOnFactor(sunElevationDeg: number): number {
  return Math.max(0, Math.min(1, (8 - sunElevationDeg) / 10));
}
