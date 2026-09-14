import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  buildScene,
  cameraPosition,
  clampCamera,
  drawScene,
  fitCamera,
  hexToRgb,
  hitTestWall,
  mixHex,
  pointInPoly,
  projectScene,
  shadeForFace,
  shadeHex,
  STUB_HEIGHT_M,
  type DrawTarget,
  type OrbitCamera,
  type SceneInput,
} from '../roomView3d';

const RECT = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
const H = 2.7;
const VP = { width: 800, height: 500 };

/** Camera due SOUTH of the room, looking north, a little above. */
function southCamera(): OrbitCamera {
  return {
    target: { x: 2.5, y: 2, z: 1 },
    azimuthRad: 0,
    elevationRad: (30 * Math.PI) / 180,
    distanceM: 12,
    fovRad: (38 * Math.PI) / 180,
  };
}

function sceneInput(cam: OrbitCamera, extra: Partial<SceneInput> = {}): SceneInput {
  return {
    rooms: [{ id: 'r1', name: 'Room', polygon: RECT }],
    wallHeightM: H,
    cameraPos: cameraPosition(cam),
    cameraTarget: cam.target,
    ...extra,
  };
}

describe('roomView3d — camera', () => {
  it('azimuth 0 puts the camera south of the target and above it', () => {
    const cam = southCamera();
    const p = cameraPosition(cam);
    expect(p.y).toBeGreaterThan(cam.target.y);
    expect(Math.abs(p.x - cam.target.x)).toBeLessThan(1e-9);
    expect(p.z).toBeGreaterThan(cam.target.z);
  });

  it('projects east to screen-right and up to screen-up', () => {
    const cam = southCamera();
    const faces = buildScene(sceneInput(cam));
    const projected = projectScene(faces, cam, VP);
    const floor = projected.find((f) => f.face.kind === 'floor')!;
    // Floor corners in polygon order: (0,0) (5,0) (5,4) (0,4).
    expect(floor.pts[1].x).toBeGreaterThan(floor.pts[0].x); // east is right
    // The north wall's top edge sits ABOVE its bottom edge on screen.
    const north = projected.find((f) => f.face.key === 'wall-r1-0')!;
    expect(north.pts[2].y).toBeLessThan(north.pts[1].y);
  });

  it('fitCamera frames the plan with a positive distance and clamps sanely', () => {
    const b = boundsOf([{ polygon: RECT }])!;
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 5, maxY: 4 });
    const cam = fitCamera(b, H, 1.6);
    expect(cam.distanceM).toBeGreaterThan(5);
    expect(cam.target).toMatchObject({ x: 2.5, y: 2 });
    const c = clampCamera({ ...cam, elevationRad: 2, distanceM: 1000 }, 3, 40);
    expect(c.distanceM).toBe(40);
    expect(c.elevationRad).toBeLessThan(1.5);
    expect(boundsOf([{ polygon: [], kind: 'outdoor' }])).toBeNull();
  });
});

