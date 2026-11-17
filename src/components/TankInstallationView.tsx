import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Property } from '../store/propertyStore';
import { buildingLevels } from '../designer/building';
import { roomLevelId, isOutdoorRoom, isRoofLevel } from '../designer/levels';
import { placedTanks, tankPortNozzles } from '../designer/tankNetwork';
import { serviceRunPoints3D } from '../designer/buildingServices';
import { serviceProductPreview } from './three/serviceProductPreview';
import { tankPortNozzleMesh } from './three/serviceRouteMeshes';
import { waterTankPreview } from './three/waterTankPreview';
import './tankInstallation.css';

function framedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  line: THREE.LineBasicMaterial,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), line));
  mesh.receiveShadow = true;
  return mesh;
}

function drawInstallation(
  canvas: HTMLCanvasElement,
  property: Property,
  elevation: boolean,
  labels: (heights: Map<string, number>) => void,
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xeef2ed);
  const scene = new THREE.Scene(),
    model = new THREE.Group();
  scene.add(model, new THREE.HemisphereLight(0xfffcf1, 0x9baaa0, 2.2));
  const stone = new THREE.MeshStandardMaterial({ color: 0xe5dfd0, roughness: 0.94 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xd0dfd8,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pencil = new THREE.LineBasicMaterial({ color: 0x82958e, transparent: true, opacity: 0.6 });
  const levels = buildingLevels(property),
    datums = new Map(levels.map((l) => [l.level.id, l]));
  const tanks = placedTanks(property),
    tankRooms = new Set(tanks.map((t) => t.roomId));
  for (const room of property.rooms) {
    if (!tankRooms.has(room.id) || isOutdoorRoom(room) || room.polygon.length < 3) continue;
    const floor = datums.get(roomLevelId(room));
    if (!floor) continue;
    const points = room.polygon;
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y)));
    const slab = framedMesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false }),
      stone,
      pencil,
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = floor.elevationM - 0.16;
    model.add(slab);
    if (!isRoofLevel(floor.level) && !elevation) {
      // Only the rear outlines remain in this cutaway, so the tank and both pipe ends stay visible.
      const ccw =
        points.reduce(
          (a, p, i) =>
            a + p.x * points[(i + 1) % points.length].y - p.y * points[(i + 1) % points.length].x,
          0,
        ) > 0;
      points.forEach((a, i) => {
        const b = points[(i + 1) % points.length],
          dx = b.x - a.x,
          dz = b.y - a.y;
        if (room.removedWallEdges?.includes(i) || (ccw ? 1 : -1) * (dz * 0.6 - dx) >= -0.001)
          return;
        const h = floor.heightM,
          y = floor.elevationM;
        const edge = new THREE.BufferGeometry();
        edge.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(
            [a.x, y, a.y, b.x, y, b.y, b.x, y + h, b.y, a.x, y + h, a.y],
            3,
          ),
        );
        edge.setIndex([0, 1, 2, 0, 2, 3]);
        edge.computeVertexNormals();
        model.add(framedMesh(edge, glass, pencil));
      });
    }
  }
  for (const t of tanks) {
    const bottom = t.baseElevationM;
    const solid = {
      key: t.instanceId,
      instanceId: t.instanceId,
      productId: t.productId,
      hex: '#8b9d92',
      rotationDeg: t.rotation,
      lengthM: t.lengthM,
      widthM: t.widthM,
      heightM: t.heightM,
      x0: t.x - t.lengthM / 2,
      x1: t.x + t.lengthM / 2,
      y0: t.y - t.widthM / 2,
      y1: t.y + t.widthM / 2,
      z0: bottom,
      z1: bottom + t.heightM,
    };
    const body = serviceProductPreview(solid) ?? waterTankPreview(solid);
    if (body) {
      body.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      model.add(body);
    }
  }
  const water = new THREE.MeshStandardMaterial({
    color: 0x007c9b,
    roughness: 0.43,
    metalness: 0.18,
  });
  const joint = new THREE.MeshStandardMaterial({ color: 0x23545d, roughness: 0.5 });
  for (const run of property.services?.runs ?? []) {
    if (!run.tankRoute) continue;
    model.add(tankPortNozzleMesh(tankPortNozzles(tanks, run), run.diameterMm));
    const floor = datums.get(run.levelId);
    if (!floor) continue;
    const points = serviceRunPoints3D(run).map(
      (p) => new THREE.Vector3(p.x, p.elevationM + floor.elevationM, p.y),
    );
    const radius = run.diameterMm / 2000;
    points.slice(1).forEach((end, i) => {
      const start = points[i],
        delta = end.clone().sub(start);
      if (delta.length() < 0.0001) return;
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, delta.length(), 16),
        water,
      );
      tube.position.copy(start).add(end).multiplyScalar(0.5);
      tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      tube.castShadow = true;
      model.add(tube);
    });
    points.forEach((p, i) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(i === 0 || i === points.length - 1 ? radius * 2 : radius, 12, 8),
        i === 0 || i === points.length - 1 ? joint : water,
      );
      marker.position.copy(p);
      model.add(marker);
    });
  }
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
  const focus = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3()),
    span = Math.max(1, size.length());
  const light = new THREE.DirectionalLight(0xfff2dc, 2.6);
  light.position.copy(focus).add(new THREE.Vector3(1.1, 2, 1).multiplyScalar(span));
  light.target.position.copy(focus);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.00035;
  Object.assign(light.shadow.camera, {
    left: -span,
    right: span,
    top: span,
    bottom: -span,
    near: 0.1,
    far: span * 6,
  });
  scene.add(light, light.target);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, span * 12);
  camera.position
    .copy(focus)
    .add(
      (elevation ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0.64, 0.44, 1))
        .normalize()
        .multiplyScalar(span * 3),
    );
  camera.lookAt(focus);
  camera.updateMatrixWorld(true);
  const corners: THREE.Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z])
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  const minX = Math.min(...corners.map((p) => p.x)),
    maxX = Math.max(...corners.map((p) => p.x)),
    minY = Math.min(...corners.map((p) => p.y)),
    maxY = Math.max(...corners.map((p) => p.y));
  const resize = () => {
    const rect = canvas.getBoundingClientRect(),
      w = Math.max(1, rect.width),
      h = Math.max(1, rect.height);
    const worldH = Math.max((maxY - minY) * 1.12, ((maxX - minX) * 1.12 * h) / w, 0.1),
      worldW = (worldH * w) / h;
    const midX = (minX + maxX) / 2,
      midY = (minY + maxY) / 2;
    Object.assign(camera, {
      left: midX - worldW / 2,
      right: midX + worldW / 2,
      top: midY + worldH / 2,
      bottom: midY - worldH / 2,
    });
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    labels(
      new Map(
        levels.map((e) => [
          e.level.id,
          Math.max(
            5,
            Math.min(
              94,
              (1 - new THREE.Vector3(focus.x, e.elevationM + 0.15, focus.z).project(camera).y) * 50,
            ),
          ),
        ]),
      ),
    );
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return () => {
    observer.disconnect();
    const materials = new Set<THREE.Material>();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
        for (const m of Array.isArray(obj.material) ? obj.material : [obj.material])
          materials.add(m);
      }
    });
    materials.forEach((m) => m.dispose());
    stone.dispose();
    glass.dispose();
    pencil.dispose();
    water.dispose();
    joint.dispose();
    light.shadow.dispose();
    renderer.dispose();
  };
}

