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
import { findWalkSpawn } from './spawn';

type Host = NonNullable<ReturnType<ThreeStageHandle['beginWalk']>>;
export interface WalkStatus {
  mode: 'first' | 'third'; door: string | null; blocked: boolean; locked: boolean;
  animation: 'idle' | 'walk' | 'run'; position: number[]; camera: number[];
  fps: number; low1: number; frames: number; entryMs: number;
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
  private disposeTestHook?: () => void;
  private testCameraBaseline = false;
  private testPose: { position: number[]; yaw: number; frames: number } | null = null;
  private eye = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private follow = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private decoder = new DRACOLoader();
  private abort = new AbortController();
  private onBlur = () => { this.clearInput(); this.paused = true; this.controls.unlock(); };
  private onFocus = () => { this.paused = false; this.last = performance.now(); };
  private onVisibility = () => document.hidden ? this.onBlur() : this.onFocus();
  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === 'Escape') { this.escapeHeld = false; this.unlockPending = false; }
  };
  private onUnlock = () => {
    this.clearInput();
    this.unlockPending = !this.unlockRequested && !this.escapeHeld && !this.paused && !this.disposed;
    this.unlockRequested = false; this.unlockedAt = performance.now();
    this.lastStatus = -Infinity;
  };
  private onLock = () => { this.unlockPending = false; this.unlockRequested = false; this.lastStatus = -Infinity; };
  private onMeasureInput = () => {
    this.measurementArmed = true; this.inputMeasure = null;
    this.host.renderer.domElement.removeAttribute('data-walk-input-result');
  };

  constructor(private host: Host, solids: SceneSolids, property: Property,
    private onStatus: (status: WalkStatus) => void, _onExit: () => void) {
    this.world = createWalkWorld(solids, property);
    const spawn = findWalkSpawn(this.world, property);
    if (!spawn) { this.world.dispose(); throw new Error('No safe standing space was found. Add a room or a clear entrance, then try again.'); }
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
    host.scene.traverse(object => {
      if (object.userData.walkDoorLeaf && object.visible) { object.visible = false; this.hidden.push(object); }
      if (object.userData.joinery === 'door') {
        // Existing joinery keeps its six frame/lining parts; private hinged leaves replace the rest.
        for (const child of object.children.slice(6)) if (child.visible) { child.visible = false; this.hidden.push(child); }
      }
    });
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
      this.doors.set(door.id, group); host.scene.add(group);
    }
    host.scene.add(this.actor);
    host.renderer.shadowMap.needsUpdate = true;
    this.follow.copy(spawn.position).add(new THREE.Vector3(0, 1.6, 0));
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibility);
    host.renderer.domElement.addEventListener('world-walk-measure-input', this.onMeasureInput);
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
        if (valid) {
          const support = groundHeight(this.world, position.x, position.z, position.y + .05, .1);
          valid = support !== null && Math.abs(position.y - support) < .015 && capsuleClear(this.world, createWalker(this.world, position));
        }
        if (!valid || !this.ready) {
          const result = { accepted: false, reason: 'Pose must have floor support and capsule clearance in a ready visit.' };
          canvas.setAttribute('data-walk-test-pose', JSON.stringify(result));
          canvas.dispatchEvent(new CustomEvent('world-walk-test-pose-ready', { detail: result }));
          return;
        }
        this.clearInput(); this.walker = createWalker(this.world, position); this.mode = 'third';
        this.look.rotation.set(0, detail.yaw, 0, 'YXZ'); this.actor.rotation.y = detail.yaw + Math.PI;
        this.actor.position.copy(position); this.eyeHeight = position.y + 1.55;
        this.follow.copy(position).add(new THREE.Vector3(0, 1.6, 0)); this.followReady = false;
        this.testCameraBaseline = detail.baselineCamera === true;
        this.testPose = { position: position.toArray(), yaw: detail.yaw, frames: 0 };
        this.lastStatus = -Infinity;
      };
      canvas.addEventListener('world-walk-test-pose', testPose);
      this.disposeTestHook = () => canvas.removeEventListener('world-walk-test-pose', testPose);
    }
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
      this.entryMs = performance.now() - startedAt;
      this.ready = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } finally { window.clearTimeout(timeout); }
  }

  keyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input,textarea,select') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      if (!event.repeat && !event.code.startsWith('Shift')) this.measureInput('keyboard', event.code, event.timeStamp);
      event.preventDefault(); this.keys.add(event.code);
    }
    if (event.repeat) return;
    if (event.code === 'KeyV') { event.preventDefault(); this.toggleView(); }
    if (event.code === 'KeyE') { event.preventDefault(); this.interact(); }
  }
  clearInput(): void { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.inputMeasure = null; this.measurementArmed = false; }
  setStick(x: number, y: number): void {
    if (y && !this.stick.y) this.measureInput('touch', 'stick');
    this.stick = { x, y };
  }
  setRunning(value: boolean): void { this.running = value; }
  toggleView(): void { this.mode = this.mode === 'first' ? 'third' : 'first'; this.clearInput(); this.followReady = false; this.lastStatus = -Infinity; }
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
    if (!this.ready) return;
    try {
      // Controls observes pointerlockchange. Catch the browser's asynchronous
      // denial too; dragging remains usable without pointer lock permission.
      const pending = this.host.renderer.domElement.requestPointerLock();
      pending?.catch(() => {});
    } catch { /* Drag-look remains available. */ }
  }
  dragLook(dx: number, dy: number): void {
    this.euler.setFromQuaternion(this.look.quaternion, 'YXZ');
    this.euler.y -= dx * .004; this.euler.x = THREE.MathUtils.clamp(this.euler.x - dy * .004, -1.35, 1.35);
    this.look.quaternion.setFromEuler(this.euler);
  }
  interact(): boolean {
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

  private tick = (now: number): void => {
    if (this.disposed) return;
    const elapsed = now - this.last, dt = Math.min(.05, Math.max(0, elapsed / 1000)); this.last = now;
    if (!this.paused && !document.hidden) {
      this.euler.setFromQuaternion(this.look.quaternion, 'YXZ');
      // Phone stick steers and moves with one thumb; the second pad optionally looks around.
      this.euler.y -= this.stick.x * dt * 1.9;
      this.look.quaternion.setFromEuler(this.euler);
      const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
      const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
      const speed = this.running || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN_SPEED_M_S : WALK_SPEED_M_S;
      this.velocity.set(x, 0, z); if (this.velocity.lengthSq() > 1) this.velocity.normalize();
      this.velocity.multiplyScalar(speed).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.euler.y);
      const movement = stepWalker(this.world, this.walker, this.velocity, dt);
      const actualSpeed = dt ? movement.movedM / dt : 0;
      const next = actualSpeed < .08 ? 'idle' : actualSpeed > 2.1 ? 'run' : 'walk';
      if (next !== this.animation) {
        this.actions[this.animation]?.fadeOut(.18); this.actions[next]?.reset().fadeIn(.18).play(); this.animation = next;
      }
      this.mixer?.update(dt);
      this.actor.position.copy(this.walker.position);
      if (actualSpeed > .08) {
        const angle = Math.atan2(this.velocity.x, this.velocity.z);
        const delta = Math.atan2(Math.sin(angle - this.actor.rotation.y), Math.cos(angle - this.actor.rotation.y));
        this.actor.rotation.y += delta * Math.min(1, dt * 14);
      }
      this.actor.visible = this.mode === 'third';
      this.eye.copy(this.walker.position).add(new THREE.Vector3(0, 1.55, 0));
      this.eyeHeight = THREE.MathUtils.lerp(this.eyeHeight, this.eye.y, 1 - Math.exp(-18 * dt));
      this.look.getWorldDirection(this.direction);
      let firstPersonCamera = this.mode === 'first';
      if (this.mode === 'first') {
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
      if (this.mode === 'third') {
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
      this.host.render(this.camera);
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
        this.onStatus({ mode: this.mode, door: door ? (door.targetAngle ? 'Close door' : 'Open door') : null,
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
    this.disposed = true; this.abort.abort(); cancelAnimationFrame(this.raf); this.clearInput();
    this.controls.unlock(); this.controls.dispose(); this.decoder.dispose();
    this.controls.removeEventListener('unlock', this.onUnlock);
    this.controls.removeEventListener('lock', this.onLock);
    this.host.renderer.domElement.removeEventListener('world-walk-measure-input', this.onMeasureInput);
    this.disposeTestHook?.();
    window.removeEventListener('keyup', this.onKeyUp, true); window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus); document.removeEventListener('visibilitychange', this.onVisibility);
    this.mixer?.stopAllAction(); disposeObject(this.actor);
    const materials = new Set<THREE.Material>();
    for (const group of this.doors.values()) { group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); for (const mat of Array.isArray(m.material) ? m.material : [m.material]) materials.add(mat); } }); group.removeFromParent(); }
    for (const material of materials) material.dispose();
    for (const object of this.hidden) object.visible = true;
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
