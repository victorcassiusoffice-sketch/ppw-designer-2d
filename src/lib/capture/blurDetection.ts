/**
 * Sims-Parity DT-05 — Laplacian-variance blur detection.
 *
 * The captured frame is judged "too blurry" if the variance of its
 * Laplacian-filtered intensity channel falls below a threshold. The
 * Laplacian kernel is the standard 4-neighbour edge detector
 * (−1 / +4 / −1 column, −1 / −1 sides).
 *
 * A sharp 1920×1080 phone capture typically scores 500–3000 variance.
 * A motion-blurred or out-of-focus shot drops to 30–120. The threshold
 * defaults to 100 which empirically discriminates the two on the
 * fixture photos in `06-Roadmap/sims-parity/CAMERA-CAPTURE-PIPELINE.md`.
 *
 * Pure-fn for testability — accepts ImageData (RGBA bytes).
 */

const DEFAULT_BLUR_THRESHOLD = 100;

/**
 * Compute the variance of the Laplacian over the luminance channel of
 * an ImageData buffer.
 *
 * Y = 0.299 R + 0.587 G + 0.114 B (Rec.601 grayscale).
 */
export function laplacianVariance(image: ImageData): number {
  const { width, height, data } = image;
  if (width < 3 || height < 3) return 0;

  // 1. Build a grayscale plane in a typed array. ImageData.data is RGBA u8.
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 2. Convolve with 4-neighbour Laplacian and accumulate sum + sum-of-squares
  //    in a single pass to avoid a second buffer.
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const p = row + x;
      const lap = 4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - width] - gray[p + width];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export interface BlurVerdict {
  /** Computed Laplacian variance — higher = sharper. */
  variance: number;
  /** Pass / fail against the threshold. */
  sharp: boolean;
  /** The threshold that was applied. */
  threshold: number;
}

/**
 * Convenience wrapper that returns a verdict + the raw variance so
 * the UI can render a tactical warning.
 */
export function assessBlur(
  image: ImageData,
  threshold: number = DEFAULT_BLUR_THRESHOLD,
): BlurVerdict {
  const variance = laplacianVariance(image);
  return {
    variance,
    sharp: variance >= threshold,
    threshold,
  };
}

export { DEFAULT_BLUR_THRESHOLD };