describe('roomView3d — cutaway', () => {
  it('walls facing the camera stay up; the wall between camera and room drops to a stub', () => {
    const cam = southCamera();
    const faces = buildScene(sceneInput(cam));
    const keys = faces.map((f) => f.key);
    // North (edge 0), east (1) and west (3) walls: full inner faces.
    expect(keys).toContain('wall-r1-0');
    expect(keys).toContain('wall-r1-1');
    expect(keys).toContain('wall-r1-3');
    // South wall (edge 2) is the near wall: a stub, no full face.
    expect(keys).not.toContain('wall-r1-2');
    expect(keys).toContain('stub-r1-2');
    const stub = faces.find((f) => f.key === 'stub-r1-2')!;
    expect(Math.max(...stub.pts.map((p) => p.z))).toBeCloseTo(STUB_HEIGHT_M, 6);
    const full = faces.find((f) => f.key === 'wall-r1-0')!;
    expect(Math.max(...full.pts.map((p) => p.z))).toBeCloseTo(H, 6);
  });

  it('orbiting to the north flips which wall is cut away', () => {
    const cam = { ...southCamera(), azimuthRad: Math.PI };
    const keys = buildScene(sceneInput(cam)).map((f) => f.key);
    expect(keys).toContain('wall-r1-2');
    expect(keys).toContain('stub-r1-0');
    expect(keys).not.toContain('wall-r1-0');
  });

  it('a wall shared by two rooms is drawn once, for the room on the camera side', () => {
    const cam = southCamera();
    cam.target = { x: 2.5, y: 4, z: 1 };
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [
          { id: 'north', name: 'N', polygon: RECT },
          { id: 'south', name: 'S', polygon: [{ x: 0, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 8 }, { x: 0, y: 8 }] },
        ],
      }),
    );
    const keys = faces.map((f) => f.key);
    // The shared edge (y = 4) is 'north' edge 2 and 'south' edge 0. Camera
    // is south of everything → it is the far wall of 'south'.
    expect(keys).toContain('wall-south-0');
    expect(keys).not.toContain('wall-north-2');
    expect(keys).toContain('stub-north-2');
  });

  it('outdoor containers draw no walls or floor but still draw their items', () => {
    const cam = southCamera();
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [
          {
            id: 'out',
            name: 'Outdoors',
            polygon: [],
            kind: 'outdoor',
            items: [{ instanceId: 'i1', x: 1, y: 1, rotation: 0, lengthCm: 100, widthCm: 60, heightCm: 80 }],
          },
        ],
      }),
    );
    expect(faces.some((f) => f.kind === 'floor')).toBe(false);
    expect(faces.some((f) => f.kind === 'wall')).toBe(false);
    expect(faces.some((f) => f.key.startsWith('item-i1'))).toBe(true);
  });
});

