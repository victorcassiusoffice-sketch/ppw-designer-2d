import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ThreeStageHandle } from '../components/three/ThreeStage';
import { buildingSolids } from '../designer/buildingScene';
import { isRoofLevel } from '../designer/levels';
import type { SceneInput } from '../designer/roomView3d';
import type { Property } from '../store/propertyStore';
import WalkMode from './WalkMode';

type BackgroundStage = Pick<ThreeStageHandle, 'beginWalk' | 'debug'>;

/** Loaded after the first picture: the enabled launch button and chooser arrive together. */
export default function WalkLauncher({
  property,
  sceneForLevel,
  onOpen,
  stageRef,
}: {
  property: Property;
  sceneForLevel: (property: Property) => SceneInput;
  onOpen: () => void;
  stageRef: RefObject<BackgroundStage | null>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
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
  const close = () => {
    setOpen(false);
  };
  return (
    <>
      <button
        ref={launchButton}
        type="button"
        className="world-walk-launch"
        aria-label="Open Walk mode"
        data-walk-ui-ready="true"
        onClick={() => {
          onOpen();
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
        }}
      >
        Walk
      </button>
      {open && (
        <WalkMode
          onClose={close}
          prepareVisit={() => {
            // Construct all storeys only after Start, never on the chooser's open action.
            const snapshot = structuredClone(property);
            const roof = snapshot.levels?.find((level) => isRoofLevel(level));
            const source = roof ? { ...snapshot, activeLevelId: roof.id } : snapshot;
            const all = buildingSolids(source, sceneForLevel, 'building', true);
            return { property: snapshot, solids: { ...all, roofs: [] } };
          }}
        />
      )}
    </>
  );
}
