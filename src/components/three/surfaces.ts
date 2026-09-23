/**
 * surfaces — procedural, world-scaled PBR textures for the 3D stage (3D Mode
 * P3 realism, 2026-09-19).
 *
 * Nothing here is fetched: every map is drawn on a canvas at first use and
 * cached, so the phone never waits on an asset and the bundle carries no
 * images. Every ALBEDO map is normalised to a mean of ~1.0 (it modulates
 * the material's hex, it never replaces it), which keeps the colour-truth
 * law the stage is measured against: a #808080 wall or floor still renders
 * its hex on average; the texture only redistributes it.
 *
 * Floors get a kind from the flooring product (rubber tile, EVA foam,
 * vinyl mat, EPDM roll, interlock, or the bare screed when nothing is
 * laid) and each kind has its own grain and joint pattern, drawn at real
 * size: a 50 cm rubber tile repeats every 0.5 m, a 1 m EVA mat every metre.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Noise + canvas helpers (also used for the plaster / roller maps).
// ---------------------------------------------------------------------------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise on a wrapping grid, box-blurred `blur` times (0 = grit, 4 = trowel marks), normalised 0..1. */
export function noiseField(size: number, seed: number, blur: number): Float32Array {
  const rnd = mulberry32(seed);
  let f = new Float32Array(size * size);
  for (let i = 0; i < f.length; i++) f[i] = rnd();
  for (let pass = 0; pass < blur; pass++) {
    const g = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += f[((y + dy + size) % size) * size + ((x + dx + size) % size)];
        g[y * size + x] = s / 9;
      }
    }
    f = g;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of f) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - lo) / span;
  return f;
}

/** A 2D canvas of the given size, or null where there is no document (unit tests under Node) — callers fall back to an empty texture. */
function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** A wrapping canvas texture filled by `fill`; `repeatPerMetre` tiles it to world size (geometry UVs are in metres). */
export function canvasTexture(size: number, fill: (data: Uint8ClampedArray) => void, colorSpace: THREE.ColorSpace, repeatPerMetre: number): THREE.Texture {
  const made = makeCanvas(size, size);
  if (!made) return new THREE.Texture();
  const { canvas: c, ctx } = made;
  const img = ctx.createImageData(size, size);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatPerMetre, repeatPerMetre);
  t.colorSpace = colorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** A tangent-space normal map from a height field (wrapping), `strength` in height units per texel. */
export function normalFromHeight(size: number, h: Float32Array, strength: number, repeatPerMetre: number): THREE.Texture {
  return canvasTexture(
    size,
    (d) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const l = h[y * size + ((x - 1 + size) % size)];
          const r = h[y * size + ((x + 1) % size)];
          const u = h[((y - 1 + size) % size) * size + x];
          const b = h[((y + 1) % size) * size + x];
          const nx = -(r - l) * strength;
          const ny = -(b - u) * strength;
          const len = Math.hypot(nx, ny, 1);
          const i = (y * size + x) * 4;
          d[i] = ((nx / len) * 0.5 + 0.5) * 255;
          d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
          d[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
          d[i + 3] = 255;
        }
      }
    },
    THREE.NoColorSpace,
    repeatPerMetre,
  );
}

// ---------------------------------------------------------------------------
// Painted walls — roller stipple that modulates the swatch, never replaces it.
// ---------------------------------------------------------------------------

/** Bilinear expand of a wrapping square field (edge length `from`) up to `size`. */
function expandField(small: Float32Array, from: number, size: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * from;
    const y0 = Math.floor(gy) % from;
    const y1 = (y0 + 1) % from;
    const ty = gy - Math.floor(gy);
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * from;
      const x0 = Math.floor(gx) % from;
      const x1 = (x0 + 1) % from;
      const tx = gx - Math.floor(gx);
      const v00 = small[y0 * from + x0];
      const v10 = small[y0 * from + x1];
      const v01 = small[y1 * from + x0];
      const v11 = small[y1 * from + x1];
      out[y * size + x] = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
    }
  }
  return out;
}

/**
 * Roller lanes, orange peel and a soft blotch, normalised 0..1.
 * The features are centimetres, not millimetres: a room-distance camera
 * mipmaps a 2 mm nap into a flat colour. One tile is one metre on the wall
 * (see `paintWallMaps`).
 */
export function paintHeightField(size = 256): Float32Array {
  const blot = expandField(noiseField(24, 29, 1), 24, size);
  const peel = expandField(noiseField(48, 17, 1), 48, size);
  const nap = expandField(noiseField(96, 11, 0), 96, size);
  const raw = new Float32Array(size * size);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    const v = blot[i] * 0.62 + peel[i] * 0.28 + nap[i] * 0.1;
    raw[i] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let y = 0; y < size; y++) {
    // A hint of the roller, not a stripe: ±0.045 around the orange peel.
    const lane = Math.sin((y / size) * Math.PI * 6) * 0.045;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      raw[i] = Math.min(1, Math.max(0, (raw[i] - lo) / span * 0.9 + 0.05 + lane));
    }
  }
  return raw;
}

