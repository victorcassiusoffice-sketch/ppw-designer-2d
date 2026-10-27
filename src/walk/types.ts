import type { Box3, BufferGeometry, Vector3 } from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import type { BuildingStair } from '../designer/building';
import type { FloorSolid } from '../designer/roomSolids';

/** Runtime-only state. No reference here is ever written back to a property. */
export interface WalkDoor {
  id: string;
  openingIds: string[];
  wallKeys: string[];
  /** Leaf pivot at its bottom hinge, in Three world metres. Local leaf extends +X. */
  hinge: Vector3;
  width: number;
  height: number;
  thickness: number;
  baseM: number;
  closedYaw: number;
  openDelta: number;
  angle: number;
  targetAngle: number;
  inward: Vector3;
  exterior: boolean;
  geometry: BufferGeometry;
  bvh: MeshBVH;
}

export interface WalkStair {
  stair: BuildingStair;
  baseM: number;
  riseM: number;
  count: number;
  riserM: number;
  goingM: number;
}

export interface WalkWorld {
  staticGeometry: BufferGeometry;
  bvh: MeshBVH | null;
  doors: WalkDoor[];
  stairs: WalkStair[];
  floors: FloorSolid[];
  /** Furniture volumes also reject a spawn wholly inside a closed mesh. */
  obstacleBounds: Box3[];
  bounds: Box3;
  dispose(): void;
}

export interface WalkSpawn { position: Vector3; yaw: number }

export interface WalkerState {
  /** Feet, not capsule centre. Y is vertical; plan Y maps to world Z. */
  position: Vector3;
  velocityY: number;
  grounded: boolean;
  radius: number;
  height: number;
  accumulator: number;
  safePosition: Vector3;
}

export const WALK_RADIUS_M = 0.23;
export const WALK_HEIGHT_M = 1.7;
export const WALK_FIXED_STEP_S = 1 / 120;
