/** Only a completed direct picture may unlock optional post-processing.
 * Asset loading gets a bounded settling window; a failed merchant download
 * cannot prevent a usable scene or keep the renderer spinning forever. */
export function optionalShadingReady(firstPictureAt: number | null, now: number, pendingBodies: number): boolean {
  if (firstPictureAt === null || !Number.isFinite(now)) return false;
  const elapsed = now - firstPictureAt;
  return elapsed >= 500 && (pendingBodies === 0 || elapsed >= 5000);
}
