import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CITY_NETWORK_SYSTEMS,
  cityBounds,
  cityRoadPolygons,
  type CityAsset,
  type CityModel,
  type CityPoint,
} from '../designer/city';
import './CityThreeView.css';

export interface CityThreeViewProps {
  model: CityModel;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  fitNonce: number;
  showUtilities: boolean;
}

interface CityScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  selection: THREE.Group;
  sun: THREE.DirectionalLight;
  selectedId: string | null;
  lastFitNonce: number;
  dirty: boolean;
}

function material(colour: string, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness, metalness });
}

/** Plan x/y map to Three x/z; model elevations map directly to Three y. */
function box(
  group: THREE.Group,
  width: number,
  height: number,
  length: number,
  x: number,
  y: number,
  z: number,
  colour: string,
  metalness = 0,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, length),
    material(colour, metalness ? 0.4 : 0.8, metalness),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function facadeAccent(mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>) {
  // Bias only the appearance: flush panels keep the measured outer envelope exact.
  mesh.material.polygonOffset = true;
  mesh.material.polygonOffsetFactor = -1;
  mesh.material.polygonOffsetUnits = -1;
}

function assetMesh(asset: CityAsset) {
  const group = new THREE.Group();
  const w = asset.widthM, l = asset.lengthM, h = asset.heightM;
  group.position.set(asset.x, 0, asset.y);
  group.rotation.y = -THREE.MathUtils.degToRad(asset.rotation);
  group.userData.cityId = asset.id;
  group.userData.kind = 'asset';
  group.name = asset.name;

  if (asset.kind === 'water-tank') {
    // Elliptical tank envelope, never its nominal stored water volume.
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 28), material('#728f8e'));
    tank.scale.set(w, h, l);
    tank.position.y = h / 2;
    tank.castShadow = true;
    tank.receiveShadow = true;
    group.add(tank);
    for (const level of [0.2, 0.4, 0.6, 0.8]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.488, 0.01, 4, 28), material('#95aaa3'),
      );
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(w, l, Math.min(w, l, h * 2));
      ring.position.y = h * level;
      group.add(ring);
    }
  } else if (asset.kind === 'pv-array') {
    const thickness = Math.min(0.12, h * 0.1);
    box(group, w, thickness, l, 0, h - thickness / 2, 0, '#435e72', 0.25);
    // Cell lines are visual divisions of one envelope, not an inferred panel count.
    const points: THREE.Vector3[] = [];
    const columns = Math.min(24, Math.max(2, Math.ceil(w / 2)));
    const rows = Math.min(24, Math.max(2, Math.ceil(l / 2)));
    for (let i = 1; i < columns; i++) {
      const x = -w / 2 + w * i / columns;
      points.push(new THREE.Vector3(x, h, -l / 2), new THREE.Vector3(x, h, l / 2));
    }
    for (let i = 1; i < rows; i++) {
      const z = -l / 2 + l * i / rows;
      points.push(new THREE.Vector3(-w / 2, h, z), new THREE.Vector3(w / 2, h, z));
    }
    const cells = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: '#a6bdc1', transparent: true, opacity: 0.55 }));
    group.add(cells);
    for (const x of [-w * 0.35, w * 0.35])
      for (const z of [-l * 0.35, l * 0.35])
        box(group, Math.min(w * 0.05, 0.15), h - thickness, Math.min(l * 0.05, 0.15), x, (h - thickness) / 2, z, '#a1a5a0', 0.3);
  } else if (asset.kind === 'solar-light') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1, 12), material('#e3e4d8', 0.45, 0.3));
    pole.scale.set(Math.min(w, l), h * 0.96, Math.min(w, l));
    pole.position.y = h * 0.48;
    pole.castShadow = true;
    group.add(pole);
    box(group, w, h * 0.035, l, 0, h * 0.9825, 0, '#4c6577', 0.25);
    const lamp = box(group, w * 0.65, h * 0.02, l * 0.65, 0, h * 0.92, 0, '#f2eac7');
    (lamp.material as THREE.MeshStandardMaterial).emissive.set('#e1bc64');
    (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
  } else if (asset.kind === 'park') {
    box(group, w, h, l, 0, h / 2, 0, '#9ba987');
    // Top-down canopy marks stay within the measured green-space height.
    // A park area is not a tree-height or biodiversity specification.
    for (const [x, z, radius] of [[-0.25, -0.22, 0.13], [0.24, 0.2, 0.16], [-0.18, 0.27, 0.11], [0.27, -0.25, 0.12]]) {
      const canopy = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, l) * radius, 20),
        new THREE.MeshBasicMaterial({ color: '#6f896b', polygonOffset: true, polygonOffsetFactor: -1 }));
      canopy.rotation.x = -Math.PI / 2;
      canopy.position.set(w * x, h, l * z);
      group.add(canopy);
    }
  } else if (asset.kind === 'building' || asset.kind === 'data-centre') {
    const isDataCentre = asset.kind === 'data-centre';
    const cap = Math.min(0.25, h * 0.05);
    box(group, w, h - cap, l, 0, (h - cap) / 2, 0, isDataCentre ? '#acbab3' : '#e3dfcf');
    box(group, w, cap, l, 0, h - cap / 2, 0, isDataCentre ? '#738f89' : '#b8b7a9');
    // Facade accents remain inside the envelope, not rentable floor-area estimates.
    const bandH = Math.min(1.2, h * 0.18);
    const floors = Math.min(8, Math.max(1, Math.floor(h / 3)));
    for (let level = 0; level < floors; level++) {
      const y = (level + 0.52) * (h - cap) / floors;
      facadeAccent(box(group, w * 0.8, bandH, Math.min(l * 0.015, 0.04), 0, y, l / 2 - Math.min(l * 0.0075, 0.02), '#668282', 0.15));
      facadeAccent(box(group, Math.min(w * 0.015, 0.04), bandH, l * 0.8, w / 2 - Math.min(w * 0.0075, 0.02), y, 0, '#78908c', 0.15));
    }
  } else {
    const colours = { battery: '#8fa995', transformer: '#b8af92', 'ev-charger': '#719c8e' };
    const base = colours[asset.kind];
    box(group, w, h, l, 0, h / 2, 0, base);
    const panelW = w * 0.56, panelH = h * 0.22, panelD = Math.min(l * 0.02, 0.03);
    facadeAccent(box(group, panelW, panelH, panelD, 0, h * 0.65, l / 2 - panelD / 2, '#3c5754'));
    for (const y of [0.16, 0.23, 0.3])
      facadeAccent(box(group, w * 0.7, h * 0.012, panelD, 0, h * y, l / 2 - panelD / 2, '#536e65'));
  }
  return group;
}

