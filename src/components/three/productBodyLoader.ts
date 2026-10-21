/** One lazy supplier-model cache for both the live 3D view and plan photographs. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { bodyTemplate, type BodyTemplate } from './productBody';

const loader = new GLTFLoader();
const decoder = new DRACOLoader();
decoder.setDecoderPath('/draco/');
loader.setDRACOLoader(decoder);
const cache = new Map<string, Promise<BodyTemplate>>();

export function loadProductBody(url: string): Promise<BodyTemplate> {
  const existing = cache.get(url);
  if (existing) return existing;
  const pending = loader.loadAsync(url).then(gltf => {
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.userData.cachedProductBody = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return bodyTemplate(gltf.scene);
  });
  cache.set(url, pending);
  void pending.catch(() => cache.delete(url));
  return pending;
}