describe('roomView3d — openings, colour, hit-testing', () => {
  it('a door cuts a hole in its wall; a window adds glass and a frame', () => {
    const cam = southCamera();
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [
          {
            id: 'r1',
            name: 'Room',
            polygon: RECT,
            openings: [
              { edgeIndex: 0, offsetM: 1, widthM: 0.838, kind: 'door' },
              { edgeIndex: 0, offsetM: 3.5, widthM: 1.2, kind: 'window', sillM: 0.9 },
            ],
          },
        ],
      }),
    );
    const north = faces.find((f) => f.key === 'wall-r1-0')!;
    expect(north.holes).toHaveLength(2);
    const door = north.holes![0];
    expect(Math.min(...door.map((p) => p.z))).toBe(0);
    expect(Math.max(...door.map((p) => p.z))).toBeCloseTo(2.04, 6);
    const win = north.holes![1];
    expect(Math.min(...win.map((p) => p.z))).toBeCloseTo(0.9, 6);
    expect(Math.max(...win.map((p) => p.z))).toBeCloseTo(2.1, 6);
    expect(faces.filter((f) => f.kind === 'glass')).toHaveLength(1);
    expect(faces.filter((f) => f.kind === 'frame')).toHaveLength(2);
  });

  it('an opening taller than the wall is capped at the wall height', () => {
    const cam = southCamera();
    const faces = buildScene(
      sceneInput(cam, {
        wallHeightM: 1.8,
        rooms: [{ id: 'r1', name: 'Room', polygon: RECT, openings: [{ edgeIndex: 0, offsetM: 1, widthM: 0.838, kind: 'door' }] }],
      }),
    );
    const north = faces.find((f) => f.key === 'wall-r1-0')!;
    expect(Math.max(...north.holes![0].map((p) => p.z))).toBeCloseTo(1.8, 6);
  });

  it('painted walls carry their colour; unpainted walls are plaster; hover tints', () => {
    const cam = southCamera();
    const colours = new Map([[0, '#8FA68A']]);
    const faces = buildScene(sceneInput(cam, { rooms: [{ id: 'r1', name: 'Room', polygon: RECT, wallColourByEdge: colours }] }));
    expect(faces.find((f) => f.key === 'wall-r1-0')!.fill).toBe('#8FA68A');
    expect(faces.find((f) => f.key === 'wall-r1-1')!.fill).toBe('#EDE9DF');
    const hovered = buildScene(
      sceneInput(cam, {
        rooms: [{ id: 'r1', name: 'Room', polygon: RECT, wallColourByEdge: colours }],
        hover: { kind: 'edge', roomId: 'r1', edgeIndex: 0 },
      }),
    );
    expect(hovered.find((f) => f.key === 'wall-r1-0')!.fill).not.toBe('#8FA68A');
  });

  it('hit-test finds the wall under a point, ignores holes, prefers the nearest face', () => {
    const cam = southCamera();
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [{ id: 'r1', name: 'Room', polygon: RECT, openings: [{ edgeIndex: 0, offsetM: 2.5, widthM: 1.0, kind: 'doorway' }] }],
      }),
    );
    const projected = projectScene(faces, cam, VP);
    const north = projected.find((f) => f.face.key === 'wall-r1-0')!;
    // A point inside the solid part of the north wall (left quarter, mid-height).
    const solid = {
      x: (north.pts[0].x * 3 + north.pts[1].x) / 4,
      y: (north.pts[0].y + north.pts[3].y) / 2,
    };
    expect(hitTestWall(projected, solid.x, solid.y)).toEqual({ kind: 'edge', roomId: 'r1', edgeIndex: 0 });
    // A point in the doorway is NOT the wall.
    const hole = north.holes[0];
    const inHole = { x: hole.reduce((a, p) => a + p.x, 0) / 4, y: hole.reduce((a, p) => a + p.y, 0) / 4 };
    expect(pointInPoly(inHole, north.pts)).toBe(true);
    const hit = hitTestWall(projected, inHole.x, inHole.y);
    expect(hit).not.toEqual({ kind: 'edge', roomId: 'r1', edgeIndex: 0 });
    // Far off-screen: nothing.
    expect(hitTestWall(projected, -5000, -5000)).toBeNull();
  });

  it('free walls are slabs painted on both faces and stub down when in front of the target', () => {
    const cam = southCamera();
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [],
        walls: [
          { id: 'far', a: { x: 0, y: -3 }, b: { x: 5, y: -3 }, colourHex: '#C9553F' },
          { id: 'near', a: { x: 0, y: 9 }, b: { x: 5, y: 9 } },
        ],
      }),
    );
    const far = faces.filter((f) => f.key.startsWith('fw-far') && f.kind !== 'wall-cap');
    expect(far.length).toBeGreaterThan(0);
    expect(far.every((f) => f.fill === '#C9553F')).toBe(true);
    expect(far.every((f) => f.kind === 'wall')).toBe(true);
    const near = faces.filter((f) => f.key.startsWith('fw-near') && f.kind !== 'wall-cap');
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((f) => f.kind === 'wall-stub')).toBe(true);
    expect(faces.find((f) => f.key === 'fw-far-cap')!.hit).toEqual({ kind: 'free', wallId: 'far' });
  });
});

