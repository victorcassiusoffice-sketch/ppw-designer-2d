/**
 * Sims-Parity DT-21 — BabylonRoom (L2.01).
 *
 * React component that mounts the Babylon engine + scene + camera on
 * a <canvas>. Mounted ONLY when `?engine=babylon` is on the URL
 * (gated by `isBabylonActive()` in `engineFlag.ts`).
 *
 * Loaded via dynamic import from App.tsx so the marketing-route
 * bundle never pays for Babylon's ~1.5 MB chunk. The bundle delta
 * gate (≤ 250 KB on marketing routes) is held by the dynamic-import
 * boundary at the App.tsx flag-check.
 */

import { useEffect, useRef } from 'react';
import { Engine } from '@babylonjs/core';
import { buildBabylonScene } from './Scene';
import { buildArcRotateCamera } from './Camera';
import {
  buildWoodFloorMaterial,
  buildWhiteWallMaterial,
} from './Materials';
import { buildProceduralProductBox } from './ProceduralProductBox';
import { fetchApiProducts } from '../../data/apiCatalogAdapter';

export interface BabylonRoomProps {
  roomWidthM?: number;
  roomDepthM?: number;
  ceiling?: boolean;
}

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|Android/i.test(navigator.userAgent);
}

export function BabylonRoom(props: BabylonRoomProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const built = buildBabylonScene(engine, {
      roomWidthM: props.roomWidthM,
      roomDepthM: props.roomDepthM,
      ceiling: props.ceiling,
      isMobile: detectMobile(),
    });

    // DT-22 — PBR upgrade on the scaffold materials.
    built.groundMesh.material = buildWoodFloorMaterial(built.scene);
    built.scene.meshes
      .filter((m) => m.name.startsWith('wall'))
      .forEach((wall) => {
        (wall as { material: unknown }).material = buildWhiteWallMaterial(built.scene);
      });

    buildArcRotateCamera(built.scene, canvas);

    engine.runRenderLoop(() => {
      built.scene.render();
    });

    // DT-22 — load the first 3 merchant SKUs and drop them as
    // procedural boxes at a 1.2 m spaced grid on the floor. This
    // turns the K1 ?engine=babylon visit from "empty room" into
    // "3 demo products in 3D" which is the real Demo B preview.
    let cancelled = false;
    fetchApiProducts().then((products) => {
      if (cancelled) return;
      const trio = products.slice(0, 3);
      trio.forEach((p, i) => {
        // The bundled Product shape carries dimensions_cm; convert
        // back to mm for the procedural box.
        const dims = p.dimensions_cm;
        const x = (i - 1) * 1.3; // -1.3, 0, 1.3 across the room
        const z = 0.5;
        buildProceduralProductBox({
          scene: built.scene,
          shadowGenerator: built.shadowGenerator,
          productId: p.id,
          photoUrl: p.image_url,
          dimensionsMm: {
            width: dims.length * 10,
            depth: dims.width * 10,
            height: dims.height * 10,
          },
          positionM: { x, z },
        });
      });
    });

    function onResize(): void {
      engine.resize();
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      engine.stopRenderLoop();
      built.scene.dispose();
      engine.dispose();
    };
  }, [props.roomWidthM, props.roomDepthM, props.ceiling]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Wellness room (3D Babylon)"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none',
        touchAction: 'none',
        background: '#0E0E10',
      }}
    />
  );
}

export default BabylonRoom;