export default function TankInstallationView({ property }: { property: Property }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    box = useRef<HTMLElement>(null),
    [view, choose] = useState<'cutaway' | 'elevation'>('cutaway');
  const [heights, setHeights] = useState(new Map<string, number>()),
    [error, setError] = useState(''),
    tanks = placedTanks(property);
  const summary = buildingLevels(property)
    .map((s) => ({ ...s, tanks: tanks.filter((t) => t.levelId === s.level.id) }))
    .filter((s) => s.tanks.length)
    .reverse();
  useEffect(() => {
    setError('');
    if (!canvas.current || !tanks.length) return;
    try {
      return drawInstallation(canvas.current, property, view === 'elevation', setHeights);
    } catch {
      setError('The 3D view is unavailable on this device. The floor schedule is shown below.');
    }
  }, [property, view, tanks.length]);
  if (!tanks.length) return null;
  return (
    <figure className="tank-installation" ref={box} aria-label="Measured tank installation">
      <div className="tank-installation-bar">
        <strong>Installation view</strong>
        <div>
          <button type="button" aria-pressed={view === 'cutaway'} onClick={() => choose('cutaway')}>
            Cutaway
          </button>
          <button
            type="button"
            aria-pressed={view === 'elevation'}
            onClick={() => choose('elevation')}
          >
            Elevation
          </button>
          {document.fullscreenEnabled && (
            <button
              type="button"
              aria-label="Expand installation view"
              title="Expand installation view"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void box.current?.requestFullscreen().catch(() => {});
              }}
            >
              ⛶
            </button>
          )}
        </div>
      </div>
      <div
        className={'tank-installation-drawing' + (error ? ' failed' : '')}
        data-testid="tank-installation-drawing"
      >
        <div className="tank-installation-labels">
          {summary.map((s) => (
            <div key={s.level.id} style={{ top: (heights.get(s.level.id) ?? 50) + '%' }}>
              <strong>{s.level.name}</strong>
              <span>
                {s.tanks.map((t) => t.capacityLitres.toLocaleString('en-GB') + ' L').join(' + ')}
              </span>
              <small>{s.elevationM.toFixed(2)} m</small>
            </div>
          ))}
        </div>
        {error && <p role="status">{error}</p>}
        <canvas
          hidden={!!error}
          ref={canvas}
          aria-label={
            view === 'cutaway'
              ? 'Three-dimensional tank and pipe cutaway'
              : 'Front elevation of connected tanks'
          }
        />
      </div>
      <figcaption>
        Floor elevations in metres · Blue lines show measured cold-water routes.
      </figcaption>
    </figure>
  );
}
