/** Screen-sized rotation affordance. This only positions chrome; plan units
 * and the object's measured centre stay untouched. */
export function planHandleLayout(input: { w: number; h: number; scale: number; left: number; top: number; width: number; height: number }) {
  const scale = Math.max(0.01, input.scale);
  const gap = 38 / scale;
  const high = input.top < 72;
  const rightFits = input.left + input.w * scale + 60 < input.width;
  const preferredX = high ? (rightFits ? input.w + gap : -gap) : input.w / 2;
  const preferredY = high ? input.h / 2 : -gap;
  // An item can be panned or dragged above the visible plan. A side-flip
  // alone still leaves its handle behind the application header. Keep the
  // entire 44px hit target inside the canvas, with a small edge clearance.
  // Convert back to item-local coordinates; the rotation gesture continues
  // to use the measured object centre, never this relocated affordance.
  const inset = 24;
  const inside = (position: number, extent: number) => {
    const margin = Math.min(inset, extent / 2);
    return Math.max(margin, Math.min(position, extent - margin));
  };
  return {
    x: (inside(input.left + preferredX * scale, input.width) - input.left) / scale,
    y: (inside(input.top + preferredY * scale, input.height) - input.top) / scale,
    radius: 12 / scale,
    hitStrokeWidth: 20 / scale,
  };
}
