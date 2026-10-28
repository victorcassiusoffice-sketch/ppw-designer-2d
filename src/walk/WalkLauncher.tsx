import { useState } from 'react';
import { buildingSolids } from '../designer/buildingScene';
import { isRoofLevel } from '../designer/levels';
import type { SceneInput } from '../designer/roomView3d';
import type { Property } from '../store/propertyStore';
import WalkMode from './WalkMode';

/** Loaded after the first picture: the enabled launch button and chooser arrive together. */
export default function WalkLauncher({
  property,
  sceneForLevel,
  onOpen,
}: {
  property: Property;
  sceneForLevel: (property: Property) => SceneInput;
  onOpen: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="world-walk-launch"
        aria-label="Open Walk mode"
        data-walk-ui-ready="true"
        onClick={() => {
          onOpen();
          setOpen(true);
        }}
      >
        Walk
      </button>
      {open && (
        <WalkMode
          onClose={() => setOpen(false)}
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
