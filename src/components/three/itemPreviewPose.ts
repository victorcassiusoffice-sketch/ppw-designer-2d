import type { Object3D, Vector3 } from 'three';

/** Transfer a live carry when a GLB arrives, retaining the new model's own pivot and catalog scale. */
export function carryItemPreviewPose(previous: Object3D, replacement: Object3D, home?: Vector3, rotation?: number) {
  const replacementHome = replacement.position.clone();
  const replacementRotation = replacement.rotation.y;
  // Art boxes pivot at half-height; catalog models pivot at their floor. Copy
  // only the gesture's displacement/turn, never the placeholder's whole pose.
  if (home) replacement.position.add(previous.position.clone().sub(home));
  if (rotation !== undefined) replacement.rotation.y += previous.rotation.y - rotation;
  replacement.updateMatrixWorld(true);
  return { home: replacementHome, rotation: replacementRotation };
}
