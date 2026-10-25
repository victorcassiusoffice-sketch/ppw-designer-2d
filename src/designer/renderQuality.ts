/** Viewing quality only. No geometry, material quantities or camera values. */
export const RENDER_QUALITY_CHOICES = ['auto', 'low', 'medium', 'high'] as const;
export type RenderQualityChoice = typeof RENDER_QUALITY_CHOICES[number];
export type RenderQualityLevel = Exclude<RenderQualityChoice, 'auto'>;
export interface RenderDeviceHints {
  width: number;
  pixelRatio: number;
  coarsePointer?: boolean;
  memoryGb?: number;
  logicalCores?: number;
}
export interface RenderQualityProfile {
  level: RenderQualityLevel;
  phone: boolean;
  pixelRatio: number;
  shadowSize: 1024 | 2048;
  ambientOcclusion: boolean;
  anisotropy: number;
}
export function normaliseRenderQuality(value: unknown): RenderQualityChoice {
  return RENDER_QUALITY_CHOICES.includes(value as RenderQualityChoice) ? value as RenderQualityChoice : 'auto';
}
export function renderQualityProfile(choice: RenderQualityChoice, device: RenderDeviceHints): RenderQualityProfile {
  const width = Number.isFinite(device.width) ? Math.max(1, device.width) : 390;
  const phone = width < 600 || (device.coarsePointer === true && width < 1024);
  const limited = (device.memoryGb !== undefined && device.memoryGb > 0 && device.memoryGb <= 2)
    || (device.logicalCores !== undefined && device.logicalCores > 0 && device.logicalCores <= 2);
  // GPU capability cannot be inferred from CPU core count. Auto starts with
  // bounded buffers; ThreeStage separately measures whether desktop AO can
  // sustain 45 FPS. High is explicit, and phones never run an AO pass.
  const level = choice === 'auto' ? limited ? 'low' : 'medium' : choice;
  const density = Number.isFinite(device.pixelRatio) ? Math.max(1, device.pixelRatio) : 1;
  return {
    level, phone,
    pixelRatio: Math.min(level === 'low' ? 1 : level === 'medium' ? 1.5 : 2, density),
    shadowSize: phone || level === 'low' ? 1024 : 2048,
    ambientOcclusion: level === 'high' && !phone,
    anisotropy: level === 'high' ? 8 : level === 'medium' ? 4 : 2,
  };
}
export function browserRenderDevice(width: number): RenderDeviceHints {
  const nav = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number };
  return { width, pixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
    coarsePointer: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
    memoryGb: nav?.deviceMemory, logicalCores: nav?.hardwareConcurrency };
}
