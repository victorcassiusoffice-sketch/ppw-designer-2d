/**
 * Sims-Parity DT-21 / M3 — BabylonRoom.
 *
 * Mounts the Babylon engine + scene + camera on a <canvas>. Mounted
 * ONLY when `?engine=babylon` is on the URL (gated by `isBabylonActive()`).
 *
 * M3 fix (Gaming Dept `ppw-gaming-3d-mirror.md`, 2026-05-19): the DT-22
 * hardcoded 3-merchant-SKU demo is replaced with live subscriptions to
 * `useDesignStore.placedItems` (the active room's items) and
 * `useWallStore.walls`. Babylon meshes are diffed against the store —
 * add on new ids, update transform on existing ids, dispose on removed
 * ids. The scene is now a *camera mode* of the same room, not a parallel
 * demo theatre.
 *
 * Loaded via dynamic import from App.tsx so the marketing-route bundle
 * never pays for Babylon's ~1.5 MB chunk.
 */

import { useEffect, useRef } from 'react';
import {
  Engine,
  MeshBuilder,
  PointerEventTypes,
  StandardMaterial,
  Color3,
  Vector3,
  type Mesh,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import { buildBabylonScene } from './Scene';
import { buildArcRotateCamera } from './Camera';
import {
  buildWoodFloorMaterial,
  buildWhiteWallMaterial,
} from './Materials';
import { buildProceduralProductBox } from './ProceduralProductBox';
import { createSelectionController } from './Selection';
import { useDesignStore } from '../../store/designStore';
import { useWallStore } from '../../store/wallStore';
import { getProductById } from '../../data/products';
import type { PlacedItem } from '../../store/propertyStore';
import type { WallSegment } from '../../store/wallStore';

export interface BabylonRoomProps {
  roomWidthM?: number;
  roomDepthM?: number;
  ceiling?: boolean;
  /** P0-δ — M1 pointer-FSM state lifted from App.tsx so 3D click-to-place
   * can read the armed product id and clear it after committing.
   * Optional so the marketing-route lazy chunk doesn't need to pass them. */
  pendingProductId?: string | null;
  setPendingProductId?: (id: string | null) => void;
}

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|Android/i.test(navigator.userAgent);
}

const WALL_KEY_PREFIX = 'wall-seg-';

function rebuildWallSlab(
  scene: Scene,
  segment: WallSegment,
): Mesh {
  const startXm = segment.start.x_mm / 1000;
  const startZm = segment.start.y_mm / 1000;
  const endXm = segment.end.x_mm / 1000;
  const endZm = segment.end.y_mm / 1000;
  const dx = endXm - startXm;
  const dz = endZm - startZm;
  const lengthM = Math.max(0.01, Math.hypot(dx, dz));
  const heightM = Math.max(0.01, segment.height_mm / 1000);
  const thicknessM = Math.max(0.02, segment.thickness_mm / 1000);
  const slab = MeshBuilder.CreateBox(
    `${WALL_KEY_PREFIX}${segment.id}`,
    { width: lengthM, height: heightM, depth: thicknessM },
    scene,
  );
  slab.position = new Vector3((startXm + endXm) / 2, heightM / 2, (startZm + endZm) / 2);
  slab.rotation = new Vector3(0, Math.atan2(dz, dx), 0);
  const mat = new StandardMaterial(`${WALL_KEY_PREFIX}${segment.id}-mat`, scene);
  mat.diffuseColor = Color3.FromHexString('#F5EFE6');
  slab.material = mat;
  return slab;
}

