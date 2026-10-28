/**
 * ThreeStage — the WebGL renderer behind the 3D MODE (2026-09-17; P3
 * realism 2026-09-19).
 *
 * Draws `SceneSolids` (designer/roomSolids.ts) with three.js: wall slabs
 * with real thickness and their doors and windows cut through — dressed
 * with skirting, architraves, panelled door leaves, window frames and
 * sills (three/joinery.ts) — floor slabs in the laid product's real
 * surface (three/surfaces.ts), furniture bodies on soft contact shadows,
 * corner shading where walls meet the floor (the phone-safe stand-in for
 * ambient occlusion), a sun with soft shadows that can follow the real
 * Mauritian sky by the hour (designer/sunPosition.ts), lamps that come on
 * after dark, and a sky dome that goes from noon to night. The Sims
 * cutaway is a per-camera VISIBILITY toggle between a wall's full and stub
 * meshes — orbiting never rebuilds geometry.
 *
 * This module is loaded LAZILY (its own `vendor-three` chunk) the first time
 * a 3D view opens, so the 2D designer's first paint does not carry three.
 * Its parent (`RoomView3D`) owns the camera state, the gestures and the
 * store reads; this file owns nothing but the GL scene and answers three
 * questions for the parent: what wall is under a point, where a wall is on
 * screen (the e2e bridge), and what is drawn.
 *
 * Frame mapping: the plan is x east, y south, z up. three is y-up, so
 * plan (x, y, z) → three (x, z, y). Right-handed either way (verified: the
 * camera south of a room looking north has east on its right).
 *
 * COLOUR TRUTH (measured, pinned by paint-sims-3d.spec.ts and
 * realism-3d.spec.ts): with no hour set the rig is the STUDIO rig —
 * hemisphere 0.72 π + camera fill 0.25 π + a fixed high sun 0.25 π,
 * NoToneMapping, exposure 1, floors at the measured 0.9 gain
 * (three/renderPresentation.ts holds the numbers) — under which a painted
 * wall renders its hex (a #808080 room reads 118–127 on every wall). The
 * time-of-day rig only replaces it while the customer drags the sun. THE
 * RULE for the calibrated presentations (studio / architectural): they may change the
 * sky dome, the ground plane, the far fog and the unpriced reveal / cap
 * edges of the walls — never the rig, the tone mapping, the exposure or a
 * priced surface's material. The explicitly labelled natural-light preview
 * instead uses a directional lighting rig and neutral highlight compression.
 * It preserves the same source materials and measurements but does not claim
 * pixel matching with a colour card. Switching looks never moves the camera.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createAutoAoState, sampleAutoAo } from './adaptiveAmbientOcclusion';
import { optionalShadingReady } from './firstPicture';
import { createFirstPictureMaterials } from './firstPictureMaterials';
import { applyWallHoverVisibility, removalHighlight, clipRemovalHighlightToPlanBounds, disposeRemovalHighlight } from './viewOnlyFeedback';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ecoTreeMeshes } from './ecoTrees';
import type { EcoTree } from '../../designer/eco';
import { cameraPosition, GLASS_HEX, type OrbitCamera, type WallHit } from '../../designer/roomView3d';
import { cutawayState, wallAnchor, type ItemSolid, type SceneSolids, type WallShow, type WallSolid } from '../../designer/roomSolids';
import { bodyObject, bodyTemplate, productEnvelope, type BodyTemplate } from './productBody';
import { dayOfYear, sunAt, sunColourHex } from '../../designer/sunPosition';
import { BARE_PLASTER_HEX } from '../../data/wallPaints';
import type { WallView } from '../../store/designerUIStore';
import type { FloorKind } from './surfaces';
import { applyWallLook, wallTextures } from './wallSurfaces';
import { wallJoinery } from './joinery';
import { stairMesh, roofMesh, disposeBuildingTextures } from './buildingMeshes';
import { gardenMeshes } from './gardenMeshes';
import { disposeGardenResources } from './gardenGround';
import { visibleOpeningProfile } from './openingMeshProfile';
import { useBuildSkinStore, BUILD_SKIN_PALETTES } from '../../store/buildSkinStore';
import { contactShadow, cornerShades, disposeDressingTextures, floorMesh, groundPlane, lampsOnFactor, nightLight, skyDome, updateGroundPresentation, updateSkyDome, type NightLight } from './dressing';
import { applyContentPresentation, applyRendererPresentation, architecturalBackdrop, ARCHITECTURAL_HORIZON_HEX, presentationProfile, type ScenePresentation } from './renderPresentation';
import { disposeFurnitureTextures, furniturePreview } from './furniturePreview';
import { serviceProductPreview } from './serviceProductPreview';
import { foundationMeshes } from './foundationMeshes';
import { setFoundationInspection } from './foundationInspection';
import type { FoundationModel } from '../../designer/foundation';
import { createNaturalSceneRenderer, type NaturalSceneRenderer } from './naturalSceneRenderer';
import { mountRoofItem, poseRoofItem, roofPointFromRay } from './roofItems';
import { solarPanelPreview } from './solarPanelPreview';
import { waterTankPreview } from './waterTankPreview';
import { carryItemPreviewPose } from './itemPreviewPose';
import { createRoofSurface, roofItemMount } from '../../designer/roofSurface';
import { pointInPolygon } from '../../lib/geometry';
import { applyProductSurfaceLighting, applySceneTextureSampling } from './productSurfaceLighting';
import { browserRenderDevice, renderQualityProfile } from '../../designer/renderQuality';
import { useRenderQualityStore } from '../../store/renderQualityStore';
import { attachedDescendantIds, attachedPreviewPosition } from './attachedItemPreview';
import { serviceFixtureMesh } from './serviceFixtureMeshes';
import { serviceRouteMesh } from './serviceRouteMeshes';
import type { ServiceRunPlacement } from '../../designer/serviceScene';
import { hasFoundationGeometry } from '../../designer/foundation';
import type { ServiceFixturePlacement } from '../../designer/serviceFixtures';

// ---------------------------------------------------------------------------
// Product bodies (2026-09-17): a textured glTF per product, fetched once and
// cloned per placed item, fitted EXACTLY to the catalog's dimensions by
// `fitToSize`. Until it arrives (or if it cannot), a supported dimensional
// preview or the product's art box stands in.
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
gltfLoader.setDRACOLoader(dracoLoader);

const bodyCache = new Map<string, Promise<BodyTemplate>>();

function loadBody(url: string): Promise<BodyTemplate> {
  let p = bodyCache.get(url);
  if (!p) {
    p = gltfLoader.loadAsync(url).then((gltf) => {
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          // Cached GLTF geometry belongs to the template, not its item clone.
          m.geometry.userData.cachedProductBody = true;
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return bodyTemplate(scene);
    });
    p.catch(() => bodyCache.delete(url));
    bodyCache.set(url, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// A product without a body or an explicitly supported dimensional preview:
// the box wears the product's OWN art —
// the plan's top-down image on its top (what the 2D shows), the photo on its
// sides — so what you placed is what you see, at its exact catalog size.
// ---------------------------------------------------------------------------
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const artCache = new Map<string, Promise<THREE.Texture>>();
function loadArt(url: string): Promise<THREE.Texture> {
  let p = artCache.get(url);
  if (!p) {
    p = textureLoader.loadAsync(url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    p.catch(() => artCache.delete(url));
    artCache.set(url, p);
  }
  return p;
}

/** A clone of `tex` cropped to COVER a face of aspect `faceW / faceH` (centre crop, no stretch). */
function coverTexture(tex: THREE.Texture, faceW: number, faceH: number): THREE.Texture {
  const img = tex.image as { width?: number; height?: number } | undefined;
  const t = tex.clone();
  const iw = img?.width ?? 1;
  const ih = img?.height ?? 1;
  const imgAspect = iw / ih;
  const faceAspect = faceW / faceH;
  if (imgAspect > faceAspect) {
    const r = faceAspect / imgAspect;
    t.repeat.set(r, 1);
    t.offset.set((1 - r) / 2, 0);
  } else {
    const r = imgAspect / faceAspect;
    t.repeat.set(1, r);
    t.offset.set(0, (1 - r) / 2);
  }
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/**
 * The art box for one placed item: a shaded box at the catalog size, then —
 * as the images arrive — the top-down art laid on top at the item's
 * rotation and the photo on the four sides. Returns the item's root (a
 * Group carrying `userData.instanceId`).
 */
function artBox(it: ItemSolid, requestRender: () => void): THREE.Group {
  const envelope = productEnvelope(it);
  const sx = envelope.size.x;
  const sy = envelope.size.y;
  const sz = envelope.size.z;
  const root = new THREE.Group();
  root.position.copy(envelope.position);
  root.rotation.y = envelope.yawRad;
  root.userData = { key: it.key, instanceId: it.instanceId, art: !!(it.artTopUrl || it.artSideUrl) };
  const base = new THREE.MeshStandardMaterial({ color: it.hex, roughness: ITEM_ROUGHNESS, metalness: 0.02 });
  const box: THREE.Mesh<THREE.BoxGeometry, THREE.Material | THREE.Material[]> = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), base);
  box.castShadow = true;
  box.receiveShadow = true;
  root.add(box);
  if (it.artSideUrl) {
    const sideUrl = it.artSideUrl;
    loadArt(sideUrl)
      .then((tex) => {
        if (!root.parent || root.userData.disposed) return;
        const side = (w: number, h: number) => new THREE.MeshStandardMaterial({ color: 0xffffff, map: coverTexture(tex, w, h), roughness: 0.8, metalness: 0 });
        // Box material order: +x, −x, +y (top), −y (bottom), +z, −z.
        box.material = [side(sz, sy), side(sz, sy), base, base, side(sx, sy), side(sx, sy)];
        requestRender();
      })
      .catch(() => {
        /* the shaded box stays */
      });
  }
  if (it.artTopUrl) {
    const topUrl = it.artTopUrl;
    loadArt(topUrl)
      .then((tex) => {
        if (!root.parent || root.userData.disposed) return;
        // The plan's icon, at the plan's rotation, on the box's lid.
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.max(0.01, it.lengthM), Math.max(0.01, it.widthM)),
          new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, transparent: true, alphaTest: 0.35, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        );
        plane.rotation.x = -Math.PI / 2; // image top → plan north (−z)
        const turn = new THREE.Group();
        turn.rotation.y = 0; // The envelope already carries the saved item rotation.
        turn.position.y = sy / 2 + 0.003;
        turn.add(plane);
        root.add(turn);
        requestRender();
      })
      .catch(() => {
        /* the shaded box stays */
      });
  }
  return root;
}

export interface ThreeStageHandle {
  /** A private deferred viewer may render its own camera without changing the design. */
  beginWalk(): { scene: THREE.Scene; renderer: THREE.WebGLRenderer; render(camera: THREE.PerspectiveCamera): void; release(): void } | null;
  viewHover(x:number|null,y?:number):void;
  hitErase(x:number,y:number):ThreeEraseTarget|null;
  setEraseHover(target:ThreeEraseTarget|null,floorOutline?:readonly {x:number;y:number}[]):void;
  /** Wall under a canvas-local point, or null. */
  hitTest(x: number, y: number): WallHit | null;
  wallPoint(x: number, y: number): { x: number; y: number } | null;
  /** Canvas-local point at the middle of a wall's shown face — the e2e bridge aims here. */
  screenPoint(hit: WallHit): { x: number; y: number } | null;
  faceCount(): number;
  faces(): Array<{ key: string; holes: number }>;
  /**
   * DEV bridge: what the stage has done so far, and the colour-truth state
   * it draws under — the presentation, the renderer's tone mapping (0 =
   * NoToneMapping) and exposure, the fog planes (null when the studio look
   * has none) and the camera's distance to the plan's bounds centre, so a
   * spec can prove the fog starts beyond every priced surface.
   */
  debug(): {
    frames: number; children: number; camera: number[]; target: number[]; renderer: string; hour: number | null;
    sun: { elevationDeg: number; azimuthDeg: number } | null;
    presentation: ScenePresentation; toneMapping: number | null; exposure: number | null;
    fog: { near: number; far: number } | null; cameraDistance: number | null;
  };
  /** The placed item under a canvas-local point (its body or its box), or null. */
  hitItem(x: number, y: number): { instanceId: string } | null;
  /** Generic plumbing/electric fixture on the active storey, in canvas pixels. */
  hitServiceFixture?(x: number, y: number): string | null;
  /** Existing wall-hosted opening, respecting cutaway and visible storeys. */
  hitOpening?(x: number, y: number): string | null;
  /** DEV bridge: what a wall's material shows right now (the preview or its own paint). */
  wallMaterial(hit: WallHit): { hex: string; baseHex: string; finish: string | null; roughness: number; sheen: number; hasMap: boolean; show: WallShow } | null;
  /** DEV bridge: the rendered colour at a canvas-local point (renders, then reads the pixel back). */
  samplePixel(x: number, y: number): { r: number; g: number; b: number } | null;
  /** DEV bridge: bisect the light rig / materials live. */
  tune(opts: { hemi?: number; sun?: number; fill?: number; env?: boolean; normals?: number; maps?: boolean }): void;
  /** Where a canvas-local point meets the floor plane, in PLAN metres, or null when it looks at the sky. */
  floorPoint(x: number, y: number): { x: number; y: number } | null;
  /** Unbounded active-level plane for drawing a roof beyond its current outline. */
  constructionPoint?(x: number, y: number): { x: number; y: number } | null;
  /** A PLAN point (x, y on the plan, z up) on the canvas, or null when it is behind the camera. */
  projectPoint(x: number, y: number, z: number): { x: number; y: number } | null;
  /** Slide an item's body by a plan-metre delta while a drag is in progress (no store write). */
  moveItemPreview(instanceId: string, dxM: number, dyM: number, rotationDeg?: number): void;
  /** Put a previewed body back where the plan has it. */
  resetItemPreview(instanceId: string): void;
  /** DEV bridge: what is dressed — joinery, shades, lamps, bodies, art boxes, previews, bare boxes — for a spec to count. */
  dressing(): { joinery: number; shades: number; lamps: number; contactShadows: number; floors: Array<{ key: string; kind: string }>; bodies: number; artBoxes: number; previews: number; bareBoxes: number };
}