function polygonShape(points: CityPoint[]) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (!index) shape.moveTo(point.x, -point.y);
    else shape.lineTo(point.x, -point.y);
  });
  shape.closePath();
  return shape;
}

function disposeGroup(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    if (mesh.material) {
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m));
    }
  });
  materials.forEach((m) => m.dispose());
  group.clear();
}

function populate(runtime: CityScene, model: CityModel, showUtilities: boolean) {
  disposeGroup(runtime.content);
  const site = model.site;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(site.widthM, site.lengthM), material('#aab59a'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(site.originM.x + site.widthM / 2, -0.025, site.originM.y + site.lengthM / 2);
  ground.receiveShadow = true;
  runtime.content.add(ground);

  const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(site.originM.x, 0, site.originM.y),
    new THREE.Vector3(site.originM.x + site.widthM, 0, site.originM.y),
    new THREE.Vector3(site.originM.x + site.widthM, 0, site.originM.y + site.lengthM),
    new THREE.Vector3(site.originM.x, 0, site.originM.y + site.lengthM),
  ]), new THREE.LineBasicMaterial({ color: '#6e836e' }));
  runtime.content.add(border);

  if (model.enabled) {
    model.roads.forEach((road) => {
      const group = new THREE.Group();
      group.userData.cityId = road.id;
      group.userData.kind = 'road';
      group.name = road.name;
      cityRoadPolygons(road).forEach((points) => {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(polygonShape(points)),
          material(road.presetId === 'cycle-path' ? '#cebaa0' : '#7e8784'));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.006;
        mesh.receiveShadow = true;
        group.add(mesh);
      });
      runtime.content.add(group);
    });
    model.assets.forEach((asset) => runtime.content.add(assetMesh(asset)));
    if (showUtilities) model.networks.forEach((network) => {
      const colour = CITY_NETWORK_SYSTEMS.find((s) => s.id === network.system)?.colour ?? '#64828d';
      const group = new THREE.Group();
      group.userData.cityId = network.id;
      group.userData.kind = 'network';
      group.name = network.name;
      const points = network.points.map((p) => new THREE.Vector3(p.x, p.z, p.y));
      points.slice(1).forEach((b, index) => {
        const a = points[index], direction = b.clone().sub(a);
        const length = direction.length();
        if (length < 0.00001) return;
        const m = material(colour);
        m.depthTest = false;
        m.depthWrite = false;
        m.transparent = true;
        m.opacity = 0.75;
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(network.diameterMm / 2000, network.diameterMm / 2000, length, 10), m);
        pipe.position.copy(a).add(b).multiplyScalar(0.5);
        pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        pipe.renderOrder = 2;
        group.add(pipe);
      });
      // One-pixel coordination centrelines keep small, correctly sized ducts visible.
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: colour, depthTest: false, depthWrite: false }));
      line.renderOrder = 3;
      group.add(line);
      runtime.content.add(group);
    });
  }

  const bounds = cityBounds(model), extent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 10);
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minY + bounds.maxY) / 2;
  runtime.sun.position.set(cx - extent * 0.4, extent * 0.9, cz + extent * 0.3);
  runtime.sun.target.position.set(cx, 0, cz);
  const shadow = runtime.sun.shadow.camera;
  shadow.left = shadow.bottom = -extent * 0.75;
  shadow.right = shadow.top = extent * 0.75;
  shadow.far = extent * 3 + bounds.maxHeightM;
  shadow.updateProjectionMatrix();
  runtime.renderer.shadowMap.needsUpdate = true;
  runtime.dirty = true;
}

