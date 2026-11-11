import * as THREE from 'three';
// Import the mixer from Three's source entry so its implementation stays in
// the deferred walk chunk instead of growing the first-picture vendor bundle.
import { AnimationMixer } from 'three/src/animation/AnimationMixer.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { ThreeStageHandle } from '../components/three/ThreeStage';
import type { SceneSolids } from '../designer/roomSolids';
import type { Property } from '../store/propertyStore';
import type { WalkCharacter } from './characters';
import { createWalkWorld } from './scene';
import { capsuleClear, createWalker, doorTransform, followCamera, groundHeight, interactionDoor, pullInCamera, stepWalker, toggleDoor } from './collision';
import { GROUND_LEVEL_ID } from '../designer/levels';
import { cutawayState } from '../designer/roomSolids';
import { pointInPolygon } from '../lib/geometry';
import { authoredSupport, roofFootOffset, pickSpawn, spawnAt, spawnOnLevel, type PlacementHint } from './placement';
import { findWalkSpawn } from './spawn';
import { WalkFrameMeasurement, type FrameMeasurementResult } from './frameMeasurement';
import { hideStaticDoorLeaves, renderWalkSurface } from './stageSurface';

type Host = NonNullable<ReturnType<ThreeStageHandle['beginWalk']>>;
export interface WalkStatus {
  mode: 'first' | 'third'; door: string | null; blocked: boolean; locked: boolean;
  animation: 'idle' | 'walk' | 'run'; position: number[]; camera: number[];
  fps: number; low1: number; frames: number; entryMs: number;
  grounded?: boolean; levelId?: string; cutaway?: boolean; overview?: boolean; notice?: string;
}

export const WALK_SPEED_M_S = 1.45;
export const RUN_SPEED_M_S = 3.4;

