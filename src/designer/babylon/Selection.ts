/**
 * Sims-Parity DT-23 — Babylon selection + rotate gizmo + delete (L2.07).
 *
 * GizmoManager wraps Babylon's positionGizmo + rotationGizmo behind a
 * single attach/detach surface. We only enable the y-axis rotation
 * handle for product boxes (rotate-on-floor matches the GL1.11 R-key
 * semantics) — translation gizmo would clash with the GL1.05 drag flow.
 *
 * Caller wires a delete keystroke (Delete / Backspace) to
 * `disposeSelected()` from outside this module.
 */

import {
  GizmoManager,
  Color3,
  type Scene,
  type AbstractMesh,
} from '@babylonjs/core';

export interface SelectionController {
  attachToMesh: (mesh: AbstractMesh | null) => void;
  getSelected: () => AbstractMesh | null;
  disposeSelected: () => void;
  dispose: () => void;
}

const PALETTE_SELECTED_RING_RGB = new Color3(0.752, 0.651, 0.495); // V4-AU-1 gold

export function createSelectionController(scene: Scene): SelectionController {
  const manager = new GizmoManager(scene);
  manager.usePointerToAttachGizmos = false;
  manager.positionGizmoEnabled = false;
  manager.scaleGizmoEnabled = false;
  manager.boundingBoxGizmoEnabled = false;
  manager.rotationGizmoEnabled = true;

  if (manager.gizmos.rotationGizmo) {
    // y-axis only (rotate on floor; no pitch/roll).
    manager.gizmos.rotationGizmo.xGizmo.isEnabled = false;
    manager.gizmos.rotationGizmo.zGizmo.isEnabled = false;
    manager.gizmos.rotationGizmo.yGizmo.snapDistance = (Math.PI / 180) * 15; // 15° snap (GL1.11)
  }

  let current: AbstractMesh | null = null;

  function highlight(mesh: AbstractMesh | null): void {
    if (current && current !== mesh) {
      current.renderOutline = false;
    }
    if (mesh) {
      mesh.renderOutline = true;
      mesh.outlineColor = PALETTE_SELECTED_RING_RGB;
      mesh.outlineWidth = 0.02;
    }
  }

  return {
    attachToMesh: (mesh) => {
      manager.attachToMesh(mesh);
      highlight(mesh);
      current = mesh;
    },
    getSelected: () => current,
    disposeSelected: () => {
      if (!current) return;
      manager.attachToMesh(null);
      current.dispose();
      current = null;
    },
    dispose: () => {
      manager.attachToMesh(null);
      manager.dispose();
      if (current) current.renderOutline = false;
      current = null;
    },
  };
}
