import type { FloorKind } from './floorKind';

/** Display-only texture. One repeat represents one metre in both views;
 * commercial tile sizes and quantities continue to come from the catalog. */
const textures = new Map<string, HTMLCanvasElement>();
export function planSurfaceTexture(hex: string, kind: FloorKind = 'screed'): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const key = `${hex}:${kind}`;
  const cached = textures.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = hex; ctx.fillRect(0, 0, 256, 256);
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
  if (kind === 'screed' || kind === 'ceramic') {
    for (let index = 0; index < 24; index++) {
      const x = random() * 256, y = random() * 256, radius = 5 + random() * 26;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(110,105,94,0.028)'); gradient.addColorStop(1, 'rgba(110,105,94,0)');
      ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }
  textures.set(key, canvas);
  if (textures.size > 32) textures.delete(textures.keys().next().value!);
  return canvas;
}