/**
 * One linear albedo texel. `stipple` is the half-range in 8-bit steps.
 * Height 0.5 lands on `255 - stipple`, so the map stays near white and the
 * material hex remains the swatch (a #808080 wall stays a grey wall).
 */
export function paintAlbedoByte(height: number, stipple: number): number {
  const amp = Math.max(0, stipple);
  const mid = 255 - amp;
  return Math.max(0, Math.min(255, Math.round(mid + (height - 0.5) * 2 * amp)));
}

/**
 * Roughness multiplier texel (linear, green channel). Spans about 0.84–1.0
 * so the finish's roughness scalar stays the finish and the highlight breaks
 * up instead of reading as a plastic sheet.
 */
export function paintRoughnessByte(height: number): number {
  return Math.max(0, Math.min(255, Math.round((0.84 + height * 0.16) * 255)));
}

export interface PaintWallMaps {
  /** Linear albedo for a finish's stipple amplitude. Cached per amplitude. */
  albedo: (stipple: number) => THREE.Texture;
  /** Linear roughness modulation, shared by every finish. */
  roughness: THREE.Texture;
  /** Roller nap + orange peel, for the base coat and the clear film. */
  normal: THREE.Texture;
}

let paintMapsCache: PaintWallMaps | null = null;
const paintAlbedoCache = new Map<number, THREE.Texture>();

/** Procedural paint maps. Albedo and roughness are linear multipliers; the hex is the colour. */
export function paintWallMaps(): PaintWallMaps {
  if (paintMapsCache) return paintMapsCache;
  const N = 256;
  const height = paintHeightField(N);
  const repeat = 1;
  const roughness = canvasTexture(
    N,
    (d) => {
      for (let i = 0; i < N * N; i++) {
        const v = paintRoughnessByte(height[i]);
        d[i * 4] = v;
        d[i * 4 + 1] = v;
        d[i * 4 + 2] = v;
        d[i * 4 + 3] = 255;
      }
    },
    THREE.LinearSRGBColorSpace,
    repeat,
  );
  // Coarse bumps have a tiny per-texel slope; a higher strength lets the
  // sun actually rake across a roller pass instead of shading a flat plane.
  const normal = normalFromHeight(N, height, 9, repeat);
  paintMapsCache = {
    roughness,
    normal,
    albedo(stipple: number) {
      const hit = paintAlbedoCache.get(stipple);
      if (hit) return hit;
      const tex = canvasTexture(
        N,
        (d) => {
          for (let i = 0; i < N * N; i++) {
            const v = paintAlbedoByte(height[i], stipple);
            d[i * 4] = v;
            d[i * 4 + 1] = v;
            d[i * 4 + 2] = v;
            d[i * 4 + 3] = 255;
          }
        },
        THREE.LinearSRGBColorSpace,
        repeat,
      );
      paintAlbedoCache.set(stipple, tex);
      return tex;
    },
  };
  return paintMapsCache;
}

/** Greyscale albedo modulation from a 0..1 field: mean ≈ `mean` (255 = ×1), spread ±`amp`. */
function greyMap(size: number, field: (i: number) => number, mean: number, amp: number, repeatPerMetre: number): THREE.Texture {
  return canvasTexture(
    size,
    (d) => {
      for (let i = 0; i < size * size; i++) {
        const v = Math.max(0, Math.min(255, mean + (field(i) - 0.5) * 2 * amp));
        d[i * 4] = v;
        d[i * 4 + 1] = v;
        d[i * 4 + 2] = v;
        d[i * 4 + 3] = 255;
      }
    },
    THREE.SRGBColorSpace,
    repeatPerMetre,
  );
}

// ---------------------------------------------------------------------------
// Floors.
// ---------------------------------------------------------------------------
export { floorKindOf, type FloorKind } from '../../designer/floorKind';
import type { FloorKind } from '../../designer/floorKind';

export interface FloorSurface {
  kind: FloorKind;
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughness: number;
  normalScale: number;
  /** A hint of the room in the surface (rubber and vinyl have a low sheen; screed none). */
  sheen: number;
}

const floorCache = new Map<string, FloorSurface>();

