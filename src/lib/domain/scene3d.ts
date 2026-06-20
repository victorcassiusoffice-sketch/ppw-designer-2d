/**
 * Procedural 3D scene-graph MODEL per domain (DESIGNER-EXPANSION P5).
 *
 * `DomainConfig.render.mirror3d` declares an optional 3D mirror per domain
 * (car turntable, airplane cabin walkthrough). This module builds that mirror
 * as a renderer-agnostic, PROCEDURAL scene-graph node tree — boxes, cylinders
 * and a tube, NO paid/imported meshes (V8 = NO).
 *
 * Engine note: the Designer's previous Babylon mirror was REMOVED (commit
 * `be15d21`); the repo ships Konva-2D only. Reintroducing a heavy WebGL engine
 * is a separate, Vic-gated call, so P5 ships this scene-graph MODEL plus an
 * SVG projection (`DomainMirror3D`) rather than reinstalling Babylon. The node
 * tree is exactly the data a future GL renderer (or a reinstated Babylon scene)
 * would consume — additive, $0, and machine-verifiable today.
 */
import { getDefaultSpace } from './templates';
import type { FuselageSectionSpace } from './templates';
import type { DomainId } from './types';

/** Procedural primitive kinds the scene-graph uses. No imported meshes. */
export type MeshKind = 'box' | 'cylinder' | 'tube' | 'group';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SceneNode {
  id: string;
  kind: MeshKind;
  /** Centre position (model units = metres). */
  position: Vec3;
  /** Bounding size (metres). For cylinder/tube: x=diameter, y=length. */
  size: Vec3;
  children: SceneNode[];
}

/** Orbit camera descriptor for a turntable (Babylon ArcRotateCamera-shaped). */
export interface OrbitCamera {
  type: 'orbit';
  /** Horizontal angle (rad). */
  alpha: number;
  /** Vertical angle (rad). */
  beta: number;
  /** Distance from target (metres). */
  radius: number;
  target: Vec3;
}

/** Free/walkthrough camera for the cabin stub. */
export interface WalkCamera {
  type: 'walk';
  position: Vec3;
  target: Vec3;
}

export type SceneCamera = OrbitCamera | WalkCamera;

export interface DomainScene {
  domain: DomainId;
  mirror: 'turntable-3d' | 'cabin-3d';
  root: SceneNode;
  camera: SceneCamera;
  /** Flat node count incl. root — convenience for tests / fallback summary. */
  nodeCount: number;
}

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function countNodes(node: SceneNode): number {
  return 1 + node.children.reduce((n, c) => n + countNodes(c), 0);
}

/** Procedural car: a body box + four wheel cylinders, viewed on a turntable. */
function buildCarScene(): DomainScene {
  const body: SceneNode = {
    id: 'car-body',
    kind: 'box',
    position: vec(0, 0.6, 0),
    size: vec(4.2, 1.2, 1.8),
    children: [],
  };
  const wheelY = 0.3;
  const wheelOffsets: Array<[number, number]> = [
    [-1.4, 0.9],
    [1.4, 0.9],
    [-1.4, -0.9],
    [1.4, -0.9],
  ];
  const wheels: SceneNode[] = wheelOffsets.map(([x, z], i) => ({
    id: `car-wheel-${i}`,
    kind: 'cylinder',
    position: vec(x, wheelY, z),
    size: vec(0.6, 0.25, 0.6), // diameter, width, diameter
    children: [],
  }));
  const root: SceneNode = {
    id: 'car-root',
    kind: 'group',
    position: vec(0, 0, 0),
    size: vec(4.2, 1.5, 1.8),
    children: [body, ...wheels],
  };
  return {
    domain: 'car',
    mirror: 'turntable-3d',
    root,
    camera: { type: 'orbit', alpha: Math.PI / 4, beta: Math.PI / 3, radius: 8, target: vec(0, 0.6, 0) },
    nodeCount: countNodes(root),
  };
}

/** Procedural airplane cabin: a fuselage tube + a grid of seat blocks. */
function buildAirplaneScene(): DomainScene {
  const space = getDefaultSpace('airplane') as FuselageSectionSpace;
  const lengthM = space.lengthCm / 100;
  const widthM = space.crossSectionWidthCm / 100;
  const { rows, cols, pitchCm } = space.floorGrid;
  const pitchM = pitchCm / 100;

  const tube: SceneNode = {
    id: 'cabin-tube',
    kind: 'tube',
    position: vec(0, 0, 0),
    size: vec(widthM, lengthM, widthM), // diameter, length, diameter
    children: [],
  };

  const seats: SceneNode[] = [];
  const startZ = -(lengthM / 2) + pitchM / 2;
  const colSpacing = widthM / (cols + 1);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = -widthM / 2 + colSpacing * (c + 1);
      const z = startZ + r * pitchM;
      seats.push({
        id: `seat-r${r}-c${c}`,
        kind: 'box',
        position: vec(x, 0.25, z),
        size: vec(0.45, 0.5, 0.45),
        children: [],
      });
    }
  }

  const root: SceneNode = {
    id: 'cabin-root',
    kind: 'group',
    position: vec(0, 0, 0),
    size: vec(widthM, widthM, lengthM),
    children: [tube, ...seats],
  };
  return {
    domain: 'airplane',
    mirror: 'cabin-3d',
    root,
    camera: { type: 'walk', position: vec(0, 0.8, -lengthM / 2 - 2), target: vec(0, 0.5, 0) },
    nodeCount: countNodes(root),
  };
}

/**
 * Build the procedural 3D mirror scene for a domain, or `null` when the domain
 * declares no `mirror3d` (wellness-room renders 2D-only, unchanged).
 */
export function buildDomainScene(domain: DomainId): DomainScene | null {
  switch (domain) {
    case 'car':
      return buildCarScene();
    case 'airplane':
      return buildAirplaneScene();
    case 'wellness-room':
    default:
      return null;
  }
}
