import { describe, expect, it } from 'vitest';
import { cameraForProfessionalView, orthographicHalfHeight, panProfessionalCamera, pinchProfessionalCamera, PROFESSIONAL_VIEWS, projectProfessionalPoint } from '../professionalViews';
import { cameraForViewport } from '../cameraMotion';
import { cameraPosition, type OrbitCamera } from '../roomView3d';

const camera: OrbitCamera = { target: { x: 12, y: -4, z: 2 }, distanceM: 18, fovRad: 0.8, azimuthRad: 0.7, elevationRad: 0.6 };
const viewport = { width: 1280, height: 900 };
describe('professional camera projections', () => {
  it.each(PROFESSIONAL_VIEWS)('$label changes no zoom, target or canonical dimensions', ({ id }) => {
    const next = cameraForProfessionalView(camera, id);
    expect(next.distanceM).toBe(camera.distanceM); expect(next.fovRad).toBe(camera.fovRad); expect(next.target).toEqual(camera.target);
    const projected = projectProfessionalPoint(camera.target, next, viewport, 'orthographic');
    expect(projected?.x).toBeCloseTo(viewport.width / 2); expect(projected?.y).toBeCloseTo(viewport.height / 2);
  });
  it('uses cardinal elevations consistent with plan north (negative Y)', () => {
    const north = cameraPosition(cameraForProfessionalView(camera, 'north'));
    const east = cameraPosition(cameraForProfessionalView(camera, 'east'));
    expect(north.y).toBeLessThan(camera.target.y); expect(east.x).toBeGreaterThan(camera.target.x);
    expect(north.z).toBeCloseTo(camera.target.z);
  });
  it('keeps equal physical lengths equal at different depths in an elevation', () => {
    const front = cameraForProfessionalView(camera, 'south');
    const point = (x: number, y: number) => projectProfessionalPoint({ x, y, z: 2 }, front, viewport, 'orthographic')!;
    const near = point(13, 0).x - point(12, 0).x;
    const far = point(13, -8).x - point(12, -8).x;
    expect(near).toBeCloseTo(far); expect(near).toBeCloseTo(viewport.height / (2 * orthographicHalfHeight(camera)));
  });
  it('pans vertically in an elevation instead of moving away on the ground plane', () => {
    const elevation = cameraForProfessionalView(camera, 'south');
    const panned = panProfessionalCamera(elevation, 20, 60, 900, 'orthographic');
    expect(panned.target.y).toBeCloseTo(elevation.target.y);
    expect(panned.target.z).toBeGreaterThan(elevation.target.z);
    const screen = projectProfessionalPoint(camera.target, panned, viewport, 'orthographic')!;
    expect(screen.x).toBeCloseTo(640 + 20); expect(screen.y).toBeCloseTo(450 + 60);
  });
  it('preserves measured screen scale when a dock changes viewport height', () => {
    const resized = cameraForViewport(camera, 500, 900);
    expect(500 / orthographicHalfHeight(resized)).toBeCloseTo(900 / orthographicHalfHeight(camera));
  });
  it('repeated asymmetric pinch updates do not drift from the anchored target', () => {
    const top = cameraForProfessionalView(camera, 'plan');
    const start = { x: 195, y: 400, distance: 100 };
    let result = top;
    for (let i = 0; i < 100; i++) {
      result = pinchProfessionalCamera(top, start, { x: 170, y: 400, distance: 150 }, 844, 1, 100, 'orthographic');
      result = pinchProfessionalCamera(top, start, { ...start, distance: 200 }, 844, 1, 100, 'orthographic');
      expect(result.target).toEqual(top.target); expect(result.distanceM).toBe(9);
      result = pinchProfessionalCamera(top, start, start, 844, 1, 100, 'orthographic');
    }
    expect(result).toEqual(top);
  });
});