/** The surface for a floor kind and tile size (metres; joints repeat at that size). Cached per kind + size. */
export function floorSurface(kind: FloorKind, tileM = 0.5): FloorSurface {
  const key = `${kind}:${tileM}`;
  const hit = floorCache.get(key);
  if (hit) return hit;
  const N = 256;
  const repeat = 1 / Math.max(0.25, tileM); // one texture tile = one floor tile
  let surface: FloorSurface;
  const joint = (x: number, y: number, widthTexels: number) => x < widthTexels || y < widthTexels; // a joint along the tile's top/left edges
  switch (kind) {
    case 'rubber-tile': {
      const grit = noiseField(N, 21, 0);
      const speck = noiseField(N, 22, 1);
      surface = {
        kind,
        map: greyMap(N, (i) => (joint(i % N, Math.floor(i / N), 3) ? 0.2 : 0.5 + (grit[i] - 0.5) * 0.9 + (speck[i] - 0.5) * 0.4), 250, 22, repeat),
        normalMap: normalFromHeight(N, grit.map((v, i) => (joint(i % N, Math.floor(i / N), 3) ? 0 : 0.2 + v * 0.15)), 2.2, repeat),
        roughness: 0.92,
        normalScale: 0.45,
        sheen: 0.06,
      };
      break;
    }
    case 'interlock': {
      const grit = noiseField(N, 31, 0);
      // Interlock tiles: a puzzle edge every tile, drawn as a scalloped joint.
      surface = {
        kind,
        map: greyMap(N, (i) => {
          const x = i % N;
          const y = Math.floor(i / N);
          const edge = x < 3 || y < 3 || (x < 24 && Math.abs(((y + 32) % 64) - 32) < 6 && x > 12) || (y < 24 && Math.abs(((x + 32) % 64) - 32) < 6 && y > 12);
          return edge ? 0.25 : 0.5 + (grit[i] - 0.5) * 0.8;
        }, 250, 20, repeat),
        normalMap: normalFromHeight(N, grit.map((v, i) => (joint(i % N, Math.floor(i / N), 3) ? 0 : 0.2 + v * 0.12)), 2, repeat),
        roughness: 0.9,
        normalScale: 0.4,
        sheen: 0.06,
      };
      break;
    }
    case 'eva-mat': {
      // EVA foam: a fine embossed diamond and a soft joint per mat.
      const emboss = new Float32Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) emboss[y * N + x] = ((x % 8) + (y % 8) < 8 ? 1 : 0) * 0.5 + 0.25;
      const soft = noiseField(N, 41, 3);
      surface = {
        kind,
        map: greyMap(N, (i) => (joint(i % N, Math.floor(i / N), 2) ? 0.3 : 0.5 + (soft[i] - 0.5) * 0.3 + (emboss[i] - 0.5) * 0.15), 252, 14, repeat),
        normalMap: normalFromHeight(N, emboss.map((v, i) => v * 0.25 + soft[i] * 0.05), 1.6, repeat),
        roughness: 0.98,
        normalScale: 0.35,
        sheen: 0,
      };
      break;
    }
    case 'vinyl-mat': {
      const fine = noiseField(N, 51, 1);
      surface = {
        kind,
        map: greyMap(N, (i) => 0.5 + (fine[i] - 0.5) * 0.35, 252, 10, repeat),
        normalMap: normalFromHeight(N, fine.map((v) => v * 0.08), 1.2, repeat),
        roughness: 0.7,
        normalScale: 0.2,
        sheen: 0.14,
      };
      break;
    }
    case 'epdm-roll': {
      const grit = noiseField(N, 61, 0);
      const fleck = noiseField(N, 62, 0);
      surface = {
        kind,
        map: greyMap(N, (i) => 0.5 + (grit[i] - 0.5) * 0.7 + (fleck[i] > 0.93 ? 0.35 : 0), 250, 20, repeat),
        normalMap: normalFromHeight(N, grit.map((v) => v * 0.18), 2.4, repeat),
        roughness: 0.94,
        normalScale: 0.5,
        sheen: 0.04,
      };
      break;
    }
    case 'wood': {
      // Planks: 14 cm boards along x, a grain along the board, staggered ends.
      const grain = noiseField(N, 71, 2);
      const fine = noiseField(N, 72, 0);
      const boards = 7; // per texture tile
      const field = new Float32Array(N * N);
      for (let y = 0; y < N; y++) {
        const b = Math.floor((y * boards) / N);
        const tone = mulberry32(b + 3)() * 0.5;
        for (let x = 0; x < N; x++) {
          const i = y * N + x;
          const jointY = y * boards - b * N < boards * 1.2;
          const endX = (x + b * 61) % N < 2;
          field[i] = jointY || endX ? 0.12 : 0.35 + tone * 0.4 + (grain[(y * 3) % N * N + x] - 0.5) * 0.25 + (fine[i] - 0.5) * 0.08;
        }
      }
      surface = {
        kind,
        map: greyMap(N, (i) => field[i], 248, 26, repeat),
        normalMap: normalFromHeight(N, field.map((v) => v * 0.2), 1.5, repeat),
        roughness: 0.62,
        normalScale: 0.3,
        sheen: 0.18,
      };
      break;
    }
    case 'ceramic': {
      const fine = noiseField(N, 81, 3);
      surface = {
        kind,
        map: greyMap(N, (i) => (joint(i % N, Math.floor(i / N), 4) ? 0.15 : 0.5 + (fine[i] - 0.5) * 0.2), 252, 16, repeat),
        normalMap: normalFromHeight(N, fine.map((v, i) => (joint(i % N, Math.floor(i / N), 4) ? 0 : 0.25 + v * 0.02)), 1.5, repeat),
        roughness: 0.32,
        normalScale: 0.25,
        sheen: 0.35,
      };
      break;
    }
    case 'screed':
    default: {
      // Bare screed: cement grit, faint trowel sweeps, no joints.
      const trowel = noiseField(N, 91, 4);
      const grit = noiseField(N, 92, 0);
      surface = {
        kind: 'screed',
        map: greyMap(N, (i) => 0.5 + (trowel[i] - 0.5) * 0.5 + (grit[i] - 0.5) * 0.3, 250, 14, 1),
        normalMap: normalFromHeight(N, trowel.map((v, i) => v * 0.1 + grit[i] * 0.03), 1.4, 1),
        roughness: 0.96,
        normalScale: 0.3,
        sheen: 0,
      };
      break;
    }
  }
  floorCache.set(key, surface);
  return surface;
}

