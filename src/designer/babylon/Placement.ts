/**
 * Sims-Parity DT-23 — Babylon placement (L2.06).
 *
 * Raycast the pointer onto the ground plane and surface the world-
 * space (x, z) anchor so the React layer can spawn a ghost / commit
 * a placed product. Re-uses the GL1.06 50 cm snap math (engine-agnostic
 * snapToGrid from `src/designer/useGridSnap.ts`).
 *
 * Pure-fn wrapper around scene.pick(); no React state lives here.
 */

import { Vector3, type Scene, type AbstractMesh, type PointerInfo } from '@babylonjs/core';
import { snapToGrid } from '../useGridSnap';

export interface PointerToGroundResult {
  worldX: number; // metres
  worldZ: number; // metres
  groundMesh: AbstractMesh;
}

/**
 * Cast a ray from the current pointer through the active camera and
 * return the first hit on a mesh whose name starts with "ground".
 *
 * Returns null when nothing hits — caller stays put.
 */
export function pickPointerToGround(scene: Scene): PointerToGroundResult | null {
  const hit = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name.startsWith('ground'));
  if (!hit || !hit.hit || !hit.pickedPoint || !hit.pickedMesh) return null;
  return {
    worldX: hit.pickedPoint.x,
    worldZ: hit.pickedPoint.z,
    groundMesh: hit.pickedMesh,
  };
}

/**
 * Apply the GL1.06 50 cm snap to a world-space (x, z) and return the
 * snapped Vector3 at the floor.
 *
 * shiftHeld → freeFloat = no snap (matches the GL1.05 Konva contract).
 */
export function snapWorldToGrid(worldX: number, worldZ: number, shiftHeld: boolean): Vector3 {
  // Babylon world units are metres; the snap helper is in mm.
  const snapped = snapToGrid({
    xMm: worldX * 1000,
    yMm: worldZ * 1000,
    freeFloat: shiftHeld,
  });
  return new Vector3(snapped.xMm / 1000, 0, snapped.yMm / 1000);
}

/**
 * Convenience: wire a Babylon pointer-move callback to a "ghost
 * position" sink. Returns the unsubscribe function.
 */
export function trackGhostPosition(
  scene: Scene,
  sink: (pos: Vector3 | null) => void,
  shiftHeldRef: { current: boolean },
): () => void {
  const observer = scene.onPointerObservable.add((info: PointerInfo) => {
    if (info.type !== 4 /* POINTERMOVE */) return;
    const ground = pickPointerToGround(scene);
    if (!ground) {
      sink(null);
      return;
    }
    sink(snapWorldToGrid(ground.worldX, ground.worldZ, shiftHeldRef.current));
  });
  return () => {
    if (observer) scene.onPointerObservable.remove(observer);
  };
}
