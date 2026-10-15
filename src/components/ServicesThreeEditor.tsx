import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Property } from '../store/propertyStore';
import { roomLevelId } from '../designer/levels';
import {
  SERVICE_SYSTEMS,
  serviceRunPoints3D,
  type BuildingServices,
  type ServiceConnection,
  type ServicePoint,
} from '../designer/buildingServices';
import { servicePorts } from '../designer/serviceConnections';
import { SERVICE_MATERIALS } from '../data/buildingServicesCatalog';
import { serviceFixtureMesh } from './three/serviceFixtureMeshes';
import { snapServicePoint, type ServiceAngleSnap } from '../designer/serviceRouteEditing';
import { servicesFovForResize } from '../designer/servicesCamera';

export interface ServiceEditorHit {
  id: string | null;
  nodeIndex?: number;
  port?: ServiceConnection;
}
export interface ServicesThreeEditorProps {
  property: Property;
  services: BuildingServices;
  levelId: string;
  selectedId: string | null;
  selectedNode: number | null;
  drawing: boolean;
  routing: boolean;
  endElevationM: number;
  snapGrid: boolean;
  angleSnap: ServiceAngleSnap;
  onRouteDrag: (
    start: ServicePoint,
    end: ServicePoint,
    startHit: ServiceEditorHit,
    endHit: ServiceEditorHit,
  ) => void;
  draft: ServicePoint[];
  elevationM: number;
  fitNonce: number;
  zoomCommand: { sequence: number; factor: number };
  onPoint: (point: ServicePoint, hit: ServiceEditorHit) => void;
  onNodeMove: (
    runId: string,
    nodeIndex: number,
    point: { x: number; y: number; elevationM: number },
  ) => void;
  onHover: (point: ServicePoint | null, hit: ServiceEditorHit | null) => void;
}
interface Runtime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  content: THREE.Group;
  lastFit: number;
  lastFloor: string;
  dirty: boolean;
}
function dispose(group: THREE.Object3D) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    if (mesh.material)
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  });
}
function hitFor(object: THREE.Object3D): ServiceEditorHit {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.serviceHit) return current.userData.serviceHit as ServiceEditorHit;
    current = current.parent;
  }
  return { id: null };
}

/** Same metre-based nodes as plan. The camera is fitted only on floor entry or explicit Fit.
 * Dragging a selected node uses its own elevation plane; elevation edits live in the inspector. */
