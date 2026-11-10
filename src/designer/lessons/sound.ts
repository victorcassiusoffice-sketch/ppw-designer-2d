/**
 * Quiet build sounds, made in code with the Web Audio API: no sound files,
 * nothing downloaded, nothing to license (recorded in docs/lessons/LICENCES.md).
 *
 * Off until the user switches them on with a speaker button; the choice is
 * remembered on the device by the lessons store. The audio context is made
 * on the first sound after that click, so the browser's autoplay rule is met.
 */
export type BuildSound = 'place' | 'snap' | 'remove' | 'paint' | 'undo' | 'tick' | 'done';

type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;
/** Never more than one of the same sound in this window (a drag paints many tiles). */
const lastPlayed = new Map<BuildSound, number>();
const MIN_GAP_MS: Record<BuildSound, number> = {
  place: 60,
  snap: 45,
  remove: 80,
  paint: 140,
  undo: 80,
  tick: 200,
  done: 600,
};

function audio(): AudioContext | null {
  if (context) return context;
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // A fixed seed: the same soft hiss every time.
  let seed = 7;
  for (let i = 0; i < length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  noise = buffer;
  return buffer;
}

/** One enveloped tone. */
function tone(ctx: AudioContext, out: AudioNode, at: number, options: {
  type: OscillatorType; from: number; to?: number; length: number; gain: number;
}): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.from, at);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, at + options.length);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(options.gain, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + options.length);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + options.length + 0.02);
}

/** A short filtered hiss. */
function hiss(ctx: AudioContext, out: AudioNode, at: number, options: {
  from: number; to: number; length: number; gain: number; q?: number;
}): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = options.q ?? 1.2;
  filter.frequency.setValueAtTime(options.from, at);
  filter.frequency.exponentialRampToValueAtTime(options.to, at + options.length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(options.gain, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + options.length);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
  source.stop(at + options.length + 0.02);
}

/** Plays one sound. Returns false when it did not play (no audio, too soon). */
export function playBuildSound(kind: BuildSound): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const last = lastPlayed.get(kind) ?? -Infinity;
  if (now - last < MIN_GAP_MS[kind]) return false;
  const ctx = audio();
  if (!ctx) return false;
  lastPlayed.set(kind, now);
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const at = ctx.currentTime + 0.005;
    switch (kind) {
      case 'place':
        // A soft knock as the object settles.
        tone(ctx, master, at, { type: 'sine', from: 240, to: 110, length: 0.14, gain: 0.16 });
        hiss(ctx, master, at, { from: 900, to: 300, length: 0.07, gain: 0.05, q: 0.8 });
        break;
      case 'snap':
        tone(ctx, master, at, { type: 'triangle', from: 1320, to: 1180, length: 0.035, gain: 0.07 });
        break;
      case 'remove':
        hiss(ctx, master, at, { from: 1400, to: 220, length: 0.2, gain: 0.08 });
        tone(ctx, master, at + 0.05, { type: 'sine', from: 160, to: 70, length: 0.16, gain: 0.1 });
        break;
      case 'paint':
        hiss(ctx, master, at, { from: 2400, to: 1200, length: 0.16, gain: 0.05, q: 0.7 });
        break;
      case 'undo':
        tone(ctx, master, at, { type: 'sine', from: 660, length: 0.07, gain: 0.07 });
        tone(ctx, master, at + 0.075, { type: 'sine', from: 440, length: 0.09, gain: 0.07 });
        break;
      case 'tick':
        tone(ctx, master, at, { type: 'sine', from: 660, length: 0.09, gain: 0.08 });
        tone(ctx, master, at + 0.09, { type: 'sine', from: 990, length: 0.16, gain: 0.08 });
        break;
      case 'done':
        tone(ctx, master, at, { type: 'sine', from: 523, length: 0.12, gain: 0.08 });
        tone(ctx, master, at + 0.11, { type: 'sine', from: 659, length: 0.12, gain: 0.08 });
        tone(ctx, master, at + 0.22, { type: 'sine', from: 784, length: 0.28, gain: 0.09 });
        break;
    }
    return true;
  } catch {
    return false;
  }
}

/** Unlock audio inside the click that switched sounds on (Safari needs the gesture). */
export function primeBuildSounds(): void {
  const ctx = audio();
  if (ctx?.state === 'suspended') void ctx.resume();
}
