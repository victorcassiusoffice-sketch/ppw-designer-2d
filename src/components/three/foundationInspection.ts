/** Preserve each existing visibility flag through an inspection toggle. New
 * geometry built while inspecting receives the same treatment; disposed nodes
 * are weakly held and cannot be resurrected when the house is rebuilt. */
const previous = new WeakMap<{ visible: boolean }, boolean>();
export function setFoundationInspection(
  surfaces: readonly ({ visible: boolean } | null | undefined)[],
  inspect: boolean,
): void {
  for (const surface of surfaces) {
    if (!surface) continue;
    if (inspect) {
      if (!previous.has(surface)) previous.set(surface, surface.visible);
      surface.visible = false;
    } else if (previous.has(surface)) {
      surface.visible = previous.get(surface)!;
      previous.delete(surface);
    }
  }
}
