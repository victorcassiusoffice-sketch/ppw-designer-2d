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

    buildArcRotateCamera(built.scene, canvas);

    engine.runRenderLoop(() => {
      built.scene.render();
    });

    function onResize(): void {
      engine.resize();
    }
    window.addEventListener('resize', onResize);

    return () => {
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
