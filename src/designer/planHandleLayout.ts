/** Screen-sized rotation affordance. This only positions chrome; plan units
 * and the object's measured centre stay untouched. */
export function planHandleLayout(input: { w: number; h: number; scale: number; left: number; top: number; width: number }) {
  const scale = Math.max(0.01, input.scale);
  const gap = 38 / scale;
  const high = input.top < 72;
  const rightFits = input.left + input.w * scale + 60 < input.width;
  return {
    x: high ? (rightFits ? input.w + gap : -gap) : input.w / 2,
    y: high ? input.h / 2 : -gap,
    radius: 12 / scale,
    hitStrokeWidth: 20 / scale,
  };
}
