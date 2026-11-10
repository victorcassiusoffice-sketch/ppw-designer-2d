import { lazy, Suspense, type RefObject } from 'react';
import type { SceneSolids } from '../../designer/roomSolids';
import type { OrbitCamera } from '../../designer/roomView3d';
import type { ThreeStageHandle } from '../three/ThreeStage';
import { useTradeFlow } from './tradeFlow';

type Frame = { size: { width: number; height: number }; levelId: string };
export type OverlayFrame = Frame & (
  | { view: 'plan'; viewport: { x:number; y:number; scale:number }; pxPerMetre:number }
  | { view: 'house'; stageRef: RefObject<ThreeStageHandle|null>; camera: OrbitCamera;
      backend:'gl'|'painter'; wallView:'up'|'down'|'cutaway'; solids:SceneSolids }
);
const TradeOverlay = lazy(() => import('./TradeProgressOverlay'));
/** The public build drops both host lines. Even the protected renderer leaves
 * geometry, job storage and transfer libraries unloaded in ordinary build mode. */
export function TradeOverlayHost(props:OverlayFrame) {
  const mode = useTradeFlow(s => s.mode);
  if (mode === 'off' || !/^\/designer\/?$/.test(location.pathname)) return null;
  return <Suspense fallback={null}><TradeOverlay {...props}/></Suspense>;
}