function highlight(runtime: CityScene, model: CityModel, selectedId: string | null, showUtilities: boolean) {
  disposeGroup(runtime.selection);
  runtime.dirty = true;
  runtime.selectedId = selectedId;
  if (!selectedId || !model.enabled) return;
  const asset = model.assets.find((a) => a.id === selectedId);
  const lineMaterial = new THREE.LineBasicMaterial({ color: '#f0cc82', depthTest: false, depthWrite: false });
  if (asset) {
    const geometry = new THREE.BoxGeometry(asset.widthM, asset.heightM, asset.lengthM);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial);
    geometry.dispose();
    edges.position.set(asset.x, asset.heightM / 2, asset.y);
    edges.rotation.y = -THREE.MathUtils.degToRad(asset.rotation);
    edges.renderOrder = 5;
    runtime.selection.add(edges);
    return;
  }
  const road = model.roads.find((r) => r.id === selectedId);
  if (road) {
    for (const points of cityRoadPolygons(road)) {
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, 0.02, p.y))), lineMaterial);
      line.renderOrder = 5;
      runtime.selection.add(line);
    }
    return;
  }
  const network = showUtilities ? model.networks.find((n) => n.id === selectedId) : undefined;
  if (network) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(network.points.map((p) => new THREE.Vector3(p.x, p.z, p.y))), lineMaterial);
    line.renderOrder = 5;
    runtime.selection.add(line);
  } else lineMaterial.dispose();
}

function fitScene(runtime: CityScene, model: CityModel) {
  const bounds = cityBounds(model);
  const radius = Math.max(2, Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxHeightM) / 2);
  const vertical = THREE.MathUtils.degToRad(runtime.camera.fov);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * runtime.camera.aspect);
  const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.08;
  const target = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, bounds.maxHeightM / 3, (bounds.minY + bounds.maxY) / 2);
  runtime.controls.target.copy(target);
  runtime.camera.position.copy(target).add(new THREE.Vector3(0.85, 0.95, 1.15).normalize().multiplyScalar(distance));
  runtime.camera.near = 0.05;
  runtime.camera.far = Math.max(100000, distance * 30);
  runtime.camera.updateProjectionMatrix();
  runtime.controls.maxDistance = Math.max(distance * 10, 1000);
  runtime.controls.minDistance = 0.5;
  runtime.controls.update();
  runtime.dirty = true;
}

