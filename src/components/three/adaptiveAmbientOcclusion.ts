/** Measures completed AO frames, never CPU-count guesses or idle RAF callbacks. */
export type AutoAoMode = 'probing' | 'enabled' | 'disabled';
export interface AutoAoState {
  mode: AutoAoMode;
  warmup: number;
  warmupUntil: number | null;
  start: number | null;
  last: number | null;
  intervals: number;
  fps: number | null;
}
export const AUTO_AO_MIN_FPS = 45;
export function createAutoAoState(): AutoAoState {
  return { mode:'probing', warmup:8, warmupUntil:null, start:null, last:null, intervals:0, fps:null };
}
/** Initial trial renders continuously. Later windows observe real active frames;
 * an idle pause starts a fresh window instead of being counted as a slow GPU. */
export function sampleAutoAo(state: AutoAoState, now: number): AutoAoState {
  if (state.mode === 'disabled' || !Number.isFinite(now)) return state;
  const warmupUntil=state.warmupUntil??now+1500;
  if (state.warmup > 0 || now < warmupUntil) return { ...state, warmup:Math.max(0,state.warmup-1), warmupUntil, last:now };
  if (state.start === null || (state.mode === 'enabled' && state.last !== null && now-state.last > 250)) {
    return { ...state, start:now, last:now, intervals:0 };
  }
  const intervals = state.intervals+1;
  const elapsed = now-state.start;
  if (elapsed < 1500) return { ...state, last:now, intervals };
  const fps = intervals*1000/elapsed;
  return { ...state, mode:fps+1e-9 >= AUTO_AO_MIN_FPS ? 'enabled' : 'disabled', fps,
    start:now, last:now, intervals:0 };
}
