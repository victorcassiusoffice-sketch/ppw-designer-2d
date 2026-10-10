import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Natural-light presentation only. The calibrated colour-check path never
 * goes through this pipeline. World-space ambient occlusion gives real
 * contact to wall intersections, furniture feet and cabinet recesses instead
 * of adding another decorative image or changing a saved material. */
export interface NaturalSceneRenderer {
  setSize(width: number, height: number, pixelRatio: number): void;
  render(): void;
  dispose(): void;
}

/** Keep the expensive AO buffer below half a megapixel even on a 4K monitor.
 * Beauty rendering is independent, so the denoised AO never makes models
 * pixelated. Both retain the viewport aspect; no camera or object is resized. */
export function naturalRenderResolution(width: number, height: number, pixelRatio: number) {
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  // A DPR=1 desktop needs modest supersampling for thin diagonal wall caps.
  // Phone sampling and both pixel ceilings stay unchanged.
  const density = Math.min(1.5, Math.max(w >= 768 ? 1.25 : 1, Number.isFinite(pixelRatio) ? pixelRatio : 1));
  const scale = Math.min(density, Math.sqrt(2_000_000 / (w * h)));
  const beautyWidth = Math.max(1, Math.floor(w * scale));
  const beautyHeight = Math.max(1, Math.floor(h * scale));
  return {
    beautyWidth, beautyHeight,
    aoWidth: Math.max(1, Math.floor(beautyWidth / 2)),
    aoHeight: Math.max(1, Math.floor(beautyHeight / 2)),
  };
}

/** Decals, annotations, glass, sky, selection rings and cutaway ghosts must not turn into
 * opaque occluders in the normal/depth pass. The already-rendered beauty
 * image keeps them. This is also essential for floor contact-shadow planes. */
export function withOpaqueOccluders<T>(scene: THREE.Scene, draw: () => T): T {
  const hidden: THREE.Object3D[] = [];
  scene.traverseVisible((object) => {
    if ((object as THREE.Line).isLine || (object as THREE.Points).isPoints || (object as THREE.Sprite).isSprite || object.type === 'Line2') {
      hidden.push(object);
      return;
    }
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some((material) => material.transparent || !material.depthWrite)) hidden.push(object);
  });
  hidden.forEach((object) => { object.visible = false; });
  try { return draw(); }
  finally { hidden.forEach((object) => { object.visible = true; }); }
}

class OpaqueGTAOPass extends GTAOPass {
  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const shadowUpdate = renderer.shadowMap.autoUpdate;
    // The beauty pass has already rendered the light's shadow map. A normal
    // pass cannot use it; redrawing the 2048px map here only wastes GPU time.
    renderer.shadowMap.autoUpdate = false;
    try { withOpaqueOccluders(this.scene, () => super.render(renderer, writeBuffer, readBuffer, 0, false)); }
    finally { renderer.shadowMap.autoUpdate = shadowUpdate; }
  }
}

export function createNaturalSceneRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): NaturalSceneRenderer | null {
  // A fully working direct renderer is preferable to a broken optional effect.
  if (!renderer.extensions.has('EXT_color_buffer_float')) return null;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(2, renderer.capabilities.maxSamples) });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  const beauty = new RenderPass(scene, camera);
  const ao = new OpaqueGTAOPass(scene, camera, 1, 1);
  const output = new OutputPass();
  // Metres, not screen pixels: the same skirting/contact reads correctly when
  // zooming, adding a storey or returning from a detail to the whole house.
  ao.updateGtaoMaterial({ radius: 0.48, thickness: 0.22, distanceExponent: 2, distanceFallOff: 1, scale: 1, samples: 8, screenSpaceRadius: false });
  // Restore Three's normal denoise sample count. Eight leaves isolated dark
  // flecks on smooth white walls around fine blind slats / joinery; this pass
  // still runs only on the capped half-resolution AO buffer.
  ao.updatePdMaterial({ radius: 4, samples: 16, rings: 2, lumaPhi: 10, depthPhi: 2, normalPhi: 3 });
  ao.blendIntensity = 0.72;
  composer.addPass(beauty);
  composer.addPass(ao);
  composer.addPass(output);
  let disposed = false;
  let sizeKey = '';
  return {
    setSize(width, height, pixelRatio) {
      const size = naturalRenderResolution(width, height, pixelRatio);
      const key = `${size.beautyWidth}:${size.beautyHeight}`;
      if (key === sizeKey || disposed) return;
      sizeKey = key;
      composer.setSize(size.beautyWidth, size.beautyHeight);
      ao.setSize(size.aoWidth, size.aoHeight);
    },
    render() {
      if (disposed) return;
      const override = scene.overrideMaterial;
      const autoClear = renderer.autoClear;
      const clear = renderer.getClearColor(new THREE.Color());
      const alpha = renderer.getClearAlpha();
      try { composer.render(); }
      finally {
        scene.overrideMaterial = override;
        renderer.autoClear = autoClear;
        renderer.setClearColor(clear, alpha);
        renderer.setRenderTarget(null);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      beauty.dispose();
      ao.dispose();
      // These two materials are not disposed by GTAOPass r186 itself.
      ao.gtaoMaterial.dispose();
      ao.blendMaterial.dispose();
      output.dispose();
      composer.dispose();
    },
  };
}
