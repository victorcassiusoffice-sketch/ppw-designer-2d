export const cameraDistances = { close: 2.8, wide: 4.8, far: 6.2 } as const;
export type CameraFraming = keyof typeof cameraDistances;
export type WalkControls = { framing: CameraFraming; oneHanded: boolean };
const defaults: WalkControls = { framing: 'wide', oneHanded: false };
const storageKey = 'olb-walk-camera-controls-v1';

export function readWalkControls(): WalkControls {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return {
      framing: Object.prototype.hasOwnProperty.call(cameraDistances, saved?.framing)
        ? saved.framing
        : defaults.framing,
      oneHanded: saved.oneHanded === true,
    };
  } catch {
    return defaults;
  }
}

export function saveWalkControls(value: WalkControls) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* The current visit still uses the selection. */
  }
}
