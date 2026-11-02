export type FrameMeasurementEnd = 'deadline' | 'disposed' | 'record-limit';
export interface FrameMeasurementResult {
  startedAt: number;
  deadlineAt: number;
  finishedAt: number;
  requestedMs: number;
  observedMs: number;
  activeMs: number;
  pausedMs: number;
  completedFrames: number;
  completedFramesPerActiveSecond: number;
  low1CompletedIntervalFps: number | null;
  reason: FrameMeasurementEnd;
  intervals: { startAt: number; completedAt: number; durationMs: number; start: 'armed' | 'resumed' | 'frame' }[];
  unrenderedActiveTails: { startAt: number; endAt: number; durationMs: number }[];
  pauses: { startAt: number; endAt: number; reason: string }[];
  transitions: { at: number; active: boolean; reason: string }[];
}

/** Opt-in fixed wall-time window. Never filters slow frames or waits for a nicer sample. */
export class WalkFrameMeasurement {
  readonly deadlineAt: number;
  private finished = false;
  private active: boolean;
  private segmentAt: number;
  private previousAt: number;
  private intervalStart: 'armed' | 'resumed' | 'frame' = 'armed';
  private pauseReason = 'armed while paused';
  private activeMs = 0;
  private intervals: FrameMeasurementResult['intervals'] = [];
  private tails: FrameMeasurementResult['unrenderedActiveTails'] = [];
  private pauses: FrameMeasurementResult['pauses'] = [];
  private transitions: FrameMeasurementResult['transitions'] = [];

  constructor(readonly startedAt: number, readonly requestedMs: number, active: boolean) {
    this.deadlineAt = startedAt + requestedMs;
    this.segmentAt = this.previousAt = startedAt;
    this.active = active;
    this.transitions.push({ at: startedAt, active, reason: 'armed' });
  }

  transition(at: number, active: boolean, reason: string): FrameMeasurementResult | null {
    if (this.finished) return null;
    if (at >= this.deadlineAt) return this.finish(at, 'deadline');
    if (this.transitions.length >= 2048) return this.finish(at, 'record-limit');
    at = Math.max(this.segmentAt, at);
    this.transitions.push({ at, active, reason });
    if (active === this.active) return null;
    this.closeSegment(at);
    this.active = active;
    this.segmentAt = this.previousAt = at;
    this.intervalStart = 'resumed';
    if (!active) this.pauseReason = reason;
    return null;
  }

  rendered(at: number): FrameMeasurementResult | null {
    if (this.finished) return null;
    // A completion after the deadline does not extend the sample. Its active
    // wait remains an explicit unfinished tail and in the FPS denominator.
    if (at > this.deadlineAt) return this.finish(at, 'deadline');
    if (this.active) {
      if (this.intervals.length >= 36000) return this.finish(at, 'record-limit');
      this.intervals.push({ startAt: this.previousAt, completedAt: at,
        durationMs: Math.max(0, at - this.previousAt), start: this.intervalStart });
      this.previousAt = at;
      this.intervalStart = 'frame';
    }
    return at >= this.deadlineAt ? this.finish(at, 'deadline') : null;
  }

  private closeSegment(at: number): void {
    if (this.active) {
      this.activeMs += at - this.segmentAt;
      if (at > this.previousAt) this.tails.push({ startAt: this.previousAt, endAt: at, durationMs: at - this.previousAt });
    } else if (at > this.segmentAt) this.pauses.push({ startAt: this.segmentAt, endAt: at, reason: this.pauseReason });
  }

  finish(at: number, reason: FrameMeasurementEnd): FrameMeasurementResult | null {
    if (this.finished) return null;
    this.finished = true;
    const finishedAt = Math.max(this.startedAt, Math.min(at, this.deadlineAt));
    this.closeSegment(finishedAt);
    const completeIntervals = this.intervals.filter(i => i.start === 'frame').map(i => i.durationMs);
    const slow = [...completeIntervals].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(completeIntervals.length * .01)));
    const sum = slow.reduce((a, b) => a + b, 0);
    return { startedAt: this.startedAt, deadlineAt: this.deadlineAt, finishedAt,
      requestedMs: this.requestedMs, observedMs: finishedAt - this.startedAt,
      activeMs: this.activeMs, pausedMs: finishedAt - this.startedAt - this.activeMs,
      completedFrames: this.intervals.length,
      completedFramesPerActiveSecond: this.activeMs > 0 ? this.intervals.length * 1000 / this.activeMs : 0,
      low1CompletedIntervalFps: sum > 0 ? slow.length * 1000 / sum : null,
      reason, intervals: this.intervals, unrenderedActiveTails: this.tails, pauses: this.pauses, transitions: this.transitions };
  }
}
