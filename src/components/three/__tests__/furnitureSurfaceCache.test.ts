import { describe, expect, it } from 'vitest';
import { furnitureSurface, type FurnitureSurface } from '../furnitureSurface';

describe('cached furniture surface pixels', () => {
  it.each<FurnitureSurface>(['wood', 'fabric', 'weave', 'stone'])('keeps %s texture ownership private and repeated values identical', kind => {
    const first = furnitureSurface(kind), second = furnitureSurface(kind);
    const firstPixels = first.image.data as Uint8Array, secondPixels = second.image.data as Uint8Array;
    expect(first).not.toBe(second);
    expect(firstPixels).not.toBe(secondPixels);
    expect(secondPixels.every((value, index) => value === firstPixels[index])).toBe(true);
    const originalPixel = secondPixels[0];
    firstPixels[0] = originalPixel === 0 ? 255 : 0;
    first.dispose();
    const third = furnitureSurface(kind);
    const thirdPixels = third.image.data as Uint8Array;
    expect(thirdPixels[0]).toBe(originalPixel);
    expect(thirdPixels.every((value, index) => value === secondPixels[index])).toBe(true);
    second.dispose(); third.dispose();
  });
});
