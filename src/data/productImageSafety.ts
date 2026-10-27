/** Legacy catalogue rows can still contain outside placeholder services.
 * Reject them before any image element or canvas starts a network request. */
export function usableProductImage(url: string | null | undefined): string | undefined {
  const value = url?.trim();
  if (!value || /(?:^|\/)\/?(?:[^/]+\.)?placehold\.co(?:[/:?#]|$)/i.test(value)) return undefined;
  return value;
}

export const isVectorProductImage = (url: string): boolean => /^data:image\/svg\+xml/i.test(url) || /\.svg(?:[?#]|$)/i.test(url);

/** Give existing plan symbols an intrinsic size for image/canvas consumers. */
export function planSymbolDataUrl(source: string): string {
  let svg = source;
  if (!/\swidth\s*=/.test(svg)) svg = svg.replace('<svg', '<svg width="64"');
  if (!/\sheight\s*=/.test(svg)) svg = svg.replace('<svg', '<svg height="64"');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