export default function CityThreeView({ model, selectedId = null, onSelect, fitNonce, showUtilities }: CityThreeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<CityScene | null>(null);
  const modelRef = useRef(model);
  const onSelectRef = useRef(onSelect);
  const initialFitRef = useRef(fitNonce);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
    } catch {
      setUnavailable(true);
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e5e8de');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.setAttribute('aria-label', 'City 3D planning model. Drag to orbit; two fingers or right-drag to pan; pinch or scroll to zoom.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 1.4;
    controls.panSpeed = 1.05;
    controls.screenSpacePanning = true;
    controls.minPolarAngle = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    const ambient = new THREE.HemisphereLight('#fcf7e9', '#73836d', 2.2);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#fff0d6', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.normalBias = 0.05;
    scene.add(sun, sun.target);
    const content = new THREE.Group(), selection = new THREE.Group();
    scene.add(content, selection);
    const runtime: CityScene = { renderer, scene, camera, controls, content, selection, sun, selectedId: null, lastFitNonce: initialFitRef.current, dirty: true };
    runtimeRef.current = runtime;
    const onControlsChange = () => { runtime.dirty = true; };
    controls.addEventListener('change', onControlsChange);
    const resize = () => {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      runtime.dirty = true;
      // Layout changes deliberately never call fitScene: preserve the user's view.
    };
    resize();
    fitScene(runtime, modelRef.current);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointers = new Map<number, { x: number; y: number }>();
    let multiTouchGesture = false;
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size > 1) multiTouchGesture = true;
    };
    const onUp = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId);
      const wasMultiTouch = multiTouchGesture;
      pointers.delete(event.pointerId);
      if (!pointers.size) multiTouchGesture = false;
      if (!start || wasMultiTouch || event.button !== 0 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      ray.params.Line = { threshold: Math.max(0.08, camera.position.distanceTo(controls.target) / Math.max(rect.height, 1) * 2) };
      for (const hit of ray.intersectObjects(content.children, true)) {
        let object: THREE.Object3D | null = hit.object;
        while (object && !object.userData.cityId) object = object.parent;
        if (object?.userData.cityId) {
          onSelectRef.current(object.userData.cityId as string);
          return;
        }
      }
      onSelectRef.current(null);
    };
    const onCancel = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (!pointers.size) multiTouchGesture = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      if (event.key === '+' || event.key === '=') offset.multiplyScalar(0.85);
      else if (event.key === '-') offset.multiplyScalar(1.15);
      else {
        const spherical = new THREE.Spherical().setFromVector3(offset);
        if (event.key === 'ArrowLeft') spherical.theta -= 0.08;
        if (event.key === 'ArrowRight') spherical.theta += 0.08;
        if (event.key === 'ArrowUp') spherical.phi = Math.max(controls.minPolarAngle, spherical.phi - 0.08);
        if (event.key === 'ArrowDown') spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + 0.08);
        offset.setFromSpherical(spherical);
      }
      camera.position.copy(controls.target).add(offset);
      controls.update();
    };
    const onLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); setUnavailable(true); };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onCancel);
    renderer.domElement.addEventListener('keydown', onKey);
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    let frame = 0;
    const render = () => {
      if (controls.update() || runtime.dirty) {
        renderer.render(scene, camera);
        runtime.dirty = false;
      }
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onCancel);
      renderer.domElement.removeEventListener('keydown', onKey);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      disposeGroup(content);
      disposeGroup(selection);
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) populate(runtime, model, showUtilities);
  }, [model, showUtilities]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) highlight(runtime, model, selectedId, showUtilities);
  }, [model, selectedId, showUtilities]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime && runtime.lastFitNonce !== fitNonce) {
      runtime.lastFitNonce = fitNonce;
      fitScene(runtime, modelRef.current);
    }
  }, [fitNonce]);

  return <div className="city-three-view" data-testid="city-three-view">
    <div className="city-three-view__stage" ref={hostRef} />
    {unavailable ? <div className="city-three-view__fallback" role="status">
      <strong>3D is unavailable on this device</strong>
      <span>Switch to 2D to continue editing the same city plan and measurements.</span>
    </div> : <>
      <div className="city-three-view__label">Measured 3D planning envelopes{showUtilities && <span>Underground routes revealed</span>}</div>
      <div className="city-three-view__help">Drag to orbit · Two fingers to pan · Pinch to zoom</div>
    </>}
  </div>;
}
