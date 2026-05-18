/**
 * Sims-Parity DT-23 — DetailCard screen-coord anchor (L2.07 wire to GL1.08).
 *
 * Babylon mesh → viewport (x, y) px via the active camera. The
 * Gaming Layer 1 DetailCard (DOM overlay from DT-14) reads these
 * coords to position itself above-right of the selected mesh.
 * Engine-agnostic shape — Konva's anchor uses the placed-item
 * stage position; Babylon's uses `getScreenCoordinates`.
 */

import { Vector3, type AbstractMesh, type Scene } from '@babylonjs/core';

export interface ScreenAnchor {
  xPx: number;
  yPx: number;
}

export function meshScreenAnchor(scene: Scene, mesh: AbstractMesh): ScreenAnchor | null {
  const camera = scene.activeCamera;
  if (!camera) return null;
  const engine = scene.getEngine();
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const world = mesh.getAbsolutePosition().clone();
  // Anchor at the mesh's top-centre so the DetailCard floats above the box.
  const bbox = mesh.getBoundingInfo().boundingBox;
  const top = new Vector3(world.x, world.y + bbox.extendSize.y, world.z);
  const projection = Vector3.Project(
    top,
    mesh.getWorldMatrix(),
    scene.getTransformMatrix(),
    viewport,
  );
  if (!Number.isFinite(projection.x) || !Number.isFinite(projection.y)) return null;
  return { xPx: projection.x, yPx: projection.y };
}