export type ThreeEraseTarget = {kind:'item';instanceId:string}|{kind:'opening';openingId:string}|{kind:'wall';hit:WallHit}|{kind:'floor';roomId:string;point:{x:number;y:number}};

export interface ThreeStageProps {
  /** Idle selection only; paint, structural tools and removal keep walls pickable. */
  viewHoverEnabled?: boolean;
  /** Transient catalogue drag body; never part of the saved model or raycast. */
  catalogPreview?: { item: ItemSolid; valid: boolean } | null;
  /** Architectural lighting/backdrop for exploring; studio preserves the measured paint preview. */
  presentation?: ScenePresentation;
  solids: SceneSolids;
  /** Generic service fixtures on visible storeys, independent of catalog stock. */
  serviceFixtures?: ServiceFixturePlacement[];
  serviceRuns?: ServiceRunPlacement[];
  groundVisible?: boolean;
  ecoTrees?: readonly EcoTree[];
  foundation?: FoundationModel;
  foundationView?: boolean;
  foundationBaseElevationM?: number;
  camera: OrbitCamera;
  projection?: import('../../designer/professionalViews').CameraProjection;
  width: number;
  height: number;
  hover: WallHit | null;
  /** The plan's selection — tinted so 2D and 3D agree on what is picked. */
  selectedInstanceId?: string | null;
  /**
   * The paint on the brush, shown ON the hovered wall before the click (The
   * Sims' wallpaper preview); null = the tool is armed with no preview
   * colour (Erase shows bare plaster); undefined = no paint tool.
   */
  brushHex?: string | null;
  /** Product finish on the brush; null previews bare plaster. */
  brushFinish?: string | null;
  brushSide?: 'interior' | 'exterior';
  brushConstruction?: import('../../designer/wallConstruction').WallConstruction;
  /** Walls Up / Cutaway / Down (default 'cutaway'). */
  wallView?: WallView;
  /**
   * Local clock hour (0–24) to light the room by the real Mauritian sun;
   * null / undefined = the studio rig the colour truth is measured under.
   */
  hour?: number | null;
  /** Day of the year for the sun's path (default: today). */
  dayOfYear?: number;
  /** WebGL could not start (headless without GL, an old device) — the parent falls back to the painter. */
  onFailed?: () => void;
  /** Fires after a real frame, so the loading state cannot disappear too early. */
  onReady?: () => void;
}

/** Wall tops, ends and the reveals of openings — a shade under plaster so edges read. */
const REVEAL_HEX = '#C9C3B6';
/** The cap strip along the top of every wall, full or cut — the Sims' cut-wall cap. */
const CAP_HEX = '#B5AFA2';
/** The OUTSIDE of a room wall: render, never the room's paint (the quote prices one face; the picture painted two). */
const EXTERIOR_HEX = '#E4E0D6';
function exteriorLook(w: WallSolid) { return { hex: w.exteriorHex ?? EXTERIOR_HEX, finish: w.exteriorFinish, construction: w.construction }; }
const ITEM_ROUGHNESS = 0.72;
/** The target outline on the hovered wall (mint, the plan's selection colour). */
const TARGET_HEX = '#79C7AD';
const OUTLINE_WIDTH_M = 0.028;

/**
 * The studio rig (measured): the sun direction, three frame, and the three
 * intensities in π multiples. P3 raised the sun (0.15 → 0.25) for readable
 * shadows and lowered the hemisphere to keep a camera-facing, sun-shaded
 * wall at the same ≈0.95 of its hex the colour-truth probe pins.
 */
const STUDIO = { hemi: 0.72, sun: 0.25, fill: 0.25 };
/**
 * Floors face the sky, so the hemisphere, the fill from above and the sun
 * all land on them at once: a floor rendered ×1.14 of its swatch and a
 * light one clipped to white (the 3D audit). This gain, measured on
 * #3A3A3A / #1F2A44 / #F1EBDD floor centres against the swatch, brings the
 * rendered floor back to its hex; the walls are untouched.
 */
const FLOOR_GAIN = 0.9;
/** Night rig: a cool, dim sky and the lamps. */
const HEMI_DAY_SKY = new THREE.Color(0xffffff);
const HEMI_DAY_GROUND = new THREE.Color(0xf2ede4);
const HEMI_NIGHT_SKY = new THREE.Color(0x9db0d6);
const HEMI_NIGHT_GROUND = new THREE.Color(0x3b3f4a);

const toThree = (p: { x: number; y: number; z: number }): THREE.Vector3 => new THREE.Vector3(p.x, p.z, p.y);
const SELECT_HEX = '#79C7AD';
/** Unpriced presentation horizon; never allowed to intrude into room bounds. */
const FOG_HEX = ARCHITECTURAL_HORIZON_HEX;
/**
 * Clear air between the farthest point of the plan and where the fade may
 * start, metres. With the 4 m minimum plan radius the fog therefore begins
 * more than 6 m past the camera-to-plan distance at every zoom
 * (realism-3d.spec.ts pins that).
 */
const FOG_CLEARANCE_M = 3;

interface WallEntry {
  solid: WallSolid;
  group: THREE.Group;
  full: THREE.Object3D;
  stub: THREE.Object3D;
  paint: THREE.MeshPhysicalMaterial;
  exterior: THREE.MeshPhysicalMaterial;
  /** The wall's own colour (the preview swaps the material colour and restores this). */
  baseHex: string;
  /** Outline of the wall face, shown only while it is the paint target. */
  outlineFull: THREE.Object3D;
  outlineStub: THREE.Object3D;
  show: WallShow;
  /** A cut wall raised as a ghost while the brush hovers it (the preview shows the whole face). */
  ghost: boolean;
}

/**
 * Raise a cutaway stub as a translucent ghost of its full wall while the
 * brush hovers it, so the preview shows the whole face and not a skirting-
 * height strip (the 3D audit); the joinery and shading of the ghost stay
 * hidden so only the painted face floats up.
 */
function setGhost(e: WallEntry, on: boolean): void {
  if (e.ghost === on) return;
  e.ghost = on;
  for (const face of [e.paint, e.exterior]) {
    face.transparent = on; face.opacity = on ? 0.55 : 1; face.depthWrite = !on; face.needsUpdate = true;
  }
  e.full.traverse((o) => {
    if (o === e.full) return;
    if (o.userData?.joinery || o.userData?.cap || o.name === 'corner-shades') o.visible = !on;
  });
  e.full.visible = on ? true : e.show === 'full';
}

/** A mint inverted hull around a body — the Sims' selection glow, one draw call, phone-safe. */
let hullMaterialCache: THREE.MeshBasicMaterial | null = null;
function makeHull(root: THREE.Object3D): THREE.Object3D {
  if (!hullMaterialCache) {
    hullMaterialCache = new THREE.MeshBasicMaterial({ color: SELECT_HEX, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false });
    hullMaterialCache.userData.shared = true;
  }
  const hull = root.clone(true);
  hull.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = hullMaterialCache as THREE.Material;
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = -1;
    }
  });
  hull.userData = { hull: true };
  // A little bigger about the body's own centre, so the rim shows all round.
  const box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  const k = 1.028;
  hull.scale.multiplyScalar(k);
  hull.position.copy(root.position).sub(centre).multiplyScalar(k).add(centre);
  return hull;
}

/**
 * What a rebuild is FOR: the geometry. A paint click changes a wall's hex
 * and finish only — the same walls, floors and items with new colours —
 * and repaints in place instead of disposing and re-extruding the room
 * (Sims-instant, and the phone never stalls on a click).
 */
function structureSignature(s: SceneSolids): string {
  return JSON.stringify({
    h: s.wallHeightM,
    f: s.floors.map((f) => [f.key, f.hex, f.kind, f.tileM, f.polygon, f.elevationM, f.holes]),
    w: s.walls.map((w) => [w.key, w.a, w.b, w.thicknessM, w.heightM, w.stubHeightM, w.centred, w.openings, w.shared, w.free, w.elevationM, w.renderDuplicateOf, w.smoothStart, w.smoothEnd]),
    stairs: s.stairs, roofs: s.roofs, garden: s.garden, gardenObstacles: s.gardenObstacles, gardenSite: s.gardenSite, gardenVisible: s.gardenVisible,
    i: s.items.map((it) => [it.key, it.instanceId, it.x0, it.y0, it.z0, it.x1, it.y1, it.z1, it.rotationDeg, it.hex, it.meshUrl, it.preferMesh, it.modelFront, it.lengthAxis, it.modelUp, it.emitsLight, it.lightMountM, it.artTopUrl, it.artSideUrl, it.roofMount]),
  });
}

let outlineMaterialCache: THREE.MeshBasicMaterial | null = null;
function outlineMaterial(): THREE.MeshBasicMaterial {
  if (!outlineMaterialCache) {
    outlineMaterialCache = new THREE.MeshBasicMaterial({ color: TARGET_HEX, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    outlineMaterialCache.userData.shared = true;
  }
  return outlineMaterialCache;
}

/**
 * The outline of a slab's inner face, drawn only while it is the target:
 * four 28 mm strips just in front of the face (a WebGL line is always one
 * pixel, which read as a hairline on the phone — the 3D audit).
 */
function faceOutline(w: WallSolid, heightM: number): THREE.Group {
  const g = new THREE.Group();
  const z = w.thicknessM + 0.006;
  const t = OUTLINE_WIDTH_M;
  const mat = outlineMaterial();
  const strip = (sw: number, sh: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
    m.position.set(x, y, z);
    m.renderOrder = 5;
    g.add(m);
  };
  strip(w.lengthM, t, w.lengthM / 2, t / 2);
  strip(w.lengthM, t, w.lengthM / 2, heightM - t / 2);
  strip(t, heightM, t / 2, heightM / 2);
  strip(t, heightM, w.lengthM - t / 2, heightM / 2);
  g.visible = false;
  return g;
}

/**
 * Re-group an extruded slab's faces so the OUTSIDE cap of a room wall gets
 * the exterior render instead of the room's paint. ExtrudeGeometry gives
 * both caps material 0 and the sides material 1; the cap at z = 0 is the
 * outer face (placeWall puts the inner face on the wall line at z =
 * thickness). Free walls straddle their line and are painted on both faces.
 */
function splitCaps(geo: THREE.ExtrudeGeometry, depth: number, _centred: boolean): void {
  const pos = geo.getAttribute('position');
  const groups = geo.groups.map((g) => ({ ...g }));
  geo.clearGroups();
  for (const g of groups) {
    if (g.materialIndex !== 0) {
      geo.addGroup(g.start, g.count, g.materialIndex ?? 1);
      continue;
    }
    let runStart = g.start;
    let runMat = -1;
    for (let i = g.start; i < g.start + g.count; i += 3) {
      const mat = pos.getZ(i) < depth / 2 ? 2 : 0;
      if (mat !== runMat) {
        if (runMat >= 0) geo.addGroup(runStart, i - runStart, runMat);
        runStart = i;
        runMat = mat;
      }
    }
    if (runMat >= 0) geo.addGroup(runStart, g.start + g.count - runStart, runMat);
  }
}

function sameHit(a: WallHit | null | undefined, b: WallHit): boolean {
  if (!a) return false;
  if (a.kind !== b.kind) return false;
  return a.kind === 'edge' ? a.roomId === b.roomId && a.edgeIndex === b.edgeIndex : a.wallId === b.wallId;
}

/**
 * A wall slab as an extruded shape with its openings as holes, in the
 * wall's local frame (u along, v up, w outward-in), dressed: skirting,
 * architraves and door leaves, window frames and sills, corner shading.
 */
function slabObject(w: WallSolid, heightM: number, paint: THREE.Material, reveal: THREE.Material, exterior: THREE.Material, cap: THREE.Material): THREE.Object3D {
  const node = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w.lengthM, 0);
  shape.lineTo(w.lengthM, heightM);
  shape.lineTo(0, heightM);
  shape.closePath();
  const openings = w.openings.filter((o) => o.bottomM < heightM);
  for (const o of openings) {
    const profile = visibleOpeningProfile(o, heightM);
    if (profile.length < 3) continue;
    const hole = new THREE.Path();
    hole.moveTo(profile[0].x, profile[0].y);
    for (const point of profile.slice(1)) hole.lineTo(point.x, point.y);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w.thicknessM, bevelEnabled: false });
  splitCaps(geo, w.thicknessM, w.centred);
  const glassWall = w.construction === 'glass';
  const slab = new THREE.Mesh(geo, [paint, glassWall ? paint : reveal, exterior]);
  slab.castShadow = !glassWall;
  slab.receiveShadow = true;
  slab.userData = { hit: w.hit, key: w.key, holes: openings.length, wall: true };
  node.add(slab);
  // The cap strip along the top — every wall, full or cut, wears one.
  const capStrip = new THREE.Mesh(new THREE.BoxGeometry(w.lengthM + 0.004, 0.012, w.thicknessM + 0.006), cap);
  capStrip.position.set(w.lengthM / 2, heightM + 0.006, w.thicknessM / 2);
  capStrip.receiveShadow = true;
  capStrip.userData = { cap: true };
  if (!glassWall) node.add(capStrip);
  else { capStrip.geometry.dispose(); }
  // Window glass: a pane in the middle of the slab's thickness.
  for (const o of openings) {
    if (o.kind !== 'window') continue;
    const profile = visibleOpeningProfile(o, heightM);
    if (profile.length < 3) continue;
    const paneShape = new THREE.Shape(profile.map(p => new THREE.Vector2(p.x, p.y)));
    const pane = new THREE.Mesh(
      new THREE.ShapeGeometry(paneShape),
      new THREE.MeshPhysicalMaterial({ color: GLASS_HEX, transparent: true, opacity: 0.28, roughness: 0.06, metalness: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    pane.position.z = w.thicknessM / 2;
    node.add(pane);
  }
  // Dressing (P3): joinery on every wall, corner shading on the room side.
  if (!glassWall) {
    node.add(wallJoinery(w.lengthM, w.thicknessM, heightM, openings));
    node.add(cornerShades(w, heightM, openings));
  }
  return node;
}

/** World placement of a wall's local frame: u = along the wall, v = up, extrusion from the outer face to the wall line. */
function placeWall(w: WallSolid, node: THREE.Object3D): void {
  const dx = (w.b.x - w.a.x) / w.lengthM;
  const dy = (w.b.y - w.a.y) / w.lengthM;
  const X = new THREE.Vector3(dx, 0, dy);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3().crossVectors(X, Y); // = plan (-dy, dx) = the inward normal
  const origin = new THREE.Vector3(w.a.x, w.elevationM ?? 0, w.a.y);
  // Room-edge slabs sit OUTSIDE their line (the inner face is the line);
  // free walls straddle it.
  origin.addScaledVector(Z, w.centred ? -w.thicknessM / 2 : -w.thicknessM);
  node.matrixAutoUpdate = false;
  node.matrix.makeBasis(X, Y, Z).setPosition(origin);
  node.matrixWorldNeedsUpdate = true;
}

function disposeObject(root: THREE.Object3D): void {
  disposeBuildingTextures(root);
  disposeDressingTextures(root);
  disposeFurnitureTextures(root);
  disposeGardenResources(root);
  root.traverse((o) => {
    o.userData.disposed = true;
    const m = o as THREE.Mesh;
    if (m.geometry && !m.geometry.userData.cachedProductBody) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    // Shared joinery materials are singletons — never disposed here.
    if (Array.isArray(mat)) mat.forEach((x) => !x.userData?.shared && x.dispose());
    else if (mat && !mat.userData?.shared) mat.dispose();
  });
}

/** The placed-item root (the box mesh or the body holder) an object belongs to. */
function itemRootOf(o: THREE.Object3D | null): THREE.Object3D | null {
  let n: THREE.Object3D | null = o;
  while (n && n.userData?.instanceId === undefined) n = n.parent;
  return n;
}

/** Tint every mesh of an item root (selection / preview), remembering the untinted state. */
function tintItem(root: THREE.Object3D, hex: string | null, intensity: number): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.selectionKeepsColour) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (!std.emissive) continue;
      if (hex) {
        std.emissive.set(hex);
        std.emissiveIntensity = intensity;
      } else {
        std.emissive.set(0x000000);
        std.emissiveIntensity = 0;
      }
    }
  });
}


