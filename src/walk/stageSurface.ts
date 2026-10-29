import { Fog, type Mesh, type Object3D, type PerspectiveCamera, type Scene } from 'three';
import { joineryMaterials } from '../components/three/joinery';
import type { ThreeStageSurface } from '../components/three/ThreeStage';

/** Runs only in the private visit, after the Walk import and stage acquisition. */
export function hideStaticDoorLeaves(scene: Scene): Object3D[] {
  const hidden: Object3D[] = [];
  const hide = (object: Object3D) => {
    if (object.visible) { object.visible = false; hidden.push(object); }
  };
  scene.traverse(object => {
    if (object.userData.joinery === 'door') {
      // The existing builder owns six frame/lining parts before leaf/panels/handles.
      object.children.slice(6).forEach(hide);
    } else if ((object as Mesh).isMesh && object.parent?.userData.joinery === 'wall'
      && (object as Mesh).material === joineryMaterials().leaf) {
      // Shaped leaves are direct wall children with the shared leaf material.
      // Their adjacent profile trim has a distinct material; no shape guessing.
      hide(object);
    }
  });
  return hidden;
}

/** Same private-camera lighting and horizon as the former early adapter. */
export function renderWalkSurface(surface: ThreeStageSurface, view: PerspectiveCamera): void {
  const { scene } = surface, fill = surface.fill.current, sky = surface.sky.current, bounds = surface.bounds.current;
  if (fill) {
    fill.position.copy(view.position); fill.position.y += 4;
    fill.target.position.copy(view.position);
    fill.target.updateMatrixWorld();
  }
  if (sky) sky.position.set(view.position.x, 0, view.position.z);
  if (scene.fog instanceof Fog) {
    scene.fog.near = view.position.distanceTo(bounds.centre) + bounds.radius + surface.fogClearance;
    scene.fog.far = scene.fog.near + Math.max(60, bounds.radius * 8);
  }
  surface.renderer.render(scene, view);
}
