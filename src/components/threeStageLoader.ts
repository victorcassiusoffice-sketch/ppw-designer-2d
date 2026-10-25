/** Share the explicit-3D route preload with React.lazy. A rejected download is
 * retryable; 2D and shop visits do not fetch or evaluate the WebGL renderer. */
let pending: Promise<typeof import('./three/ThreeStage')> | undefined;
export function loadThreeStage() {
  pending ??= import('./three/ThreeStage').catch(error => { pending = undefined; throw error; });
  return pending;
}
