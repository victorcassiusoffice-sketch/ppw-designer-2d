import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ThreeStageSurface } from './ThreeStage';
import type { SceneSolids } from '../../designer/roomSolids';
import type { PerspectiveCamera } from 'three';

export const WALK_BUILD_TOOLS = [
 ['select','Move objects'],['wall','Wall'],['room','Room'],['door','Door'],['window','Window'],['stair','Stairs'],
 ['furnish','Products and lights'],['paint','Paint'],['floor','Flooring'],['garden','Garden'],['materials','Materials'],
 ['energy','Solar'],['foundation','Foundation'],['electrical','Electrical services'],['plumbing','Plumbing'],['remove','Remove'],
] as const;
export type WalkBuildTool=typeof WALK_BUILD_TOOLS[number][0];
export interface LiveWalkView {
  tool?(value:WalkBuildTool):void;
  mount: StageMount;
  surface(): ThreeStageSurface | null;
  setView(value: { solids: SceneSolids; width: number; height: number } | null): void;
  pickWith(camera: PerspectiveCamera | null): void;
}
export class StageMount {
  readonly element = document.createElement('div');
  private original: HTMLElement | null = null;
  constructor() {
    this.element.className = 'absolute inset-0';
    this.element.dataset.sharedHouseCanvas = 'true';
  }
  attachHome(node: HTMLElement | null) {
    this.original = node;
    if (node) node.appendChild(this.element);
    else this.element.remove();
  }
  show(node: HTMLElement | null) {
    const next = node ?? this.original;
    if (next && this.element.parentElement !== next) next.appendChild(this.element);
  }
}
export function HouseStageSlot({ mount, children }: { mount: StageMount; children: ReactNode }) {
  const home = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    mount.attachHome(home.current);
    return () => mount.attachHome(null);
  }, [mount]);
  return (
    <>
      <div ref={home} className="absolute inset-0" />
      {createPortal(children, mount.element)}
    </>
  );
}