// ---------------------------------------------------------------------------
// Sky + ground.
// ---------------------------------------------------------------------------
/**
 * A vertical sky gradient as a texture for a big inside-out sphere: zenith
 * → horizon → below. Colours are sRGB hexes; `t` blends day (1) to night (0).
 */
export function skyTexture(day: number): THREE.Texture {
  const made = makeCanvas(4, 256);
  if (!made) return new THREE.Texture();
  const { canvas: c, ctx } = made;
  const mix = (a: [number, number, number], b: [number, number, number], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  const dayZenith: [number, number, number] = [0xc9, 0xdc, 0xee];
  const dayHorizon: [number, number, number] = [0xf1, 0xed, 0xe4];
  const nightZenith: [number, number, number] = [0x10, 0x16, 0x24];
  const nightHorizon: [number, number, number] = [0x3a, 0x3c, 0x4e];
  const zenith = mix(nightZenith, dayZenith, day);
  const horizon = mix(nightHorizon, dayHorizon, day);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, zenith);
  grad.addColorStop(0.62, horizon);
  grad.addColorStop(0.64, mix([0x3a, 0x3c, 0x4e], [0xdc, 0xd7, 0xcd], day));
  grad.addColorStop(1, mix([0x1c, 0x1c, 0x22], [0xcf, 0xca, 0xc0], day));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** The ground plane's albedo: a soft radial fall-off so the plot sits on something, not on a flat card. */
export function groundTexture(): THREE.Texture {
  const N = 512;
  const made = makeCanvas(N, N);
  if (!made) return new THREE.Texture();
  const { canvas: c, ctx } = made;
  // The plane is 600 m across, so the stops sit close to the centre: full
  // brightness for ~25 m around the plot, then a slow fall to the horizon.
  const g = ctx.createRadialGradient(N / 2, N / 2, N * 0.02, N / 2, N / 2, N * 0.5);
  g.addColorStop(0, 'rgb(255,255,255)');
  g.addColorStop(0.08, 'rgb(250,250,250)');
  g.addColorStop(0.22, 'rgb(228,228,228)');
  g.addColorStop(0.5, 'rgb(212,212,212)');
  g.addColorStop(1, 'rgb(200,200,200)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** A radial soft shadow (alpha) for contact shadows under bodies and the corner darkening along walls. */
let softShadowCache: THREE.Texture | null = null;
export function softShadowTexture(): THREE.Texture {
  if (softShadowCache) return softShadowCache;
  const N = 128;
  const made = makeCanvas(N, N);
  if (!made) return new THREE.Texture();
  const { canvas: c, ctx } = made;
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  softShadowCache = t;
  return t;
}

/** A one-directional gradient (alpha 1 at the top edge → 0 at the bottom) for the wall-to-floor corner darkening. */
let cornerCache: THREE.Texture | null = null;
export function cornerShadeTexture(): THREE.Texture {
  if (cornerCache) return cornerCache;
  const N = 64;
  const made = makeCanvas(4, N);
  if (!made) return new THREE.Texture();
  const { canvas: c, ctx } = made;
  const g = ctx.createLinearGradient(0, 0, 0, N);
  g.addColorStop(0, 'rgba(0,0,0,0.0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, N);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  cornerCache = t;
  return t;
}
