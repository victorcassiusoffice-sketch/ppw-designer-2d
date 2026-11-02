import thumbnailManifest from './catalogImageThumbnails.json';

interface ThumbnailPair { small: string; large: string }
const thumbnails = thumbnailManifest as Record<string, ThumbnailPair>;

/** Cards and basket images use cached small assets. Detail views retain the source. */
export function catalogImageSources(source: string, detail = false): { src: string; srcSet?: string } {
  const pair = !detail && thumbnails[source];
  return pair ? { src: pair.small, srcSet: `${pair.small} 1x, ${pair.large} 2x` } : { src: source };
}