export function BabylonRoom(props: BabylonRoomProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const shadowRef = useRef<ShadowGenerator | null>(null);
  const itemMeshesRef = useRef<Map<string, Mesh>>(new Map());
  const wallMeshesRef = useRef<Map<string, Mesh>>(new Map());
  // P0-δ — keep the latest FSM props in a ref so the Babylon pointer
  // observer (registered once on mount) always sees the current armed
  // state without re-mounting the entire engine.
  const fsmRef = useRef<{ id: string | null; clear: ((id: string | null) => void) | null }>({
    id: props.pendingProductId ?? null,
    clear: props.setPendingProductId ?? null,
  });
  fsmRef.current = {
    id: props.pendingProductId ?? null,
    clear: props.setPendingProductId ?? null,
  };

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
    sceneRef.current = built.scene;
    shadowRef.current = built.shadowGenerator;

    built.groundMesh.material = buildWoodFloorMaterial(built.scene);
    // Dispose the scaffold's hardcoded "wall1..4" meshes — M3 builds
    // walls per WallSegment from the wallStore now. Leaving them up
    // would render two wall sets on top of each other.
    const scaffoldWalls = built.scene.meshes.filter((m) => m.name.startsWith('wall') && !m.name.startsWith(WALL_KEY_PREFIX));
    scaffoldWalls.forEach((w) => {
      // PBR upgrade them in case the user has no walls drawn yet so the
      // room still reads as a room. Wall-segment slabs overlay anyway.
      (w as { material: unknown }).material = buildWhiteWallMaterial(built.scene);
    });

    buildArcRotateCamera(built.scene, canvas);

    const selection = createSelectionController(built.scene);
    const pointerObserver = built.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERPICK) return;
      const picked = info.pickInfo?.pickedMesh;
      const armedId = fsmRef.current.id;
      // P0-δ — click-to-place: if the FSM is armed and the click hit the
      // ground mesh, commit a placement at the world pick point (snapped
      // to the 50 cm grid the 2D RoomCanvas uses). The M3 designStore
      // mirror will render the new product mesh on the next frame.
      if (armedId && picked && picked.name === 'ground') {
        const p = info.pickInfo?.pickedPoint;
        if (p) {
          const product = getProductById(armedId);
          if (product) {
            const lengthM = product.dimensions_cm.length / 100;
            const widthM = product.dimensions_cm.width / 100;
            // Babylon ground is centred at origin with width=roomWidthM,
            // height=roomDepthM. The 2D designer's coord-space has the room
            // polygon starting at (0,0) → translate by half-size.
            const xRoomM = p.x + (props.roomWidthM ?? 5) / 2;
            const yRoomM = p.z + (props.roomDepthM ?? 4) / 2;
            // Snap to 50 cm grid + centre the footprint on the cursor.
            const snap = (v: number) => Math.round(v / 0.5) * 0.5;
            const snappedX = snap(xRoomM - lengthM / 2);
            const snappedY = snap(yRoomM - widthM / 2);
            useDesignStore.getState().addItem({
              productId: product.id,
              x: snappedX,
              y: snappedY,
              rotation: 0,
            });
            fsmRef.current.clear?.(null);
          }
        }
        return;
      }
      if (picked && picked.name.startsWith('product-')) {
        selection.attachToMesh(picked);
      } else {
        selection.attachToMesh(null);
      }
    });
    function onKey(e: KeyboardEvent): void {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.getSelected()) {
        e.preventDefault();
        selection.disposeSelected();
      }
    }
    window.addEventListener('keydown', onKey);

    // E2E hook (`ppw-gaming-3d-mirror.md` acceptance test): expose the
    // live scene so Playwright can introspect mesh counts without a
    // brittle screenshot comparison.
    interface PpwWindow extends Window { __ppwBabylonScene?: Scene; }
    (window as PpwWindow).__ppwBabylonScene = built.scene;

    engine.runRenderLoop(() => {
      built.scene.render();
    });

    function onResize(): void {
      engine.resize();
    }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      if (pointerObserver) built.scene.onPointerObservable.remove(pointerObserver);
      selection.dispose();
      itemMeshesRef.current.forEach((m) => m.dispose());
      itemMeshesRef.current.clear();
      wallMeshesRef.current.forEach((m) => m.dispose());
      wallMeshesRef.current.clear();
      engine.stopRenderLoop();
      built.scene.dispose();
      engine.dispose();
      sceneRef.current = null;
      shadowRef.current = null;
      delete (window as PpwWindow).__ppwBabylonScene;
    };
  }, [props.roomWidthM, props.roomDepthM, props.ceiling]);

  // M3 mirror — placed items.
  useEffect(() => {
    function syncItems(placedItems: PlacedItem[]): void {
      const scene = sceneRef.current;
      if (!scene) return;
      const seen = new Set<string>();
      for (const item of placedItems) {
        seen.add(item.instanceId);
        const product = getProductById(item.productId);
        if (!product) continue;
        const dimensionsMm = {
          width: product.dimensions_cm.length * 10,
          depth: product.dimensions_cm.width * 10,
          height: product.dimensions_cm.height * 10,
        };
        const existing = itemMeshesRef.current.get(item.instanceId);
        if (!existing) {
          const mesh = buildProceduralProductBox({
            scene,
            shadowGenerator: shadowRef.current ?? undefined,
            productId: item.instanceId,
            photoUrl: product.image_url ?? '',
            dimensionsMm,
            positionM: { x: item.x, z: item.y },
            rotationDegY: item.rotation,
          });
          itemMeshesRef.current.set(item.instanceId, mesh);
        } else {
          existing.position.x = item.x;
          existing.position.z = item.y;
          existing.position.y = dimensionsMm.height / 2000;
          existing.rotation.y = (item.rotation * Math.PI) / 180;
        }
      }
      for (const [id, mesh] of itemMeshesRef.current) {
        if (!seen.has(id)) {
          mesh.dispose();
          itemMeshesRef.current.delete(id);
        }
      }
    }
    // Initial sync (covers SSR / hot-reload / engine restart).
    syncItems(useDesignStore.getState().placedItems);
    return useDesignStore.subscribe((s) => syncItems(s.placedItems));
  }, []);

  // M3 mirror — walls.
  useEffect(() => {
    function syncWalls(walls: WallSegment[]): void {
      const scene = sceneRef.current;
      if (!scene) return;
      const seen = new Set<string>();
      for (const seg of walls) {
        seen.add(seg.id);
        const existing = wallMeshesRef.current.get(seg.id);
        if (existing) {
          // Walls are immutable after commit in M2, so the simplest
          // correct behaviour is dispose+rebuild on any change. With
          // the M2 scope this code path is only hit on engine restart.
          existing.dispose();
        }
        const slab = rebuildWallSlab(scene, seg);
        wallMeshesRef.current.set(seg.id, slab);
        if (shadowRef.current) {
          shadowRef.current.addShadowCaster(slab);
        }
      }
      for (const [id, mesh] of wallMeshesRef.current) {
        if (!seen.has(id)) {
          mesh.dispose();
          wallMeshesRef.current.delete(id);
        }
      }
    }
    syncWalls(useWallStore.getState().walls);
    return useWallStore.subscribe((s) => syncWalls(s.walls));
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Wellness room (3D Babylon)"
      data-testid="babylon-canvas"
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
