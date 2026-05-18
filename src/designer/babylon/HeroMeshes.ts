/**
 * Sims-Parity DT-26 — hero glTF Path A wiring (procedural-only stub).
 *
 * V8=NO blocks the $1,800 external 3D artist spend. This module
 * surfaces the contract: when `product.use_gltf === true` AND a
 * matching `.glb` exists under `public/meshes/${slug}.glb`, Babylon
 * loads the hero mesh; otherwise it falls back to the procedural
 * box from DT-22 / DT-25.
 *
 * Today every SKU has `use_gltf = false` (DB default), so this
 * module always takes the procedural path. The branching is here
 * so DT-26 ships zero-impact wiring; when V8 unblocks, flipping
 * `use_gltf` per-row is the only change required.
 */

import { SceneLoader, type Scene, type Mesh, type ShadowGenerator } from '@babylonjs/core';
import { meshAssetUrl } from './Assets';

export interface HeroMeshLoadOptions {
  scene: Scene;
  shadowGenerator?: ShadowGenerator;
  productId: string;
  slug: string;
  /** Bypass the load — caller knows use_gltf=false. */
  procedural?: boolean;
}

/**
 * Attempt to load a Draco-compressed glTF from the Vercel Blob
 * asset host. Returns null when:
 *   • opts.procedural is true (V8=NO default for every row today),
 *   • the network request fails,
 *   • SceneLoader returns zero meshes.
 *
 * Caller falls back to buildProceduralProductBox / buildCaptureMesh.
 */
export async function loadHeroMesh(opts: HeroMeshLoadOptions): Promise<Mesh | null> {
  if (opts.procedural) return null;
  const url = meshAssetUrl(opts.slug);
  try {
    const result = await SceneLoader.ImportMeshAsync('', url, '', opts.scene);
    const root = result.meshes[0] as Mesh | undefined;
    if (!root) return null;
    if (opts.shadowGenerator) {
      for (const m of result.meshes) {
        opts.shadowGenerator.addShadowCaster(m as Mesh);
      }
    }
    return root;
  } catch {
    return null;
  }
}