describe('roomView3d — items, ordering, drawing', () => {
  it('items become boxes: camera-facing sides + a top; ceiling items hang from the ceiling', () => {
    const cam = southCamera();
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [
          {
            id: 'r1',
            name: 'Room',
            polygon: RECT,
            items: [
              { instanceId: 'sofa', x: 1, y: 1, rotation: 0, lengthCm: 200, widthCm: 90, heightCm: 80, fill: '#B9A68F' },
              { instanceId: 'lamp', x: 2, y: 2, rotation: 0, lengthCm: 40, widthCm: 40, heightCm: 30, placement: 'ceiling' },
            ],
          },
        ],
      }),
    );
    const sofa = faces.filter((f) => f.key.startsWith('item-sofa'));
    expect(sofa.some((f) => f.kind === 'item-top')).toBe(true);
    // The south side faces the camera; the north side does not.
    expect(sofa.some((f) => f.key.endsWith('-s'))).toBe(true);
    expect(sofa.some((f) => f.key.endsWith('-n'))).toBe(false);
    expect(sofa[0].fill).toBe('#B9A68F');
    const lampTop = faces.find((f) => f.key === 'item-lamp-top');
    // Camera z is above 2.7? southCamera: z = 1 + 12 sin 30° = 7 → yes, top visible at z = H.
    expect(lampTop).toBeDefined();
    expect(lampTop!.pts[0].z).toBeCloseTo(H, 6);
  });

  it('projection orders floors first, then far to near', () => {
    const cam = southCamera();
    const faces = buildScene(sceneInput(cam));
    const projected = projectScene(faces, cam, VP);
    expect(projected[0].face.kind).toBe('floor');
    const rest = projected.slice(1);
    for (let i = 1; i < rest.length; i++) {
      expect(rest[i].depth).toBeLessThanOrEqual(rest[i - 1].depth + 0.02 + 1e-9);
    }
    // The near stub is drawn after the far wall.
    const idxFar = projected.findIndex((f) => f.face.key === 'wall-r1-0');
    const idxStub = projected.findIndex((f) => f.face.key === 'stub-r1-2');
    expect(idxStub).toBeGreaterThan(idxFar);
  });

  it('shading brightens faces toward the key light and never blows out', () => {
    const camPos = { x: 2.5, y: 14, z: 7 };
    const floor = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 4, z: 0 }, { x: 0, y: 4, z: 0 }];
    const s = shadeForFace(floor, camPos);
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThanOrEqual(1.06);
    expect(shadeHex('#808080', 0.5)).toBe('rgb(64,64,64)');
    expect(shadeHex('#ffffff', 1.5)).toBe('rgb(255,255,255)');
    expect(hexToRgb('#abc')).toEqual([170, 187, 204]);
    expect(hexToRgb('nope')).toBeNull();
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
  });

  it('drawScene paints the ground then every face, holes even-odd', () => {
    const cam = southCamera();
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [{ id: 'r1', name: 'Room', polygon: RECT, openings: [{ edgeIndex: 0, offsetM: 1, widthM: 0.838, kind: 'door' }] }],
      }),
    );
    const projected = projectScene(faces, cam, VP);
    const calls: string[] = [];
    const ctx: DrawTarget = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      lineJoin: 'miter',
      beginPath: () => calls.push('begin'),
      moveTo: () => calls.push('move'),
      lineTo: () => calls.push('line'),
      closePath: () => calls.push('close'),
      fill: (rule?: CanvasFillRule) => calls.push(`fill:${rule ?? ''}`),
      stroke: () => calls.push('stroke'),
      fillRect: () => calls.push('rect'),
    };
    drawScene(ctx, projected, VP);
    expect(calls[0]).toBe('rect');
    expect(calls.filter((c) => c === 'begin')).toHaveLength(projected.length);
    expect(calls).toContain('fill:evenodd');
    // The door wall traces two closed paths (outline + hole) in one fill.
    const wallIdx = projected.findIndex((f) => f.face.key === 'wall-r1-0');
    const begins = calls.map((c, i) => (c === 'begin' ? i : -1)).filter((i) => i >= 0);
    const seg = calls.slice(begins[wallIdx], begins[wallIdx + 1] ?? calls.length);
    expect(seg.filter((c) => c === 'close')).toHaveLength(2);
  });
});

describe('roomView3d — a neighbour opening passed in cuts the far wall (review round 2)', () => {
  it('the hole is cut whichever room hosts the door', () => {
    const cam = { ...southCamera(), azimuthRad: Math.PI / 2, target: { x: 5, y: 2, z: 1 } }; // camera EAST of x = 5
    const faces = buildScene(
      sceneInput(cam, {
        rooms: [
          { id: 'a', name: 'A', polygon: RECT, openings: [{ edgeIndex: 1, offsetM: 2, widthM: 0.9, kind: 'door' }] },
          // Room B east of A; the shared wall is B's edge 3 (x = 5, y 4→0). The
          // component maps A's door across; here we pass it mapped already.
          { id: 'b', name: 'B', polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }], openings: [{ edgeIndex: 3, offsetM: 2, widthM: 0.9, kind: 'door' }] },
        ],
      }),
    );
    const keys = faces.map((f) => f.key);
    expect(keys).toContain('wall-b-3');
    expect(faces.find((f) => f.key === 'wall-b-3')!.holes).toHaveLength(1);
  });
});
