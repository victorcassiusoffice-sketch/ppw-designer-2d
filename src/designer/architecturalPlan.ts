import type { BuildSkin } from '../store/buildSkinStore';
import { constructionHex, type WallConstruction } from './wallConstruction';

/** A cut-plan presentation, not a material assignment. All widths/offsets
 * remain in world metres and never feed the building or estimate models. */
export function architecturalPlanStyle(skin: BuildSkin) {
  return {
    cutCap: skin === 'blueprint' ? '#a9b9b3' : skin === 'gallery' ? '#d4d4c9' : '#c9b9a2',
    cutHighlight: 'rgba(255,252,242,0.86)',
    dimensionText: skin === 'blueprint' ? '#dfebe6' : '#655b4c',
    contact: 'rgba(75,58,39,0.13)',
    contactShadow: 'rgba(66,51,35,0.25)',
    cast: '67,55,42',
    // A model on a desk has a broad soft studio light. The true-sun setting
    // still projects the existing physical direction; this only sets ink.
    castOpacity: 0.68,
  } as const;
}

export function architecturalWallCap(kind: WallConstruction | undefined, skin: BuildSkin): string {
  // Explicit brick/concrete/glass selections retain their catalog swatch.
  return kind ? constructionHex(kind) : architecturalPlanStyle(skin).cutCap;
}

/** Shadows scale with the plan's world transform, not a fixed screen blur.
 * One narrow contact plus one short soft cast keeps 1 mm detail from growing
 * when zoomed out and bounds the cost on large multi-room plans. */
export function architecturalWallShadow(pxPerMetre: number, glass = false) {
  const pixels = Number.isFinite(pxPerMetre) && pxPerMetre > 0 ? pxPerMetre : 100;
  return {
    blur: pixels * (glass ? 0.035 : 0.09),
    offsetX: pixels * (glass ? 0.01 : 0.055),
    offsetY: pixels * (glass ? 0.015 : 0.08),
    opacity: glass ? 0.25 : 0.72,
  };
}
