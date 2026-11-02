/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { createTapActivator, ownTouchSequences, type TapPointerLike } from '../touchInput';

const touch = (pointerId: number, x: number, y: number, isPrimary = true): TapPointerLike =>
  ({ pointerType: 'touch', pointerId, isPrimary, clientX: x, clientY: y });
const mouse = (pointerId: number, x: number, y: number): TapPointerLike =>
  ({ pointerType: 'mouse', pointerId, isPrimary: true, clientX: x, clientY: y });

describe('ownTouchSequences', () => {
  it('cancels touchstart and touchmove defaults on the element until released, through a non-passive listener', () => {
    const element = document.createElement('div');
    const release = ownTouchSequences(element);
    for (const type of ['touchstart', 'touchmove']) {
      const event = new Event(type, { cancelable: true, bubbles: true });
      element.dispatchEvent(event);
      expect(event.defaultPrevented, type).toBe(true);
    }
    const uncancelable = new Event('touchstart', { cancelable: false, bubbles: true });
    element.dispatchEvent(uncancelable);
    expect(uncancelable.defaultPrevented).toBe(false);
    const touchend = new Event('touchend', { cancelable: true, bubbles: true });
    element.dispatchEvent(touchend);
    expect(touchend.defaultPrevented).toBe(false);
    release();
    const after = new Event('touchstart', { cancelable: true, bubbles: true });
    element.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});

describe('createTapActivator', () => {
  it('activates once on a completed primary touch tap and ignores the browser click that follows it', () => {
    let clock = 1000;
    const activate = vi.fn();
    const tap = createTapActivator(activate, () => clock);
    tap.pointerDown(touch(7, 100, 200));
    tap.pointerUp(touch(7, 104, 203));
    expect(activate).toHaveBeenCalledOnce();
    clock += 40; tap.click();
    expect(activate).toHaveBeenCalledOnce();
    clock += 700; tap.click();
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it('activates on click for mouse and keyboard without a touch contact', () => {
    const activate = vi.fn();
    const tap = createTapActivator(activate, () => 5000);
    tap.pointerDown(mouse(1, 10, 10)); tap.pointerUp(mouse(1, 10, 10));
    expect(activate).not.toHaveBeenCalled();
    tap.click();
    expect(activate).toHaveBeenCalledOnce();
  });

  it('does not activate when the contact moves beyond the tap slop, is cancelled, is secondary or lifts as another pointer', () => {
    const activate = vi.fn();
    const tap = createTapActivator(activate, () => 0);
    tap.pointerDown(touch(2, 50, 50)); tap.pointerUp(touch(2, 50, 80));
    tap.pointerDown(touch(3, 50, 50)); tap.pointerCancel(touch(3, 50, 50)); tap.pointerUp(touch(3, 50, 50));
    tap.pointerDown(touch(4, 50, 50, false)); tap.pointerUp(touch(4, 50, 50, false));
    tap.pointerDown(touch(5, 50, 50)); tap.pointerUp(touch(6, 50, 50));
    expect(activate).not.toHaveBeenCalled();
    tap.pointerUp(touch(5, 50, 50));
    expect(activate).toHaveBeenCalledOnce();
  });

  it('lets a later click activate again after the touch window closes', () => {
    let clock = 0;
    const activate = vi.fn();
    const tap = createTapActivator(activate, () => clock);
    tap.pointerDown(touch(1, 0, 0)); tap.pointerUp(touch(1, 0, 0));
    clock = 699; tap.click();
    clock = 701; tap.click();
    expect(activate).toHaveBeenCalledTimes(2);
  });
});
