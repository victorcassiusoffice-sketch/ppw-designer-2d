import { describe, expect, it } from 'vitest';
import { cameraAtRest, dampOrbitCamera, shortestAngleDelta, panOrbitCamera } from '../cameraMotion';
import type { OrbitCamera } from '../roomView3d';

const camera: OrbitCamera = { target: { x: 0, y: 0, z: 1 }, azimuthRad: 0, elevationRad: 0.7, distanceM: 8, fovRad: 0.8 };

describe('smooth 3D camera', () => {
  it('pans parallel to the ground and rotates the screen axes with the view', () => {
    const horizontal = panOrbitCamera(camera, 100, 0, 600);
    expect(horizontal.target.x).toBeLessThan(0);
    expect(horizontal.target.y).toBe(0);
    expect(horizontal.target.z).toBe(camera.target.z);
    const turned = panOrbitCamera({ ...camera, azimuthRad: Math.PI / 2 }, 100, 0, 600);
    expect(turned.target.x).toBeCloseTo(0);
    expect(turned.target.y).toBeCloseTo(-horizontal.target.x);
    expect(panOrbitCamera(camera, 0, 100, 600).target.y).toBeGreaterThan(0);
    expect(panOrbitCamera(camera, 100, 100, 0)).toBe(camera);
  });
  it('takes the short path across the ±π seam', () => {
    const from = { ...camera, azimuthRad: Math.PI - 0.05 };
    const target = { ...camera, azimuthRad: -Math.PI + 0.05 };
    expect(shortestAngleDelta(from.azimuthRad, target.azimuthRad)).toBeCloseTo(0.1);
    const next = dampOrbitCamera(from, target, 16);
    expect(next.azimuthRad).toBeGreaterThan(from.azimuthRad);
    expect(next.azimuthRad - from.azimuthRad).toBeLessThan(0.1);
  });

  it('has the same motion at 30fps and 120fps', () => {
    const target = { ...camera, distanceM: 4, azimuthRad: 1, target: { x: 2, y: 3, z: 4 } };
    let slow = camera;
    let fast = camera;
    for (let i = 0; i < 6; i++) slow = dampOrbitCamera(slow, target, 1000 / 30);
    for (let i = 0; i < 24; i++) fast = dampOrbitCamera(fast, target, 1000 / 120);
    expect(slow.distanceM).toBeCloseTo(fast.distanceM, 10);
    expect(slow.azimuthRad).toBeCloseTo(fast.azimuthRad, 10);
    expect(slow.target.z).toBeCloseTo(fast.target.z, 10);
  });

  it('does not overshoot and finishes at the exact target', () => {
    const target = { ...camera, distanceM: 3, elevationRad: 1.2 };
    let current = camera;
    for (let i = 0; i < 200; i++) {
      current = dampOrbitCamera(current, target, 16);
      expect(current.distanceM).toBeGreaterThanOrEqual(3);
      expect(current.elevationRad).toBeLessThanOrEqual(1.2);
    }
    expect(current).toBe(target);
    expect(cameraAtRest(current, target)).toBe(true);
    expect(dampOrbitCamera(camera, target, 16, 0)).toBe(target);
  });
});
