import type { FloorKind } from './floorKind';
import { architecturalMineralVariation, ARCHITECTURAL_MINERAL_REPEAT_M } from './architecturalSurface';

export function planSurfacePatternScale(pxPerMetre: number, kind: FloorKind = 'screed'): number {
  return pxPerMetre * (kind === 'screed' ? ARCHITECTURAL_MINERAL_REPEAT_M / 512 : 1 / 256);
}

/** Display-only texture. Unfinished mineral repeats at four metres; catalog
 * finishes keep their one-metre detail. Tile quantities come from the catalog. */
const textures = new Map<string, HTMLCanvasElement>();
export function planSurfaceTexture(hex: string, kind: FloorKind = 'screed'): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const key = `${hex}:${kind}`;
  const cached = textures.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const size = kind === 'screed' ? 512 : 256;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = hex; ctx.fillRect(0, 0, size, size);
  if (kind === 'screed') {
    const texture = ctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const aggregate = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const delta = architecturalMineralVariation(x / size, y / size) * 8 + (aggregate - Math.floor(aggregate) - 0.5) * 4;
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) texture.data[index + channel] = Math.max(0, Math.min(255, texture.data[index + channel] + delta));
    }
    ctx.putImageData(texture, 0, 0);
    textures.set(key, canvas);
    if (textures.size > 32) textures.delete(textures.keys().next().value!);
    return canvas;
  }
  let seed = 7391;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // Neutral grain enriches the actual swatch without replacing a paid
  // material with an unrelated photographic texture or fictional pattern.
  const rubber = ['rubber-tile', 'interlock', 'eva-mat', 'epdm-roll', 'vinyl-mat'].includes(kind);
  for (let index = 0; index < (rubber ? 1900 : 1300); index++) {
    const x = random() * 256, y = random() * 256;
    const alpha = (rubber ? 0.05 : 0.025) + random() * (rubber ? 0.11 : 0.045);
    ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(35,39,34,${alpha})`;
    const radius = rubber ? 0.4 + random() * 0.65 : 0.35 + random() * 1.3;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  }
  if (kind === 'wood') {
    for (let index = 0; index < 55; index++) {
      const x = random() * 256;
      ctx.beginPath(); ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + random() * 10, 84, x - random() * 10, 176, x, 256);
      ctx.strokeStyle = 'rgba(50,34,22,0.07)'; ctx.lineWidth = 0.5 + random(); ctx.stroke();
    }
  }
  if (kind === 'ceramic') {
    // Trowelled mineral variation rather than a grid of circular smudges.
    // Periodic bands meet at the tile boundary and preserve the base hue.
    const texture = ctx.getImageData(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const tau = Math.PI * 2;
      const flow = Math.sin(x / 256 * tau * 2 + Math.sin(y / 256 * tau) * 0.7);
      const grain = Math.sin((x + y) / 256 * tau * 5) * 0.32 + Math.sin((x * 3 - y * 2) / 256 * tau) * 0.18;
      const delta = Math.round((flow * 0.5 + grain) * 2.8);
      const index = (y * 256 + x) * 4;
      for (let channel = 0; channel < 3; channel++) texture.data[index + channel] = Math.max(0, Math.min(255, texture.data[index + channel] + delta));
    }
    ctx.putImageData(texture, 0, 0);
  }
  textures.set(key, canvas);
  if (textures.size > 32) textures.delete(textures.keys().next().value!);
  return canvas;
}
