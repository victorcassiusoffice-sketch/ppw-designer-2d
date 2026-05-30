/**
 * @vitest-environment jsdom
 *
 * haptics — guarded Web Vibration wrapper (PARITY-MATRIX M15).
 * Verifies: fires a pattern when navigator.vibrate exists, no-ops + never
 * throws when it's absent (iOS Safari / desktop), and swallows a throwing
 * vibrate (some embedded webviews).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { haptic, hapticsAvailable } from '../haptics';

afterEach(() => {
  // Remove any stubbed vibrate so cases don't leak.
  // @ts-expect-error — deleting an optional DOM method for test isolation.
  delete navigator.vibrate;
  vi.restoreAllMocks();
});

describe('haptics', () => {
  it('calls navigator.vibrate with a pattern when available', () => {
    const spy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true });
    haptic('place');
    expect(spy).toHaveBeenCalledTimes(1);
    // place is a single positive duration.
    expect(spy.mock.calls[0][0]).toBeTypeOf('number');
  });

  it('uses a multi-pulse pattern for invalid (error buzz)', () => {
    const spy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true });
    haptic('invalid');
    expect(Array.isArray(spy.mock.calls[0][0])).toBe(true);
  });

  it('no-ops + does not throw when navigator.vibrate is absent', () => {
    expect(hapticsAvailable()).toBe(false);
    expect(() => haptic('snap')).not.toThrow();
  });

  it('swallows a throwing vibrate', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('not a user gesture');
      },
      configurable: true,
    });
    expect(() => haptic('rotate')).not.toThrow();
  });
});