export const ThreeStage = forwardRef<ThreeStageHandle, ThreeStageProps>(function ThreeStage(
  { solids, catalogPreview, viewHoverEnabled = false, serviceFixtures, serviceRuns, groundVisible = true, ecoTrees, foundation, foundationView = false, foundationBaseElevationM = 0, camera, projection = 'perspective', width, height, hover, selectedInstanceId, brushHex, brushFinish, brushSide, brushConstruction, wallView = 'cutaway', hour = null, dayOfYear: doy, presentation = 'studio', onFailed, onReady },
  ref,
): JSX.Element {
  const buildSkin = useBuildSkinStore(s => s.skin);
  const qualityChoice = useRenderQualityStore(s => s.choice);
  const qualityChoiceRef = useRef(qualityChoice);
  qualityChoiceRef.current = qualityChoice;
  const autoAoRef = useRef(createAutoAoState());
  const autoSceneKeyRef = useRef('');
  const quality = renderQualityProfile(qualityChoice, browserRenderDevice(width));
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const naturalRendererRef = useRef<NaturalSceneRenderer | null>(null);
  const naturalPreparedRef = useRef<NaturalSceneRenderer | null>(null);
  const naturalBalancedRef = useRef(false);
  const naturalEnabledRef = useRef(presentation === 'natural');
  const naturalUnavailableRef = useRef(false);
  const drawingSizeRef = useRef(new THREE.Vector2());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const walkOwnsFrames = useRef(false);
  const hemiRef = useRef<THREE.HemisphereLight | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  /** A soft light that rides with the camera so no wall face is ever unlit. */
  const fillRef = useRef<THREE.DirectionalLight | null>(null);
  const rimRef = useRef<THREE.DirectionalLight | null>(null);
  /** The room environment, for materials with a sheen. */
  const envRef = useRef<THREE.Texture | null>(null);
  const envTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const skyRef = useRef<THREE.Mesh | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const servicesRef = useRef<THREE.Group | null>(null);
  const ecoRef = useRef<THREE.Group | null>(null);
  const foundationRef = useRef<THREE.Group | null>(null);
  const gardenRef = useRef<THREE.Group | null>(null);
  const signatureRef = useRef<string>('');
  const wallsRef = useRef<WallEntry[]>([]);
  const floorsRef = useRef<THREE.Mesh[]>([]);
  const itemsRef = useRef<THREE.Object3D[]>([]);
  const roofsRef = useRef<THREE.Object3D[]>([]);
  const lampsRef = useRef<NightLight[]>([]);
  const shadowsRef = useRef<THREE.Mesh[]>([]);
  /** Where the plan is and how big, for the sun's shadow frustum. */
  const boundsRef = useRef<{ centre: THREE.Vector3; radius: number }>({ centre: new THREE.Vector3(), radius: 6 });
  const structureBoundsRef = useRef(new THREE.Box3());
  const sunStateRef = useRef<{ elevationDeg: number; azimuthDeg: number } | null>(null);
  const buildRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const failedRef = useRef(false);
  const hoveredRef = useRef<WallEntry | null>(null);
  const viewLoweredRef = useRef<WallEntry | null>(null);
  const viewCameraKeyRef = useRef('');
  const eraseHighlightRef = useRef<{key:string;root:THREE.Group}|null>(null);
  const framesRef = useRef(0);
  const firstPictureAtRef = useRef<number | null>(null);
  const firstFullPictureAtRef = useRef<number | null>(null);
  const detailReadyRef = useRef(presentation !== 'natural');
  const firstMaterialsRef = useRef<ReturnType<typeof createFirstPictureMaterials> | null>(null);
  const firstPreparationRef = useRef<{ renderer: THREE.WebGLRenderer; buildId: number; ready: boolean } | null>(null);
  const prepareDetailsRef = useRef<(() => void) | null>(null);
  const detailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBodiesRef = useRef(0);
  const shadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const targetRef = useRef<number[]>([0, 0, 0]);
  /** Bodies slid by a drag preview, with where the plan has them. */
  const previewRef = useRef(new Map<string, THREE.Vector3>());
  const previewRotationRef = useRef(new Map<string, number>());
  const selectedRootRef = useRef<THREE.Object3D | null>(null);
  const padRef = useRef<THREE.Mesh | null>(null);
  const hullRef = useRef<THREE.Object3D | null>(null);
  const catalogGhostRef = useRef<{key:string;root:THREE.Object3D;item:ItemSolid;valid:boolean} | null>(null);
  const clearViewHover = () => {
    const previous=viewLoweredRef.current;
    if(previous) applyWallHoverVisibility(previous,false);
    viewLoweredRef.current=null;
    if(rendererRef.current) rendererRef.current.domElement.dataset.hoverCutaway='';
  };
  const clearEraseHover = () => {
    if(eraseHighlightRef.current) disposeRemovalHighlight(eraseHighlightRef.current.root);
    eraseHighlightRef.current=null;
    if(rendererRef.current) rendererRef.current.domElement.dataset.eraseTarget='';
  };

  /**
   * The architectural fog is a horizon fade on the ground plane and nothing
   * else. Its near plane follows the camera: FOG_CLEARANCE_M beyond the
   * farthest point the plan can reach from where the camera is, so no wall,
   * floor or item is ever tinted at any zoom (the zoom clamp allows 3× the
   * fit distance; a fixed near plane left a 10 × 8 m plan's far wall in
   * 9–39 % fog out there). Cheap, so it runs before every frame.
   */
  const updateFog = () => {
    const fog = sceneRef.current?.fog;
    const c = cameraRef.current;
    if (!fog || !(fog instanceof THREE.Fog) || !c) return;
    const { centre, radius } = boundsRef.current;
    fog.near = c.position.distanceTo(centre) + radius + FOG_CLEARANCE_M;
    fog.far = fog.near + Math.max(60, radius * 8);
  };

  const requestRender = (shadowsDirty = true) => {
    // Static sunlight does not require a new shadow-map pass for every orbit
    // frame. Geometry, previews and lighting still invalidate it explicitly.
    if (shadowsDirty && rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
    if (rafRef.current !== null || failedRef.current) return;
    const firstAt = firstPictureAtRef.current;
    const presentationGap = firstAt === null || detailReadyRef.current ? 0 : Math.max(0, 600 - (performance.now() - firstAt));
    if (shadowsDirty && presentationGap > 0) {
      // Let the completed first picture and loading-state removal actually
      // present before asset-driven texture/shader refinements. Camera input
      // calls requestRender(false), so orbit/zoom never waits on this gap.
      if (firstRefreshTimerRef.current === null) firstRefreshTimerRef.current = setTimeout(() => {
        firstRefreshTimerRef.current = null; requestRender();
      }, presentationGap);
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (walkOwnsFrames.current) return;
      const r = rendererRef.current;
      const s = sceneRef.current;
      const c = cameraRef.current;
      if (r && s && c) {
        // Deep or large foundations can extend beyond the room-only clip plane.
        const extent = boundsRef.current;
        const far = Math.max(1000, c.position.distanceTo(extent.centre) + extent.radius * 2 + 20);
        if (c.far !== far) { c.far = far; c.updateProjectionMatrix(); }
        updateFog();
        if (firstPictureAtRef.current === null && !detailReadyRef.current && typeof r.compileAsync === 'function') {
          let preparation = firstPreparationRef.current;
          if (!preparation || preparation.renderer !== r || preparation.buildId !== buildRef.current) {
            preparation = { renderer: r, buildId: buildRef.current, ready: false };
            firstPreparationRef.current = preparation;
            firstMaterialsRef.current ??= createFirstPictureMaterials();
            const pending = preparation;
            const ready = () => {
              if (rendererRef.current !== r || firstPreparationRef.current !== pending || buildRef.current !== pending.buildId) return;
              pending.ready = true;
              r.domElement.dataset.firstPreparedMs = String(performance.now());
              requestRender(false);
            };
            r.domElement.dataset.firstPrepareStartMs = String(performance.now());
            try { void firstMaterialsRef.current.prepare(r, s, c).then(ready, ready); }
            catch { ready(); }
          }
          // Keep Loading 3D visible until the completed, shadowed scene has
          // actually drawn. Preparation alone never fires onReady.
          if (!preparation.ready) return;
        }
        let rendered = false;
        const automatic = qualityChoiceRef.current === 'auto' && !qualityRef.current.phone;
        const shadingReady = optionalShadingReady(firstFullPictureAtRef.current, performance.now(), pendingBodiesRef.current);
        const requestedAo = qualityRef.current.ambientOcclusion || (automatic && autoAoRef.current.mode !== 'disabled');
        const wantsAo = shadingReady && requestedAo;
        if (naturalEnabledRef.current && wantsAo && !naturalUnavailableRef.current) {
          try {
            if (naturalRendererRef.current && naturalBalancedRef.current !== automatic) {
              naturalRendererRef.current.dispose(); naturalRendererRef.current = null;
            }
            if (!naturalRendererRef.current) {
              r.domElement.dataset.aoPrepareStartMs = String(performance.now());
              naturalRendererRef.current = createNaturalSceneRenderer(r, s, c, automatic);
              naturalBalancedRef.current = automatic;
              if (!naturalRendererRef.current) naturalUnavailableRef.current = true;
              const preparing = naturalRendererRef.current;
              if (preparing) {
                preparing.prepare().then(() => {
                  if (naturalRendererRef.current !== preparing) return;
                  naturalPreparedRef.current = preparing;
                  r.domElement.dataset.shadingPreparedMs = String(performance.now());
                  requestRender(false);
                }).catch(() => {
                  if (naturalRendererRef.current !== preparing) return;
                  preparing.dispose(); naturalRendererRef.current = null;
                  naturalUnavailableRef.current = true; requestRender(false);
                });
              }
            }
            const natural = naturalRendererRef.current;
            if (natural && naturalPreparedRef.current === natural) {
              const size = r.getSize(drawingSizeRef.current);
              natural.setSize(size.x, size.y, r.getPixelRatio());
              natural.render();
              if (!r.domElement.dataset.firstAoMs) r.domElement.dataset.firstAoMs = String(performance.now());
              rendered = true;
            }
          } catch {
            // Optional shading must never strand the designer on a black
            // canvas. The normal renderer retains the same camera and scene.
            naturalRendererRef.current?.dispose();
            naturalRendererRef.current = null;
            naturalUnavailableRef.current = true;
            r.setRenderTarget(null);
          }
        }
        if (!rendered) {
          if (!detailReadyRef.current) {
            firstMaterialsRef.current ??= createFirstPictureMaterials();
            firstMaterialsRef.current.draw(s, () => r.render(s, c));
          } else r.render(s, c);
        }
        r.domElement.dataset.detail = detailReadyRef.current ? 'full' : 'first-picture';
        if (detailReadyRef.current && firstFullPictureAtRef.current === null) {
          firstFullPictureAtRef.current = performance.now();
          r.domElement.dataset.fullPictureMs = String(firstFullPictureAtRef.current);
        }
        if (automatic && rendered) {
          autoAoRef.current = sampleAutoAo(autoAoRef.current, performance.now());
          if (autoAoRef.current.mode === 'disabled') {
            naturalRendererRef.current?.dispose(); naturalRendererRef.current = null;
            requestRender(false);
          }
        }
        // Read-only diagnostic for browser QA; no scene/store access is needed
        // to confirm an optional GPU effect really ran on this device.
        r.domElement.dataset.shading = rendered ? 'natural-depth' : naturalEnabledRef.current ? 'natural-basic' : 'colour-check';
        r.domElement.dataset.quality = qualityRef.current.level;
        r.domElement.dataset.shadowSize = String(qualityRef.current.shadowSize);
        r.domElement.dataset.autoAo = qualityRef.current.phone ? 'phone-off' : automatic ? !shadingReady ? 'waiting-for-picture' : naturalUnavailableRef.current ? 'unavailable' : autoAoRef.current.mode : 'manual';
        r.domElement.dataset.autoAoFps = autoAoRef.current.fps?.toFixed(1) ?? '';
        framesRef.current += 1;
        if (framesRef.current === 1) {
          firstPictureAtRef.current = performance.now();
          r.domElement.dataset.firstPictureMs = String(firstPictureAtRef.current);
          onReadyRef.current?.();
          if (!detailReadyRef.current && detailTimerRef.current === null) {
            detailTimerRef.current = setTimeout(() => {
              detailTimerRef.current = null;
              prepareDetailsRef.current?.();
            }, 600);
          }
        }
        if (firstFullPictureAtRef.current !== null && !shadingReady && requestedAo && naturalEnabledRef.current && shadingTimerRef.current === null) {
          // A macrotask after the first real frame lets the browser present it
          // and dismiss Loading 3D before optional shader compilation begins.
          shadingTimerRef.current = setTimeout(() => { shadingTimerRef.current = null; requestRender(false); }, 100);
        }
        // A short bounded real-AO trial establishes GPU throughput even before
        // the first orbit. Once decided, static scenes stop rendering again.
        if (automatic && rendered && autoAoRef.current.mode === 'probing') requestRender(false);
      }
    });
  };

  /** Aim the sun and size its shadow camera to the plan. `dir` is the direction TOWARDS the sun, three frame. */
  const aimSun = (dir: THREE.Vector3) => {
    const sun = sunRef.current;
    if (!sun) return;
    const { centre, radius } = boundsRef.current;
    sun.position.copy(centre).addScaledVector(dir, radius * 3 + 10);
    sun.target.position.copy(centre);
    sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera;
    sc.left = -radius - 2;
    sc.right = radius + 2;
    sc.top = radius + 2;
    sc.bottom = -radius - 2;
    sc.near = 0.5;
    sc.far = radius * 6 + 40;
    sc.updateProjectionMatrix();
    const rim = rimRef.current;
    if (rim) {
      rim.position.copy(centre).add(new THREE.Vector3(radius, radius * 1.25, -radius));
      rim.target.position.copy(centre);
      rim.target.updateMatrixWorld();
    }
  };

  /** Presentation switches update the existing scene, never rebuild its room geometry. */
  const applyPresentation = () => {
    naturalEnabledRef.current = presentation === 'natural';
    if (rendererRef.current) applyRendererPresentation(rendererRef.current, presentation);
    if (contentRef.current) applyContentPresentation(contentRef.current, presentation);
    const { centre } = boundsRef.current;
    if (groundRef.current) {
      updateGroundPresentation(groundRef.current, presentation, buildSkin);
      groundRef.current.position.x = presentation !== 'studio' ? centre.x : 0;
      groundRef.current.position.z = presentation !== 'studio' ? centre.z : 0;
    }
    if (sceneRef.current) {
      // Fog is a horizon fade on the ground plane only. Its planes are not
      // fixed: updateFog keeps the near plane beyond the plan for wherever the
      // camera is (a fixed plane tinted painted walls at 3× zoom-out).
      sceneRef.current.fog = presentation !== 'studio' ? new THREE.Fog(buildSkin === 'natural' ? FOG_HEX : BUILD_SKIN_PALETTES[buildSkin].sky, 1, 2) : null;
      updateFog();
    }
  };

  /**
   * The selected presentation rig (null hour), or the real sun for that clock
   * hour with the sky and lamps following it. Only studio/architectural are
   * calibrated to colour-card pixels; natural light is an appearance preview.
   */
  const applyHour = (h: number | null) => {
    const hemi = hemiRef.current;
    const sun = sunRef.current;
    const fill = fillRef.current;
    if (!hemi || !sun || !fill) return;
    const profile = presentationProfile(presentation);
    sun.shadow.radius = profile.shadowRadius;
    const dayRig = profile.day;
    const nightRig = profile.night;
    const daySky = new THREE.Color(profile.sky);
    const dayBounce = new THREE.Color(profile.bounce);
    fill.color.set(profile.fill);
    if (h === null || !Number.isFinite(h)) {
      hemi.intensity = Math.PI * dayRig.hemi;
      hemi.color.copy(daySky);
      hemi.groundColor.copy(dayBounce);
      sun.intensity = Math.PI * dayRig.sun;
      sun.color.set(profile.sun);
      fill.intensity = Math.PI * dayRig.fill;
      if (rimRef.current) rimRef.current.intensity = Math.PI * dayRig.rim;
      aimSun(new THREE.Vector3(...profile.sunDirection).normalize());
      sunStateRef.current = null;
      sceneRef.current?.fog?.color.set(FOG_HEX);
      if (skyRef.current && (skyRef.current.userData.day !== 1 || skyRef.current.userData.presentation !== presentation || skyRef.current.userData.buildSkin !== buildSkin)) updateSkyDome(skyRef.current, 1, presentation, buildSkin);
      for (const l of lampsRef.current) {
        l.light.intensity = l.baseIntensity * profile.lampFactor;
        l.glow.visible = profile.lampFactor > 0;
        (l.glow.material as THREE.MeshBasicMaterial).color.set(profile.lampFactor > 0 ? 0xffe9c4 : 0xe9e2d3);
      }
      return;
    }
    const s = sunAt(h, doy ?? dayOfYear(new Date().getMonth() + 1, new Date().getDate()));
    const day = s.daylight;
    // The far horizon follows the sky at dusk. Fog remains beyond all room
    // bounds, and this never alters the calibrated light or product colour.
    const horizon = architecturalBackdrop(day).horizon;
    sceneRef.current?.fog?.color.setRGB(horizon[0] / 255, horizon[1] / 255, horizon[2] / 255, THREE.SRGBColorSpace);
    hemi.intensity = Math.PI * (dayRig.hemi * day + nightRig.hemi * (1 - day));
    hemi.color.copy(HEMI_NIGHT_SKY).lerp(daySky, day);
    hemi.groundColor.copy(HEMI_NIGHT_GROUND).lerp(dayBounce, day);
    // The sun's share grows as it climbs, bounded by this presentation's daylight rig.
    const up = Math.max(0, Math.sin((s.elevationDeg * Math.PI) / 180));
    sun.intensity = Math.PI * dayRig.sun * Math.min(1, up * 1.4) * day;
    sun.color.set(sunColourHex(s.elevationDeg));
    fill.intensity = Math.PI * (dayRig.fill * day + nightRig.fill * (1 - day));
    if (rimRef.current) rimRef.current.intensity = Math.PI * (dayRig.rim * day + nightRig.rim * (1 - day));
    aimSun(new THREE.Vector3(s.direction.x, Math.max(0.05, s.direction.z), s.direction.y));
    sunStateRef.current = { elevationDeg: s.elevationDeg, azimuthDeg: s.azimuthDeg };
    if (skyRef.current) {
      const quant = Math.round(day * 20) / 20;
      if (skyRef.current.userData.day !== quant || skyRef.current.userData.presentation !== presentation || skyRef.current.userData.buildSkin !== buildSkin) updateSkyDome(skyRef.current, quant, presentation, buildSkin);
    }
    const lamps = lampsOnFactor(s.elevationDeg);
    for (const l of lampsRef.current) {
      l.light.intensity = l.baseIntensity * lamps;
      l.glow.visible = lamps > 0;
      (l.glow.material as THREE.MeshBasicMaterial).color.set(lamps > 0.5 ? 0xffe9c4 : 0xe9e2d3);
    }
  };

  // ---- renderer + lights, once ------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      failedRef.current = true;
      onFailed?.();
      return;
    }
    renderer.setPixelRatio(qualityRef.current.pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Colour truth (Vic 2026-09-17): the wall must be the SAME hex as the
    // 2D chip and the merchant's colour card. Filmic tone mapping remaps
    // every pixel (ACES washed tints toward grey), so none — a lit face
    // renders its albedo. The rig sums to ≈1.0 on a camera-facing wall:
    // hemisphere 0.72 π (flat, everywhere) + fill 0.25 π · cos (from the
    // camera) + sun 0.25 π · cos (for the shadows) — the STUDIO numbers in
    // renderPresentation.ts, which both colour-check presentations keep.
    // Natural light explicitly opts into a different rig after scene setup.
    // Measured,
    // not assumed: a wall painted #4C493F reads back within a few points of
    // #4C493F on the far walls (the pixel probe in paint-sims-3d.spec.ts
    // pins it; realism-3d.spec.ts pins the architectural look to ±3 of it).
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const sky = skyDome(1);
    scene.add(sky);
    skyRef.current = sky;

    const cam = new THREE.PerspectiveCamera(50, 1.4, 0.05, 250);
    cameraRef.current = cam;

    // Physical light units (r155+): a lit Lambert face renders albedo ×
    // intensity × cos / π, so the rig is stated in multiples of π. Measured
    // on a #808080 room with the DEV `tune()` knob: hemisphere alone at
    // 0.8 π → 0.76 of the hex on a wall; sun / fill add their cos share.
    const hemi = new THREE.HemisphereLight(HEMI_DAY_SKY, HEMI_DAY_GROUND, Math.PI * STUDIO.hemi);
    scene.add(hemi);
    hemiRef.current = hemi;
    const sun = new THREE.DirectionalLight(0xfff6ea, Math.PI * STUDIO.sun);
    sun.castShadow = true;
    sun.shadow.mapSize.set(qualityRef.current.shadowSize, qualityRef.current.shadowSize);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    sunRef.current = sun;
    const fill = new THREE.DirectionalLight(0xffffff, Math.PI * STUDIO.fill);
    scene.add(fill);
    scene.add(fill.target);
    fillRef.current = fill;
    const rim = new THREE.DirectionalLight(0xb9d3ff, 0);
    scene.add(rim, rim.target);
    rimRef.current = rim;

    // Something for a sheen to reflect: a neutral room environment, handed
    // to the materials that have a sheen (silk / satin / gloss, the product
    // bodies) — never set on the scene, see applyWallLook.
    const prepareEnvironment = () => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = new RoomEnvironment();
      try {
        envTargetRef.current = pmrem.fromScene(environment, 0.04);
        envRef.current = envTargetRef.current.texture;
      } catch {
        envRef.current = null; /* no environment: finishes read flat, colours unaffected */
      }
      pmrem.dispose(); environment.dispose();
    };
    // Natural gets its real diffuse scene on screen before reflections and
    // physical shader detail. Calibrated colour-check views keep their rig.
    detailReadyRef.current = presentation !== 'natural';
    if (detailReadyRef.current) prepareEnvironment();
    prepareDetailsRef.current = () => {
      if (rendererRef.current !== renderer) return;
      prepareEnvironment();
      for (const entry of wallsRef.current) {
        applyWallLook(entry.paint, entry.solid, envRef.current);
        applyWallLook(entry.exterior, exteriorLook(entry.solid), envRef.current);
      }
      for (const floor of floorsRef.current) {
        const material = floor.material as THREE.MeshPhysicalMaterial;
        if (material.envMapIntensity > 0) { material.envMap = envRef.current; material.needsUpdate = true; }
      }
      for (const item of itemsRef.current) applyProductSurfaceLighting(item, envRef.current,
        Math.min(qualityRef.current.anisotropy, renderer.capabilities.getMaxAnisotropy()));
      const ready = () => {
        if (rendererRef.current !== renderer) return;
        detailReadyRef.current = true;
        firstMaterialsRef.current?.dispose(); firstMaterialsRef.current = null;
        requestRender();
      };
      // compileAsync starts shader work without a blocking first full draw.
      if (cameraRef.current && typeof renderer.compileAsync === 'function') {
        void renderer.compileAsync(scene, cameraRef.current).then(ready, ready);
      } else ready();
    };

    const ground = groundPlane();
    scene.add(ground);
    groundRef.current = ground;

    const content = new THREE.Group();
    scene.add(content);
    contentRef.current = content;
    const services = new THREE.Group();
    services.name = 'building-service-fixtures';
    scene.add(services);
    servicesRef.current = services;
    const eco = new THREE.Group(); scene.add(eco); ecoRef.current = eco;
    const foundationGroup = new THREE.Group();
    scene.add(foundationGroup);
    foundationRef.current = foundationGroup;

    const onLost = (e: Event) => {
      e.preventDefault();
      failedRef.current = true;
      onFailed?.();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      clearViewHover(); clearEraseHover();
      if (catalogGhostRef.current) { disposeObject(catalogGhostRef.current.root); catalogGhostRef.current = null; }
      canvas.removeEventListener('webglcontextlost', onLost);
      // Clear the handle too: a cancelled frame left in the ref would make
      // every later requestRender() think a frame is already pending — zero
      // renders after StrictMode's dev remount (the "blank 3D" bug).
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (shadingTimerRef.current !== null) clearTimeout(shadingTimerRef.current);
      shadingTimerRef.current = null;
      if (detailTimerRef.current !== null) clearTimeout(detailTimerRef.current);
      detailTimerRef.current = null;
      if (firstRefreshTimerRef.current !== null) clearTimeout(firstRefreshTimerRef.current);
      firstRefreshTimerRef.current = null;
      prepareDetailsRef.current = null;
      firstMaterialsRef.current?.dispose(); firstMaterialsRef.current = null;
      firstPreparationRef.current = null;
      firstPictureAtRef.current = null;
      firstFullPictureAtRef.current = null;
      pendingBodiesRef.current = 0;
      framesRef.current = 0;
      failedRef.current = false;
      naturalRendererRef.current?.dispose();
      naturalRendererRef.current = null;
      naturalUnavailableRef.current = false;
      if (contentRef.current) disposeObject(contentRef.current);
      if (servicesRef.current) disposeObject(servicesRef.current);
      if (ecoRef.current) disposeObject(ecoRef.current);
      if (foundationRef.current) disposeObject(foundationRef.current);
      disposeObject(ground);
      disposeObject(sky);
      envTargetRef.current?.dispose();
      envTargetRef.current = null;
      envRef.current = null;
      signatureRef.current = '';
      // dispose() only — forceContextLoss() would leave the canvas's context
      // LOST for the next mount (StrictMode remounts in dev; a view that
      // closes and reopens on the same element), and three then reads a null
      // precision format and refuses to start.
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      contentRef.current = null;
      servicesRef.current = null;
      foundationRef.current = null;
      gardenRef.current = null;
      ecoRef.current = null;
      skyRef.current = null;
      groundRef.current = null;
      hemiRef.current = null;
      sunRef.current = null;
      fillRef.current = null;
      rimRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- geometry, on plan change ---------------------------------------------
  useEffect(() => {
    const content = contentRef.current;
    const sun = sunRef.current;
    if (!content || !sun) return;
    clearViewHover(); clearEraseHover();

    // Same room, new paint: repaint in place (see structureSignature).
    const signature = structureSignature(solids);
    if (signature === signatureRef.current && wallsRef.current.length === solids.walls.length) {
      const byKey = new Map(solids.walls.map((w) => [w.key, w]));
      for (const e of wallsRef.current) {
        const w = byKey.get(e.solid.key);
        if (!w) continue;
        e.solid = w;
        e.baseHex = w.hex;
        applyWallLook(e.paint, w, envRef.current);
        applyWallLook(e.exterior, exteriorLook(w), envRef.current);
      }
      requestRender();
      return;
    }
    signatureRef.current = signature;

    disposeObject(content);
    content.clear();
    wallsRef.current = [];
    floorsRef.current = [];
    itemsRef.current = [];
    roofsRef.current = [];
    lampsRef.current = [];
    shadowsRef.current = [];
    hoveredRef.current = null;
    previewRef.current.clear();
    previewRotationRef.current.clear();
    selectedRootRef.current = null;
    gardenRef.current = null;
    padRef.current = null;
    hullRef.current = null;

    const bounds = new THREE.Box3();

    for (const f of solids.floors) {
      const mesh = floorMesh(f, (f.kind as FloorKind | undefined) ?? 'screed', f.tileM ?? 0.5, envRef.current);
      (mesh.material as THREE.MeshPhysicalMaterial).color.multiplyScalar(FLOOR_GAIN);
      content.add(mesh);
      floorsRef.current.push(mesh);
      bounds.expandByObject(mesh);
    }

    const reveal = new THREE.MeshPhysicalMaterial({ color: REVEAL_HEX, roughness: 0.95, metalness: 0, envMapIntensity: 0, specularIntensity: 0 });
    const cap = new THREE.MeshPhysicalMaterial({ color: CAP_HEX, roughness: 0.9, metalness: 0, envMapIntensity: 0, specularIntensity: 0 });
    reveal.userData.stageSurface = 'reveal';
    cap.userData.stageSurface = 'cap';
    for (const w of solids.walls) {
      const exterior = new THREE.MeshPhysicalMaterial();
      // A user's façade material must not be recoloured by the studio/house theme.
      exterior.userData.wallSurface = 'exterior';
      applyWallLook(exterior, exteriorLook(w), envRef.current);
      const paint = new THREE.MeshPhysicalMaterial();
      applyWallLook(paint, w, envRef.current);
      const group = new THREE.Group();
      group.visible = !w.renderDuplicateOf;
      const full = slabObject(w, w.heightM, paint, reveal, exterior, cap);
      const stub = slabObject(w, w.stubHeightM, paint, reveal, exterior, cap);
      stub.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData.wall) o.userData = { ...o.userData, key: w.key.replace(/^wall-/, 'stub-'), stub: true };
      });
      const outlineFull = faceOutline(w, w.heightM);
      const outlineStub = faceOutline(w, w.stubHeightM);
      group.add(full, stub, outlineFull, outlineStub);
      placeWall(w, group);
      content.add(group);
      group.updateMatrixWorld(true);
      wallsRef.current.push({ solid: w, group, full, stub, paint, exterior, baseHex: w.hex, outlineFull, outlineStub, show: 'full', ghost: false });
      bounds.expandByObject(full);
    }

    const buildId = ++buildRef.current;
    pendingBodiesRef.current = 0;
    for (const it of solids.items) {
      // Known furniture has a shaped, explicitly approximate planning body.
      // Other products retain their own art; an exact GLTF always replaces it.
      const solarPreview = solarPanelPreview(it);
      const tankPreview = waterTankPreview(it);
      const preview = serviceProductPreview(it) ?? solarPreview ?? tankPreview ?? furniturePreview(it);
      // A dimensional preview is flagged so the DEV bridge can tell it from a
      // loaded body and from a bare box (`dressing().bareBoxes`).
      if (preview) preview.userData.preview = true;
      const mesh = mountRoofItem(preview ?? artBox(it, requestRender), it);
      applyProductSurfaceLighting(mesh, envRef.current, Math.min(qualityRef.current.anisotropy, rendererRef.current?.capabilities.getMaxAnisotropy() ?? 1));
      content.add(mesh);
      itemsRef.current.push(mesh);
      bounds.expandByObject(mesh);
      // Grounded on the floor: a soft contact shadow under every standing body.
      const shadow = it.roofMount ? null : contactShadow(it);
      if (shadow) {
        content.add(shadow);
        shadowsRef.current.push(shadow);
      }
      // A lamp: a warm light at its source, off by day, on after dark.
      if (it.emitsLight) {
        const lamp = nightLight(it, it.lightMountM ?? Math.min(it.z1, solids.wallHeightM - 0.3));
        lamp.light.intensity = 0;
        content.add(lamp.light, lamp.glow);
        lampsRef.current.push(lamp);
      }
      // Swap the preview for the product's body once it has loaded — unless the
      // plan has been rebuilt since (a stale load must not resurrect).
      if (it.meshUrl && (it.preferMesh || (!solarPreview && !tankPreview))) {
        pendingBodiesRef.current += 1;
        loadBody(it.meshUrl)
          .then((tpl) => {
            if (buildRef.current !== buildId || !contentRef.current) return;
            const body = mountRoofItem(bodyObject(it, tpl), it);
            if (it.roofMount) {
              // A model may arrive midway through a pointer drag. Keep the
              // current preview's pose instead of jumping to the saved slot.
              body.position.copy(mesh.position);
              body.quaternion.copy(mesh.quaternion);
              const heading = body.getObjectByName('roof-item-heading');
              const previousHeading = mesh.getObjectByName('roof-item-heading');
              if (heading && previousHeading) heading.rotation.copy(previousHeading.rotation);
            } else {
              const home = previewRef.current.get(it.instanceId);
              const rotation = previewRotationRef.current.get(it.instanceId);
              const baseline = carryItemPreviewPose(mesh, body, home, rotation);
              if (home) previewRef.current.set(it.instanceId, baseline.home);
              if (rotation !== undefined) previewRotationRef.current.set(it.instanceId, baseline.rotation);
            }
            applyProductSurfaceLighting(body, envRef.current, Math.min(qualityRef.current.anisotropy, rendererRef.current?.capabilities.getMaxAnisotropy() ?? 1));
            contentRef.current.remove(mesh);
            disposeObject(mesh);
            contentRef.current.add(body);
            const i = itemsRef.current.indexOf(mesh);
            if (i >= 0) itemsRef.current[i] = body;
            if (selectedRootRef.current === mesh) {
              selectedRootRef.current = body;
              tintItem(body, SELECT_HEX, 0.12);
              const oldHull = hullRef.current;
              if (oldHull) {
                oldHull.parent?.remove(oldHull);
                disposeObject(oldHull);
              }
              const hull = makeHull(body);
              contentRef.current.add(hull);
              hullRef.current = hull;
            }
            requestRender();
          })
          .catch(() => {
            /* the dimensional preview or art box stays */
          }).finally(() => { if (buildRef.current === buildId) pendingBodiesRef.current = Math.max(0, pendingBodiesRef.current - 1); });
      }
    }

    if (solids.gardenVisible !== false) {
      const groundRooms = solids.gardenObstacles ?? solids.floors.filter((floor) => (floor.elevationM ?? 0) < 0.01).map((floor) => floor.polygon);
      const garden = gardenMeshes(solids.garden, groundRooms, solids.gardenSite);
      gardenRef.current = garden;
      content.add(garden);
      // A large plot must not spread the house's finite shadow map over its
      // entire lawn. User-built terrain/fences still participate in lighting.
      for (const child of garden.children) if (!child.userData.automaticLawn) bounds.expandByObject(child);
    }
    for (const run of solids.stairs ?? []) {
      const stairs = stairMesh(run.stair, run.baseM, run.riseM);
      content.add(stairs);
      bounds.expandByObject(stairs);
    }
    for (const roof of solids.roofs ?? []) {
      const mesh = roofMesh(roof.polygon, roof.elevationM, roof.config);
      mesh.userData.levelId = roof.levelId;
      content.add(mesh);
      mesh.updateMatrixWorld(true);
      roofsRef.current.push(mesh);
      bounds.expandByObject(mesh);
    }
    // The sun's shadow camera hugs whatever is drawn; the rig for the hour follows.
    structureBoundsRef.current.copy(bounds);
    boundsRef.current = {
      centre: bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3()),
      radius: bounds.isEmpty() ? 6 : Math.max(4, bounds.getSize(new THREE.Vector3()).length() / 2),
    };
    applyPresentation();
    applyHour(hour);
    applySceneTextureSampling(content, Math.min(qualityRef.current.anisotropy, rendererRef.current?.capabilities.getMaxAnisotropy() ?? 1));
    // Compile every shader variant OFF the main thread's critical path before
    // the first frame (a room with several finishes used to block the page
    // while it compiled on that frame); a renderer without the async path
    // just draws.
    const r = rendererRef.current;
    const s = sceneRef.current;
    const c = cameraRef.current;
    if (detailReadyRef.current && r && s && c && typeof r.compileAsync === 'function') {
      r.compileAsync(s, c).then(() => requestRender()).catch(() => requestRender());
    } else {
      requestRender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solids]);

  // Services are presentation geometry only. Rebuilding their small dedicated
  // group never moves the camera, changes a room footprint or enters the cart.
  useEffect(() => {
    const group = servicesRef.current;
    if (!group) return;
    disposeObject(group);
    group.clear();
    for (const fixture of serviceFixtures ?? []) group.add(serviceFixtureMesh(fixture));
    for (const run of serviceRuns ?? []) group.add(serviceRouteMesh(run));
    group.updateMatrixWorld(true);
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFixtures, serviceRuns]);

  // Vegetation has its own bounded instanced group: changing a tree does not
  // rebuild furniture or reset the camera. It is ground context, never a storey asset.
  useEffect(() => {
    const group = ecoRef.current;
    if (!group) return;
    disposeObject(group); group.clear();
    if (solids.gardenVisible !== false && ecoTrees?.length) group.add(ecoTreeMeshes(ecoTrees, solids.garden));
    group.updateMatrixWorld(true);
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecoTrees, solids.garden, solids.gardenVisible]);

  // Explicit below-ground inspection never moves the camera or changes geometry.
  useEffect(() => {
    const group = foundationRef.current;
    if (!group) return;
    disposeObject(group); group.clear();
    if (foundation?.enabled) group.add(foundationMeshes(foundation, foundationBaseElevationM, false, foundationView));
    const inspect = foundationView && hasFoundationGeometry(foundation);
    setFoundationInspection([groundRef.current, ...floorsRef.current, gardenRef.current, ...shadowsRef.current], inspect);
    if (groundRef.current) groundRef.current.visible = groundVisible && !inspect;
    group.updateMatrixWorld(true);
    const bounds = structureBoundsRef.current.clone();
    if (foundation?.enabled) bounds.expandByObject(group);
    if (ecoRef.current?.children.length) bounds.expandByObject(ecoRef.current);
    boundsRef.current = { centre: bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3()),
      radius: bounds.isEmpty() ? 6 : Math.max(4, bounds.getSize(new THREE.Vector3()).length() / 2) };
    applyPresentation();
    applyHour(hour);
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundation, foundationView, foundationBaseElevationM, solids, ecoTrees, groundVisible]);

  // ---- the hour: sun, sky, lamps -----------------------------------------
  useEffect(() => {
    applyHour(hour);
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, doy, presentation, buildSkin]);

  useEffect(() => {
    applyPresentation();
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation, buildSkin]);

  // View quality never rebuilds room/product solids or changes the camera.
  useEffect(() => {
    const key=JSON.stringify([qualityChoice,signatureRef.current,width,height,presentation]);
    if(autoSceneKeyRef.current===key)return;
    autoSceneKeyRef.current=key;
    autoAoRef.current = createAutoAoState();
    if (qualityChoice === 'auto') requestRender(false);
    // Re-test after a different scene/viewport, not every camera or pointer move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityChoice, solids, width, height, presentation]);
  // Drop the optional GPU buffers when they are not needed (including phones).
  useEffect(() => {
    const r = rendererRef.current, sun = sunRef.current;
    if (!r || !sun) return;
    if (!quality.ambientOcclusion) {
      naturalRendererRef.current?.dispose();
      naturalRendererRef.current = null;
    }
    r.setPixelRatio(quality.pixelRatio);
    if (sun.shadow.mapSize.x !== quality.shadowSize) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    }
    if (sceneRef.current) applySceneTextureSampling(sceneRef.current, Math.min(quality.anisotropy, r.capabilities.getMaxAnisotropy()));
    requestRender();
    // All captured settings are listed; renderer/camera refs stay mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality.ambientOcclusion, quality.pixelRatio, quality.shadowSize, quality.anisotropy]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const clear = () => {
      const old = catalogGhostRef.current;
      if (old) { scene.remove(old.root); disposeObject(old.root); catalogGhostRef.current = null; }
    };
    if (!catalogPreview) { clear(); requestRender(false); return; }
    const { item, valid } = catalogPreview;
    const key = JSON.stringify([item.productId,item.meshUrl,item.lengthM,item.widthM,item.heightM]);
    const decorate = (root:THREE.Object3D, allowed:boolean) => {
      root.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = false; mesh.receiveShadow = false;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          material.transparent = true; material.opacity = .48; material.depthWrite = false;
          const standard = material as THREE.MeshStandardMaterial;
          if (standard.color) standard.color.set(allowed ? '#39c8c2' : '#df554f');
          if (standard.emissive) { standard.emissive.set(allowed ? '#39c8c2' : '#df554f'); standard.emissiveIntensity = .35; }
        }
      });
    };
    let ghost = catalogGhostRef.current;
    if (!ghost || ghost.key !== key) {
      clear();
      const body = serviceProductPreview(item) ?? solarPanelPreview(item) ?? waterTankPreview(item) ?? furniturePreview(item);
      const root = body ?? new THREE.Mesh(new THREE.BoxGeometry(item.lengthM,item.heightM,item.widthM),new THREE.MeshStandardMaterial({color:valid?'#39c8c2':'#df554f'}));
      if (!body) { const envelope=productEnvelope(item);root.position.copy(envelope.position);root.rotation.y=envelope.yawRad; }
      decorate(root,valid);scene.add(root);ghost={key,root,item,valid};catalogGhostRef.current=ghost;
      if (item.meshUrl) loadBody(item.meshUrl).then(template => {
        const current = catalogGhostRef.current;
        if (!current || current.key !== key || current.root !== root || !sceneRef.current) return;
        const exact = bodyObject(current.item,template);decorate(exact,current.valid);
        sceneRef.current.remove(current.root);disposeObject(current.root);sceneRef.current.add(exact);
        current.root=exact;requestRender(false);
      }).catch(()=>{ /* Keep the catalog-sized fallback if the model is unavailable. */ });
    } else {
      const previous = ghost.item;
      ghost.root.position.x += (item.x0+item.x1-previous.x0-previous.x1)/2;
      ghost.root.position.z += (item.y0+item.y1-previous.y0-previous.y1)/2;
      ghost.root.position.y += item.z0-previous.z0;
      ghost.root.rotation.y -= (item.rotationDeg-previous.rotationDeg)*Math.PI/180;
      if (valid !== ghost.valid) decorate(ghost.root,valid);
      ghost.item=item;ghost.valid=valid;
    }
    requestRender(false);
    // A pointer pose only updates this private object, not scene bounds/solids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogPreview]);

  // ---- camera + cutaway, on orbit / resize -------------------------------------
  useEffect(() => {
    if (!viewHoverEnabled || brushHex !== undefined || brushConstruction) {
      clearViewHover(); requestRender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewHoverEnabled, brushHex, brushConstruction]);
  useEffect(() => {
    const r = rendererRef.current;
    let c = cameraRef.current;
    if (!r || !c || width < 8 || height < 8) return;
    if ((projection === 'orthographic') !== (c instanceof THREE.OrthographicCamera)) {
      // Only the camera changes; product geometry, textures and the renderer stay mounted.
      naturalRendererRef.current?.dispose();
      naturalRendererRef.current = null;
      c = projection === 'orthographic' ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, c.far) : new THREE.PerspectiveCamera(50, 1, 0.05, c.far);
      cameraRef.current = c;
    }
    // WebGLRenderer.setSize writes canvas.width/height even when unchanged,
    // reallocating/clearing the drawing buffer. Orbit changes the camera,
    // not the viewport: resize only when the actual layout dimensions change.
    const viewport = r.getSize(drawingSizeRef.current);
    if (viewport.x !== width || viewport.y !== height) r.setSize(width, height, false);
    if (c instanceof THREE.PerspectiveCamera) {
      c.aspect = width / height;
      c.fov = (camera.fovRad * 180) / Math.PI;
    } else {
      const halfHeight = camera.distanceM * Math.tan(camera.fovRad / 2);
      c.left = -halfHeight * width / height; c.right = -c.left;
      c.top = halfHeight; c.bottom = -halfHeight;
    }
    if (canvasRef.current) canvasRef.current.dataset.projection = projection;
    const pos = cameraPosition(camera);
    c.position.copy(toThree(pos));
    targetRef.current = toThree(camera.target).toArray();
    c.up.set(0, 1, 0);
    c.lookAt(toThree(camera.target));
    c.updateProjectionMatrix();
    // Raycasts and screen projections read the camera's WORLD matrices,
    // which the renderer would only refresh on its next frame — a click or
    // a bridge call between an orbit and that frame would otherwise aim
    // with the previous camera (the e2e's first click landed on nothing).
    c.updateMatrixWorld(true);
    // The fog's near plane follows the camera (colour truth at any zoom).
    updateFog();

    // The fill rides with the camera, a little above it, so whichever walls
    // face the viewer are lit to their colour. The sky dome rides too, so
    // its horizon never comes into reach.
    const fill = fillRef.current;
    if (fill) {
      fill.position.copy(c.position).add(new THREE.Vector3(0, 4, 0));
      fill.target.position.copy(toThree(camera.target));
      fill.target.updateMatrixWorld();
    }
    if (skyRef.current) skyRef.current.position.set(c.position.x, 0, c.position.z);

    // Walls Up / Cutaway / Down: the same slabs, only visibility flips.
    const viewCameraKey=JSON.stringify([camera,projection,width,height,wallView]);
    if(viewCameraKeyRef.current!==viewCameraKey)clearViewHover();
    viewCameraKeyRef.current=viewCameraKey;
    const state = wallView === 'cutaway' ? cutawayState(solids, pos, camera.target) : null;
    let shadowsChanged = false;
    for (const e of wallsRef.current) {
      const show: WallShow = e.solid.renderDuplicateOf ? 'hidden' : wallView === 'up' ? 'full' : wallView === 'down' ? 'stub' : (state?.get(e.solid.key) ?? 'full');
      shadowsChanged ||= e.show !== show || Boolean(e.ghost && show !== 'stub');
      e.show = show;
      if (e.ghost && show !== 'stub') setGhost(e, false);
      e.full.visible = show === 'full' || e.ghost;
      e.stub.visible = show === 'stub';
      if(viewLoweredRef.current===e)applyWallHoverVisibility(e,true);
      const target = hoveredRef.current === e;
      e.outlineFull.visible = target && (show === 'full' || e.ghost);
      e.outlineStub.visible = target && show === 'stub' && !e.ghost;
    }
    requestRender(shadowsChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, projection, width, height, solids, wallView]);

  // ---- selection (the plan's selection, mirrored) -----------------------------------
  // A mint pad on the floor under the picked body — the Sims' footprint
  // highlight — plus a tint on the body itself. The pad lives in the content
  // group, which a plan change rebuilds, so it is re-laid on every rebuild.
  useEffect(() => {
    const prev = selectedRootRef.current;
    if (prev) tintItem(prev, null, 0);
    const oldPad = padRef.current;
    if (oldPad) {
      oldPad.parent?.remove(oldPad);
      oldPad.geometry.dispose();
      (oldPad.material as THREE.Material).dispose();
      padRef.current = null;
    }
    const oldHull = hullRef.current;
    if (oldHull) {
      oldHull.parent?.remove(oldHull);
      disposeObject(oldHull);
      hullRef.current = null;
    }
    const next = selectedInstanceId ? itemsRef.current.find((o) => o.userData.instanceId === selectedInstanceId) ?? null : null;
    // A hint of mint on the body and a rim around it — the product keeps its
    // own colours (a 0.5 emissive turned a black machine into a mint ghost).
    if (next) {
      tintItem(next, SELECT_HEX, 0.12);
      if (contentRef.current) {
        const hull = makeHull(next);
        contentRef.current.add(hull);
        hullRef.current = hull;
      }
    }
    selectedRootRef.current = next;
    const s = selectedInstanceId ? solids.items.find((i) => i.instanceId === selectedInstanceId) : undefined;
    if (s && !s.roofMount && contentRef.current) {
      const m = 0.06;
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(s.x1 - s.x0 + 2 * m, s.y1 - s.y0 + 2 * m),
        new THREE.MeshBasicMaterial({ color: SELECT_HEX, transparent: true, opacity: 0.55, depthWrite: false }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set((s.x0 + s.x1) / 2, s.z0 + 0.012, (s.y0 + s.y1) / 2);
      pad.userData = { key: `pad-${s.instanceId}` };
      contentRef.current.add(pad);
      padRef.current = pad;
    }
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstanceId, solids]);

  // ---- the paint target (The Sims' wallpaper preview) ------------------------------
  // The hovered wall shows the BRUSH colour before the click and a mint
  // outline says which wall; leaving it restores its own colour. A yellow
  // glow used to sit on the wall instead — the same glow before and after
  // the click, so a paint looked like nothing happened.
  useEffect(() => {
    const prev = hoveredRef.current;
    if (prev) {
      applyWallLook(prev.paint, prev.solid, envRef.current);
      applyWallLook(prev.exterior, exteriorLook(prev.solid), envRef.current);
      prev.outlineFull.visible = false;
      prev.outlineStub.visible = false;
      setGhost(prev, false);
    }
    const matched = hover ? wallsRef.current.find((e) => sameHit(hover, e.solid.hit)) ?? null : null;
    const next = matched?.solid.renderDuplicateOf
      ? wallsRef.current.find(e => e.solid.key === matched.solid.renderDuplicateOf) ?? null : matched;
    if (next) {
      if (brushHex !== undefined) {
        applyWallLook(brushSide === 'exterior' ? next.exterior : next.paint, { hex: brushHex ?? BARE_PLASTER_HEX, finish: brushConstruction ? null : brushHex ? brushFinish : null, construction: brushConstruction ?? next.solid.construction }, envRef.current);
      }
      const outlineOffset = brushSide === 'exterior' ? -next.solid.thicknessM - 0.012 : 0;
      next.outlineFull.position.z = outlineOffset; next.outlineStub.position.z = outlineOffset;
      // A cut wall under the brush stands up as a ghost so the whole face previews.
      const ghost = brushHex !== undefined && next.show === 'stub';
      setGhost(next, ghost);
      next.outlineFull.visible = next.show === 'full' || ghost;
      next.outlineStub.visible = next.show === 'stub' && !ghost;
    }
    hoveredRef.current = next;
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, solids, brushHex, brushFinish, brushSide, brushConstruction]);

  useImperativeHandle(
    ref,
    () => {
      const api:ThreeStageHandle = {
      beginWalk() {
        const scene = sceneRef.current, renderer = rendererRef.current;
        if (!scene || !renderer) return null;
        walkOwnsFrames.current = true;
        return {
          scene, renderer,
          render(view) {
            if (fillRef.current) {
              fillRef.current.position.copy(view.position).add(new THREE.Vector3(0, 4, 0));
              fillRef.current.target.position.copy(view.position);
              fillRef.current.target.updateMatrixWorld();
            }
            if (skyRef.current) skyRef.current.position.set(view.position.x, 0, view.position.z);
            if (scene.fog instanceof THREE.Fog) {
              scene.fog.near = view.position.distanceTo(boundsRef.current.centre) + boundsRef.current.radius + FOG_CLEARANCE_M;
              scene.fog.far = scene.fog.near + Math.max(60, boundsRef.current.radius * 8);
            }
            renderer.render(scene, view);
          },
          release() { walkOwnsFrames.current = false; requestRender(); },
        };
      },
      viewHover(x,y) {
        if(x===null||y===undefined||!viewHoverEnabled||brushHex!==undefined||brushConstruction||catalogPreview||solids.activeRoof){
          if(viewLoweredRef.current){clearViewHover();requestRender();}return;
        }
        const c=cameraRef.current;if(!c||width<8||height<8)return;
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/width*2-1,-y/height*2+1),c);
        // Full geometry remains the hover boundary even after the visible wall
        // is lowered, preventing hide/show flicker while the cursor stays there.
        const candidates=wallsRef.current.filter(e=>e.show==='full'&&!e.solid.renderDuplicateOf&&(!solids.activeLevelId||e.solid.levelId===solids.activeLevelId));
        const meshes:THREE.Object3D[]=[];
        for(const e of candidates)e.full.traverse(o=>{if(o.userData.wall)meshes.push(o);});
        const hit=ray.intersectObjects(meshes,false)[0];
        let next=hit?candidates.find(e=>e.solid.key===hit.object.userData.key)??null:null;
        if(hit){
          const item=ray.intersectObjects(itemsRef.current,true)[0],floor=ray.intersectObjects(floorsRef.current,false)[0];
          if((item&&item.distance<hit.distance)||(floor&&floor.distance<hit.distance))next=null;
        }
        if(next===viewLoweredRef.current)return;
        clearViewHover();viewLoweredRef.current=next;
        if(next)applyWallHoverVisibility(next,true);
        if(rendererRef.current)rendererRef.current.domElement.dataset.hoverCutaway=next?.solid.key??'';
        requestRender();
      },
      hitErase(x,y) {
        // The existing picking methods already apply active-level and front
        // obstruction rules; removal must not reach through a wall or item.
        const item=api.hitItem(x,y);if(item)return {kind:'item',instanceId:item.instanceId};
        if(solids.activeRoof)return null;
        const opening=api.hitOpening?.(x,y);if(opening)return {kind:'opening',openingId:opening};
        const wall=api.hitTest(x,y);if(wall)return {kind:'wall',hit:wall};
        const c=cameraRef.current;if(!c||width<8||height<8)return null;
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/width*2-1,-y/height*2+1),c);
        const floorHit=ray.intersectObjects(floorsRef.current,false)[0];if(!floorHit)return null;
        const floor=solids.floors.find(f=>f.key===floorHit.object.userData.key);
        if(!floor||solids.activeLevelId&&floor.levelId&&floor.levelId!==solids.activeLevelId)return null;
        return {kind:'floor',roomId:floor.roomId,point:{x:floorHit.point.x,y:floorHit.point.z}};
      },
      setEraseHover(target,floorOutline) {
        const key=target?.kind==='floor'?`floor:${target.roomId}:${JSON.stringify(floorOutline)}`:JSON.stringify(target);
        if(eraseHighlightRef.current?.key===key)return;
        clearEraseHover();clearViewHover();
        if(!target||!sceneRef.current){requestRender(false);return;}
        let objects:THREE.Object3D[]=[];let temporary:THREE.Mesh|null=null;
        if(target.kind==='item')objects=itemsRef.current.filter(o=>o.userData.instanceId===target.instanceId);
        if(target.kind==='wall'){
          const entry=wallsRef.current.find(e=>sameHit(e.solid.hit,target.hit)&&!e.solid.renderDuplicateOf);
          const node=entry?.show==='full'?entry.full:entry?.show==='stub'?entry.stub:null;
          node?.traverse(o=>{if(o.userData.wall)objects.push(o);});
        }
        if(target.kind==='floor'){
          const keys=new Set(solids.floors.filter(f=>f.roomId===target.roomId).map(f=>f.key));
          objects=floorsRef.current.filter(f=>keys.has(f.userData.key));
        }
        if(target.kind==='opening')for(const entry of wallsRef.current){
          const opening=entry.solid.openings.find(o=>o.id===target.openingId);
          if(!opening||entry.show==='hidden'||entry.solid.renderDuplicateOf)continue;
          const top=Math.min(opening.topM,entry.show==='full'?entry.solid.heightM:entry.solid.stubHeightM+.02);
          const bottom=Math.min(opening.bottomM,top-.025);
          temporary=new THREE.Mesh(new THREE.BoxGeometry(opening.t1M-opening.t0M,top-bottom,entry.solid.thicknessM+.04),new THREE.MeshBasicMaterial());
          const transform=new THREE.Matrix4().makeTranslation((opening.t0M+opening.t1M)/2,(top+bottom)/2,entry.solid.thicknessM/2);
          entry.full.updateWorldMatrix(true,false);temporary.applyMatrix4(transform.premultiply(entry.full.matrixWorld));objects=[temporary];break;
        }
        const root=removalHighlight(objects);
        if(target.kind==='floor'&&floorOutline)clipRemovalHighlightToPlanBounds(root,floorOutline);
        if(temporary){temporary.geometry.dispose();(temporary.material as THREE.Material).dispose();}
        sceneRef.current.add(root);eraseHighlightRef.current={key,root};
        if(rendererRef.current)rendererRef.current.domElement.dataset.eraseTarget=target.kind;
        requestRender(false);
      },
      hitOpening(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        let closest: { id: string; distance: number } | null = null;
        const blockers: THREE.Object3D[] = [...floorsRef.current];
        for (const entry of wallsRef.current) {
          const shown=viewLoweredRef.current===entry?'stub':entry.show;
          const node = shown === 'full' ? entry.full : shown === 'stub' ? entry.stub : null;
          if (!node) continue;
          node.traverse(object => { if (object.userData.wall) blockers.push(object); });
          if (solids.activeLevelId && entry.solid.levelId && entry.solid.levelId !== solids.activeLevelId) continue;
          node.updateWorldMatrix(true, false);
          const localRay = ray.ray.clone().applyMatrix4(node.matrixWorld.clone().invert());
          // A cutaway door is represented by a low threshold. Its vertical
          // midpoint can be below the finished floor, so also pick the visible
          // cap plane instead of asking users to click through the floor.
          if (shown === 'stub') {
            const capPoint = localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -entry.solid.stubHeightM - .015), new THREE.Vector3());
            if (capPoint && capPoint.z >= -.08 && capPoint.z <= entry.solid.thicknessM + .08) {
              for (const opening of entry.solid.openings) {
                if (!opening.id || opening.bottomM >= entry.solid.stubHeightM || capPoint.x < opening.t0M || capPoint.x > opening.t1M) continue;
                const distance = node.localToWorld(capPoint.clone()).distanceTo(ray.ray.origin);
                if (!closest || distance < closest.distance) closest = { id: opening.id, distance };
              }
            }
          }
          const point = localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -entry.solid.thicknessM / 2), new THREE.Vector3());
          const shownHeight = shown === 'full' ? entry.solid.heightM : entry.solid.stubHeightM;
          if (!point || point.y < 0 || point.y > shownHeight) continue;
          for (const opening of entry.solid.openings) {
            if (!opening.id || point.x < opening.t0M || point.x > opening.t1M || point.y < opening.bottomM || point.y > opening.topM) continue;
            if (opening.profile && !pointInPolygon({ x: point.x, y: point.y }, opening.profile)) continue;
            const distance = node.localToWorld(point.clone()).distanceTo(ray.ray.origin);
            if (!closest || distance < closest.distance) closest = { id: opening.id, distance };
          }
        }
        if (!closest) return null;
        const blocker = ray.intersectObjects(blockers, false)[0];
        if (blocker && blocker.distance < closest.distance - 0.02) return null;
        const box = new THREE.Box3(), point = new THREE.Vector3();
        for (const item of itemsRef.current) {
          box.setFromObject(item);
          if (!box.isEmpty() && ray.ray.intersectBox(box, point) && point.distanceTo(ray.ray.origin) < closest.distance - 0.02) return null;
        }
        return closest.id;
      },
      hitTest(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        const targets: THREE.Object3D[] = [];
        for (const e of wallsRef.current) {
          if (solids.activeLevelId && e.solid.levelId && e.solid.levelId !== solids.activeLevelId) continue;
          const node = e.show === 'full' ? e.full : e.show === 'stub' ? e.stub : null;
          if (!node) continue;
          node.traverse((o) => {
            if ((o as THREE.Mesh).isMesh && o.userData.wall) targets.push(o);
          });
        }
        const hits = ray.intersectObjects(targets, false);
        const wall = hits[0];
        if (!wall) return null;
        // What is under the cursor is what gets hit: an item (its exact
        // catalog box — the Sims pick the box, and a hollow frame must not
        // let the brush through) or the floor in front of the wall blocks
        // the brush; the wall behind a treadmill used to take the paint.
        let block = Infinity;
        const box = new THREE.Box3();
        const p = new THREE.Vector3();
        for (const o of itemsRef.current) {
          box.setFromObject(o);
          if (!box.isEmpty() && ray.ray.intersectBox(box, p)) block = Math.min(block, p.distanceTo(ray.ray.origin));
        }
        const floorHit = ray.intersectObjects(floorsRef.current, false)[0];
        if (floorHit) block = Math.min(block, floorHit.distance);
        if (block < wall.distance - 1e-4) return null;
        const hit = wall.object.userData.hit as WallHit | undefined;
        return hit ? { ...hit, side: wall.face?.materialIndex === 2 ? 'exterior' : 'interior' } : null;
      },
      wallPoint(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        const targets = wallsRef.current.filter((e) => e.show !== 'hidden' && (!solids.activeLevelId || e.solid.levelId === solids.activeLevelId)).map((e) => e.show === 'full' ? e.full : e.stub);
        const hit = ray.intersectObjects(targets, true).find((h) => h.object.userData.wall);
        return hit ? { x: hit.point.x, y: hit.point.z } : null;
      },
      wallMaterial(hit) {
        const e = wallsRef.current.find((x) => sameHit(hit, x.solid.hit));
        if (!e) return null;
        const face = hit.side === 'exterior' ? e.exterior : e.paint;
        return {
          hex: `#${face.color.getHexString().toUpperCase()}`,
          baseHex: hit.side === 'exterior' ? exteriorLook(e.solid).hex : e.baseHex,
          finish: (hit.side === 'exterior' ? e.solid.exteriorFinish : e.solid.finish) ?? null,
          roughness: face.roughness,
          sheen: face.specularIntensity,
          hasMap: !!face.map,
          show: e.show,
        };
      },
      tune(opts) {
        // DEV bridge: bisect the rig live (a probe sets one thing at a time).
        const s = sceneRef.current;
        if (!s) return;
        s.traverse((o) => {
          const l = o as THREE.Light;
          if ((l as THREE.HemisphereLight).isHemisphereLight && opts.hemi !== undefined) l.intensity = opts.hemi;
          if ((l as THREE.DirectionalLight).isDirectionalLight) {
            if (l === sunRef.current && opts.sun !== undefined) l.intensity = opts.sun;
            if (l === fillRef.current && opts.fill !== undefined) l.intensity = opts.fill;
          }
        });
        if (opts.env !== undefined) {
          for (const e of wallsRef.current) {
            e.paint.envMap = opts.env && e.paint.specularIntensity > 0 ? envRef.current : null;
            e.paint.needsUpdate = true;
          }
        }
        if (opts.normals !== undefined) {
          for (const e of wallsRef.current) {
            e.paint.normalScale.set(opts.normals, opts.normals);
            e.paint.needsUpdate = true;
          }
        }
        if (opts.maps !== undefined) {
          for (const e of wallsRef.current) {
            e.paint.map = opts.maps ? wallTextures().plasterMap : null;
            e.paint.needsUpdate = true;
          }
        }
        requestRender();
      },
      samplePixel(x, y) {
        const r = rendererRef.current;
        const s = sceneRef.current;
        const c = cameraRef.current;
        if (!r || !s || !c) return null;
        // Render now and read straight back, before the compositor swaps.
        r.render(s, c);
        const gl = r.getContext();
        const dpr = r.getPixelRatio();
        const px = new Uint8Array(4);
        gl.readPixels(Math.round(x * dpr), Math.round((height - y) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { r: px[0], g: px[1], b: px[2] };
      },
      screenPoint(hit) {
        const c = cameraRef.current;
        if (!c) return null;
        const e = wallsRef.current.find((x) => sameHit(hit, x.solid.hit));
        if (!e || e.show === 'hidden') return null;
        const p = toThree(wallAnchor(e.solid, e.show)).project(c);
        if (p.z > 1) return null;
        return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
      },
      faceCount() {
        return wallsRef.current.filter((e) => e.show !== 'hidden').length + floorsRef.current.length + itemsRef.current.length;
      },
      faces() {
        const out: Array<{ key: string; holes: number }> = [];
        for (const e of wallsRef.current) {
          if (e.show === 'hidden') continue;
          const node = e.show === 'full' ? e.full : e.stub;
          node.traverse((o) => {
            if ((o as THREE.Mesh).isMesh && o.userData.wall) out.push({ key: o.userData.key as string, holes: o.userData.holes as number });
          });
        }
        for (const f of floorsRef.current) out.push({ key: f.userData.key as string, holes: 0 });
        for (const it of itemsRef.current) out.push({ key: it.userData.key as string, holes: 0 });
        return out;
      },
      hitServiceFixture(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        const visible = (servicesRef.current?.children ?? []).filter(fixture => !solids.activeLevelId || fixture.userData.levelId === solids.activeLevelId);
        const first = ray.intersectObjects(visible, true)[0];
        let node: THREE.Object3D | null = first?.object ?? null;
        while (node && !node.userData.serviceFixtureId) node = node.parent;
        return (node?.userData.serviceFixtureId as string | undefined) ?? null;
      },
      hitItem(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        // The body's own surface first (precise for a tap on a leg or a screen)…
        const activeItems = itemsRef.current.filter((o) => !solids.activeLevelId || solids.items.some((it) => it.instanceId === o.userData.instanceId && it.levelId === solids.activeLevelId));
        const hits = ray.intersectObjects(itemsRef.current, true);
        const root = hits.length ? itemRootOf(hits[0].object) : null;
        // …then the exact catalog box the fit guarantees: a treadmill is air
        // above its deck, a lamp is a thin pole — the Sims pick the box.
        let best: { instanceId: string; d: number } | null = root ? { instanceId: root.userData.instanceId as string, d: hits[0].distance } : null;
        const box = new THREE.Box3();
        const p = new THREE.Vector3();
        for (const o of itemsRef.current) {
          // A tilted, thin panel has mostly empty space inside its world AABB.
          // Its visible model is the useful target, not that inflated box.
          if (o.userData.roofMounted) continue;
          box.setFromObject(o);
          if (box.isEmpty() || !ray.ray.intersectBox(box, p)) continue;
          const d = p.distanceTo(ray.ray.origin);
          if (!best || d < best.d) best = { instanceId: o.userData.instanceId as string, d };
        }
        if (!best || !activeItems.some((o) => o.userData.instanceId === best!.instanceId)) return null;
        // Visible slabs, walls and roof must block objects on another storey.
        const blockers: THREE.Object3D[] = [...floorsRef.current];
        for (const entry of wallsRef.current) {
          if (entry.show !== 'hidden') blockers.push(entry.show === 'full' && viewLoweredRef.current!==entry ? entry.full : entry.stub);
        }
        for (const child of contentRef.current?.children ?? []) {
          if (child.userData.buildingPart) blockers.push(child);
        }
        const obstruction = ray.intersectObjects(blockers, true)[0];
        if (obstruction && obstruction.distance < best.d - 0.001) return null;
        return { instanceId: best.instanceId };
      },
      constructionPoint(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        const p = new THREE.Vector3();
        return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(solids.activeElevationM ?? 0)), p) ? { x: p.x, y: p.z } : null;
      },
      floorPoint(x, y) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), c);
        if (solids.activeRoof) {
          return roofPointFromRay(ray, roofsRef.current.filter((roof) => !roof.userData.levelId || roof.userData.levelId === solids.activeLevelId));
        }
        const p = new THREE.Vector3();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(solids.activeElevationM ?? 0));
        return ray.ray.intersectPlane(plane, p) ? { x: p.x, y: p.z } : null;
      },
      projectPoint(x, y, z) {
        const c = cameraRef.current;
        if (!c || width < 8 || height < 8) return null;
        // Plan (x, y, z-up) → three (x, z, y): the same map the solids use.
        const v = new THREE.Vector3(x, z, y).project(c);
        if (v.z > 1) return null;
        return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
      },
      moveItemPreview(instanceId, dxM, dyM, rotationDeg) {
        const root = itemsRef.current.find((o) => o.userData.instanceId === instanceId);
        if (!root) return;
        const solid = solids.items.find((it) => it.instanceId === instanceId);
        if (solid?.roofMount) {
          const rotation = rotationDeg ?? solid.rotationDeg;
          const radians = rotation * Math.PI / 180;
          const w = Math.abs(solid.lengthM * Math.cos(radians)) + Math.abs(solid.widthM * Math.sin(radians));
          const h = Math.abs(solid.lengthM * Math.sin(radians)) + Math.abs(solid.widthM * Math.cos(radians));
          const next = { x0: solid.x0 + dxM, y0: solid.y0 + dyM, x1: solid.x0 + dxM + w, y1: solid.y0 + dyM + h, rotationDeg: rotation };
          const centre = { x: (next.x0 + next.x1) / 2, y: (next.y0 + next.y1) / 2 };
          const roof = solids.roofs?.find((entry) => pointInPolygon(centre, entry.polygon))
            ?? solids.roofs?.find((entry) => entry.roomId === solid.roofRoomId);
          const surface = roof && createRoofSurface(roof.polygon, roof.elevationM, roof.config);
          if (surface) poseRoofItem(root, next, roofItemMount(surface, next));
          // Keep the selection rim on the moving panel too.
          const hull = hullRef.current;
          if (hull && selectedRootRef.current === root) {
            hull.position.copy(root.position); hull.quaternion.copy(root.quaternion);
            const heading = hull.getObjectByName('roof-item-heading');
            if (heading) heading.rotation.y = root.getObjectByName('roof-item-heading')!.rotation.y;
          }
          requestRender();
          return;
        }
        if (!previewRotationRef.current.has(instanceId)) previewRotationRef.current.set(instanceId, root.rotation.y);
        const rotation = rotationDeg ?? solid?.rotationDeg ?? 0;
        if (solid) {
          const radians = rotation * Math.PI / 180;
          const newWidth = Math.abs(solid.lengthM * Math.cos(radians)) + Math.abs(solid.widthM * Math.sin(radians));
          const newDepth = Math.abs(solid.lengthM * Math.sin(radians)) + Math.abs(solid.widthM * Math.cos(radians));
          dxM += (newWidth - (solid.x1 - solid.x0)) / 2;
          dyM += (newDepth - (solid.y1 - solid.y0)) / 2;
          root.rotation.y = previewRotationRef.current.get(instanceId)! - (rotation - solid.rotationDeg) * Math.PI / 180;
        }
        let home = previewRef.current.get(instanceId);
        if (!home) {
          home = root.position.clone();
          previewRef.current.set(instanceId, home);
        }
        root.position.set(home.x + dxM, home.y, home.z + dyM);
        // A lamp on a table follows its parent while the drag is still only a
        // preview. Saved child coordinates remain untouched until commit.
        for (const childId of attachedDescendantIds(solids.items, instanceId)) {
          const child = itemsRef.current.find(object => object.userData.instanceId === childId);
          if (!child) continue;
          let childHome = previewRef.current.get(childId);
          if (!childHome) { childHome=child.position.clone();previewRef.current.set(childId,childHome); }
          if (!previewRotationRef.current.has(childId)) previewRotationRef.current.set(childId,child.rotation.y);
          const angle = rotation-(solid?.rotationDeg??rotation);
          const position = attachedPreviewPosition({x:childHome.x,y:childHome.z},{x:home.x,y:home.z},{x:dxM,y:dyM},angle);
          child.position.set(position.x,childHome.y,position.y);
          child.rotation.y=previewRotationRef.current.get(childId)!-angle*Math.PI/180;
        }
        for (const itemId of [instanceId, ...attachedDescendantIds(solids.items, instanceId)]) {
          const item = solids.items.find(entry => entry.instanceId === itemId);
          const lamp = item && lampsRef.current.find(entry => entry.light.userData.key === `light-${item.key}`);
          if (!lamp) continue;
          for (const [part, object] of [['light',lamp.light],['glow',lamp.glow]] as const) {
            const key=`${part}:${itemId}`;
            let origin=previewRef.current.get(key);
            if (!origin) { origin=object.position.clone();previewRef.current.set(key,origin); }
            const position=attachedPreviewPosition({x:origin.x,y:origin.z},{x:home.x,y:home.z},{x:dxM,y:dyM},rotation-(solid?.rotationDeg??rotation));
            object.position.set(position.x,origin.y,position.y);
          }
        }
        // The pad and the contact shadow ride with the body they mark.
        const pad = padRef.current;
        if (pad && selectedRootRef.current === root) {
          let padHome = previewRef.current.get(`pad:${instanceId}`);
          if (!padHome) {
            padHome = pad.position.clone();
            previewRef.current.set(`pad:${instanceId}`, padHome);
          }
          pad.position.set(padHome.x + dxM, padHome.y, padHome.z + dyM);
        }
        const shadow = shadowsRef.current.find((s) => s.userData.key === `shadow-${root.userData.key}`);
        if (shadow) {
          let shadowHome = previewRef.current.get(`shadow:${instanceId}`);
          if (!shadowHome) {
            shadowHome = shadow.position.clone();
            previewRef.current.set(`shadow:${instanceId}`, shadowHome);
          }
          shadow.position.set(shadowHome.x + dxM, shadowHome.y, shadowHome.z + dyM);
        }
        requestRender();
      },
      resetItemPreview(instanceId) {
        for (const itemId of [instanceId, ...attachedDescendantIds(solids.items, instanceId)]) {
          const item=solids.items.find(entry=>entry.instanceId===itemId);
          const lamp=item&&lampsRef.current.find(entry=>entry.light.userData.key===`light-${item.key}`);
          if (!lamp) continue;
          for (const [part,object] of [['light',lamp.light],['glow',lamp.glow]] as const) {
            const key=`${part}:${itemId}`, origin=previewRef.current.get(key);
            if (origin) object.position.copy(origin);
            previewRef.current.delete(key);
          }
        }
        for (const childId of attachedDescendantIds(solids.items, instanceId)) {
          const child=itemsRef.current.find(object=>object.userData.instanceId===childId);
          const childHome=previewRef.current.get(childId), childRotation=previewRotationRef.current.get(childId);
          if (child && childHome) child.position.copy(childHome);
          if (child && childRotation!==undefined) child.rotation.y=childRotation;
          previewRef.current.delete(childId);previewRotationRef.current.delete(childId);
        }
        const root = itemsRef.current.find((o) => o.userData.instanceId === instanceId);
        const solid = solids.items.find((it) => it.instanceId === instanceId);
        if (root && solid?.roofMount) {
          poseRoofItem(root, solid, solid.roofMount);
          const hull = hullRef.current;
          if (hull && selectedRootRef.current === root) {
            hull.position.copy(root.position); hull.quaternion.copy(root.quaternion);
            const heading = hull.getObjectByName('roof-item-heading');
            if (heading) heading.rotation.y = 0;
          }
          requestRender();
          return;
        }
        const home = previewRef.current.get(instanceId);
        if (root && home) root.position.copy(home);
        const rotation = previewRotationRef.current.get(instanceId);
        if (root && rotation !== undefined) root.rotation.y = rotation;
        previewRotationRef.current.delete(instanceId);
        const pad = padRef.current;
        const padHome = previewRef.current.get(`pad:${instanceId}`);
        if (pad && padHome) pad.position.copy(padHome);
        const shadowHome = previewRef.current.get(`shadow:${instanceId}`);
        if (root && shadowHome) {
          const shadow = shadowsRef.current.find((s) => s.userData.key === `shadow-${root.userData.key}`);
          if (shadow) shadow.position.copy(shadowHome);
        }
        previewRef.current.delete(instanceId);
        previewRef.current.delete(`pad:${instanceId}`);
        previewRef.current.delete(`shadow:${instanceId}`);
        requestRender();
      },
      dressing() {
        let joinery = 0;
        let shades = 0;
        for (const e of wallsRef.current) {
          const node = e.show === 'full' ? e.full : e.show === 'stub' ? e.stub : null;
          if (!node) continue;
          node.traverse((o) => {
            if (o.userData?.joinery && o.userData.joinery !== 'wall') joinery += 1;
            if (o.name === 'corner-shades') shades += o.children.length;
          });
        }
        return {
          joinery,
          shades,
          lamps: lampsRef.current.length,
          contactShadows: shadowsRef.current.length,
          floors: floorsRef.current.map((f) => ({ key: f.userData.key as string, kind: String(f.userData.kind ?? '') })),
          bodies: itemsRef.current.filter((o) => o.userData.body).length,
          artBoxes: itemsRef.current.filter((o) => o.userData.art).length,
          previews: itemsRef.current.filter((o) => o.userData.preview).length,
          // The law (2026-09-20): a product wears its own body, its own art or
          // a purpose-built preview — never a bare category-coloured box.
          bareBoxes: itemsRef.current.filter((o) => !o.userData.body && !o.userData.art && !o.userData.preview).length,
        };
      },
      debug() {
        const r = rendererRef.current;
        const c = cameraRef.current;
        const fog = sceneRef.current?.fog;
        return {
          frames: framesRef.current,
          children: contentRef.current?.children.length ?? 0,
          camera: c?.position.toArray() ?? [],
          target: targetRef.current,
          renderer: r ? `${r.domElement.width}x${r.domElement.height} calls=${r.info.render.calls} tris=${r.info.render.triangles}` : 'none',
          hour: hour ?? null,
          sun: sunStateRef.current,
          presentation,
          toneMapping: r ? (r.toneMapping as number) : null,
          exposure: r ? r.toneMappingExposure : null,
          fog: fog instanceof THREE.Fog ? { near: fog.near, far: fog.far } : null,
          cameraDistance: c ? c.position.distanceTo(boundsRef.current.centre) : null,
        };
      },
      };
      return api;
    },
    // requestRender is a per-render closure over refs only — a stale copy renders the same scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, hour, solids, presentation, viewHoverEnabled, brushHex, brushConstruction, catalogPreview],
  );

  return <canvas ref={canvasRef} data-testid="wallpaint-3d-gl" style={{ display: 'block', width: '100%', height: '100%' }} />;
});

export default ThreeStage;
