import { describe, expect, it } from 'vitest';
import { cameraAtRest, cameraForViewport, dampOrbitCamera, shortestAngleDelta, panOrbitCamera, pinchOrbitCamera } from '../cameraMotion';
import type { OrbitCamera } from '../roomView3d';

const camera: OrbitCamera = { target: { x: 0, y: 0, z: 1 }, azimuthRad: 0, elevationRad: 0.7, distanceM: 8, fovRad: 0.8 };

describe('smooth 3D camera', () => {
  it('does not accumulate translation from individually delivered finger moves during repeated zoom cycles', () => {
    const start = {x:195, y:320, distance:100};
    let current = camera;
    for (let cycle=0; cycle<100; cycle++) {
      const baseline = current;
      // Left then right finger move out; their temporary midpoint differs.
      current = pinchOrbitCamera(baseline, start, {x:170,y:320,distance:150},640,1,40);
      current = pinchOrbitCamera(baseline, start, {x:195,y:320,distance:200},640,1,40);
      expect(current.target).toEqual(camera.target);
      expect(current.distanceM).toBe(4);
      current = pinchOrbitCamera(baseline, start, {x:220,y:320,distance:150},640,1,40);
      current = pinchOrbitCamera(baseline, start, start,640,1,40);
    }
    expect(current).toEqual(camera);
  });
  it('combines deliberate two-finger translation with zoom independently of event order', () => {
    const start = {x:180,y:320,distance:100};
    const next = pinchOrbitCamera(camera,start,{x:210,y:360,distance:200},640,1,40);
    expect(next.target).toEqual(panOrbitCamera(camera,30,40,640).target);
    expect(next.distanceM).toBe(4);
    const differentPath = pinchOrbitCamera(camera,start,{x:170,y:290,distance:130},640,1,40);
    expect(differentPath.target).not.toEqual(next.target);
    expect(pinchOrbitCamera(camera,start,{x:210,y:360,distance:200},640,1,40)).toEqual(next);
  });
  it('recovers the starting view exactly after reaching zoom limits', () => {
    const start = {x:195,y:320,distance:100};
    expect(pinchOrbitCamera(camera,start,{...start,distance:10000},640,1,40).distanceM).toBe(1);
    expect(pinchOrbitCamera(camera,start,{...start,distance:2},640,1,40).distanceM).toBe(40);
    expect(pinchOrbitCamera(camera,start,start,640,1,40)).toEqual(camera);
    expect(pinchOrbitCamera(camera,{...start,distance:0},start,640,1,40)).toBe(camera);
  });
  it('preserves apparent object size and pan precision when the catalog takes some canvas height', () => {
    const initialHeight = 640;
    for (const height of [240, 400, 640, 900]) {
      const adjusted = cameraForViewport(camera, height, initialHeight);
      const initialFocal = initialHeight / (2 * Math.tan(camera.fovRad / 2));
      const currentFocal = height / (2 * Math.tan(adjusted.fovRad / 2));
      expect(currentFocal / adjusted.distanceM).toBeCloseTo(initialFocal / camera.distanceM, 10);
      expect(adjusted.target).toEqual(camera.target);
      // Same screen drag covers the same ground at the same zoom.
      expect(panOrbitCamera(adjusted, 20, 10, height).target.x).toBeCloseTo(panOrbitCamera(camera, 20, 10, initialHeight).target.x, 10);
    }
    expect(cameraForViewport(camera, 0, initialHeight)).toBe(camera);
  });
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
  it('settles more than 90 percent of a gesture within 100ms for precise placement', () => {
    const target = { ...camera, distanceM: 4, target: { x: 2, y: 3, z: 1 } };
    const next = dampOrbitCamera(camera, target, 100);
    expect(Math.abs(next.distanceM - target.distanceM)).toBeLessThan(0.4);
    expect(Math.abs(next.target.x - target.target.x)).toBeLessThan(0.2);
  });
});
