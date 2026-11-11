import * as THREE from 'three';
import { AnimationMixer } from 'three/src/animation/AnimationMixer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { WALK_CHARACTERS } from '../walk/characters';
import type { Player } from './contract';

interface Peer {
  root: THREE.Group;
  target: THREE.Vector3;
  yaw: number;
  moving: boolean;
  model: string;
  loaded: boolean;
  mixer?: THREE.AnimationMixer;
  idle?: THREE.AnimationAction;
  walk?: THREE.AnimationAction;
}
function release(root: THREE.Object3D) {
  root.removeFromParent();
  const mats = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      mats.add(m);
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
    }
  });
  mats.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
export class RemotePlayers {
  private entries = new Map<string, Peer>();
  private decoder = new DRACOLoader().setDecoderPath('/draco/');
  private loader = new GLTFLoader().setDRACOLoader(this.decoder);
  constructor(private scene: THREE.Scene) {}
  update(players: Player[]) {
    const visible = players.filter((p) => p.pose),
      ids = new Set(visible.map((p) => p.id));
    for (const [id, entry] of this.entries)
      if (!ids.has(id)) {
        entry.mixer?.stopAllAction();
        release(entry.root);
        this.entries.delete(id);
      }
    for (const player of visible) {
      const pose = player.pose!;
      let peer = this.entries.get(player.id);
      if (!peer) {
        const root = new THREE.Group(),
          target = new THREE.Vector3(pose.x, pose.z, pose.y);
        root.position.copy(target);
        root.userData.sharedPlayerId = player.id;
        root.name = player.trade;
        this.scene.add(root);
        peer = {
          root,
          target,
          yaw: pose.yaw,
          moving: pose.moving,
          model: player.avatar,
          loaded: false,
        };
        this.entries.set(player.id, peer);
        const character = WALK_CHARACTERS.find((c) => c.id === player.avatar) ?? WALK_CHARACTERS[0];
        const entry = peer;
        void this.loader
          .loadAsync(character.url)
          .then((gltf) => {
            if (this.entries.get(player.id) !== entry) {
              release(gltf.scene);
              return;
            }
            const bounds = new THREE.Box3().setFromObject(gltf.scene);
            const factor = 1.7 / Math.max(0.1, bounds.max.y - bounds.min.y);
            gltf.scene.scale.setScalar(factor);
            gltf.scene.position.y = -bounds.min.y * factor;
            entry.root.add(gltf.scene);
            entry.mixer = new AnimationMixer(gltf.scene);
            const idle = THREE.AnimationClip.findByName(gltf.animations, character.clips.idle),
              walk = THREE.AnimationClip.findByName(gltf.animations, character.clips.walk);
            if (idle) entry.idle = entry.mixer.clipAction(idle).play();
            if (walk) entry.walk = entry.mixer.clipAction(walk).play();
            entry.loaded = true;
          })
          .catch(() => {
            if (this.entries.get(player.id) === entry) {
              const m = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.25, 1.15, 3, 8),
                new THREE.MeshStandardMaterial({ color: 0x548a83 }),
              );
              m.position.y = 0.825;
              entry.root.add(m);
            }
          });
      }
      peer.target.set(pose.x, pose.z, pose.y);
      peer.yaw = pose.yaw;
      peer.moving = pose.moving;
    }
  }
  get visibleCount() {
    return [...this.entries.values()].filter((p) => p.root.children.length > 0).length;
  }
  frame(dt: number) {
    for (const p of this.entries.values()) {
      p.root.position.lerp(p.target, 1 - Math.exp(-8 * dt));
      p.root.rotation.y +=
        Math.atan2(Math.sin(p.yaw - p.root.rotation.y), Math.cos(p.yaw - p.root.rotation.y)) *
        (1 - Math.exp(-10 * dt));
      p.idle?.setEffectiveWeight(p.moving ? 0 : 1);
      p.walk?.setEffectiveWeight(p.moving ? 1 : 0);
      p.mixer?.update(dt);
    }
  }
  dispose() {
    this.update([]);
    this.decoder.dispose();
  }
}