/** All state belongs to this visit. The property is only read to build collision geometry. */
export class WalkRuntime {
  private world;
  private walker;
  private camera = new THREE.PerspectiveCamera(65, 1, .06, 1000);
  private look = new THREE.PerspectiveCamera();
  private controls: PointerLockControls;
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private running = false;
  private levelId: string;
  private cutaway = true;
  private overview = false;
  private cutawayAt = -Infinity;
  private route: THREE.Vector3[] = [];
  private routeRequest = 0;
  private stalled = 0;
  private notice = '';
  private lookStick = { x: 0, y: 0 };
  private mode: 'first' | 'third' = 'third';
  private actor = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<'idle' | 'walk' | 'run', THREE.AnimationAction>> = {};
  private animation: 'idle' | 'walk' | 'run' = 'idle';
  private doors = new Map<string, THREE.Group>();
  private hidden: THREE.Object3D[] = [];
  private raf = 0;
  private disposed = false;
  private ready = false;
  private paused = false;
  private last = 0;
  private lastStatus = 0;
  private frames: number[] = [];
  private totalFrames = 0;
  private entryMs = 0;
  private eyeHeight = 0;
  private blockedUntil = 0;
  private retainedDoor: string | null = null;
  private followReady = false;
  private escapeHeld = false;
  private unlockPending = false;
  private unlockRequested = false;
  private unlockedAt = -Infinity;
  private measurementArmed = false;
  private inputMeasure: { inputAt: number; handlerAt: number; source: string; key: string; mode: string; x: number; z: number } | null = null;
  private frameMeasurement: WalkFrameMeasurement | null = null;
  private frameMeasurementTimer: number | undefined;
  private disposeProjectionHook?: () => void;
  private disposeTestHook?: () => void;
  private testCameraBaseline = false;
  private testPose: { position: number[]; yaw: number; frames: number } | null = null;
  private eye = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private follow = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private peers?: import('../sharedBuild/remotePlayers').RemotePlayers;
  private peerLoad?: Promise<void>;
  private peerList: import('../sharedBuild/contract').Player[] = [];
  private receivePeers=(event:Event)=>{
    this.peerList=(event as CustomEvent<import('../sharedBuild/contract').Player[]>).detail;
    if(this.peers){this.peers.update(this.peerList);return}
    if(!this.peerList.length)return;
    this.peerLoad??=import('../sharedBuild/remotePlayers').then(({RemotePlayers})=>{
      if(this.disposed)return;
      this.peers=new RemotePlayers(this.host.scene);this.peers.update(this.peerList);
    }).catch(()=>{this.peerLoad=undefined});
  };
  private decoder = new DRACOLoader();
  private abort = new AbortController();
  private pauseFrames(reason: string): void {
    this.clearInput(); this.paused = true; this.controls.unlock();
    this.emitFrameMeasurement(this.frameMeasurement?.transition(performance.now(), false, reason));
  }
  private resumeFrames(reason: string): void {
    this.paused = false; this.last = performance.now();
    this.emitFrameMeasurement(this.frameMeasurement?.transition(this.last, !document.hidden, reason));
  }
  private onBlur = () => this.pauseFrames('blur');
  private onFocus = () => this.resumeFrames('focus');
  private onVisibility = () => document.hidden ? this.pauseFrames('hidden') : this.resumeFrames('visible');
  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === 'Escape') { this.escapeHeld = false; this.unlockPending = false; }
  };
  private onUnlock = () => {
    this.clearInput();
    this.unlockPending = !this.unlockRequested && !this.escapeHeld && !this.paused && !this.disposed;
    // Keep our unlock intent until the next lock attempt: a queued lock event
    // can arrive after unlock and produce a second "unlocked" notification.
    this.unlockedAt = performance.now();
    this.lastStatus = -Infinity;
  };
  private onLock = () => { this.unlockPending = false; this.unlockRequested = false; this.lastStatus = -Infinity; };
  private onMeasureInput = () => {
    this.measurementArmed = true; this.inputMeasure = null;
    this.host.renderer.domElement.removeAttribute('data-walk-input-result');
  };
  private onMeasureFrames = (event: Event) => {
    if (!this.ready || this.disposed || this.frameMeasurement) return;
    const requested = (event as CustomEvent<{ durationMs?: number }>).detail?.durationMs ?? 40000;
    if (!Number.isFinite(requested) || requested < 100 || requested > 120000) return;
    const canvas = this.host.renderer.domElement;
    canvas.removeAttribute('data-walk-frame-result');
    this.frameMeasurement = new WalkFrameMeasurement(performance.now(), requested, !this.paused && !document.hidden);
    const complete = () => {
      const sample = this.frameMeasurement;
      if (!sample) return;
      const now = performance.now(), remaining = sample.deadlineAt - now;
      if (remaining > 0) this.frameMeasurementTimer = window.setTimeout(complete, remaining);
      else this.emitFrameMeasurement(sample.finish(now, 'deadline'));
    };
    this.frameMeasurementTimer = window.setTimeout(complete, requested);
  };
  private emitFrameMeasurement(result: FrameMeasurementResult | null | undefined): void {
    if (!result) return;
    this.frameMeasurement = null;
    window.clearTimeout(this.frameMeasurementTimer); this.frameMeasurementTimer = undefined;
    const canvas = this.host.renderer.domElement;
    canvas.setAttribute('data-walk-frame-result', JSON.stringify(result));
    canvas.dispatchEvent(new CustomEvent('world-walk-frame-result', { detail: result }));
  }

  constructor(private host: Host, private solids: SceneSolids, property: Property,
    private onStatus: (status: WalkStatus) => void, _onExit: () => void, initial?: { levelId: string; point?: PlacementHint['point'] }) {
    this.world = createWalkWorld(solids, property);
    this.levelId = initial?.levelId ?? this.world.groundLevelId ?? GROUND_LEVEL_ID;
    this.world.roofActive = this.world.roofSurfaces?.some(r => r.levelId === this.levelId) ?? false;
    const spawn = initial?.point ? spawnAt(this.world, initial.point, this.levelId)
      : initial ? spawnOnLevel(this.world, this.levelId)
      : findWalkSpawn(this.world, property) ?? spawnOnLevel(this.world, this.levelId);
    if (!spawn) { this.world.dispose(); throw new Error('No clear standing space on this surface. Choose a floor or another spot on the land.'); }
    this.walker = createWalker(this.world, spawn.position);
    this.eyeHeight = spawn.position.y + 1.55;
    this.look.rotation.order = 'YXZ';
    this.look.rotation.y = spawn.yaw;
    this.actor.rotation.y = spawn.yaw + Math.PI;
    this.controls = new PointerLockControls(this.look, host.renderer.domElement);
    this.controls.pointerSpeed = .8;
    this.controls.addEventListener('unlock', this.onUnlock);
    this.controls.addEventListener('lock', this.onLock);
    this.controls.minPolarAngle = .2; this.controls.maxPolarAngle = Math.PI - .2;
    window.addEventListener('olb:live-peers',this.receivePeers);
    window.dispatchEvent(new Event('olb:request-peers'));
    this.attachDoors();
    host.scene.add(this.actor);
    host.renderer.shadowMap.needsUpdate = true;
    this.follow.copy(spawn.position).add(new THREE.Vector3(0, 1.6, 0));
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibility);
    host.renderer.domElement.addEventListener('world-walk-measure-input', this.onMeasureInput);
    host.renderer.domElement.addEventListener('world-walk-measure-frames', this.onMeasureFrames);
    if (typeof __TEST_HOOKS__ !== 'undefined' && __TEST_HOOKS__) {
      const canvas = host.renderer.domElement;
      const project = (event: Event) => {
        const { x, y, height, reply } = (event as CustomEvent).detail;
        const point = new THREE.Vector3(x, height, y).project(this.camera);
        const rect = canvas.getBoundingClientRect();
        if (point.z <= 1) reply({ x: rect.left + (point.x+1)*rect.width/2, y: rect.top + (1-point.y)*rect.height/2 });
      };
      canvas.addEventListener('world-walk-project', project);
      this.disposeProjectionHook = () => canvas.removeEventListener('world-walk-project', project);
    }
    // Vite removes this fixture bridge from production. It exists only to make
    // the old/new camera evidence use the same valid pose in the actual scene.
    if (import.meta.env.DEV) {
      const canvas = host.renderer.domElement;
      const testPose = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        canvas.removeAttribute('data-walk-test-pose');
        const coordinates = detail?.position;
        let valid = Array.isArray(coordinates) && coordinates.length === 3 && coordinates.every(Number.isFinite) && Number.isFinite(detail?.yaw);
        const position = valid ? new THREE.Vector3(...coordinates as [number, number, number]) : new THREE.Vector3();
        if (valid) valid = this.teleport(position, detail.yaw);
        if (!valid || !this.ready) {
          const result = { accepted: false, reason: 'Pose must have floor support and capsule clearance in a ready visit.' };
          canvas.setAttribute('data-walk-test-pose', JSON.stringify(result));
          canvas.dispatchEvent(new CustomEvent('world-walk-test-pose-ready', { detail: result }));
          return;
        }
        this.mode = 'third';
        this.testCameraBaseline = detail.baselineCamera === true;
        this.testPose = { position: position.toArray(), yaw: detail.yaw, frames: 0 };
        this.lastStatus = -Infinity;
      };
      canvas.addEventListener('world-walk-test-pose', testPose);
      this.disposeTestHook = () => canvas.removeEventListener('world-walk-test-pose', testPose);
    }
  }

  /** Only supported, clear positions can become a new visit pose. */
  teleport(position: THREE.Vector3, yaw: number): boolean {
    if (!this.ready || this.disposed || !Number.isFinite(yaw) || !position.toArray().every(Number.isFinite)) return false;
    const support = groundHeight(this.world, position.x, position.z, position.y + .025, .28);
    const point = { x: position.x, y: position.z };
    if (support === null || !authoredSupport(this.world, point, support)) return false;
    const expected = support + roofFootOffset(this.world, point, support, this.walker.radius);
    if (Math.abs(position.y - expected) > .015 || !capsuleClear(this.world, createWalker(this.world, position))) return false;
    this.clearInput();
    this.walker = createWalker(this.world, position);
    this.look.rotation.set(0, yaw, 0, 'YXZ');
    this.actor.rotation.y = yaw + Math.PI;
    this.actor.position.copy(position);
    this.eyeHeight = position.y + 1.55;
    this.followReady = false; this.cutawayAt = -Infinity; this.lastStatus = -Infinity;
    this.notice = '';
    return true;
  }

  chooseLevel(levelId: string): boolean {
    const p = this.walker.position;
    const spawn = spawnOnLevel(this.world, levelId, { x: p.x, y: p.z });
    if (!spawn) { this.notice = 'No clear standing surface on this level.'; this.lastStatus = -Infinity; return false; }
    const previous = this.world.roofActive;
    this.world.roofActive = this.world.roofSurfaces?.some(r => r.levelId === levelId) ?? false;
    if (!this.teleport(spawn.position, this.look.rotation.y)) { this.world.roofActive = previous; return false; }
    this.levelId = levelId;
    return true;
  }

  toggleCutaway(): void { this.cutaway = !this.cutaway; this.cutawayAt = -Infinity; this.lastStatus = -Infinity; }
  toggleOverview(): void { this.overview = !this.overview; this.followReady = false; this.cutawayAt = -Infinity; this.lastStatus = -Infinity; }
  setLookStick(x: number, y: number): void { this.lookStick = { x, y }; }

  private attachDoors() {
    this.hidden = hideStaticDoorLeaves(this.host.scene);
    const material = new THREE.MeshStandardMaterial({ color: '#e3dccd', roughness: .72 });
    const handleMaterial = new THREE.MeshStandardMaterial({ color: '#657477', metalness: .65, roughness: .3 });
    for (const door of this.world.doors) {
      const group = new THREE.Group();
      const leaf = new THREE.Mesh(door.geometry.clone(), material);
      leaf.castShadow = true; leaf.receiveShadow = true;
      group.add(leaf);
      for (const face of [-1, 1]) {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(.11, .025, .035), handleMaterial);
        handle.position.set(door.width - .11, Math.min(1, door.height * .55), face * (door.thickness / 2 + .025));
        group.add(handle);
      }
      this.doors.set(door.id, group); this.host.scene.add(group);
    }
  }
  private detachDoors() {
    const materials = new Set<THREE.Material>();
    for (const group of this.doors.values()) { group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); for (const mat of Array.isArray(m.material) ? m.material : [m.material]) materials.add(mat); } }); group.removeFromParent(); }
    for (const material of materials) material.dispose();
    for (const object of this.hidden) object.visible = true;
    this.doors.clear(); this.hidden = [];
  }
  refreshDesign(solids:SceneSolids, property:Property) {
    const updated=createWalkWorld(solids,property);
    updated.roofActive=this.world.roofActive;
    const feet=this.walker.position, point={x:feet.x,y:feet.z};
    const next=spawnAt(updated,point,this.levelId) ?? spawnOnLevel(updated,this.levelId,point)
      ?? findWalkSpawn(updated,property) ?? spawnOnLevel(updated,updated.groundLevelId??GROUND_LEVEL_ID);
    if(!next){updated.dispose();this.notice='The edited build has no clear standing space.';this.pauseFrames('build changed');return}
    for(const d of updated.doors){
      const old=this.world.doors.find(x=>x.id===d.id);if(old){d.angle=old.angle;d.targetAngle=old.targetAngle}
    }
    this.detachDoors();this.world.dispose();
    this.world=updated;this.solids=solids;
    this.walker=createWalker(updated,next.position);this.eyeHeight=next.position.y+1.55;
    this.route=[];this.routeRequest++;this.stalled=0;this.cutawayAt=-Infinity;
    this.attachDoors();this.actor.position.copy(next.position);
  }
  get editCamera(){return this.camera}
  startBuilding(){this.clearInput();this.controls.unlock();this.route=[];this.routeRequest++}
  drawingRay(clientX:number,clientY:number) {
    const rect=this.host.renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    const caster=new THREE.Raycaster();
    caster.setFromCamera(new THREE.Vector2(2*(clientX-rect.left)/rect.width-1,1-2*(clientY-rect.top)/rect.height),this.camera);
    const {origin:o,direction:d}=caster.ray;
    return {origin:{x:o.x,y:o.z,z:o.y},direction:{x:d.x,y:d.z,z:d.y}};
  }
  drawingProjection(p:{x:number;y:number;z:number}) {
    const rect=this.host.renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3(p.x,p.z,p.y).project(this.camera);
    return v.z>1||v.z< -1?null:{x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};
  }
  async moveToScreen(clientX: number, clientY: number): Promise<void> {
    if (!this.ready || this.disposed || this.controls.isLocked) return;
    const rect = this.host.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(2 * (clientX - rect.left) / rect.width - 1, 1 - 2 * (clientY - rect.top) / rect.height), this.camera);
    this.route = [];
    const id = ++this.routeRequest;
    const levels = new Set([this.levelId, ...this.world.floors.map(f => f.levelId ?? this.world.groundLevelId ?? GROUND_LEVEL_ID)]);
    const targets = [...levels].filter(level => this.world.roofActive || !this.world.roofSurfaces?.some(r => r.levelId === level))
      .map(level => pickSpawn(this.world, ray.ray, level)).filter((hit): hit is NonNullable<typeof hit> => !!hit)
      .sort((a,b) => a.position.distanceToSquared(ray.ray.origin) - b.position.distanceToSquared(ray.ray.origin));
    if (targets.length) {
      const { walkingRoute } = await import('./navigation');
      if (this.disposed || id !== this.routeRequest) return;
      this.route = walkingRoute(this.world, this.walker.position, targets[0].position) ?? [];
    }
    this.stalled = 0;
    this.notice = this.route.length ? '' : 'No clear route. Open a door or choose a nearer spot.';
    this.lastStatus = -Infinity;
  }

  async load(character: WalkCharacter, startedAt: number, onProgress?: (message: string) => void): Promise<void> {
    this.decoder.setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(this.decoder);
    const timeout = window.setTimeout(() => this.abort.abort(), 20000);
    try {
      onProgress?.(`Loading ${character.label}…`);
      const response = await fetch(character.url, { signal: this.abort.signal });
      if (!response.ok) throw new Error('The character could not be loaded.');
      let buffer: ArrayBuffer;
      if (response.body && onProgress) {
        const reader = response.body.getReader(), parts: Uint8Array[] = []; let length = 0;
        let next = await reader.read();
        while (!next.done) {
          parts.push(next.value); length += next.value.byteLength;
          onProgress(`Loading ${character.label}… ${Math.min(100, Math.round(length / character.bytes * 100))}%`);
          next = await reader.read();
        }
        const bytes = new Uint8Array(length); let offset = 0;
        for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
        buffer = bytes.buffer;
      } else buffer = await response.arrayBuffer();
      onProgress?.(`Preparing ${character.label}…`);
      const gltf = await loader.parseAsync(buffer, '');
      if (this.disposed) { disposeObject(gltf.scene); return; }
      if (this.abort.signal.aborted) {
        disposeObject(gltf.scene);
        throw new Error('Walk preparation was cancelled or took too long. Exit and try again.');
      }
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const height = box.max.y - box.min.y;
      const scale = this.walker.height / Math.max(.1, height);
      gltf.scene.scale.setScalar(scale);
      gltf.scene.position.y = -box.min.y * scale;
      gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      this.actor.add(gltf.scene);
      this.mixer = new AnimationMixer(gltf.scene);
      for (const name of ['idle', 'walk', 'run'] as const) {
        const clip = THREE.AnimationClip.findByName(gltf.animations, character.clips[name]);
        if (!clip) throw new Error(`The character is missing its ${name} animation.`);
        this.actions[name] = this.mixer.clipAction(clip);
      }
      this.actions.idle?.play();
      this.mixer.update(0);
      this.actor.position.copy(this.walker.position);
      // Pose the selected character and private doors before the first draw,
      // preserving the normal frame's follow history.
      const initialFollow = this.follow.clone(), initialFollowReady = this.followReady;
      this.syncView(0);
      this.follow.copy(initialFollow); this.followReady = initialFollowReady;
      this.host.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
      if (this.disposed || this.abort.signal.aborted) return;
      this.entryMs = performance.now() - startedAt;
      this.ready = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } finally { window.clearTimeout(timeout); }
  }

  keyDown(event: KeyboardEvent): void {
    if (!this.ready || this.disposed) return;
    const target = event.target as HTMLElement | null;
    if (target?.matches('input,textarea,select') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      if (!event.repeat && !event.code.startsWith('Shift')) this.measureInput('keyboard', event.code, event.timeStamp);
      event.preventDefault(); this.route = []; this.routeRequest++; this.keys.add(event.code);
    }
    if (event.repeat) return;
    if (event.code === 'KeyB') { event.preventDefault(); this.toggleOverview(); }
    if (event.code === 'KeyV') { event.preventDefault(); this.toggleView(); }
    if (event.code === 'KeyE') { event.preventDefault(); this.interact(); }
  }
  clearInput(): void { this.route = []; this.routeRequest++; this.lookStick = { x: 0, y: 0 }; this.keys.clear(); this.stick = { x: 0, y: 0 }; this.inputMeasure = null; this.measurementArmed = false; }
  setStick(x: number, y: number): void {
    if (!this.ready || this.disposed) return;
    if (y && !this.stick.y) this.measureInput('touch', 'stick');
    if (x || y) { this.route = []; this.routeRequest++; }
    this.stick = { x, y };
  }
  setRunning(value: boolean): void { if (this.ready && !this.disposed) this.running = value; }
  toggleView(): void {
    if (!this.ready || this.disposed) return;
    this.overview = false; this.cutawayAt = -Infinity;
    this.mode = this.mode === 'first' ? 'third' : 'first'; this.clearInput(); this.followReady = false; this.lastStatus = -Infinity;
  }
  /** True means this Escape only frees the mouse; the UI exits on false. */
  escape(): boolean {
    if (this.escapeHeld) return true;
    // The DOM lock is authoritative: pointerlockchange (and therefore the
    // controls' cached isLocked) can arrive after the next distinct keypress.
    if (document.pointerLockElement === this.host.renderer.domElement) {
      this.escapeHeld = true; this.unlockPending = false; this.unlockRequested = true;
      this.controls.unlock(); this.clearInput(); return true;
    }
    // Browsers may release pointer lock before delivering the same keydown.
    if (this.unlockPending && performance.now() - this.unlockedAt < 150) {
      this.unlockPending = false; this.escapeHeld = true; return true;
    }
    return false;
  }
  private measureInput(source: string, key: string, eventAt = performance.now()): void {
    if (!this.measurementArmed) return;
    this.measurementArmed = false;
    const now = performance.now();
    this.inputMeasure = { inputAt: Number.isFinite(eventAt) && eventAt > 0 && eventAt <= now ? eventAt : now,
      handlerAt: now, source, key, mode: this.mode, x: this.walker.position.x, z: this.walker.position.z };
  }
  lock(): void {
    if (!this.ready || this.disposed) return;
    this.unlockRequested = false;
    try {
      // Controls observes pointerlockchange. Catch the browser's asynchronous
      // denial too; dragging remains usable without pointer lock permission.
      const pending = this.host.renderer.domElement.requestPointerLock();
      pending?.catch(() => {});
    } catch { /* Drag-look remains available. */ }
  }
  dragLook(dx: number, dy: number): void {
    if (!this.ready || this.disposed) return;
    this.euler.setFromQuaternion(this.look.quaternion, 'YXZ');
    this.euler.y -= dx * .004; this.euler.x = THREE.MathUtils.clamp(this.euler.x - dy * .004, -1.35, 1.35);
    this.look.quaternion.setFromEuler(this.euler);
  }
  interact(): boolean {
    if (!this.ready || this.disposed) return false;
    this.look.getWorldDirection(this.direction);
    const eye = this.walker.position.clone().add(new THREE.Vector3(0, 1.55, 0));
    const door = interactionDoor(this.world, eye, this.direction, this.retainedDoor, 2);
    if (!door) return false;
    const allowed = toggleDoor(this.world, door.id, this.walker);
    this.retainedDoor = door.id;
    this.lastStatus = -Infinity;
    if (!allowed) this.blockedUntil = performance.now() + 2000;
    return allowed;
  }

  private syncView(dt: number): void {
    this.euler.setFromQuaternion(this.look.quaternion, 'YXZ');
    this.actor.visible = this.mode === 'third';
    this.eye.copy(this.walker.position).add(new THREE.Vector3(0, 1.55, 0));
    this.eyeHeight = THREE.MathUtils.lerp(this.eyeHeight, this.eye.y, 1 - Math.exp(-18 * dt));
    this.look.getWorldDirection(this.direction);
    let firstPersonCamera = this.mode === 'first';
    if (this.overview) {
      const bounds = this.host.bounds.current;
      const radius = Math.max(5, bounds.radius * 1.6);
      this.desired.copy(bounds.centre);
      this.camera.position.copy(bounds.centre).add(new THREE.Vector3(Math.sin(this.euler.y) * radius, radius, Math.cos(this.euler.y) * radius));
      this.actor.visible = true; firstPersonCamera = false;
    } else if (this.mode === 'first') {
      this.desired.copy(this.eye); this.desired.y = this.eyeHeight;
      this.camera.position.copy(pullInCamera(this.world, this.eye, this.desired, .08));
    }
    else if (import.meta.env.DEV && this.testCameraBaseline) {
      // Exact third-person camera formula from 52dfa87:src/walk/runtime.ts.
      this.desired.copy(this.eye).addScaledVector(this.direction, -3.1).add(new THREE.Vector3(0, .45, 0));
      this.desired.add(new THREE.Vector3(.4, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.euler.y));
      const safe = pullInCamera(this.world, this.eye, this.desired, .18);
      this.follow.lerp(safe, 1 - Math.exp(-14 * dt));
      this.camera.position.copy(pullInCamera(this.world, this.eye, this.follow, .18));
      if (this.camera.position.distanceTo(this.eye) < .8) this.actor.visible = false;
      this.desired.copy(this.eye).addScaledVector(this.direction, 1.4); this.desired.y -= .45;
    }
    else {
      const view = followCamera(this.world, this.walker.position, this.direction, this.followReady ? this.follow : null, dt, this.walker.height);
      this.follow.copy(view.position); this.followReady = true;
      this.camera.position.copy(view.position); this.desired.copy(view.target);
      firstPersonCamera = view.firstPerson;
      if (view.firstPerson) this.actor.visible = false;
    }
    this.camera.quaternion.copy(this.look.quaternion);
    if (this.mode === 'third' || this.overview) {
      this.camera.lookAt(this.desired);
    }
    const canvas = this.host.renderer.domElement;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const fov = aspect < .8 && !firstPersonCamera ? 95 : 65;
    if (this.camera.aspect !== aspect || this.camera.fov !== fov) { this.camera.aspect = aspect; this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    for (const door of this.world.doors) {
      const group = this.doors.get(door.id)!; const pose = doorTransform(door);
      if (Math.abs(group.quaternion.dot(pose.quaternion)) < .999999) this.host.renderer.shadowMap.needsUpdate = true;
      group.position.copy(pose.position); group.quaternion.copy(pose.quaternion);
    }
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    const elapsed = now - this.last, dt = Math.min(.05, Math.max(0, elapsed / 1000)); this.last = now;
    if (!this.paused && !document.hidden) {
      this.euler.setFromQuaternion(this.look.quaternion, 'YXZ');
      // Phone stick steers and moves with one thumb; the second pad optionally looks around.
      this.euler.y -= (this.stick.x + this.lookStick.x) * dt * 1.9;
      this.euler.x = THREE.MathUtils.clamp(this.euler.x - this.lookStick.y * dt * 1.6, -1.35, 1.35);
      this.look.quaternion.setFromEuler(this.euler);
      const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
      const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
      const speed = this.running || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN_SPEED_M_S : WALK_SPEED_M_S;
      this.velocity.set(x, 0, z); if (this.velocity.lengthSq() > 1) this.velocity.normalize();
      this.velocity.multiplyScalar(speed).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.euler.y);
      const target = this.route[0];
      if (target) {
        this.velocity.set(target.x - this.walker.position.x, 0, target.z - this.walker.position.z);
        const distance = this.velocity.length();
        if (distance <= .08) { this.route.shift(); this.velocity.set(0, 0, 0); }
        else this.velocity.multiplyScalar(Math.min(speed, distance / Math.max(dt, .001)) / distance);
      }
      const movement = stepWalker(this.world, this.walker, this.velocity, dt);
      if (target && this.route.length) {
        this.stalled = movement.movedM < .001 ? this.stalled + dt : 0;
        if (this.stalled > .6) { this.route = []; this.notice = 'The route is blocked.'; }
      }
      const actualSpeed = dt ? movement.movedM / dt : 0;
      const next = actualSpeed < .08 ? 'idle' : actualSpeed > 2.1 ? 'run' : 'walk';
      if (next !== this.animation) {
        this.actions[this.animation]?.fadeOut(.18); this.actions[next]?.reset().fadeIn(.18).play(); this.animation = next;
      }
      this.peers?.frame(dt);
      this.mixer?.update(dt);
      this.actor.position.copy(this.walker.position);
      if (actualSpeed > .08) {
        const angle = Math.atan2(this.velocity.x, this.velocity.z);
        const delta = Math.atan2(Math.sin(angle - this.actor.rotation.y), Math.cos(angle - this.actor.rotation.y));
        this.actor.rotation.y += delta * Math.min(1, dt * 14);
      }
      this.syncView(dt);
      const canvas = this.host.renderer.domElement;
      if (now - this.cutawayAt > 120) {
        const eye = this.camera.position, feet = this.walker.position;
        const visibility = this.cutaway && !this.overview
          ? cutawayState(this.solids, { x: eye.x, y: eye.z, z: eye.y }, { x: feet.x, y: feet.z, z: feet.y + .8 }) : null;
        for (const wall of this.host.visitWalls?.() ?? []) {
          const lowered = visibility?.get(wall.solid.key) === 'stub';
          wall.full.visible = !lowered; wall.stub.visible = lowered;
        }
        for (const roof of this.host.visitRoofs?.() ?? []) roof.visible = this.overview || !!this.world.roofActive;
        this.cutawayAt = now;
      }
      renderWalkSurface(this.host, this.camera);
      // Collect only when explicitly armed, and publish once at the deadline.
      // Unlike the historical HUD, this retains long stalls and window tails.
      if (this.frameMeasurement) this.emitFrameMeasurement(this.frameMeasurement.rendered(performance.now()));
      if (import.meta.env.DEV && this.testPose && ++this.testPose.frames === 60) {
        const result = { accepted: true, fixture: this.testPose, baselineCamera: this.testCameraBaseline,
          source: this.testCameraBaseline ? '52dfa87:src/walk/runtime.ts' : 'world-fix-1 followCamera',
          position: this.walker.position.toArray(), camera: this.camera.position.toArray(),
          quaternion: this.camera.quaternion.toArray(), fov: this.camera.fov, actorVisible: this.actor.visible };
        canvas.setAttribute('data-walk-test-pose', JSON.stringify(result));
        canvas.dispatchEvent(new CustomEvent('world-walk-test-pose-ready', { detail: result }));
        this.testPose = null;
      }
      if (this.inputMeasure && Math.hypot(this.walker.position.x - this.inputMeasure.x, this.walker.position.z - this.inputMeasure.z) > 1e-5) {
        const { x, z, ...sample } = this.inputMeasure;
        const result = { ...sample, firstMovedRenderedAt: performance.now(), startPosition: [x, z], position: this.walker.position.toArray() };
        this.inputMeasure = null;
        canvas.setAttribute('data-walk-input-result', JSON.stringify(result));
        canvas.dispatchEvent(new CustomEvent('world-walk-input-result', { detail: result }));
      }
      this.totalFrames++;
      if (elapsed < 250 && this.totalFrames > 10) { this.frames.push(elapsed); if (this.frames.length > 1800) this.frames.shift(); }
      if (now - this.lastStatus > 250) {
        const sorted = [...this.frames].sort((a, b) => b - a), slow = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * .01)));
        const door = interactionDoor(this.world, this.eye, this.direction, this.retainedDoor, 2);
        if (!door || (door.id === this.retainedDoor && Math.abs(door.angle) < .01 && Math.abs(door.targetAngle) < .01)) this.retainedDoor = null;
        const feet = this.walker.position;
        if (!this.world.roofActive) {
          const point = { x: feet.x, y: feet.z };
          const floor = this.world.floors.find(f => Math.abs((f.elevationM ?? 0) - feet.y) < .025 &&
            pointInPolygon(point, f.polygon) && !f.holes?.some(h => pointInPolygon(point, h)));
          const patch = !floor && this.world.outdoor?.find(f => Math.abs(f.elevationM - feet.y) < .025 && pointInPolygon(point, f.polygon));
          if (floor?.levelId) this.levelId = floor.levelId;
          else if (patch) this.levelId = patch.levelId;
        }
        window.dispatchEvent(new CustomEvent('olb:local-pose',{detail:{x:feet.x,y:feet.z,z:feet.y,yaw:this.actor.rotation.y,moving:this.animation!=='idle'}}));
        if(this.peers)this.host.renderer.domElement.dataset.sharedPlayers=String(this.peers.visibleCount);
        this.onStatus({ mode: this.mode, levelId: this.levelId, grounded: this.walker.grounded,
          overview: this.overview, cutaway: this.cutaway, notice: this.notice, door: door ? (door.targetAngle ? 'Close door' : 'Open door') : null,
          blocked: now < this.blockedUntil, locked: this.controls.isLocked, animation: this.animation,
          position: this.walker.position.toArray(), camera: this.camera.position.toArray(),
          fps: this.frames.length ? 1000 * this.frames.length / this.frames.reduce((a, b) => a + b, 0) : 0,
          low1: slow.length ? 1000 * slow.length / slow.reduce((a, b) => a + b, 0) : 0,
          frames: this.totalFrames, entryMs: this.entryMs });
        this.lastStatus = now;
      }
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.emitFrameMeasurement(this.frameMeasurement?.finish(performance.now(), 'disposed'));
    this.abort.abort(); cancelAnimationFrame(this.raf); this.clearInput();
    this.controls.unlock(); this.controls.dispose(); this.decoder.dispose();
    this.controls.removeEventListener('unlock', this.onUnlock);
    this.controls.removeEventListener('lock', this.onLock);
    this.host.renderer.domElement.removeEventListener('world-walk-measure-input', this.onMeasureInput);
    this.host.renderer.domElement.removeEventListener('world-walk-measure-frames', this.onMeasureFrames);
    this.disposeTestHook?.(); this.disposeProjectionHook?.();
    window.removeEventListener('keyup', this.onKeyUp, true); window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus); document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('olb:live-peers',this.receivePeers);
    window.dispatchEvent(new CustomEvent('olb:local-pose',{detail:null}));
    this.peers?.dispose();
    this.mixer?.stopAllAction(); disposeObject(this.actor);
    this.detachDoors();
    this.world.dispose(); this.host.release();
  }
}

function disposeObject(root: THREE.Object3D): void {
  root.removeFromParent();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh; if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
}
