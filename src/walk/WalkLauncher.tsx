import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ThreeStageHandle } from '../components/three/ThreeStage';
import { prepareWalkVisit, visitLevels } from './visit';
import { SharedBuildButton } from '../sharedBuild/SharedBuildButton';
import { BoundaryTools } from '../components/three/BoundaryTools';
import { WalkerPlacement } from './WalkerPlacement';
import type { PlacementHint } from './placement';
import type { SceneInput } from '../designer/roomView3d';
import type { Property } from '../store/propertyStore';
import WalkMode from './WalkMode';

type BackgroundStage = Pick<ThreeStageHandle, 'beginWalk' | 'debug'> & Partial<Pick<ThreeStageHandle, 'walkRay' | 'projectPoint'>>;

/** Loaded after the first picture: the enabled launch button and chooser arrive together. */
export default function WalkLauncher({
  property,
  sceneForLevel,
  onOpen,
  stageRef, viewportRef,
}: {
  property: Property;
  sceneForLevel: (property: Property) => SceneInput;
  onOpen: () => void;
  stageRef: RefObject<BackgroundStage | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<PlacementHint>();
  const levels = visitLevels(property);
  const prepare = () => prepareWalkVisit(property, sceneForLevel);
  const launchButton = useRef<HTMLButtonElement>(null);
  const background = useRef<{
    release: () => void;
    readFrames: () => number;
    paused: boolean;
  } | null>(null);
  const resumeBackground = useCallback(() => {
    const acquired = background.current;
    if (!acquired?.paused) return;
    // Clear ownership first: close, unmount and a reentrant release share one cleanup.
    acquired.paused = false;
    const release = acquired.release;
    acquired.release = () => {};
    release();
  }, []);
  useLayoutEffect(() => resumeBackground, [resumeBackground]);
  useLayoutEffect(() => {
    // Resume after React removes the covering overlay, before the next paint.
    if (!open) resumeBackground();
  }, [open, resumeBackground]);
  useEffect(() => {
    const button = launchButton.current;
    if (!button) return;
    // Opt-in read-only QA snapshot; no polling or frame-by-frame DOM writes.
    const snapshot = () => {
      const acquired = background.current;
      const frames = acquired ? acquired.readFrames() : stageRef.current?.debug().frames;
      if (typeof frames !== 'number' || !Number.isFinite(frames)) return;
      button.dispatchEvent(
        new CustomEvent('world-walk-background-result', {
          detail: { frames, paused: acquired?.paused ?? false },
        }),
      );
    };
    button.addEventListener('world-walk-measure-background', snapshot);
    return () => button.removeEventListener('world-walk-measure-background', snapshot);
  }, [stageRef]);
  const launch = (placement?: PlacementHint) => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    setHint(placement); onOpen();

    if (!background.current?.paused) {
      const original = stageRef.current;
      const surface = original?.beginWalk();
      background.current =
        original && surface
          ? {
              release: () => surface.release(),
              readFrames: () => original.debug().frames,
              paused: true,
            }
          : null;
    }
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
  };
  return (
    <>
      <div className="world-walk-dock">
      <button
        ref={launchButton}
        type="button"
        className="world-walk-launch"
        aria-label="Open Walk mode"
        data-walk-ui-ready="true"
        onClick={() => launch()}
      >
        Walk
      </button>
      {!open && <SharedBuildButton/>}
      {!open && <BoundaryTools view={{
        element: () => viewportRef?.current ?? null,
        ray(x,y) {
          const rect=viewportRef?.current?.getBoundingClientRect(); if(!rect)return null;
          const r=stageRef.current?.walkRay?.(x-rect.left,y-rect.top); if(!r)return null;
          return {origin:{x:r.origin.x,y:r.origin.z,z:r.origin.y},direction:{x:r.direction.x,y:r.direction.z,z:r.direction.y}};
        },
        project(p) {
          const rect=viewportRef?.current?.getBoundingClientRect(),v=stageRef.current?.projectPoint?.(p.x,p.y,p.z);
          return rect&&v?{x:rect.left+v.x,y:rect.top+v.y}:null;
        }
      }}/>}
      {!open && <WalkerPlacement property={property} levels={levels} stageRef={stageRef} viewportRef={viewportRef} prepare={prepare} onPlace={launch} />}
      </div>
      {open && (
        <WalkMode
          onClose={close}
          initial={hint} levels={levels} prepareVisit={prepare}
        />
      )}
    </>
  );
}
