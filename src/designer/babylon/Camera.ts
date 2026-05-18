/**
 * Sims-Parity DT-21 — ArcRotateCamera builder (L2.03).
 *
 * Orbit camera around the room's centre. Wheel zoom, right-drag pan,
 * pitch min/max locked (camera can't go under the floor or directly
 * overhead).
 */

import { ArcRotateCamera, Vector3, type Scene } from '@babylonjs/core';

export interface CameraOptions {
  alpha?: number; // radians; 0 = +X axis
  beta?: number; // radians; π/2 = horizon
  radius?: number; // metres
  target?: Vector3;
}

export function buildArcRotateCamera(scene: Scene, canvas: HTMLCanvasElement, opts: CameraOptions = {}): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    'camera',
    opts.alpha ?? -Math.PI / 2 - Math.PI / 4, // looking south-east-ish
    opts.beta ?? Math.PI / 2 - 0.5, // slightly above horizon
    opts.radius ?? 6,
    opts.target ?? new Vector3(0, 0.6, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerBetaLimit = 0.1; // can't look straight down
  camera.upperBetaLimit = Math.PI / 2 - 0.05; // can't go below floor
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 20;
  camera.wheelPrecision = 30;
  camera.pinchPrecision = 50;
  camera.panningSensibility = 1000;
  return camera;
}
