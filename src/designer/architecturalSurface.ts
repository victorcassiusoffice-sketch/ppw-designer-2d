/** Unpriced presentation of an unfinished mineral slab. These values are not
 * catalog material IDs, specifications, measurements or ordering inputs. */
export const NATURAL_BARE_FLOOR_HEX = '#b7b8ae';
export const ARCHITECTURAL_MINERAL_REPEAT_M = 4;

function periodicNoise(u: number, v: number, cells: number): number {
  const x = ((u % 1) + 1) % 1 * cells, y = ((v % 1) + 1) % 1 * cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const sample = (a: number, b: number) => {
    const hash = Math.sin((a % cells) * 127.1 + (b % cells) * 311.7 + cells * 17.3) * 43758.5453;
    return (hash - Math.floor(hash)) * 2 - 1;
  };
  const top = sample(ix, iy) * (1 - fx) + sample(ix + 1, iy) * fx;
  const bottom = sample(ix, iy + 1) * (1 - fx) + sample(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/** Seamless, deterministic trowel variation at several physical scales. Broad
 * clouds give mineral depth; finer aggregate avoids repeated stripes/blobs. */
export function architecturalMineralVariation(u: number, v: number): number {
  return 0.46 * periodicNoise(u, v, 3) + 0.28 * periodicNoise(u, v, 7)
    + 0.16 * periodicNoise(u, v, 17) + 0.1 * periodicNoise(u, v, 41);
}