export default function ServicesThreeEditor(props: ServicesThreeEditorProps) {
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<Runtime | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  // Rendering limits protect imported files; the canonical model is never trimmed.
  const overBudget =
    props.services.runs
      .filter((r) => r.levelId === props.levelId)
      .reduce((sum, r) => sum + r.points.length, 0) > 12000 ||
    props.services.fixtures.filter((f) => f.levelId === props.levelId).length > 500;
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor('#c6d4ca');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(42, 1, 0.02, 50000);
    scene.add(new THREE.HemisphereLight('#fffdf1', '#7b9587', 2.3));
    const sun = new THREE.DirectionalLight('#fff5db', 2);
    sun.position.set(6, 14, 4);
    scene.add(sun);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 0.15;
    controls.maxDistance = 30000;
    controls.maxPolarAngle = Math.PI * 0.94;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    const content = new THREE.Group();
    scene.add(content);
    const state: Runtime = {
      scene,
      camera,
      renderer,
      controls,
      content,
      lastFit: -1,
      lastFloor: '',
      dirty: true,
    };
    runtime.current = state;
    element.appendChild(renderer.domElement);
    let previousHeight = 0;
    const resize = new ResizeObserver(() => {
      const width = element.clientWidth,
        height = element.clientHeight;
      if (!width || !height) return;
      camera.fov = servicesFovForResize(camera.fov, previousHeight, height);
      previousHeight = height;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      state.dirty = true;
    });
    resize.observe(element);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    ray.params.Line.threshold = 0.06;
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      return (
        ray
          .intersectObjects(content.children, true)
          .map((i) => hitFor(i.object))
          .find((h) => h.id || h.port) ?? { id: null }
      );
    };
    const planePoint = (elevationM: number) => {
      const point = ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevationM),
        new THREE.Vector3(),
      );
      return point ? { x: point.x, y: point.z, elevationM } : null;
    };
    let drag: {
      x: number;
      y: number;
      hit: ServiceEditorHit;
      elevationM: number;
      moved: boolean;
      pointerId: number;
      worldStart: ServicePoint | null;
    } | null = null;
    const activePointers = new Set<number>();
    const preview = new THREE.Group();
    scene.add(preview);
    const clearPreview = () => {
      dispose(preview);
      preview.clear();
      state.dirty = true;
    };
    const down = (event: PointerEvent) => {
      activePointers.add(event.pointerId);
      if (activePointers.size > 1) {
        drag = null;
        controls.enabled = true;
        clearPreview();
        return;
      }
      if (event.button !== 0) return;
      const hit = pick(event),
        p = latest.current;
      const node =
        hit.id && hit.nodeIndex !== undefined && hit.id === p.selectedId
          ? p.services.runs.find((r) => r.id === hit.id)
          : undefined;
      const elevation = node ? serviceRunPoints3D(node)[hit.nodeIndex!].elevationM : p.elevationM;
      drag = {
        x: event.clientX,
        y: event.clientY,
        hit,
        elevationM: elevation,
        moved: false,
        pointerId: event.pointerId,
        worldStart: planePoint(elevation),
      };
      if (node && !p.drawing) {
        controls.enabled = false;
        event.stopImmediatePropagation();
        renderer.domElement.setPointerCapture(event.pointerId);
      }
    };
    const move = (event: PointerEvent) => {
      const hit = pick(event),
        p = latest.current;
      if (!drag) {
        if (p.drawing) p.onHover(planePoint(p.elevationM), hit);
        return;
      }
      if (activePointers.size !== 1) return;
      drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4;
      if (p.routing && drag.moved && drag.worldStart) {
        const point = planePoint(p.endElevationM);
        if (point) {
          clearPreview();
          const start =
            p.draft[p.draft.length - 1] ??
            snapServicePoint(drag.worldStart, undefined, p.snapGrid, 'free');
          const end = snapServicePoint(point, start, p.snapGrid, p.angleSnap);
          const segments = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(start.x, start.elevationM ?? drag.elevationM, start.y),
              new THREE.Vector3(end.x, end.elevationM ?? p.endElevationM, end.y),
            ]),
            new THREE.LineDashedMaterial({
              color: '#b77733',
              depthTest: false,
              dashSize: 0.12,
              gapSize: 0.08,
            }),
          );
          segments.computeLineDistances();
          segments.renderOrder = 20;
          preview.add(segments);
          state.dirty = true;
          p.onHover(point, hit);
        }
        return;
      }
      if (
        !p.drawing &&
        drag.hit.id === p.selectedId &&
        drag.hit.nodeIndex !== undefined &&
        drag.moved
      ) {
        const point = planePoint(drag.elevationM);
        if (point) {
          clearPreview();
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 12, 8),
            new THREE.MeshBasicMaterial({ color: '#e4b16c', depthTest: false }),
          );
          mesh.position.set(point.x, point.elevationM, point.y);
          mesh.renderOrder = 20;
          preview.add(mesh);
          const route = p.services.runs.find((run) => run.id === drag!.hit.id);
          if (route) {
            const nodes = serviceRunPoints3D(route),
              index = drag.hit.nodeIndex!;
            const adjacent = [nodes[index - 1], point, nodes[index + 1]]
              .filter(Boolean)
              .map((node) => new THREE.Vector3(node.x, node.elevationM, node.y));
            const segments = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(adjacent),
              new THREE.LineDashedMaterial({
                color: '#b77733',
                depthTest: false,
                dashSize: 0.12,
                gapSize: 0.08,
              }),
            );
            segments.computeLineDistances();
            segments.renderOrder = 20;
            preview.add(segments);
          }
          state.dirty = true;
          p.onHover(point, hit);
        }
      }
    };
    const up = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      const current = drag;
      drag = null;
      controls.enabled = true;
      clearPreview();
      if (!current || current.pointerId !== event.pointerId || activePointers.size) return;
      const endHit = pick(event);
      const p = latest.current;
      const point = planePoint(p.routing && current.moved ? p.endElevationM : current.elevationM);
      if (!point) {
        if (!p.drawing && !current.moved && !current.hit.id) p.onPoint({ x: 0, y: 0 }, current.hit);
        p.onHover(null, null);
        return;
      }
      if (p.routing && current.moved && current.worldStart)
        p.onRouteDrag(current.worldStart, point, current.hit, endHit);
      else if (
        current.moved &&
        !p.drawing &&
        current.hit.id === p.selectedId &&
        current.hit.nodeIndex !== undefined
      )
        p.onNodeMove(current.hit.id!, current.hit.nodeIndex, point);
      else if (!current.moved) p.onPoint(point, current.hit);
      p.onHover(null, null);
    };
    const cancel = () => {
      activePointers.clear();
      drag = null;
      controls.enabled = true;
      clearPreview();
      latest.current.onHover(null, null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    renderer.domElement.addEventListener('pointerdown', down, true);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const moved = controls.update();
      if (state.dirty || moved) {
        renderer.render(scene, camera);
        state.dirty = false;
      }
    };
    animate();
    setReady(true);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('keydown', key);
      renderer.domElement.removeEventListener('pointerdown', down, true);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', cancel);
      controls.dispose();
      dispose(scene);
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const state = runtime.current;
    if (!state || !ready) return;
    state.controls.enableRotate = !props.drawing;
    dispose(state.content);
    state.content.clear();
    if (overBudget) {
      state.dirty = true;
      return;
    }
    const { content } = state;
    const line = (points: THREE.Vector3[], colour: string, hit?: ServiceEditorHit, opacity = 1) => {
      const object = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: colour,
          transparent: opacity < 1,
          opacity,
          depthTest: false,
        }),
      );
      if (hit) object.userData.serviceHit = hit;
      content.add(object);
      return object;
    };
    const rooms = props.property.rooms.filter((r) => roomLevelId(r) === props.levelId);
    for (const room of rooms) {
      if (!room.polygon.length) continue;
      line(
        [...room.polygon, room.polygon[0]].map((p) => new THREE.Vector3(p.x, 0, p.y)),
        '#81988b',
        undefined,
        0.6,
      );
    }
    for (const wall of (props.property.walls ?? []).filter((w) => roomLevelId(w) === props.levelId))
      line(
        [wall.a, wall.b].map((p) => new THREE.Vector3(p.x, 0, p.y)),
        '#81988b',
        undefined,
        0.6,
      );
    const marker = (
      point: { x: number; y: number; elevationM: number },
      colour: string,
      radius: number,
      hit: ServiceEditorHit,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 12, 8),
        new THREE.MeshBasicMaterial({ color: colour, depthTest: false }),
      );
      mesh.position.set(point.x, point.elevationM, point.y);
      mesh.userData.serviceHit = hit;
      mesh.renderOrder = 10;
      content.add(mesh);
    };
    for (const run of props.services.runs.filter((r) => r.levelId === props.levelId)) {
      const points = serviceRunPoints3D(run),
        colour = SERVICE_SYSTEMS.find((s) => s.id === run.system)!.colour;
      const radius =
        (SERVICE_MATERIALS.find(
          (m) =>
            m.id === run.materialId &&
            m.system === run.system &&
            m.nominalDiameterMm === run.diameterMm,
        )?.outerDiameterMm ?? run.diameterMm) / 2000;
      for (let i = 1; i < points.length; i++) {
        const a = new THREE.Vector3(points[i - 1].x, points[i - 1].elevationM, points[i - 1].y);
        const b = new THREE.Vector3(points[i].x, points[i].elevationM, points[i].y),
          direction = b.clone().sub(a);
        if (direction.length() <= 1e-9) continue;
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, direction.length(), 10),
          new THREE.MeshStandardMaterial({ color: colour, roughness: 0.4 }),
        );
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        mesh.userData.serviceHit = { id: run.id };
        content.add(mesh);
      }
      line(
        points.map((p) => new THREE.Vector3(p.x, p.elevationM, p.y)),
        run.id === props.selectedId ? '#b77733' : colour,
        { id: run.id },
      );
      if (run.id === props.selectedId || props.drawing)
        points.forEach((p, nodeIndex) =>
          marker(
            p,
            run.id === props.selectedId && props.selectedNode === nodeIndex ? '#dfa456' : colour,
            0.075,
            { id: run.id, nodeIndex },
          ),
        );
    }
    for (const fixture of props.services.fixtures.filter((f) => f.levelId === props.levelId)) {
      const mesh = serviceFixtureMesh({ ...fixture, elevationM: fixture.elevationM ?? 0 });
      mesh.userData.serviceHit = { id: fixture.id };
      content.add(mesh);
      for (const port of servicePorts(fixture))
        if (port.elevationM !== null)
          marker(
            { ...port, elevationM: port.elevationM },
            SERVICE_SYSTEMS.find((s) => s.id === port.id)!.colour,
            0.07,
            { id: fixture.id, port: { fixtureId: fixture.id, portId: port.id } },
          );
    }
    if (props.draft.length)
      line(
        props.draft.map((p) => new THREE.Vector3(p.x, p.elevationM ?? props.elevationM, p.y)),
        '#b77733',
      );
    const bounds = new THREE.Box3().setFromObject(content);
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-2, -1, -2), new THREE.Vector3(10, 3, 8));
    const size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3());
    const grid = new THREE.GridHelper(
      Math.min(1000, Math.max(10, Math.ceil(Math.max(size.x, size.z) + 4))),
      20,
      '#80998b',
      '#a9bbae',
    );
    grid.position.set(center.x, -0.005, center.z);
    content.add(grid);
    if (props.drawing && Math.abs(props.elevationM) > 0.01) {
      const plane = new THREE.GridHelper(
        Math.min(1000, Math.max(10, Math.ceil(Math.max(size.x, size.z) + 4))),
        20,
        '#bd935b',
        '#c4aa80',
      );
      plane.position.set(center.x, props.elevationM, center.z);
      content.add(plane);
    }
    if (state.lastFit !== props.fitNonce || state.lastFloor !== props.levelId) {
      const distance = Math.max(3, size.length()) * 1.35;
      state.controls.target.copy(center);
      state.camera.position
        .copy(center)
        .add(new THREE.Vector3(0.75, 0.85, 1).normalize().multiplyScalar(distance));
      state.controls.update();
      state.lastFit = props.fitNonce;
      state.lastFloor = props.levelId;
    }
    state.dirty = true;
  }, [
    ready,
    overBudget,
    props.property,
    props.services,
    props.levelId,
    props.selectedId,
    props.selectedNode,
    props.draft,
    props.elevationM,
    props.fitNonce,
    props.drawing,
  ]);
  useEffect(() => {
    const state = runtime.current;
    if (!state || !props.zoomCommand.sequence) return;
    state.camera.position
      .sub(state.controls.target)
      .multiplyScalar(props.zoomCommand.factor)
      .add(state.controls.target);
    state.controls.update();
    state.dirty = true;
  }, [props.zoomCommand]);
  return (
    <div className="services-three" ref={host} aria-label="Editable 3D building services">
      {overBudget && (
        <p role="status">
          This floor exceeds the interactive 3D budget (12,000 route nodes or 500 fixtures). Hide
          unneeded disciplines or edit in 2D. Your complete model is preserved.
        </p>
      )}
      {failed && (
        <p role="alert">
          3D is unavailable on this device. The complete measured editor remains available in 2D.
        </p>
      )}
      {!ready && !failed && <p role="status">Preparing measured 3D services…</p>}
    </div>
  );
}
